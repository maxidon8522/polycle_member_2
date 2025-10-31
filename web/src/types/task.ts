export type TaskStatus =
  | "未着手"
  | "進行中"
  | "レビュー待ち"
  | "完了"
  | "保留"
  | "棄却";

export type TaskPriority = "高" | "中" | "低";

export interface TaskLink {
  label?: string;
  url: string;
}

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
  description: string;
  assigneeName: string;
  assigneeEmail: string;
  slackUserId?: string;
  category?: string;
  taskType?: string;
  status: TaskStatus;
  progressPercent: number;
  priority: TaskPriority;
  importance?: string;
  startDate?: string;
  dueDate?: string;
  doneDate?: string;
  links: TaskLink[];
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  watchers: string[];
  history: TaskHistoryEvent[];
}

export interface TaskUpsertInput
  extends Omit<Task, "taskId" | "history" | "createdAt" | "updatedAt"> {
  taskId?: string;
  history?: TaskHistoryEvent[];
  createdAt?: string;
  updatedAt?: string;
}
