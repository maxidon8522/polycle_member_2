import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { listTasks } from "@/server/repositories/tasks-repository";
import { TasksGantt } from "@/components/tasks/tasks-gantt";
import { TasksTable } from "@/components/tasks/tasks-table";
import type { Task } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const toTimestamp = (value?: string | null): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const buildTaskSummary = (tasks: Task[]) => {
  const now = Date.now();

  const overdueCount = tasks.filter((task) => {
    const due = toTimestamp(task.dueDate);
    if (due === null) return false;
    return due < now && task.status !== "完了";
  }).length;

  const dueSoonCount = tasks.filter((task) => {
    const due = toTimestamp(task.dueDate);
    if (due === null) return false;
    const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 3 && task.status !== "完了";
  }).length;

  return { now, overdueCount, dueSoonCount };
};

export default async function TasksPage() {
  noStore();

  const tasks = await listTasks();

  const { overdueCount, dueSoonCount } = buildTaskSummary(tasks);
  const totalCount = tasks.length;

  const footerTextParts = [
    `取得件数: ${totalCount}`,
    `期限超過: ${overdueCount}`,
    `3日以内の期限: ${dueSoonCount}`,
  ];

  const debugInfo =
    process.env.NODE_ENV === "development" ? (
      <pre className="whitespace-pre-wrap rounded-lg bg-[#fffaf5] p-3 text-xs text-[#7f6b5a]">
        {JSON.stringify(
          {
            counts: {
              total: totalCount,
            },
          },
          null,
          2,
        )}
      </pre>
    ) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#3d3128]">タスク</h1>
          <p className="mt-1 text-sm text-[#7f6b5a]">
            Google Sheets上のタスクを一覧化し、期限や状態を確認できます。
          </p>
        </div>
        <Link
          href="/tasks/new"
          className={buttonVariants("secondary")}
        >
          新規タスク
        </Link>
      </div>

      <Card
        title="タスク一覧"
        description="シートのタスクタブと同期します。状態変更は詳細画面で実行します。"
        footer={footerTextParts.join(" | ")}
      >
        <TasksTable tasks={tasks} />
      </Card>

      <Card
        title="ガントチャート"
        description="同じタスクデータを開始日・期限で可視化します。表示対象は開始日または期限が設定されているタスクのみです。"
      >
        <TasksGantt tasks={tasks} />
      </Card>
      {debugInfo}
    </div>
  );
}
