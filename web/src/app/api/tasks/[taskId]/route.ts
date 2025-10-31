import { NextRequest, NextResponse } from "next/server";
import { listTasks, saveTask } from "@/server/repositories/tasks-repository";
import { taskUpsertSchema } from "@/validation";
import { z } from "zod";

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

  await saveTask(payload);

  return NextResponse.json({ ok: true });
}
