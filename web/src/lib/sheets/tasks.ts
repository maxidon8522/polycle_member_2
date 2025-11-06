import { Task, TaskHistoryEvent } from "@/types";
import { env } from "@/config/env";
import { retryWithBackoff } from "@/lib/retry";
import { getSheetsClient } from "./google";

const DEFAULT_TASK_SHEET_NAME = "tasks";
const TASK_HISTORY_SHEET_NAME = "task_history";
const TASK_SHEET_COLUMNS_RANGE = "A:N";
const TASK_HISTORY_RANGE = `'${TASK_HISTORY_SHEET_NAME}'!A:G`;
const KNOWN_HISTORY_TYPES: readonly TaskHistoryEvent["type"][] = [
  "status_change",
  "comment",
  "update",
];

const normalizeHistoryType = (
  value: string,
): TaskHistoryEvent["type"] => {
  if (KNOWN_HISTORY_TYPES.includes(value as TaskHistoryEvent["type"])) {
    return value as TaskHistoryEvent["type"];
  }
  return "update";
};

const safeString = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value);

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

const escapeSheetName = (name: string): string => name.replace(/'/g, "''");

const normalizeSheetTitle = (title: string): string =>
  title.trim().toLowerCase();

const TASK_SHEET_EXCLUDE = new Set([
  normalizeSheetTitle(TASK_HISTORY_SHEET_NAME),
  "taskhistory",
  "task-history",
  "task history",
]);

const isTaskSheetTitle = (title: string): boolean => {
  if (!title) return false;
  const normalized = normalizeSheetTitle(title);
  if (!normalized) return false;
  if (TASK_SHEET_EXCLUDE.has(normalized)) {
    return false;
  }
  if (normalized === normalizeSheetTitle(DEFAULT_TASK_SHEET_NAME)) {
    return true;
  }
  if (normalized.includes("タスク")) {
    return true;
  }
  if (normalized.includes("task")) {
    return true;
  }
  return false;
};

const buildTaskRange = (title: string): string =>
  `'${escapeSheetName(title)}'!${TASK_SHEET_COLUMNS_RANGE}`;

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

type TaskSheetData = {
  title: string;
  normalizedTitle: string;
  header: string[];
  rows: string[][];
};

const normalizeCell = (value?: string): string =>
  typeof value === "string"
    ? value
        .normalize("NFKC")
        .replace(/\u200B/g, "")
        .replace(/\u00a0/g, " ")
        .replace(/\+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";

const SHEETS_EPOCH_MS = Date.UTC(1899, 11, 30);
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const isNumericString = (value: string): boolean => {
  return /^[+-]?\d+(\.\d+)?$/.test(value);
};

const serialNumberToIsoDate = (serial: number): string | null => {
  if (!Number.isFinite(serial)) {
    return null;
  }
  const milliseconds = Math.round(serial * MILLISECONDS_PER_DAY);
  const timestamp = SHEETS_EPOCH_MS + milliseconds;
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
};

const normalizeDateCell = (value?: string): string => {
  const normalized = normalizeCell(value);
  if (!normalized) {
    return "";
  }

  if (isNumericString(normalized)) {
    const serial = Number(normalized);
    const iso = serialNumberToIsoDate(serial);
    if (iso) {
      return iso;
    }
  }

  const candidate = normalized
    .replace(/[./]/g, "-")
    .replace(/T\s+/i, "T")
    .trim();

  const isoCompatible =
    candidate.includes(" ") && !candidate.includes("T")
      ? candidate.replace(" ", "T")
      : candidate;

  const parsed = Date.parse(isoCompatible);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }

  if (candidate.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    return candidate;
  }

  return candidate;
};

const mapRowToTaskHistory = (
  row: string[],
  rowIndex: number,
): TaskHistoryEvent | null => {
  const taskId = safeString(row[0]);
  if (!taskId) {
    return null;
  }

  const fallbackId = `hist_${taskId}_${String(rowIndex + 1).padStart(4, "0")}`;
  const historyId = safeString(row[1]) || fallbackId;
  const happenedAt = safeString(row[2]) || new Date().toISOString();
  const actorId = safeString(row[3]) || "unknown";
  const actorName = safeString(row[4]) || actorId || "unknown";
  const rawType = safeString(row[5]) || "update";
  const normalizedType = normalizeHistoryType(rawType);
  const detailsCell = safeString(row[6]);
  const details =
    detailsCell ||
    (normalizedType === "update" && rawType && rawType !== "update"
      ? rawType
      : "");

  return {
    id: historyId,
    taskId,
    happenedAt,
    actorId,
    actorName,
    type: normalizedType,
    details,
  };
};

export const readTasks = async (): Promise<TaskSheetData[]> => {
  const spreadsheetId = env.server.SHEETS_TASKS_SPREADSHEET_ID;
  const sheets = await getSheetsClient();

  try {
    const metadata = await retryWithBackoff(() =>
      sheets.spreadsheets.get({
        spreadsheetId,
        fields: "sheets.properties.title",
      }),
    );

    const sheetTitles = (metadata.data.sheets ?? [])
      .map((sheet) => sheet.properties?.title)
      .filter((title): title is string => typeof title === "string" && title.trim().length > 0)
      .filter((title) => isTaskSheetTitle(title));

    const uniqueTitles: string[] = [];
    const seenTitles = new Set<string>();
    for (const title of sheetTitles) {
      const normalized = normalizeSheetTitle(title);
      if (seenTitles.has(normalized)) {
        continue;
      }
      seenTitles.add(normalized);
      uniqueTitles.push(title);
    }

    if (uniqueTitles.length === 0) {
      console.warn("sheets.tasks.read.no_task_sheets", {
        spreadsheetId,
      });
      return [];
    }

    const results = await Promise.all(
      uniqueTitles.map(async (title) => {
        const range = buildTaskRange(title);
        try {
          const values = await retryWithBackoff<string[][] | null>(async (attempt) => {
            try {
              if (attempt === 0) {
                console.info("sheets.tasks.read.request", {
                  spreadsheetId,
                  sheetTitle: title,
                  range,
                });
              }
              const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range,
                valueRenderOption: "UNFORMATTED_VALUE",
              });
              return response.data.values ?? [];
            } catch (error) {
              const errorMessage = extractErrorMessage(error);
              if (isRangeParseError(errorMessage)) {
                if (attempt === 0) {
                  console.warn("sheets.tasks.read.missing_sheet", {
                    spreadsheetId,
                    sheetTitle: title,
                    range,
                  });
                }
                return null;
              }
              console.error("sheets.tasks.read.error", {
                attempt,
                spreadsheetId,
                sheetTitle: title,
                range,
                error: errorMessage,
              });
              throw error;
            }
          });

          if (values === null) {
            return null;
          }

          const { header, rows } = splitSheetValues(values);

          return {
            title,
            normalizedTitle: normalizeSheetTitle(title),
            header,
            rows,
          } satisfies TaskSheetData;
        } catch (error) {
          const errorMessage = extractErrorMessage(error);
          console.warn("sheets.tasks.read.single_sheet_failed", {
            spreadsheetId,
            sheetTitle: title,
            error: errorMessage,
          });
          return null;
        }
      }),
    );

    return results.filter(
      (item): item is TaskSheetData => item !== null,
    );
  } catch (error) {
    const errorMessage = extractErrorMessage(error);
    console.warn("sheets.tasks.read.failed", {
      spreadsheetId,
      error: errorMessage,
    });
    return [];
  }
};

export const readTaskHistory = async (): Promise<string[][]> => {
  const spreadsheetId = env.server.SHEETS_TASKS_SPREADSHEET_ID;
  const sheets = await getSheetsClient();

  try {
    const values = await retryWithBackoff<string[][] | null>(async (attempt) => {
      try {
        if (attempt === 0) {
          console.info("sheets.tasks.history.read.request", {
            spreadsheetId,
            range: TASK_HISTORY_RANGE,
          });
        }
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: TASK_HISTORY_RANGE,
          valueRenderOption: "UNFORMATTED_VALUE",
        });
        return response.data.values ?? [];
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        if (isRangeParseError(errorMessage)) {
          if (attempt === 0) {
            console.warn("sheets.tasks.history.read.missing_sheet", {
              spreadsheetId,
              range: TASK_HISTORY_RANGE,
            });
          }
          return null;
        }
        console.error("sheets.tasks.history.read.error", {
          attempt,
          spreadsheetId,
          error: errorMessage,
        });
        throw error;
      }
    });

    if (values === null) {
      return [];
    }

    return values;
  } catch (error) {
    const errorMessage = extractErrorMessage(error);
    console.warn("sheets.tasks.history.read.failed", {
      spreadsheetId,
      error: errorMessage,
    });
    return [];
  }
};

const mapRowToTask = (
  row: string[],
  history: TaskHistoryEvent[],
  sheetTitle: string,
): Task | null => {
  const taskId = safeString(row[0]);
  if (!taskId) {
    return null;
  }

  const tagsCell = safeString(row[11]);
  const tags = tagsCell
    ? tagsCell
        .split(/\s+/)
        .map((tag) =>
          tag
            .replace(/^#/, "")
            .normalize("NFKC")
            .replace(/\u200B/g, "")
            .replace(/\+/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean)
    : [];

  return {
    taskId,
    projectName: safeString(row[1]),
    title: safeString(row[2]),
    assigneeName: safeString(row[3]),
    status: safeString(row[4]) as Task["status"],
    dueDate: safeString(row[5]) || undefined,
    startDate: safeString(row[6]) || undefined,
    doneDate: safeString(row[7]) || undefined,
    detailUrl: safeString(row[8]).trim() || undefined,
    notes: safeString(row[9]).trim() || undefined,
    priority: safeString(row[10]) as Task["priority"],
    tags,
    createdAt: safeString(row[12]) || "",
    updatedAt: safeString(row[13]) || "",
    sheetTitle,
    history,
  };
};

const toTaskRow = (task: Task): (string | number)[] => [
  task.taskId,
  task.projectName,
  task.title,
  task.assigneeName,
  task.status,
  task.dueDate ?? "",
  task.startDate ?? "",
  task.doneDate ?? "",
  task.detailUrl ?? "",
  task.notes ?? "",
  task.priority,
  (task.tags ?? []).map((tag) => tag.trim()).filter(Boolean).join(" "),
  task.createdAt ?? "",
  task.updatedAt ?? "",
];

type TaskRowLocator = {
  sheet: TaskSheetData;
  sheetRowNumber: number;
};

const findTaskRowLocator = (
  sheets: TaskSheetData[],
  taskId: string,
  preferredSheetTitle?: string,
): TaskRowLocator | null => {
  if (sheets.length === 0) {
    return null;
  }

  const normalizedTaskId = taskId.trim();
  if (!normalizedTaskId) {
    return null;
  }

  const preferredNormalized = preferredSheetTitle
    ? normalizeSheetTitle(preferredSheetTitle)
    : null;

  const orderedSheets =
    preferredNormalized === null
      ? sheets
      : [
          ...sheets.filter((sheet) => sheet.normalizedTitle === preferredNormalized),
          ...sheets.filter((sheet) => sheet.normalizedTitle !== preferredNormalized),
        ];

  for (const sheet of orderedSheets) {
    for (let index = 0; index < sheet.rows.length; index += 1) {
      const row = sheet.rows[index] ?? [];
      const rowTaskId = safeString(row[0]);
      if (rowTaskId === normalizedTaskId) {
        return {
          sheet,
          sheetRowNumber: index + 2,
        };
      }
    }
  }

  return null;
};

const resolveTargetSheetTitle = (
  sheets: TaskSheetData[],
  preferredSheetTitle?: string,
): string => {
  if (preferredSheetTitle) {
    const normalizedPreferred = normalizeSheetTitle(preferredSheetTitle);
    const preferred = sheets.find(
      (sheet) => sheet.normalizedTitle === normalizedPreferred,
    );
    if (preferred) {
      return preferred.title;
    }
  }

  const defaultNormalized = normalizeSheetTitle(DEFAULT_TASK_SHEET_NAME);
  const defaultSheet = sheets.find(
    (sheet) => sheet.normalizedTitle === defaultNormalized,
  );
  if (defaultSheet) {
    return defaultSheet.title;
  }

  if (sheets.length > 0) {
    return sheets[0].title;
  }

  return preferredSheetTitle ?? DEFAULT_TASK_SHEET_NAME;
};

export const fetchTasks = async (): Promise<Task[]> => {
  const [taskSheets, historyValues] = await Promise.all([
    readTasks(),
    readTaskHistory(),
  ]);

  const { rows: historyRows } = splitSheetValues(historyValues);

  const historyByTaskId = new Map<string, TaskHistoryEvent[]>();
  historyRows.forEach((row, index) => {
    const event = mapRowToTaskHistory(row, index);
    if (!event) {
      return;
    }
    const existing = historyByTaskId.get(event.taskId) ?? [];
    existing.push(event);
    historyByTaskId.set(event.taskId, existing);
  });

  for (const [key, events] of historyByTaskId.entries()) {
    const sorted = events.slice().sort((a, b) => {
      const aTime = Date.parse(a.happenedAt);
      const bTime = Date.parse(b.happenedAt);
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
        return a.id.localeCompare(b.id);
      }
      if (Number.isNaN(aTime)) return -1;
      if (Number.isNaN(bTime)) return 1;
      return aTime - bTime;
    });
    historyByTaskId.set(key, sorted);
  }

  const normalizedTasks: Task[] = [];

  for (const sheet of taskSheets) {
    for (const row of sheet.rows) {
      const taskId = safeString(row[0]);
      const history = historyByTaskId.get(taskId) ?? [];
      const task = mapRowToTask(row, history, sheet.title);
      if (!task) {
        continue;
      }

      const normalizeOptional = (value?: string) => {
        const normalized = normalizeCell(value);
        return normalized || undefined;
      };

      const normalizeOptionalDate = (value?: string) => {
        const normalizedValue = normalizeDateCell(value);
        return normalizedValue || undefined;
      };

      normalizedTasks.push({
        ...task,
        taskId: normalizeCell(task.taskId),
        title: normalizeCell(task.title),
        assigneeName: normalizeCell(task.assigneeName),
        projectName: normalizeCell(task.projectName),
        status: normalizeCell(task.status) as Task["status"],
        priority: normalizeCell(task.priority) as Task["priority"],
        dueDate: normalizeOptionalDate(task.dueDate),
        startDate: normalizeOptionalDate(task.startDate),
        doneDate: normalizeOptionalDate(task.doneDate),
        detailUrl: task.detailUrl?.trim() || undefined,
        notes: normalizeOptional(task.notes),
        tags: (task.tags ?? [])
          .map((tag) => normalizeCell(tag))
          .filter(Boolean),
        createdAt:
          normalizeOptional(task.createdAt) ?? new Date().toISOString(),
        updatedAt:
          normalizeOptional(task.updatedAt) ?? new Date().toISOString(),
      });
    }
  }

  return normalizedTasks;
};

export const upsertTask = async (task: Task): Promise<void> => {
  const spreadsheetId = env.server.SHEETS_TASKS_SPREADSHEET_ID;
  const sheets = await getSheetsClient();
  const taskSheets = await readTasks();
  const locator = findTaskRowLocator(
    taskSheets,
    task.taskId,
    task.sheetTitle,
  );

  const payload = [toTaskRow(task)];

  if (locator) {
    const targetSheetTitle = locator.sheet.title;
    const range = `'${escapeSheetName(targetSheetTitle)}'!A${locator.sheetRowNumber}:N${locator.sheetRowNumber}`;
    task.sheetTitle = targetSheetTitle;
    await retryWithBackoff(async (attempt) => {
      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: "RAW",
          requestBody: { values: payload },
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("sheets.tasks.update.error", {
          attempt,
          spreadsheetId,
          range,
          sheetTitle: targetSheetTitle,
          taskId: task.taskId,
          error: errorMessage,
        });
        throw error;
      }
    });
  } else {
    const targetSheetTitle = resolveTargetSheetTitle(
      taskSheets,
      task.sheetTitle,
    );
    const range = `'${escapeSheetName(targetSheetTitle)}'!${TASK_SHEET_COLUMNS_RANGE}`;
    task.sheetTitle = targetSheetTitle;
    await retryWithBackoff(async (attempt) => {
      try {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: payload },
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("sheets.tasks.append.error", {
          attempt,
          spreadsheetId,
          range,
          sheetTitle: targetSheetTitle,
          taskId: task.taskId,
          error: errorMessage,
        });
        throw error;
      }
    });
  }
};

export const appendTaskHistoryEvent = async (
  event: TaskHistoryEvent,
): Promise<void> => {
  const spreadsheetId = env.server.SHEETS_TASKS_SPREADSHEET_ID;
  const sheets = await getSheetsClient();
  const row = [
    event.taskId,
    event.id,
    event.happenedAt,
    event.actorId,
    event.actorName,
    event.type,
    event.details,
  ];

  await retryWithBackoff(async (attempt) => {
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: TASK_HISTORY_RANGE,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("sheets.tasks.history.append.error", {
        attempt,
        spreadsheetId,
        taskId: event.taskId,
        error: errorMessage,
      });
      throw error;
    }
  });
};
