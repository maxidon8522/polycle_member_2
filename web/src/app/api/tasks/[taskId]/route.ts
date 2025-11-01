import { NextRequest, NextResponse } from "next/server";
import { listTasks, saveTask } from "@/server/repositories/tasks-repository";
import { taskUpsertSchema } from "@/validation";
import { z } from "zod";
import type { TaskUpsertInput } from "@/types";

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
    projectName: payload.projectName ?? existingTask.projectName,
    title: payload.title ?? existingTask.title,
    description: payload.description ?? existingTask.description,
    assigneeName: payload.assigneeName ?? existingTask.assigneeName,
    assigneeEmail: payload.assigneeEmail ?? existingTask.assigneeEmail,
    status: payload.status ?? existingTask.status,
    progressPercent: payload.progressPercent ?? existingTask.progressPercent,
    priority: payload.priority ?? existingTask.priority,
    links: payload.links ?? existingTask.links,
    createdBy: payload.createdBy ?? existingTask.createdBy,
    watchers: payload.watchers ?? existingTask.watchers,
  };

  await saveTask(taskPayload);

  return NextResponse.json({ ok: true });
}
