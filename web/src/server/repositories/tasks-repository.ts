"use server";

import "server-only";

import { randomUUID } from "node:crypto";

import { Task, TaskHistoryEvent, TaskUpsertInput } from "@/types";
import { appendTaskHistoryEvent, fetchTasks, upsertTask } from "@/lib/sheets/tasks";

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

const compareDueDate = (left?: string, right?: string): number => {
  const leftParsed = Date.parse(left ?? "");
  const rightParsed = Date.parse(right ?? "");
  const leftValue = Number.isNaN(leftParsed) ? null : leftParsed;
  const rightValue = Number.isNaN(rightParsed) ? null : rightParsed;
  if (leftValue === null && rightValue === null) return 0;
  if (leftValue === null) return 1;
  if (rightValue === null) return -1;
  return leftValue - rightValue;
};

const sortTasks = (tasks: Task[]): Task[] => {
  return tasks.slice().sort((a, b) => {
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
      (Date.parse(b.updatedAt ?? "") || 0) -
      (Date.parse(a.updatedAt ?? "") || 0);
    if (updatedDiff !== 0 && !Number.isNaN(updatedDiff)) {
      return updatedDiff;
    }

    return a.taskId.localeCompare(b.taskId);
  });
};

export const listTasks = async (): Promise<Task[]> => {
  const tasks = await fetchTasks();
  return sortTasks(tasks);
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
