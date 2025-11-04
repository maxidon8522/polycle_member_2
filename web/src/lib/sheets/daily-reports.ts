import { addDays, formatISO, parseISO } from "date-fns";
import { DailyReport, DailyReportSource } from "@/types";
import { DEFAULT_TIMEZONE } from "@/config/constants";
import { env } from "@/config/env";
import { retryWithBackoff } from "@/lib/retry";
import { getWeekStart, getWeekdayCode } from "@/lib/time";
import { getSheetsClient } from "./google";

const safeString = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value);

const normalizeSlug = (slug: string): string => slug.trim().toLowerCase();

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

const parseTags = (value: string): string[] =>
  value
    .split(/\s+/)
    .map((tag) => tag.replace(/^#/, "").trim())
    .filter(Boolean);

const joinTags = (tags: string[] | undefined): string =>
  (tags ?? []).map((tag) => tag.trim()).filter(Boolean).join(" ");

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
const DAILY_REPORT_COLUMNS = [
  "date",
  "satisfactionToday",
  "doneToday",
  "goodMoreBackground",
  "moreNext",
  "todoTomorrow",
  "wishTomorrow",
  "personalNews",
  "tags",
  "source",
  "slackTs",
  "createdAt",
  "updatedAt",
  "userSlug",
];
const DAILY_REPORT_CACHE_TTL_MS = 15_000;

const columnIndexToLetter = (index: number): string => {
  let n = index + 1;
  let result = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result || "A";
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

const buildHeaderIndex = (header: string[]): Record<string, number> => {
  const index: Record<string, number> = {};
  header.forEach((raw, columnIndex) => {
    const key = safeString(raw).trim().toLowerCase();
    if (!key) {
      return;
    }
    if (!(key in index)) {
      index[key] = columnIndex;
    }
  });
  return index;
};

const getColumnIndex = (
  headerIndex: Record<string, number>,
  columnName: string,
): number | undefined => {
  return headerIndex[columnName.toLowerCase()];
};

const getCell = (
  row: string[],
  headerIndex: Record<string, number>,
  columnName: string,
): string => {
  const columnIndex = getColumnIndex(headerIndex, columnName);
  if (columnIndex === undefined) {
    return "";
  }
  return safeString(row[columnIndex]);
};

interface DailyReportSheetData {
  header: string[];
  headerIndex: Record<string, number>;
  rows: string[][];
}

let dailyReportCache:
  | { timestamp: number; data: DailyReportSheetData }
  | null = null;

const getCachedDailyReportData = (): DailyReportSheetData | null => {
  if (!dailyReportCache) {
    return null;
  }
  const age = Date.now() - dailyReportCache.timestamp;
  if (age > DAILY_REPORT_CACHE_TTL_MS) {
    dailyReportCache = null;
    return null;
  }
  return dailyReportCache.data;
};

const setCachedDailyReportData = (data: DailyReportSheetData) => {
  dailyReportCache = { timestamp: Date.now(), data };
};

const invalidateDailyReportCache = () => {
  dailyReportCache = null;
};

const ensureSheetData = (values: string[][]): DailyReportSheetData => {
  const { header, rows } = splitSheetValues(values);
  const effectiveHeader =
    header.length > 0 ? header : [...DAILY_REPORT_COLUMNS];
  const headerIndex = buildHeaderIndex(effectiveHeader);
  return {
    header: effectiveHeader,
    headerIndex,
    rows,
  };
};

const readDailyReportSheetData = async (): Promise<DailyReportSheetData> => {
  const cached = getCachedDailyReportData();
  if (cached) {
    return cached;
  }

  const spreadsheetId = env.server.SHEETS_DR_SPREADSHEET_ID;
  const sheets = await getSheetsClient();

  try {
    const values = await retryWithBackoff<string[][] | null>(async (attempt) => {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${DAILY_REPORT_SHEET_NAME}'!A:U`,
          valueRenderOption: "UNFORMATTED_VALUE",
        });
        return response.data.values ?? [];
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        if (isRangeParseError(errorMessage)) {
          if (attempt === 0) {
            console.warn("sheets.daily_reports.read.missing_sheet", {
              spreadsheetId,
              sheet: DAILY_REPORT_SHEET_NAME,
            });
          }
          return null;
        }
        console.error("sheets.daily_reports.read.error", {
          attempt,
          spreadsheetId,
          sheet: DAILY_REPORT_SHEET_NAME,
          error: errorMessage,
        });
        throw error;
      }
    });

    const data = ensureSheetData(values ?? []);
    setCachedDailyReportData(data);
    return data;
  } catch (error) {
    const errorMessage = extractErrorMessage(error);
    console.warn("sheets.daily_reports.read.failed", {
      sheet: DAILY_REPORT_SHEET_NAME,
      error: errorMessage,
    });
    const fallback = ensureSheetData([]);
    setCachedDailyReportData(fallback);
    return fallback;
  }
};

const mapRowToDailyReport = (
  row: string[],
  sheetData: DailyReportSheetData,
): DailyReport | null => {
  const { headerIndex } = sheetData;
  const date = getCell(row, headerIndex, "date");
  if (!date) {
    return null;
  }

  const rawSlug = getCell(row, headerIndex, "userSlug");
  const slug = normalizeSlug(rawSlug);
  if (!slug) {
    return null;
  }

  const tagsCell = getCell(row, headerIndex, "tags");
  const sourceCell = getCell(row, headerIndex, "source");

  const resolvedUserName =
    getCell(row, headerIndex, "userName") ||
    getCell(row, headerIndex, "displayName") ||
    rawSlug ||
    humanizeSlug(slug) ||
    slug;

  const source: DailyReportSource =
    sourceCell === "slack_ingest" || sourceCell === "web_form"
      ? (sourceCell as DailyReportSource)
      : "manual";

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
    satisfactionToday: getCell(row, headerIndex, "satisfactionToday"),
    doneToday: getCell(row, headerIndex, "doneToday"),
    goodMoreBackground: getCell(row, headerIndex, "goodMoreBackground"),
    moreNext: getCell(row, headerIndex, "moreNext"),
    todoTomorrow: getCell(row, headerIndex, "todoTomorrow"),
    wishTomorrow: getCell(row, headerIndex, "wishTomorrow"),
    personalNews: getCell(row, headerIndex, "personalNews"),
    tags: parseTags(tagsCell),
    source,
    slackTs: getCell(row, headerIndex, "slackTs") || undefined,
    createdAt: getCell(row, headerIndex, "createdAt"),
    updatedAt: getCell(row, headerIndex, "updatedAt"),
  };
};

interface DailyReportRowMatch {
  sheetRowNumber: number;
  row: string[];
}

const findDailyReportRowMatch = (
  sheetData: DailyReportSheetData,
  date: string,
  userSlug: string,
): DailyReportRowMatch | null => {
  const { rows, headerIndex } = sheetData;
  if (rows.length === 0) {
    return null;
  }

  const dateColumn = getColumnIndex(headerIndex, "date");
  const slugColumn = getColumnIndex(headerIndex, "userSlug");
  if (dateColumn === undefined || slugColumn === undefined) {
    return null;
  }

  const targetSlug = normalizeSlug(userSlug);

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const rowDate = safeString(row[dateColumn]);
    const rowSlug = normalizeSlug(safeString(row[slugColumn]));

    if (!rowDate) {
      continue;
    }

    if (rowDate === date && rowSlug === targetSlug) {
      return {
        sheetRowNumber: index + 2, // 1-based row number accounting for header
        row,
      };
    }
  }

  return null;
};

const buildDailyReportRow = (
  report: DailyReport,
  sheetData: DailyReportSheetData,
): (string | number)[] => {
  const columnCount =
    sheetData.header.length > 0
      ? sheetData.header.length
      : DAILY_REPORT_COLUMNS.length;
  const row = Array.from<string | number>({ length: columnCount }, () => "");
  const assign = (key: string, value: string | number | undefined) => {
    const columnIndex = getColumnIndex(sheetData.headerIndex, key);
    if (columnIndex === undefined) {
      return;
    }
    row[columnIndex] = value ?? "";
  };

  assign("date", report.date);
  assign("satisfactionToday", report.satisfactionToday ?? "");
  assign("doneToday", report.doneToday ?? "");
  assign("goodMoreBackground", report.goodMoreBackground ?? "");
  assign("moreNext", report.moreNext ?? "");
  assign("todoTomorrow", report.todoTomorrow ?? "");
  assign("wishTomorrow", report.wishTomorrow ?? "");
  assign("personalNews", report.personalNews ?? "");
  assign("tags", joinTags(report.tags));
  assign("source", report.source ?? "manual");
  assign("slackTs", report.slackTs ?? "");
  assign("createdAt", report.createdAt ?? "");
  assign("updatedAt", report.updatedAt ?? "");
  assign("userSlug", report.userSlug ?? "");

  return row;
};

const toColumnRange = (
  columnCount: number,
  rowNumber?: number,
): string => {
  const lastColumnLetter = columnIndexToLetter(Math.max(columnCount - 1, 0));
  if (rowNumber && rowNumber > 0) {
    return `'${DAILY_REPORT_SHEET_NAME}'!A${rowNumber}:${lastColumnLetter}${rowNumber}`;
  }
  return `'${DAILY_REPORT_SHEET_NAME}'!A:${lastColumnLetter}`;
};

export interface DailyReportQueryOptions {
  userSlug?: string;
  weekStart?: string;
  weekEnd?: string;
  searchTerm?: string;
  tags?: string[];
}

export const findRowIndexByDateAndSlug = async (
  dateISO: string,
  userSlug: string,
): Promise<number | null> => {
  const sheetData = await readDailyReportSheetData();
  const match = findDailyReportRowMatch(sheetData, dateISO, userSlug);
  return match ? match.sheetRowNumber : null;
};

export const getSlackTimestampForReport = async (
  userSlug: string,
  date: string,
): Promise<string | null> => {
  const sheetData = await readDailyReportSheetData();
  const match = findDailyReportRowMatch(sheetData, date, userSlug);
  if (!match) {
    return null;
  }
  return getCell(match.row, sheetData.headerIndex, "slackTs") || null;
};

export const setSlackTsOnSheet = async (
  userSlug: string,
  date: string,
  slackTs: string,
): Promise<void> => {
  const sheetData = await readDailyReportSheetData();
  const rowIndex = findDailyReportRowMatch(sheetData, date, userSlug);

  if (!rowIndex) {
    console.warn("sheets.daily_reports.set_slack_ts.missing_row", {
      userSlug,
      date,
    });
    return;
  }

  const slackTsColumnIndex = getColumnIndex(sheetData.headerIndex, "slackTs");
  if (slackTsColumnIndex === undefined) {
    console.warn("sheets.daily_reports.set_slack_ts.missing_column", {
      column: "slackTs",
    });
    return;
  }

  const columnLetter = columnIndexToLetter(slackTsColumnIndex);
  const range = `'${DAILY_REPORT_SHEET_NAME}'!${columnLetter}${rowIndex.sheetRowNumber}:${columnLetter}${rowIndex.sheetRowNumber}`;

  const spreadsheetId = env.server.SHEETS_DR_SPREADSHEET_ID;
  const sheets = await getSheetsClient();

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
      const errorMessage = extractErrorMessage(error);
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
  const sheetData = await readDailyReportSheetData();
  const spreadsheetId = env.server.SHEETS_DR_SPREADSHEET_ID;
  const sheets = await getSheetsClient();

  const existingMatch = findDailyReportRowMatch(
    sheetData,
    report.date,
    report.userSlug,
  );

  const now = new Date().toISOString();
  const existingCreatedAt = existingMatch
    ? getCell(existingMatch.row, sheetData.headerIndex, "createdAt")
    : "";
  const existingSlackTs = existingMatch
    ? getCell(existingMatch.row, sheetData.headerIndex, "slackTs")
    : "";

  const normalizedSlug = normalizeSlug(report.userSlug);

  const normalized: DailyReport = {
    ...report,
    reportId: report.reportId || `dr_${normalizedSlug}_${report.date}`,
    weekday: getWeekdayCode(report.date),
    userSlug: normalizedSlug,
    userName: report.userName || humanizeSlug(normalizedSlug),
    source: report.source ?? "manual",
    tags: report.tags ?? [],
    createdAt: report.createdAt || existingCreatedAt || now,
    updatedAt: report.updatedAt || now,
    slackTs: report.slackTs || existingSlackTs,
  };

  const payload = [buildDailyReportRow(normalized, sheetData)];
  const columnCount =
    sheetData.header.length > 0
      ? sheetData.header.length
      : DAILY_REPORT_COLUMNS.length;

  if (existingMatch) {
    const range = toColumnRange(columnCount, existingMatch.sheetRowNumber);
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
        const errorMessage = extractErrorMessage(error);
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

  const range = toColumnRange(columnCount);
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
      const errorMessage = extractErrorMessage(error);
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

  const sheetData = await readDailyReportSheetData();

  const reports = sheetData.rows
    .map((row) => mapRowToDailyReport(row, sheetData))
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
        report.tags.join(" "),
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
