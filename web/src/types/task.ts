export type TaskStatus =
  | "未着手"
  | "進行中"
  | "レビュー待ち"
  | "完了"
  | "保留"
  | "棄却";

export type TaskPriority = "高" | "中" | "低";

export interface TaskHistoryEvent {
  id: string;
  taskId: string;
  happenedAt: string; // ISO string
  actorId: string;
  actorName: string;
  type: "status_change" | "comment" | "update";
  details: string;
}

export interface Task {
  taskId: string;
  projectName: string;
  title: string;
  assigneeName: string;
  status: TaskStatus;
  priority: TaskPriority;
  startDate?: string;
  dueDate?: string;
  doneDate?: string;
  detailUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  history: TaskHistoryEvent[];
  tags?: string[];
  sheetTitle?: string;
}

export interface TaskUpsertInput
  extends Omit<Task, "taskId" | "history" | "createdAt" | "updatedAt"> {
  taskId?: string;
  history?: TaskHistoryEvent[];
  createdAt?: string;
  updatedAt?: string;
}
