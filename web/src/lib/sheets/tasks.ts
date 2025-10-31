import { Task } from "@/types";
import { env } from "@/config/env";
import { retryWithBackoff } from "@/lib/retry";
import { getSheetsClient } from "./google";

const TASK_SHEET_NAME = "tasks";
const TASK_HISTORY_SHEET_NAME = "task_history";

const safeString = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value);

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

export const readTasks = async (): Promise<string[][]> => {
  const spreadsheetId = env.server.SHEETS_TASKS_SPREADSHEET_ID;
  const sheets = await getSheetsClient();

  try {
    const response = await retryWithBackoff(async (attempt) => {
      try {
        const range = `'${TASK_SHEET_NAME}'!A:Z`;
        if (attempt === 0) {
          console.info("sheets.tasks.read.request", {
            spreadsheetId,
            range,
          });
        }
        return await sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
          valueRenderOption: "UNFORMATTED_VALUE",
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("sheets.tasks.read.error", {
          attempt,
          spreadsheetId,
          error: errorMessage,
        });
        throw error;
      }
    });

    return response.data.values ?? [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn("sheets.tasks.read.failed", {
      spreadsheetId,
      error: errorMessage,
    });
    return [];
  }
};

const mapRowToTask = (row: string[]): Task | null => {
  const taskId = safeString(row[0]);
  if (!taskId) {
    return null;
  }

  const linksCell = safeString(row[12]);
  const links = linksCell
    ? linksCell.split(/\n+/).map((entry) => {
        const [label, url] = entry.split("|");
        return {
          label: url ? label : undefined,
          url: url ? url : label,
        };
      })
    : [];

  const watchersCell = safeString(row[17]);
  const watchers = watchersCell
    ? watchersCell.split(",").map((item) => item.trim()).filter(Boolean)
    : [];

  return {
    taskId,
    projectName: safeString(row[1]),
    title: safeString(row[2]),
    description: safeString(row[3]),
    assigneeName: safeString(row[4]),
    assigneeEmail: safeString(row[5]),
    slackUserId: safeString(row[6]) || undefined,
    category: safeString(row[7]) || undefined,
    taskType: safeString(row[8]) || undefined,
    status: safeString(row[9]) as Task["status"],
    progressPercent: Number.parseInt(safeString(row[10]) || "0", 10) || 0,
    priority: safeString(row[11]) as Task["priority"],
    importance: "",
    startDate: safeString(row[13]) || undefined,
    dueDate: safeString(row[14]) || undefined,
    doneDate: safeString(row[15]) || undefined,
    links,
    notes: safeString(row[16]) || undefined,
    watchers,
    createdBy: safeString(row[18]) || "",
    createdAt: safeString(row[19]) || "",
    updatedAt: safeString(row[20]) || "",
    history: [],
  };
};

const toTaskRow = (task: Task): (string | number)[] => [
  task.taskId,
  task.projectName,
  task.title,
  task.description,
  task.assigneeName,
  task.assigneeEmail,
  task.slackUserId ?? "",
  task.category ?? "",
  task.taskType ?? "",
  task.status,
  task.progressPercent ?? 0,
  task.priority,
  (task.links ?? [])
    .map((link) =>
      link.label ? `${link.label}|${link.url}` : `${link.url}`,
    )
    .join("\n"),
  task.startDate ?? "",
  task.dueDate ?? "",
  task.doneDate ?? "",
  task.notes ?? "",
  (task.watchers ?? []).join(","),
  task.createdBy,
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
  const values = await readTasks();
  const { rows } = splitSheetValues(values);

  return rows
    .map((row) => mapRowToTask(row))
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
    const range = `'${TASK_SHEET_NAME}'!A${rowIndex}:U${rowIndex}`;
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
    const range = `'${TASK_SHEET_NAME}'!A:U`;
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

export const appendTaskHistory = async (
  taskId: string,
  historyLine: string[],
): Promise<void> => {
  const spreadsheetId = env.server.SHEETS_TASKS_SPREADSHEET_ID;
  const sheets = await getSheetsClient();

  await retryWithBackoff(async (attempt) => {
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${TASK_HISTORY_SHEET_NAME}!A:E`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [[taskId, ...historyLine]] },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("sheets.tasks.history.append.error", {
        attempt,
        spreadsheetId,
        taskId,
        error: errorMessage,
      });
      throw error;
    }
  });
};
