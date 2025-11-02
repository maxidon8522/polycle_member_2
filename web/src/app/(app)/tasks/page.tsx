import Link from "next/link";
import { Card } from "@/components/ui/card";
import { listTasks } from "@/server/repositories/tasks-repository";

export default async function TasksPage() {
  const tasks = await listTasks();

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
          className="cursor-not-allowed rounded-full bg-[#ead8c4] px-4 py-2 text-sm font-semibold text-[#b59b85]"
          aria-disabled
        >
          新規タスク（準備中）
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
        footer={`取得件数: ${tasks.length}`}
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
                  <tr key={task.taskId}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/tasks/${task.taskId}`}
                        className="font-semibold text-[#ad7a46] underline-offset-4 hover:underline"
                      >
                        {task.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{task.assigneeName}</td>
                    <td className="px-4 py-3">{task.status}</td>
                    <td className="px-4 py-3">{task.dueDate ?? "-"}</td>
                    <td className="px-4 py-3">{task.priority}</td>
                    <td className="px-4 py-3">{task.progressPercent}%</td>
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
