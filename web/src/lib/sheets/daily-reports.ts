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

const compactSlug = (slug: string): string =>
  normalizeSlug(slug).replace(/[^a-z0-9]/g, "");

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

const escapeSheetName = (name: string): string => name.replace(/'/g, "''");

const DAILY_REPORT_COLUMNS = [
  "date",
  "satisfactionToday",
  "doneToday",
  "goodMoreBackground",
  "moreNext",
  "todoTomorrow",
  "wishTomorrow",
  "personalNews",
  "channelId",
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
  title: string;
  header: string[];
  headerIndex: Record<string, number>;
  rows: string[][];
}

interface DailyReportCollection {
  sheets: DailyReportSheetData[];
  slugRegistry: Map<string, string>;
}

let dailyReportCache:
  | { timestamp: number; collection: DailyReportCollection }
  | null = null;

const getCachedCollection = (): DailyReportCollection | null => {
  if (!dailyReportCache) {
    return null;
  }
  const age = Date.now() - dailyReportCache.timestamp;
  if (age > DAILY_REPORT_CACHE_TTL_MS) {
    dailyReportCache = null;
    return null;
  }
  return dailyReportCache.collection;
};

const setCachedCollection = (collection: DailyReportCollection) => {
  dailyReportCache = { timestamp: Date.now(), collection };
};

const invalidateDailyReportCache = () => {
  dailyReportCache = null;
};

const registerSheetTitle = (
  registry: Map<string, string>,
  title: string,
) => {
  const normalized = normalizeSlug(title);
  if (!registry.has(normalized)) {
    registry.set(normalized, title);
  }

  const condensed = compactSlug(title);
  if (condensed && !registry.has(condensed)) {
    registry.set(condensed, title);
  }
};

const resolveSheetTitleForSlug = (
  registry: Map<string, string>,
  slug: string,
): string | null => {
  const normalized = normalizeSlug(slug);
  const condensed = compactSlug(slug);
  if (registry.has(normalized)) {
    return registry.get(normalized) ?? null;
  }
  if (condensed && registry.has(condensed)) {
    return registry.get(condensed) ?? null;
  }
  return null;
};

const buildSheetData = (
  title: string,
  values: string[][],
): DailyReportSheetData => {
  const { header, rows } = splitSheetValues(values);
  const effectiveHeader =
    header.length > 0 ? header : [...DAILY_REPORT_COLUMNS];
  const headerIndex = buildHeaderIndex(effectiveHeader);
  return {
    title,
    header: effectiveHeader,
    headerIndex,
    rows,
  };
};

const loadDailyReportCollection = async (): Promise<DailyReportCollection> => {
  const cached = getCachedCollection();
  if (cached) {
    return cached;
  }

  const spreadsheetId = env.server.SHEETS_DR_SPREADSHEET_ID;
  const sheets = await getSheetsClient();

  const metadata = await retryWithBackoff(() =>
    sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties.title",
    }),
  );

  const sheetTitles = (metadata.data.sheets ?? [])
    .map((sheet) => sheet.properties?.title)
    .filter((title): title is string => typeof title === "string" && title.trim().length > 0);

  const slugRegistry = new Map<string, string>();
  sheetTitles.forEach((title) => registerSheetTitle(slugRegistry, title));

  if (sheetTitles.length === 0) {
    const empty: DailyReportCollection = { sheets: [], slugRegistry };
    setCachedCollection(empty);
    return empty;
  }

  const ranges = sheetTitles.map(
    (title) => `'${escapeSheetName(title)}'!A:N`,
  );

  const response = await retryWithBackoff(() =>
    sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges,
      valueRenderOption: "UNFORMATTED_VALUE",
    }),
  );

  const valueRanges = response.data.valueRanges ?? [];
  const sheetData: DailyReportSheetData[] = sheetTitles.map((title, index) => {
    const values = valueRanges[index]?.values ?? [];
    return buildSheetData(title, values);
  });

  const collection: DailyReportCollection = {
    sheets: sheetData,
    slugRegistry,
  };
  setCachedCollection(collection);
  return collection;
};

const mapRowToDailyReport = (
  sheet: DailyReportSheetData,
  row: string[],
): DailyReport | null => {
  const { headerIndex } = sheet;
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
  const channelIdCell = getCell(row, headerIndex, "channelId");

  const resolvedUserName =
    getCell(row, headerIndex, "userName") ||
    getCell(row, headerIndex, "displayName") ||
    rawSlug ||
    sheet.title ||
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
    channelId: channelIdCell || "",
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

interface DailyReportRowLocator {
  sheet: DailyReportSheetData;
  sheetRowNumber: number;
  row: string[];
}

const locateDailyReportRow = (
  collection: DailyReportCollection,
  date: string,
  userSlug: string,
): DailyReportRowLocator | null => {
  const targetSlug = normalizeSlug(userSlug);
  if (!targetSlug) {
    return null;
  }

  for (const sheet of collection.sheets) {
    const dateColumn = getColumnIndex(sheet.headerIndex, "date");
    const slugColumn = getColumnIndex(sheet.headerIndex, "userSlug");
    if (dateColumn === undefined || slugColumn === undefined) {
      continue;
    }

    for (let index = 0; index < sheet.rows.length; index += 1) {
      const row = sheet.rows[index] ?? [];
      const rowDate = safeString(row[dateColumn]);
      const rowSlug = normalizeSlug(safeString(row[slugColumn]));

      if (!rowDate) {
        continue;
      }

      if (rowDate === date && rowSlug === targetSlug) {
        return {
          sheet,
          sheetRowNumber: index + 2, // account for header row
          row,
        };
      }
    }
  }

  return null;
};

const buildDailyReportRow = (
  report: DailyReport,
  sheet: DailyReportSheetData,
): (string | number)[] => {
  const columnCount =
    sheet.header.length > 0 ? sheet.header.length : DAILY_REPORT_COLUMNS.length;
  const row = Array(columnCount).fill("") as (string | number)[];

  const assign = (key: string, value: string | number | undefined) => {
    const columnIndex = getColumnIndex(sheet.headerIndex, key);
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
  assign("channelId", report.channelId ?? "");
  assign("tags", joinTags(report.tags));
  assign("source", report.source ?? "manual");
  assign("slackTs", report.slackTs ?? "");
  assign("createdAt", report.createdAt ?? "");
  assign("updatedAt", report.updatedAt ?? "");
  assign("userSlug", report.userSlug ?? "");

  return row;
};

const toColumnRange = (
  sheet: DailyReportSheetData,
  rowNumber?: number,
): string => {
  const columnCount =
    sheet.header.length > 0 ? sheet.header.length : DAILY_REPORT_COLUMNS.length;
  const lastColumnLetter = columnIndexToLetter(Math.max(columnCount - 1, 0));
  const escapedTitle = escapeSheetName(sheet.title);

  if (rowNumber && rowNumber > 0) {
    return `'${escapedTitle}'!A${rowNumber}:${lastColumnLetter}${rowNumber}`;
  }

  return `'${escapedTitle}'!A:${lastColumnLetter}`;
};

export interface DailyReportQueryOptions {
  userSlug?: string;
  weekStart?: string;
  weekEnd?: string;
  searchTerm?: string;
  tags?: string[];
  channelId?: string;
}

export const findRowIndexByDateAndSlug = async (
  dateISO: string,
  userSlug: string,
): Promise<number | null> => {
  const collection = await loadDailyReportCollection();
  const locator = locateDailyReportRow(collection, dateISO, userSlug);
  return locator ? locator.sheetRowNumber : null;
};

export const getSlackTimestampForReport = async (
  userSlug: string,
  date: string,
): Promise<string | null> => {
  const collection = await loadDailyReportCollection();
  const locator = locateDailyReportRow(collection, date, userSlug);
  if (!locator) {
    return null;
  }
  return getCell(locator.row, locator.sheet.headerIndex, "slackTs") || null;
};

export const setSlackTsOnSheet = async (
  userSlug: string,
  date: string,
  slackTs: string,
): Promise<void> => {
  const collection = await loadDailyReportCollection();
  const locator = locateDailyReportRow(collection, date, userSlug);

  if (!locator) {
    console.warn("sheets.daily_reports.set_slack_ts.missing_row", {
      userSlug,
      date,
    });
    return;
  }

  const slackTsColumnIndex = getColumnIndex(
    locator.sheet.headerIndex,
    "slackTs",
  );
  if (slackTsColumnIndex === undefined) {
    console.warn("sheets.daily_reports.set_slack_ts.missing_column", {
      column: "slackTs",
      sheet: locator.sheet.title,
    });
    return;
  }

  const columnLetter = columnIndexToLetter(slackTsColumnIndex);
  const escapedTitle = escapeSheetName(locator.sheet.title);
  const range = `'${escapedTitle}'!${columnLetter}${locator.sheetRowNumber}:${columnLetter}${locator.sheetRowNumber}`;

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
  const collection = await loadDailyReportCollection();
  const spreadsheetId = env.server.SHEETS_DR_SPREADSHEET_ID;
  const sheetsClient = await getSheetsClient();

  const normalizedSlug = normalizeSlug(report.userSlug);
  const existingLocator = locateDailyReportRow(
    collection,
    report.date,
    normalizedSlug,
  );

  const targetSheetTitle =
    existingLocator?.sheet.title ??
    resolveSheetTitleForSlug(collection.slugRegistry, normalizedSlug);

  if (!targetSheetTitle) {
    throw new Error(
      `No sheet registered for user slug "${normalizedSlug}". Please create a sheet tab for this user.`,
    );
  }

  const targetSheet =
    existingLocator?.sheet ??
    collection.sheets.find((sheet) => sheet.title === targetSheetTitle);

  if (!targetSheet) {
    throw new Error(
      `Sheet "${targetSheetTitle}" is missing or has no header row.`,
    );
  }

  const now = new Date().toISOString();
  const existingCreatedAt = existingLocator
    ? getCell(existingLocator.row, targetSheet.headerIndex, "createdAt")
    : "";
  const existingSlackTs = existingLocator
    ? getCell(existingLocator.row, targetSheet.headerIndex, "slackTs")
    : "";

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

  const payload = [buildDailyReportRow(normalized, targetSheet)];

  const range = existingLocator
    ? toColumnRange(targetSheet, existingLocator.sheetRowNumber)
    : toColumnRange(targetSheet);

  await retryWithBackoff(async (attempt) => {
    try {
      if (existingLocator) {
        await sheetsClient.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: "RAW",
          requestBody: { values: payload },
        });
      } else {
        await sheetsClient.spreadsheets.values.append({
          spreadsheetId,
          range,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: payload },
        });
      }
      invalidateDailyReportCache();
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      console.error("sheets.daily_reports.upsert.error", {
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

  const collection = await loadDailyReportCollection();

  const reports = collection.sheets
    .flatMap((sheet) =>
      sheet.rows
        .map((row) => mapRowToDailyReport(sheet, row))
        .filter((report): report is DailyReport => report !== null),
    )
    .filter((report) => report.date >= weekStart && report.date <= weekEnd);

  const deduplicated = Array.from(
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

  return deduplicated
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
    })
    .filter((report) => {
      if (!options.channelId) return true;
      return (report.channelId ?? "").trim() === options.channelId.trim();
    });
};
