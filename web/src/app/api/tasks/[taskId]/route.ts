import { NextResponse } from "next/server";
import { listTasks, saveTask } from "@/server/repositories/tasks-repository";
import { taskUpsertSchema } from "@/validation";
import { z } from "zod";

const patchSchema = taskUpsertSchema
  .partial()
  .merge(z.object({ taskId: z.string().min(1) }));

export async function GET(
  _request: Request,
  { params }: { params: { taskId: string } },
) {
  const tasks = await listTasks();
  const task = tasks.find((item) => item.taskId === params.taskId);

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ data: task });
}

export async function PATCH(
  request: Request,
  { params }: { params: { taskId: string } },
) {
  const body = await request.json();
  const payload = patchSchema.parse({ ...body, taskId: params.taskId });

  await saveTask(payload);

  return NextResponse.json({ ok: true });
}
