"use server";

import "server-only";

import { randomUUID } from "node:crypto";

import { Task, TaskHistoryEvent, TaskUpsertInput } from "@/types";
import {
  appendTaskHistoryEvent,
  fetchTasks,
  upsertTask,
} from "@/lib/sheets/tasks";

export interface TaskListFilters {
  assignee?: string;
  status?: Task["status"];
  priority?: Task["priority"];
  dueBefore?: string;
  projectName?: string;
  searchTerm?: string;
}

export type TaskHistoryEventInput = {
  id?: string;
  happenedAt?: string;
  actorId?: string;
  actorName?: string;
  type?: TaskHistoryEvent["type"];
  details?: string;
};

const PRIORITY_WEIGHT: Record<Task["priority"], number> = {
  高: 0,
  中: 1,
  低: 2,
};

const normalize = (value?: string | null): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const parseDate = (value?: string | null): number | null => {
  const normalized = value ? value.trim() : "";
  if (!normalized) {
    return null;
  }
  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? null : timestamp;
};

const compareDueDate = (left?: string, right?: string): number => {
  const leftValue = parseDate(left);
  const rightValue = parseDate(right);
  if (leftValue === null && rightValue === null) return 0;
  if (leftValue === null) return 1;
  if (rightValue === null) return -1;
  return leftValue - rightValue;
};

const matchesSearchTerm = (task: Task, term: string): boolean => {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) {
    return true;
  }

  const haystack = [
    task.title,
    task.notes ?? "",
    task.projectName,
    task.assigneeName,
    task.detailUrl ?? "",
    (task.tags ?? []).join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedTerm);
};

export const listTasks = async (
  filters: TaskListFilters = {},
): Promise<Task[]> => {
  const tasks = await fetchTasks();
  const assigneeFilter = normalize(filters.assignee);
  const projectFilter = normalize(filters.projectName);
  const dueBeforeValue = parseDate(filters.dueBefore);
  const statusFilter = filters.status;
  const priorityFilter = filters.priority;
  const searchTerm = normalize(filters.searchTerm);

  const filtered = tasks.filter((task) => {
    if (assigneeFilter) {
      const matchesAssignee =
        normalize(task.assigneeName).includes(assigneeFilter);
      if (!matchesAssignee) {
        return false;
      }
    }

    if (statusFilter && task.status !== statusFilter) {
      return false;
    }

    if (priorityFilter && task.priority !== priorityFilter) {
      return false;
    }

    if (projectFilter && !normalize(task.projectName).includes(projectFilter)) {
      return false;
    }

    if (dueBeforeValue !== null) {
      const taskDue = parseDate(task.dueDate);
      if (taskDue === null || taskDue > dueBeforeValue) {
        return false;
      }
    }

    if (searchTerm && !matchesSearchTerm(task, searchTerm)) {
      return false;
    }

    return true;
  });

  return filtered.sort((a, b) => {
    const dueCompare = compareDueDate(a.dueDate, b.dueDate);
    if (dueCompare !== 0) {
      return dueCompare;
    }

    const priorityCompare =
      PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    if (priorityCompare !== 0) {
      return priorityCompare;
    }

    const updatedDiff =
      (parseDate(b.updatedAt) ?? 0) - (parseDate(a.updatedAt) ?? 0);
    if (updatedDiff !== 0) {
      return updatedDiff;
    }

    return a.taskId.localeCompare(b.taskId);
  });
};

const ensureHistoryEvent = (
  taskId: string,
  event: TaskHistoryEventInput,
): TaskHistoryEvent => {
  return {
    id: event.id ?? `hist_${taskId}_${randomUUID()}`,
    taskId,
    happenedAt: event.happenedAt ?? new Date().toISOString(),
    actorId: event.actorId?.trim() || "unknown",
    actorName:
      event.actorName?.trim() ||
      event.actorId?.trim() ||
      "unknown",
    type: event.type ?? "update",
    details: event.details ?? "",
  };
};

export const saveTask = async (
  payload: TaskUpsertInput,
  options: { historyEvents?: TaskHistoryEventInput[] } = {},
): Promise<Task> => {
  const now = new Date().toISOString();
  const taskId =
    payload.taskId ?? `tsk_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const baseHistory = payload.history ?? [];
  const task: Task = {
    ...payload,
    taskId,
    history: baseHistory,
    createdAt: payload.createdAt ?? now,
    updatedAt: now,
  };

  await upsertTask(task);

  const historyEvents = options.historyEvents ?? [];
  const appendedEvents: TaskHistoryEvent[] = [];
  if (historyEvents.length > 0) {
    for (const event of historyEvents) {
      const normalizedEvent = ensureHistoryEvent(taskId, event);
      try {
        await appendTaskHistoryEvent(normalizedEvent);
        appendedEvents.push(normalizedEvent);
      } catch (error) {
        console.error("tasks.repo.history.append.failed", {
          taskId,
          eventId: normalizedEvent.id,
          error,
        });
      }
    }
  }

  if (appendedEvents.length > 0) {
    task.history = [...baseHistory, ...appendedEvents];
  }

  return task;
};
