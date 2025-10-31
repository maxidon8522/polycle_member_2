import { NextResponse } from "next/server";
import { listTasks, saveTask } from "@/server/repositories/tasks-repository";
import { taskUpsertSchema } from "@/validation";
import { TaskPriority, TaskStatus } from "@/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const assignee = searchParams.get("assignee") ?? undefined;
  const statusParam = searchParams.get("status") ?? undefined;
  const priorityParam = searchParams.get("priority") ?? undefined;
  const dueBefore = searchParams.get("dueBefore") ?? undefined;
  const projectName = searchParams.get("project") ?? undefined;
  const searchTerm = searchParams.get("q") ?? undefined;

  const tasks = await listTasks({
    assignee: assignee ?? undefined,
    status: isTaskStatus(statusParam) ? statusParam : undefined,
    priority: isTaskPriority(priorityParam) ? priorityParam : undefined,
    dueBefore,
    projectName,
    searchTerm,
  });

  return NextResponse.json({ data: tasks });
}

export async function POST(request: Request) {
  const body = await request.json();
  const payload = taskUpsertSchema.parse(body);

  await saveTask(payload);

  return NextResponse.json({ ok: true }, { status: 201 });
}

const isTaskStatus = (value?: string | null): value is TaskStatus => {
  if (!value) return false;
  return ["未着手", "進行中", "レビュー待ち", "完了", "保留", "棄却"].includes(value);
};

const isTaskPriority = (value?: string | null): value is TaskPriority => {
  if (!value) return false;
  return ["高", "中", "低"].includes(value);
};
