import Link from "next/link";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { listTasks } from "@/server/repositories/tasks-repository";
import { TasksGantt } from "@/components/tasks/tasks-gantt";
import { TasksFilter } from "@/components/tasks/tasks-filter";
import type { Task, TaskPriority, TaskStatus } from "@/types";

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

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const TASK_STATUSES: TaskStatus[] = [
  "未着手",
  "進行中",
  "レビュー待ち",
  "完了",
  "保留",
  "棄却",
];

const TASK_PRIORITIES: TaskPriority[] = ["高", "中", "低"];

const getSingleParam = (value?: string | string[]): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === "string" ? value : undefined;
};

const isTaskStatus = (value?: string): value is TaskStatus => {
  if (!value) return false;
  return TASK_STATUSES.includes(value as TaskStatus);
};

const isTaskPriority = (value?: string): value is TaskPriority => {
  if (!value) return false;
  return TASK_PRIORITIES.includes(value as TaskPriority);
};

export default async function TasksPage({ searchParams }: PageProps) {
  const assigneeFilter = getSingleParam(searchParams?.assignee);
  const statusParam = getSingleParam(searchParams?.status);
  const statusFilter = isTaskStatus(statusParam) ? statusParam : undefined;
  const dueBeforeFilter = getSingleParam(searchParams?.dueBefore);
  const priorityParam = getSingleParam(searchParams?.priority);
  const priorityFilter = isTaskPriority(priorityParam)
    ? priorityParam
    : undefined;
  const categoryFilter = getSingleParam(searchParams?.category);
  const projectFilter = getSingleParam(searchParams?.project);

  const [allTasks, filteredTasks] = await Promise.all([
    listTasks(),
    listTasks({
      assignee: assigneeFilter,
      status: statusFilter,
      priority: priorityFilter,
      projectName: projectFilter,
      dueBefore: dueBeforeFilter,
      category: categoryFilter,
    }),
  ]);

  const { now, overdueCount, dueSoonCount } = buildTaskSummary(filteredTasks);

  const totalCount = allTasks.length;
  const filteredCount = filteredTasks.length;

  const assigneeOptions = Array.from(
    new Set(allTasks.map((task) => task.assigneeName).filter(Boolean)),
  );
  const projectOptions = Array.from(
    new Set(allTasks.map((task) => task.projectName).filter(Boolean)),
  );
  const categoryOptions = Array.from(
    new Set(
      allTasks
        .flatMap((task) => task.tags ?? [])
        .filter(Boolean),
    ),
  );

  const footerTextParts = [
    filteredCount === totalCount
      ? `取得件数: ${filteredCount}`
      : `取得件数: ${filteredCount} / 総数 ${totalCount}`,
    `期限超過: ${overdueCount}`,
    `3日以内の期限: ${dueSoonCount}`,
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#3d3128]">タスク</h1>
          <p className="mt-1 text-sm text-[#7f6b5a]">
            担当者 / 状態 / 重要度などでフィルタリングし、期限を意識したオペレーションを支援します。
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
        title="フィルタ / 並び替え"
        description="担当者や期限、カテゴリを組み合わせてタスクを絞り込みます。"
      >
        <TasksFilter
          assignees={assigneeOptions}
          projects={projectOptions}
          categories={categoryOptions}
          selected={{
            assignee: assigneeFilter,
            status: statusFilter,
            dueBefore: dueBeforeFilter,
            priority: priorityFilter,
            category: categoryFilter,
            project: projectFilter,
          }}
        />
      </Card>

      <Card
        title="タスク一覧"
        description="シートのタスクタブと同期します。状態変更は詳細画面で実行します。"
        footer={footerTextParts.join(" | ")}
      >
        <div className="overflow-hidden rounded-xl border border-dashed border-[#ead8c4] bg-[#fffaf5]">
          <table className="min-w-full divide-y divide-[#ead8c4] text-sm">
            <thead className="bg-[#f9efe3] text-left text-xs uppercase tracking-wide text-[#ad7a46]">
              <tr>
                <th className="px-4 py-3 font-semibold">タスク</th>
                <th className="px-4 py-3 font-semibold">担当</th>
                <th className="px-4 py-3 font-semibold">状態</th>
                <th className="px-4 py-3 font-semibold">開始日</th>
                <th className="px-4 py-3 font-semibold">期限</th>
                <th className="px-4 py-3 font-semibold">終了日</th>
                <th className="px-4 py-3 font-semibold">優先度</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1e6d8] bg-[#fffdf9] text-[#5b4c40]">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-[#b59b85]"
                  >
                    タスクデータがありません。Google Sheets連携完了後に表示されます。
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
                  <tr
                    key={task.taskId}
                    className="group transition-colors duration-200 hover:bg-[#f9efe3]/60"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/tasks/${task.taskId}`}
                        className="font-semibold text-[#ad7a46] underline-offset-4 hover:underline"
                      >
                        {task.title}
                      </Link>
                      <div className="mt-1 text-xs text-[#7f6b5a]">
                        {task.projectName}
                      </div>
                      {task.detailUrl && (
                        <div className="mt-1 text-xs">
                          <a
                            href={task.detailUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#ad7a46] underline-offset-4 hover:underline"
                          >
                            詳細を見る
                          </a>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">{task.assigneeName}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-[#fff0de] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#ad7a46]">
                        {task.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {task.startDate ? (
                        <span className="text-xs font-medium text-[#7f6b5a]">
                          {task.startDate}
                        </span>
                      ) : (
                        <span className="text-xs text-[#b59b85]">未設定</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {task.dueDate ? (
                        <div
                          className={[
                            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
                            (() => {
                              const due = toTimestamp(task.dueDate);
                              if (due === null) return "bg-white/70 text-[#7f6b5a]";
                              if (due < now && task.status !== "完了") {
                                return "bg-[#fbe8e6] text-[#c04747]";
                              }
                              const diffDays = Math.ceil(
                                (due - now) / (1000 * 60 * 60 * 24),
                              );
                              if (diffDays >= 0 && diffDays <= 3) {
                                return "bg-[#fff4da] text-[#ad7a46]";
                              }
                              return "bg-white/70 text-[#7f6b5a]";
                            })(),
                          ].join(" ")}
                        >
                          <span className="inline-flex h-2 w-2 rounded-full bg-[#c89b6d]" />
                          {task.dueDate}
                        </div>
                      ) : (
                        <span className="text-xs text-[#b59b85]">未設定</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {task.doneDate ? (
                        <span className="text-xs font-medium text-[#7f6b5a]">
                          {task.doneDate}
                        </span>
                      ) : (
                        <span className="text-xs text-[#b59b85]">未設定</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#ead8c4] bg-white/70 px-3 py-1 text-xs font-medium text-[#7f6b5a]">
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#ad7a46]" />
                        {task.priority}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="ガントチャート"
        description="同じタスクデータを開始日・期限で可視化します。表示対象は開始日または期限が設定されているタスクのみです。"
      >
        <TasksGantt tasks={filteredTasks} />
      </Card>
    </div>
  );
}

