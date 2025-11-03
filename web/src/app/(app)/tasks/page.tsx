import Link from "next/link";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { listTasks } from "@/server/repositories/tasks-repository";
import type { Task } from "@/types";

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
  const tasks = await listTasks();
  const { now, overdueCount, dueSoonCount } = buildTaskSummary(tasks);

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
        description="各種フィルタリングは後続で実装。サーバ側でGoogle Sheetsと連携します。"
      >
        <div className="grid gap-4 md:grid-cols-3">
          {["担当者", "状態", "期限", "重要度", "カテゴリ", "プロジェクト"].map(
            (label) => (
              <div key={label} className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-[#ad7a46]">{label}</span>
                <div className="rounded-lg border border-dashed border-[#ead8c4] bg-[#fffaf5] px-3 py-2 text-[#b59b85]">
                  UI実装予定
                </div>
              </div>
            ),
          )}
        </div>
      </Card>

      <Card
        title="タスク一覧"
        description="シートのタスクタブと同期します。状態変更は詳細画面で実行します。"
        footer={`取得件数: ${tasks.length} | 期限超過: ${overdueCount} | 3日以内の期限: ${dueSoonCount}`}
      >
        <div className="overflow-hidden rounded-xl border border-dashed border-[#ead8c4] bg-[#fffaf5]">
          <table className="min-w-full divide-y divide-[#ead8c4] text-sm">
            <thead className="bg-[#f9efe3] text-left text-xs uppercase tracking-wide text-[#ad7a46]">
              <tr>
                <th className="px-4 py-3 font-semibold">タスク</th>
                <th className="px-4 py-3 font-semibold">担当</th>
                <th className="px-4 py-3 font-semibold">状態</th>
                <th className="px-4 py-3 font-semibold">期限</th>
                <th className="px-4 py-3 font-semibold">優先度</th>
                <th className="px-4 py-3 font-semibold">進捗%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1e6d8] bg-[#fffdf9] text-[#5b4c40]">
              {tasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-[#b59b85]"
                  >
                    タスクデータがありません。Google Sheets連携完了後に表示されます。
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
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
                      {task.watchers.length > 0 && (
                        <div className="mt-1 text-xs text-[#b59b85]">
                          👀 {task.watchers.join(", ")}
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
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#ead8c4] bg-white/70 px-3 py-1 text-xs font-medium text-[#7f6b5a]">
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#ad7a46]" />
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="relative h-2 w-full max-w-[120px] overflow-hidden rounded-full bg-[#ead8c4]/60">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-[#c89b6d]"
                            style={{ width: `${task.progressPercent}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-[#ad7a46]">
                          {task.progressPercent}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
