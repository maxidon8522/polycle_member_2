"use server";

import "server-only";

import { Task, TaskUpsertInput } from "@/types";
import { fetchTasks, upsertTask } from "@/lib/sheets/tasks";

export interface TaskListFilters {
  assignee?: string;
  status?: Task["status"];
  priority?: Task["priority"];
  dueBefore?: string;
  projectName?: string;
  searchTerm?: string;
}

export const listTasks = async (
  filters: TaskListFilters = {},
): Promise<Task[]> => {
  // TODO: apply filters after fetching once the Sheets schema is finalized.
  void filters;
  return fetchTasks();
};

export const saveTask = async (payload: TaskUpsertInput): Promise<void> => {
  const now = new Date().toISOString();
  const task: Task = {
    ...payload,
    taskId: payload.taskId ?? `tsk_${now}`,
    history: payload.history ?? [],
    createdAt: payload.createdAt ?? now,
    updatedAt: now,
  };

  await upsertTask(task);
};
