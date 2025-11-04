import { Task, TaskHistoryEvent } from "@/types";
import { env } from "@/config/env";
import { retryWithBackoff } from "@/lib/retry";
import { getSheetsClient } from "./google";

const TASK_SHEET_NAME = "tasks";
const TASK_HISTORY_SHEET_NAME = "task_history";
const TASK_SHEET_RANGE = `'${TASK_SHEET_NAME}'!A:M`;
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

export const readTasks = async (): Promise<string[][]> => {
  const spreadsheetId = env.server.SHEETS_TASKS_SPREADSHEET_ID;
  const sheets = await getSheetsClient();

  try {
    const values = await retryWithBackoff<string[][] | null>(async (attempt) => {
      try {
        const range = TASK_SHEET_RANGE;
        if (attempt === 0) {
          console.info("sheets.tasks.read.request", {
            spreadsheetId,
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
              range: TASK_SHEET_RANGE,
            });
          }
          return null;
        }
        console.error("sheets.tasks.read.error", {
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
): Task | null => {
  const taskId = safeString(row[0]);
  if (!taskId) {
    return null;
  }

  return {
    taskId,
    projectName: safeString(row[1]),
    title: safeString(row[2]),
    assigneeName: safeString(row[3]),
    status: safeString(row[4]) as Task["status"],
    dueDate: safeString(row[5]) || undefined,
    startDate: safeString(row[6]) || undefined,
    doneDate: safeString(row[7]) || undefined,
    detailUrl: safeString(row[8]) || undefined,
    notes: safeString(row[9]) || undefined,
    priority: safeString(row[10]) as Task["priority"],
    createdAt: safeString(row[11]) || "",
    updatedAt: safeString(row[12]) || "",
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
  task.createdAt ?? "",
  task.updatedAt ?? "",
];

const findTaskRowIndex = (
  rows: string[][],
  taskId: string,
): number | null => {
  if (rows.length === 0) {
    return null;
  }

  const normalizedTaskId = taskId.trim();

  for (let index = 0; index < rows.length; index += 1) {
    const rowTaskId = safeString(rows[index]?.[0]);
    if (rowTaskId === normalizedTaskId) {
      return index + 2;
    }
  }

  return null;
};

export const fetchTasks = async (): Promise<Task[]> => {
  const [taskValues, historyValues] = await Promise.all([
    readTasks(),
    readTaskHistory(),
  ]);

  const { rows: taskRows } = splitSheetValues(taskValues);
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

  return taskRows
    .map((row) => {
      const taskId = safeString(row[0]);
      const history = historyByTaskId.get(taskId) ?? [];
      return mapRowToTask(row, history);
    })
    .filter((task): task is Task => task !== null);
};

export const upsertTask = async (task: Task): Promise<void> => {
  const spreadsheetId = env.server.SHEETS_TASKS_SPREADSHEET_ID;
  const sheets = await getSheetsClient();
  const values = await readTasks();
  const { rows } = splitSheetValues(values);
  const rowIndex = findTaskRowIndex(rows, task.taskId);

  const payload = [toTaskRow(task)];

  if (rowIndex) {
    const range = `'${TASK_SHEET_NAME}'!A${rowIndex}:M${rowIndex}`;
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
            taskId: task.taskId,
            error: errorMessage,
          });
          throw error;
        }
    });
  } else {
    const range = `'${TASK_SHEET_NAME}'!A:M`;
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
