import { NextResponse } from "next/server";
import {
  listTasks,
  saveTask,
  TaskHistoryEventInput,
} from "@/server/repositories/tasks-repository";
import { taskUpsertSchema } from "@/validation";
import { TaskPriority, TaskStatus } from "@/types";
import { auth } from "@/server/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const assignee = searchParams.get("assignee") ?? undefined;
  const statusParam = searchParams.get("status") ?? undefined;
  const priorityParam = searchParams.get("priority") ?? undefined;
  const dueBefore = searchParams.get("dueBefore") ?? undefined;
  const projectName = searchParams.get("project") ?? undefined;
  const searchTerm = searchParams.get("q") ?? undefined;
  const category = searchParams.get("category") ?? undefined;

  const tasks = await listTasks({
    assignee: assignee ?? undefined,
    status: isTaskStatus(statusParam) ? statusParam : undefined,
    priority: isTaskPriority(priorityParam) ? priorityParam : undefined,
    dueBefore,
    projectName,
    searchTerm,
    category,
  });

  return NextResponse.json({ data: tasks });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const payload = taskUpsertSchema.parse(body);
  const sanitizedPayload = {
    ...payload,
    projectName: payload.projectName.trim(),
    title: payload.title.trim(),
    assigneeName: payload.assigneeName.trim(),
    detailUrl: payload.detailUrl?.trim() || undefined,
    notes: payload.notes?.trim() || undefined,
    startDate: payload.startDate?.trim() || undefined,
    dueDate: payload.dueDate?.trim() || undefined,
    doneDate: payload.doneDate?.trim() || undefined,
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

  const historyEvent: TaskHistoryEventInput = {
    type: "update",
    actorId,
    actorName,
    details: "タスクを登録しました。",
  };

  const task = await saveTask(sanitizedPayload, { historyEvents: [historyEvent] });

  return NextResponse.json({ data: task }, { status: 201 });
}

const isTaskStatus = (value?: string | null): value is TaskStatus => {
  if (!value) return false;
  return ["未着手", "進行中", "レビュー待ち", "完了", "保留", "棄却"].includes(value);
};

const isTaskPriority = (value?: string | null): value is TaskPriority => {
  if (!value) return false;
  return ["高", "中", "低"].includes(value);
};
