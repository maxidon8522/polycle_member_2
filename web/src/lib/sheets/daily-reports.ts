import { addDays, formatISO, parseISO } from "date-fns";
import { DailyReport, DailyReportSource } from "@/types";
import { DEFAULT_TIMEZONE } from "@/config/constants";
import { env } from "@/config/env";
import { retryWithBackoff } from "@/lib/retry";
import { getWeekStart, getWeekdayCode } from "@/lib/time";
import { getSheetsClient } from "./google";

const DAILY_REPORT_RESERVED_COLUMNS = 7; // O〜U

const safeString = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value);

const normalizeSlug = (slug: string) => slug.trim().toLowerCase();

const extractErrorMessage = (error: unknown): string => {
  if (!error) return "";
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return String(error);
};

const isRangeParseError = (message: string): boolean => {
  return message.includes("Unable to parse range");
};

const DAILY_REPORT_SHEET_NAME = "daily_reports";
const DAILY_REPORT_VALUE_RANGE = `'${DAILY_REPORT_SHEET_NAME}'!A:U`;
const DAILY_REPORT_CACHE_TTL_MS = 15_000;

let dailyReportValuesCache: { timestamp: number; values: string[][] } | null =
  null;

const getCachedDailyReportValues = (): string[][] | null => {
  if (!dailyReportValuesCache) {
    return null;
  }
  const age = Date.now() - dailyReportValuesCache.timestamp;
  if (age > DAILY_REPORT_CACHE_TTL_MS) {
    dailyReportValuesCache = null;
    return null;
  }
  return dailyReportValuesCache.values;
};

const setCachedDailyReportValues = (values: string[][]) => {
  dailyReportValuesCache = { timestamp: Date.now(), values };
};

const invalidateDailyReportCache = () => {
  dailyReportValuesCache = null;
};

const humanizeSlug = (slug: string): string => {
  const segments = slug
    .split(/[-_]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (segments.length === 0) {
    return slug;
  }
  return segments
    .map(
      (part) => part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");
};

const pickFirstNonEmpty = (...values: (string | undefined)[]): string => {
  for (const value of values) {
    if (value && value.trim().length > 0) {
      return value;
    }
  }
  return "";
};

const splitSheetValues = (values: string[][]) => {
  if (values.length === 0) {
    return { header: [] as string[], rows: [] as string[][] };
  }

  const [header, ...rows] = values;
  return {
    header: header ?? [],
    rows,
  };
};

const toDailyReportRow = (report: DailyReport): (string | number)[] => {
  const base = [
    report.date,
    report.satisfactionToday ?? "",
    report.doneToday ?? "",
    report.goodMoreBackground ?? "",
    report.moreNext ?? "",
    report.todoTomorrow ?? "",
    report.wishTomorrow ?? "",
    report.personalNews ?? "",
    (report.tags ?? []).map((tag) => tag.trim()).filter(Boolean).join(" "),
    report.source ?? "manual",
    report.slackTs ?? "",
    report.createdAt ?? "",
    report.updatedAt ?? "",
    report.userSlug ?? "",
  ];

  const reserved = Array.from(
    { length: DAILY_REPORT_RESERVED_COLUMNS },
    () => "",
  );

  return [...base, ...reserved];
};

const mapRowToDailyReport = (
  row: string[],
  fallbackSlug = "",
): DailyReport | null => {
  const date = safeString(row[0]);
  if (!date) {
    return null;
  }

  const slugCell = safeString(row[13]);
  const rawSlug = slugCell || fallbackSlug;
  const slug = normalizeSlug(rawSlug);
  if (!slug) {
    return null;
  }

  const tagsCell = safeString(row[8]);
  const tags = tagsCell
    ? tagsCell
        .split(/\s+/)
        .map((tag) => tag.replace(/^#/, "").trim())
        .filter(Boolean)
    : [];

  const sourceCell = safeString(row[9]) as DailyReportSource;
  const source: DailyReportSource =
    sourceCell === "slack_ingest" ? "slack_ingest" : "manual";

  const displayNameCell = safeString(row[14]);
  const resolvedUserName =
    pickFirstNonEmpty(
      displayNameCell,
      slugCell,
      fallbackSlug,
      humanizeSlug(slug),
      slug,
    ) || slug;

  return {
    reportId: `dr_${slug}_${date}`,
    date,
    weekday: getWeekdayCode(date),
    userSlug: slug,
    userName: resolvedUserName,
    email: "",
    slackUserId: "",
    slackTeamId: "",
    channelId: "",
    satisfactionToday: safeString(row[1]),
    doneToday: safeString(row[2]),
    goodMoreBackground: safeString(row[3]),
    moreNext: safeString(row[4]),
    todoTomorrow: safeString(row[5]),
    wishTomorrow: safeString(row[6]),
    personalNews: safeString(row[7]),
    tags,
    source,
    slackTs: safeString(row[10]) || undefined,
    createdAt: safeString(row[11]),
    updatedAt: safeString(row[12]),
  };
};

interface DailyReportRowMatch {
  sheetRowNumber: number;
  row: string[];
}

const findDailyReportRowMatch = (
  rows: string[][],
  date: string,
  userSlug: string,
): DailyReportRowMatch | null => {
  if (rows.length === 0) {
    return null;
  }

  const targetSlug = normalizeSlug(userSlug);

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const rowDate = safeString(row[0]);
    const rowSlug = safeString(row[13]);

    if (rowDate === date && normalizeSlug(rowSlug || userSlug) === targetSlug) {
      return {
        sheetRowNumber: index + 2,
        row,
      };
    }
  }

  return null;
};

export interface DailyReportQueryOptions {
  userSlug?: string;
  weekStart?: string;
  weekEnd?: string;
  searchTerm?: string;
  tags?: string[];
}

const readDailyReportValues = async (): Promise<string[][]> => {
  const spreadsheetId = env.server.SHEETS_DR_SPREADSHEET_ID;
  const sheets = await getSheetsClient();
  const cached = getCachedDailyReportValues();
  if (cached) {
    return cached;
  }

  try {
    const values = await retryWithBackoff<string[][] | null>(async (attempt) => {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: DAILY_REPORT_VALUE_RANGE,
          valueRenderOption: "UNFORMATTED_VALUE",
        });
        return response.data.values ?? [];
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        if (isRangeParseError(errorMessage)) {
          if (attempt === 0) {
            console.warn("sheets.daily_reports.read.missing_sheet", {
              spreadsheetId,
              range: DAILY_REPORT_VALUE_RANGE,
            });
          }
          return null;
        }
        console.error("sheets.daily_reports.read.error", {
          attempt,
          spreadsheetId,
          range: DAILY_REPORT_VALUE_RANGE,
          error: errorMessage,
        });
        throw error;
      }
    });

    if (values === null) {
      return [];
    }

    setCachedDailyReportValues(values);
    return values;
  } catch (error) {
    const errorMessage = extractErrorMessage(error);
    console.warn("sheets.daily_reports.read.failed", {
      range: DAILY_REPORT_VALUE_RANGE,
      error: errorMessage,
    });
    return [];
  }
};

export const findRowIndexByDateAndSlug = async (
  dateISO: string,
  userSlug: string,
): Promise<number | null> => {
  const values = await readDailyReportValues();
  const { rows } = splitSheetValues(values);
  const match = findDailyReportRowMatch(rows, dateISO, userSlug);
  return match ? match.sheetRowNumber : null;
};

export const getSlackTimestampForReport = async (
  userSlug: string,
  date: string,
): Promise<string | null> => {
  const values = await readDailyReportValues();
  const { rows } = splitSheetValues(values);
  const match = findDailyReportRowMatch(rows, date, userSlug);
  if (!match) {
    return null;
  }
  const cell = safeString(match.row[10]);
  return cell || null;
};

export const setSlackTsOnSheet = async (
  userSlug: string,
  date: string,
  slackTs: string,
): Promise<void> => {
  const spreadsheetId = env.server.SHEETS_DR_SPREADSHEET_ID;
  const sheets = await getSheetsClient();
  const rowIndex = await findRowIndexByDateAndSlug(date, userSlug);

  if (!rowIndex) {
    console.warn("sheets.daily_reports.set_slack_ts.missing_row", {
      userSlug,
      date,
    });
    return;
  }

  const range = `'${DAILY_REPORT_SHEET_NAME}'!K${rowIndex}:K${rowIndex}`;

  await retryWithBackoff(async (attempt) => {
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "RAW",
        requestBody: { values: [[slackTs]] },
      });
      invalidateDailyReportCache();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("sheets.daily_reports.set_slack_ts.error", {
        attempt,
        spreadsheetId,
        range,
        userSlug,
        date,
        error: errorMessage,
      });
      throw error;
    }
  });
};

export const upsertDailyReport = async (
  report: DailyReport,
): Promise<void> => {
  const spreadsheetId = env.server.SHEETS_DR_SPREADSHEET_ID;
  const sheets = await getSheetsClient();

  const values = await readDailyReportValues();
  const { rows } = splitSheetValues(values);
  const match = findDailyReportRowMatch(rows, report.date, report.userSlug);

  const now = new Date().toISOString();
  const existingCreatedAt = match ? safeString(match.row[11]) : "";
  const existingSlackTs = match ? safeString(match.row[10]) : "";

  const normalized: DailyReport = {
    ...report,
    reportId: report.reportId || `dr_${report.userSlug}_${report.date}`,
    weekday: getWeekdayCode(report.date),
    userSlug: normalizeSlug(report.userSlug),
    userName: report.userName || report.userSlug,
    source: report.source ?? "manual",
    tags: report.tags ?? [],
    createdAt: report.createdAt || existingCreatedAt || now,
    updatedAt: report.updatedAt || now,
    slackTs: report.slackTs || existingSlackTs,
  };

  const payload = [toDailyReportRow(normalized)];

  if (match) {
    const range = `'${DAILY_REPORT_SHEET_NAME}'!A${match.sheetRowNumber}:U${match.sheetRowNumber}`;
    await retryWithBackoff(async (attempt) => {
      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: "RAW",
          requestBody: { values: payload },
        });
        invalidateDailyReportCache();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("sheets.daily_reports.update.error", {
          attempt,
          spreadsheetId,
          range,
          reportId: normalized.reportId,
          error: errorMessage,
        });
        throw error;
      }
    });
    return;
  }

  const range = `'${DAILY_REPORT_SHEET_NAME}'!A:U`;
  await retryWithBackoff(async (attempt) => {
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: payload },
      });
      invalidateDailyReportCache();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("sheets.daily_reports.append.error", {
        attempt,
        spreadsheetId,
        range,
        reportId: normalized.reportId,
        error: errorMessage,
      });
      throw error;
    }
  });
};

const toTimestampMs = (value?: string | null): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const pickPreferredReport = (
  existing: DailyReport,
  candidate: DailyReport,
): DailyReport => {
  const existingTimestamp =
    toTimestampMs(existing.updatedAt) ?? toTimestampMs(existing.createdAt);
  const candidateTimestamp =
    toTimestampMs(candidate.updatedAt) ?? toTimestampMs(candidate.createdAt);

  if (candidateTimestamp !== null && existingTimestamp !== null) {
    if (candidateTimestamp > existingTimestamp) {
      return candidate;
    }
    if (candidateTimestamp < existingTimestamp) {
      return existing;
    }
  } else if (candidateTimestamp !== null) {
    return candidate;
  } else if (existingTimestamp !== null) {
    return existing;
  }

  if (candidate.slackTs && !existing.slackTs) {
    return candidate;
  }
  if (!candidate.slackTs && existing.slackTs) {
    return existing;
  }

  return existing;
};

export const fetchDailyReports = async (
  options: DailyReportQueryOptions,
): Promise<DailyReport[]> => {
  const weekStart =
    options.weekStart ??
    getWeekStart(new Date().toISOString(), DEFAULT_TIMEZONE);
  const weekEnd =
    options.weekEnd ??
    formatISO(addDays(parseISO(weekStart), 6), { representation: "date" });

  const values = await readDailyReportValues();
  const { rows } = splitSheetValues(values);
  const reports = rows
    .map((row) => mapRowToDailyReport(row))
    .filter((report): report is DailyReport => report !== null);

  const deduplicatedReports = Array.from(
    reports.reduce((accumulator, report) => {
      const key = report.reportId?.trim();
      if (!key) {
        return accumulator;
      }

      const existing = accumulator.get(key);
      if (!existing) {
        accumulator.set(key, report);
        return accumulator;
      }

      accumulator.set(key, pickPreferredReport(existing, report));
      return accumulator;
    }, new Map<string, DailyReport>()).values(),
  );

  return deduplicatedReports
    .filter((report) => report.date >= weekStart && report.date <= weekEnd)
    .filter((report) => {
      if (options.userSlug) {
        return normalizeSlug(report.userSlug) === normalizeSlug(options.userSlug);
      }
      return true;
    })
    .filter((report) => {
      if (!options.searchTerm) return true;
      const haystack = [
        report.satisfactionToday,
        report.doneToday,
        report.goodMoreBackground,
        report.moreNext,
        report.todoTomorrow,
        report.wishTomorrow,
        report.personalNews,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(options.searchTerm.toLowerCase());
    })
    .filter((report) => {
      if (!options.tags || options.tags.length === 0) return true;
      const normalizedTags = report.tags.map((tag) => tag.toLowerCase());
      return options.tags.every((tag) =>
        normalizedTags.includes(tag.toLowerCase()),
      );
    });
};
