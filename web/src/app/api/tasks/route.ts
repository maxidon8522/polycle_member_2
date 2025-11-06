import { NextResponse } from "next/server";
import { listTasks, saveTask, TaskHistoryEventInput } from "@/server/repositories/tasks-repository";
import { taskUpsertSchema } from "@/validation";
import { auth } from "@/server/auth";

export async function GET() {
  const tasks = await listTasks();
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
