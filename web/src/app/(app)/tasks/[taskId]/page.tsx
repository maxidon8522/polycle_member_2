import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { listTasks } from "@/server/repositories/tasks-repository";

interface TaskDetailPageProps {
  params: { taskId: string };
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const tasks = await listTasks();
  const task = tasks.find((item) => item.taskId === params.taskId);

  if (!task) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#3d3128]">
          {task.title ?? "タスク詳細"}
        </h1>
        <p className="mt-1 text-sm text-[#7f6b5a]">
          状態変更・コメント履歴・ウォッチャー管理をここで行います。
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="基本情報">
          <dl className="space-y-3 text-sm">
            <DetailItem label="プロジェクト" value={task.projectName} />
            <DetailItem label="担当" value={task.assigneeName} />
            <DetailItem label="状態" value={task.status} />
            <DetailItem label="優先度" value={task.priority} />
            <DetailItem label="進捗" value={`${task.progressPercent}%`} />
            <DetailItem label="期限" value={task.dueDate ?? "-"} />
          </dl>
        </Card>

        <Card title="スケジュール">
          <dl className="space-y-3 text-sm">
            <DetailItem label="着手日" value={task.startDate ?? "-"} />
            <DetailItem label="期限" value={task.dueDate ?? "-"} />
            <DetailItem label="完了日" value={task.doneDate ?? "-"} />
          </dl>
        </Card>

        <Card title="ウォッチャー">
          <div className="text-sm text-[#7f6b5a]">
            {task.watchers.length > 0
              ? task.watchers.join(", ")
              : "ウォッチャー未設定"}
          </div>
        </Card>
      </div>

      <Card title="説明 / 備考">
        <div className="space-y-4 text-sm text-[#5b4c40]">
          <p>{task.description || "説明未入力"}</p>
          <p className="text-[#b59b85]">{task.notes || "備考未入力"}</p>
          {task.links.length > 0 && (
            <ul className="list-disc pl-5 text-[#5b4c40] marker:text-[#c89b6d]">
              {task.links.map((link, index) => (
                <li key={index}>
                  <a
                    href={link.url}
                    className="font-semibold text-[#ad7a46] underline-offset-4 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link.label ?? link.url}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card
        title="履歴"
        description="状態遷移やコメントを時系列で表示します。"
      >
        <div className="space-y-3 text-sm text-[#5b4c40]">
          {task.history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#ead8c4] bg-[#fffaf5] px-4 py-6 text-center text-[#b59b85]">
              履歴がありません。状態変更・コメント追加時に自動で記録されます。
            </div>
          ) : (
            <ol className="relative ml-3 border-l border-[#ead8c4] pl-5">
              {task.history.map((event) => (
                <li key={event.id} className="relative pb-6 last:pb-0">
                  <span className="absolute -left-[11px] mt-1.5 inline-flex h-3 w-3 items-center justify-center rounded-full border-2 border-white bg-[#c89b6d] shadow-sm shadow-[#c89b6d]/40" />
                  <div className="flex flex-col gap-2 rounded-xl border border-[#ead8c4] bg-white/70 px-4 py-3 shadow-sm shadow-[#ead8c4]/40">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-wide text-[#ad7a46]">
                      <span>{event.type}</span>
                      <span>{event.happenedAt}</span>
                    </div>
                    <p className="text-sm text-[#5b4c40]">{event.details}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Card>
    </div>
  );
}

const DetailItem = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between">
    <dt className="text-xs uppercase text-[#ad7a46]">{label}</dt>
    <dd className="font-medium text-[#3d3128]">{value}</dd>
  </div>
);
