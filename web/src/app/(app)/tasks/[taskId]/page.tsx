import { notFound } from "next/navigation";
import { listTasks } from "@/server/repositories/tasks-repository";
import { TaskDetailClient } from "@/components/tasks/task-detail-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface TaskDetailPageProps {
  params: { taskId: string };
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const tasks = await listTasks();
  const task = tasks.find((item) => item.taskId === params.taskId);

  if (!task) {
    notFound();
  }

  return <TaskDetailClient task={task} />;
}
