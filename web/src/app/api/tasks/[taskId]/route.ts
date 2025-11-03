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

  const trimOrUndefined = (
    value: string | undefined,
    fallback: string | undefined,
  ) => {
    if (value === undefined) return fallback;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  };

  const trimOrFallback = (
    value: string | undefined,
    fallback: string,
  ) => {
    if (value === undefined) return fallback;
    const trimmed = value.trim();
    return trimmed === "" ? fallback : trimmed;
  };

  const taskPayload: TaskUpsertInput = {
    ...existingTask,
    ...payload,
    taskId,
    projectName: trimOrFallback(payload.projectName, existingTask.projectName),
    title: trimOrFallback(payload.title, existingTask.title),
    assigneeName: trimOrFallback(payload.assigneeName, existingTask.assigneeName),
    startDate: trimOrUndefined(payload.startDate, existingTask.startDate),
    dueDate: trimOrUndefined(payload.dueDate, existingTask.dueDate),
    doneDate: trimOrUndefined(payload.doneDate, existingTask.doneDate),
    detailUrl: trimOrUndefined(payload.detailUrl, existingTask.detailUrl),
    notes: trimOrUndefined(payload.notes, existingTask.notes),
    createdAt: existingTask.createdAt,
    history: existingTask.history,
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

  if ((taskPayload.dueDate ?? "") !== (existingTask.dueDate ?? "")) {
    const before = existingTask.dueDate ?? "未設定";
    const after = taskPayload.dueDate ?? "未設定";
    registerChange("update", `期限を ${before} から ${after} に変更`);
  }

  if ((taskPayload.startDate ?? "") !== (existingTask.startDate ?? "")) {
    const before = existingTask.startDate ?? "未設定";
    const after = taskPayload.startDate ?? "未設定";
    registerChange("update", `開始日を ${before} から ${after} に変更`);
  }

  if ((taskPayload.doneDate ?? "") !== (existingTask.doneDate ?? "")) {
    const before = existingTask.doneDate ?? "未設定";
    const after = taskPayload.doneDate ?? "未設定";
    registerChange("update", `終了日を ${before} から ${after} に変更`);
  }

  if (taskPayload.priority !== existingTask.priority) {
    registerChange(
      "update",
      `優先度を ${existingTask.priority} から ${taskPayload.priority} に変更`,
    );
  }

  if ((taskPayload.detailUrl ?? "") !== (existingTask.detailUrl ?? "")) {
    const before = existingTask.detailUrl ?? "未設定";
    const after = taskPayload.detailUrl ?? "未設定";
    registerChange("update", `詳細URLを ${before} から ${after} に更新`);
  }

  if ((taskPayload.notes ?? "") !== (existingTask.notes ?? "")) {
    registerChange("comment", "備考を更新しました。");
  }

  const updatedTask = await saveTask(taskPayload, { historyEvents });

  return NextResponse.json({ data: updatedTask });
}
