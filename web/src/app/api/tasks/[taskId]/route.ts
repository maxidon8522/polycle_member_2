import { NextRequest, NextResponse } from "next/server";
import {
  listTasks,
  saveTask,
  TaskHistoryEventInput,
} from "@/server/repositories/tasks-repository";
import { taskUpsertSchema } from "@/validation";
import { z } from "zod";
import type { TaskUpsertInput } from "@/types";
import { auth } from "@/server/auth";

const patchSchema = taskUpsertSchema
  .partial()
  .merge(z.object({ taskId: z.string().min(1) }));

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  const tasks = await listTasks();
  const task = tasks.find((item) => item.taskId === taskId);

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ data: task });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await context.params;
  const body = await request.json();
  const payload = patchSchema.parse({ ...body, taskId });

  const tasks = await listTasks();
  const existingTask = tasks.find((item) => item.taskId === taskId);

  if (!existingTask) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const taskPayload: TaskUpsertInput = {
    ...existingTask,
    ...payload,
    taskId,
    createdAt: existingTask.createdAt,
    createdBy: existingTask.createdBy,
    history: existingTask.history,
    links: payload.links ?? existingTask.links,
    watchers: payload.watchers ?? existingTask.watchers,
  };

  const actorId =
    session.user.id ??
    session.user.email ??
    session.user.slackUserId ??
    "unknown";
  const actorName =
    session.user.name ??
    session.user.email ??
    session.user.slackUserId ??
    "unknown";

  const historyEvents: TaskHistoryEventInput[] = [];
  const registerChange = (
    type: TaskHistoryEventInput["type"],
    details: string,
  ) => {
    historyEvents.push({
      type,
      details,
      actorId,
      actorName,
    });
  };

  if (taskPayload.status !== existingTask.status) {
    registerChange(
      "status_change",
      `状態を ${existingTask.status} から ${taskPayload.status} に変更`,
    );
  }

  if (taskPayload.progressPercent !== existingTask.progressPercent) {
    registerChange(
      "update",
      `進捗率を ${existingTask.progressPercent}% から ${taskPayload.progressPercent}% に更新`,
    );
  }

  if ((taskPayload.dueDate ?? "") !== (existingTask.dueDate ?? "")) {
    const before = existingTask.dueDate ?? "未設定";
    const after = taskPayload.dueDate ?? "未設定";
    registerChange("update", `期限を ${before} から ${after} に変更`);
  }

  if (taskPayload.priority !== existingTask.priority) {
    registerChange(
      "update",
      `優先度を ${existingTask.priority} から ${taskPayload.priority} に変更`,
    );
  }

  const normalizeWatcherList = (list: string[]) =>
    list
      .map((entry) => entry.trim())
      .filter(Boolean)
      .sort()
      .join("|");
  if (
    normalizeWatcherList(taskPayload.watchers) !==
    normalizeWatcherList(existingTask.watchers)
  ) {
    const before =
      existingTask.watchers.length > 0
        ? existingTask.watchers.join(", ")
        : "未設定";
    const after =
      taskPayload.watchers.length > 0
        ? taskPayload.watchers.join(", ")
        : "未設定";
    registerChange("update", `ウォッチャーを ${before} から ${after} に更新`);
  }

  const updatedTask = await saveTask(taskPayload, { historyEvents });

  return NextResponse.json({ data: updatedTask });
}
