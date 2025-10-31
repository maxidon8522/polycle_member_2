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
        <h1 className="text-2xl font-semibold text-slate-900">
          {task.title ?? "タスク詳細"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
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
          <div className="text-sm text-slate-500">
            {task.watchers.length > 0
              ? task.watchers.join(", ")
              : "ウォッチャー未設定"}
          </div>
        </Card>
      </div>

      <Card title="説明 / 備考">
        <div className="space-y-4 text-sm text-slate-700">
          <p>{task.description || "説明未入力"}</p>
          <p className="text-slate-500">{task.notes || "備考未入力"}</p>
          {task.links.length > 0 && (
            <ul className="list-disc pl-5 text-slate-600">
              {task.links.map((link, index) => (
                <li key={index}>
                  <a
                    href={link.url}
                    className="text-slate-900 underline"
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
        <div className="space-y-3 text-sm text-slate-600">
          {task.history.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-slate-400">
              履歴がありません。状態変更・コメント追加時に自動で記録されます。
            </div>
          ) : (
            task.history.map((event) => (
              <div
                key={event.id}
                className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="flex justify-between text-xs uppercase text-slate-500">
                  <span>{event.type}</span>
                  <span>{event.happenedAt}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{event.details}</p>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

const DetailItem = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between">
    <dt className="text-xs uppercase text-slate-500">{label}</dt>
    <dd className="font-medium text-slate-900">{value}</dd>
  </div>
);
