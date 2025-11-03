"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";
import type { Task } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const TASK_STATUS_OPTIONS: Task["status"][] = [
  "未着手",
  "進行中",
  "レビュー待ち",
  "完了",
  "保留",
  "棄却",
];

const TASK_PRIORITY_OPTIONS: Task["priority"][] = ["高", "中", "低"];

const parseWatchers = (raw: string): string[] =>
  raw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

interface TaskDetailClientProps {
  task: Task;
}

export const TaskDetailClient = ({ task }: TaskDetailClientProps) => {
  const router = useRouter();
  const [currentTask, setCurrentTask] = useState<Task>(task);
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<"idle" | "success" | "error">(
    "idle",
  );

  const [formState, setFormState] = useState({
    status: task.status,
    progressPercent: String(task.progressPercent ?? 0),
    dueDate: task.dueDate ?? "",
    priority: task.priority,
    watchers: task.watchers.join(", "),
    notes: task.notes ?? "",
  });

  const handleChange = (
    event: ChangeEvent<
      HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(null);
    setStatusType("idle");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/tasks/${task.taskId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: formState.status,
            progressPercent:
              Number.parseInt(formState.progressPercent, 10) || 0,
            dueDate: formState.dueDate || undefined,
            priority: formState.priority,
            watchers: parseWatchers(formState.watchers),
            notes: formState.notes,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          const message =
            typeof data.error === "string"
              ? data.error
              : "更新に失敗しました。";
          setStatusMessage(message);
          setStatusType("error");
          return;
        }

        const data = await response.json();
        if (data?.data) {
          const updatedTask: Task = data.data;
          setCurrentTask(updatedTask);
          setFormState({
            status: updatedTask.status,
            progressPercent: String(updatedTask.progressPercent ?? 0),
            dueDate: updatedTask.dueDate ?? "",
            priority: updatedTask.priority,
            watchers: updatedTask.watchers.join(", "),
            notes: updatedTask.notes ?? "",
          });
        }

        setStatusMessage("更新しました。");
        setStatusType("success");
        router.refresh();
      } catch (error) {
        console.error("tasks.detail.patch.error", error);
        setStatusMessage("更新に失敗しました。");
        setStatusType("error");
      }
    });
  };

  const history = useMemo(() => currentTask.history ?? [], [currentTask]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#3d3128]">
          {currentTask.title ?? "タスク詳細"}
        </h1>
        <p className="mt-1 text-sm text-[#7f6b5a]">
          状態変更・コメント履歴・ウォッチャー管理をここで行います。
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="基本情報">
            <dl className="space-y-3 text-sm">
              <DetailItem label="プロジェクト" value={currentTask.projectName} />
              <DetailItem label="担当" value={currentTask.assigneeName} />
              <div className="flex items-center justify-between">
                <dt className="text-xs uppercase text-[#ad7a46]">状態</dt>
                <dd>
                  <select
                    name="status"
                    value={formState.status}
                    onChange={handleChange}
                    className="rounded-full border border-[#ead8c4] bg-white px-3 py-1 text-xs font-semibold text-[#ad7a46] shadow-sm focus:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8]"
                  >
                    {TASK_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-xs uppercase text-[#ad7a46]">優先度</dt>
                <dd>
                  <select
                    name="priority"
                    value={formState.priority}
                    onChange={handleChange}
                    className="rounded-full border border-[#ead8c4] bg-white px-3 py-1 text-xs font-semibold text-[#ad7a46] shadow-sm focus:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8]"
                  >
                    {TASK_PRIORITY_OPTIONS.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-xs uppercase text-[#ad7a46]">進捗</dt>
                <dd className="flex items-center gap-2">
                  <input
                    type="number"
                    name="progressPercent"
                    value={formState.progressPercent}
                    onChange={handleChange}
                    min={0}
                    max={100}
                    className="w-16 rounded-lg border border-[#ead8c4] bg-white px-2 py-1 text-xs text-[#3d3128] shadow-inner focus:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8]"
                  />
                  <span className="text-xs font-semibold text-[#ad7a46]">%</span>
                </dd>
              </div>
              <DetailItem
                label="進捗バー"
                value={`${currentTask.progressPercent}%`}
              />
              <DetailItem
                label="重要度"
                value={currentTask.importance ?? "未設定"}
              />
            </dl>
          </Card>

          <Card title="スケジュール">
            <dl className="space-y-3 text-sm">
              <DetailItem
                label="着手日"
                value={currentTask.startDate ?? "-"}
              />
              <div className="flex items-center justify-between">
                <dt className="text-xs uppercase text-[#ad7a46]">期限</dt>
                <dd>
                  <input
                    type="date"
                    name="dueDate"
                    value={formState.dueDate}
                    onChange={handleChange}
                    className="rounded-lg border border-[#ead8c4] bg-white px-3 py-1 text-xs text-[#3d3128] shadow-inner focus:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8]"
                  />
                </dd>
              </div>
              <DetailItem
                label="完了日"
                value={currentTask.doneDate ?? "-"}
              />
            </dl>
          </Card>

          <Card title="ウォッチャー">
            <div className="space-y-3 text-sm text-[#5b4c40]">
              <textarea
                name="watchers"
                value={formState.watchers}
                onChange={handleChange}
                rows={4}
                className="w-full rounded-xl border border-[#ead8c4] bg-white px-3 py-2 text-sm text-[#3d3128] shadow-inner focus:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8]"
                placeholder="山田太郎, 佐藤花子"
              />
              <p className="text-xs text-[#b59b85]">
                カンマまたは改行で区切ってください。
              </p>
            </div>
          </Card>
        </div>

        <Card title="説明 / 備考">
          <div className="space-y-4 text-sm text-[#5b4c40]">
            <p>{currentTask.description || "説明未入力"}</p>
            <textarea
              name="notes"
              value={formState.notes}
              onChange={handleChange}
              rows={4}
              className="w-full rounded-xl border border-[#ead8c4] bg-white px-3 py-2 text-sm text-[#3d3128] shadow-inner focus:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8]"
              placeholder="備考を入力"
            />
            {currentTask.links.length > 0 && (
              <ul className="list-disc pl-5 text-[#5b4c40] marker:text-[#c89b6d]">
                {currentTask.links.map((link, index) => (
                  <li key={`${link.url}-${index}`}>
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

        <div className="flex items-center gap-4 pt-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "更新中..." : "変更を保存"}
          </Button>
          {statusMessage && (
            <span
              className={`text-sm ${
                statusType === "success" ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {statusMessage}
            </span>
          )}
        </div>
      </form>

      <Card title="履歴" description="状態遷移やコメントを時系列で表示します。">
        <div className="space-y-3 text-sm text-[#5b4c40]">
          {history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#ead8c4] bg-[#fffaf5] px-4 py-6 text-center text-[#b59b85]">
              履歴がありません。状態変更・コメント追加時に自動で記録されます。
            </div>
          ) : (
            <ol className="relative ml-3 border-l border-[#ead8c4] pl-5">
              {history.map((event) => (
                <li key={event.id} className="relative pb-6 last:pb-0">
                  <span className="absolute -left-[11px] mt-1.5 inline-flex h-3 w-3 items-center justify-center rounded-full border-2 border-white bg-[#c89b6d] shadow-sm shadow-[#c89b6d]/40" />
                  <div className="flex flex-col gap-2 rounded-xl border border-[#ead8c4] bg-white/70 px-4 py-3 shadow-sm shadow-[#ead8c4]/40">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-wide text-[#ad7a46]">
                      <span>{event.type}</span>
                      <span>{event.happenedAt}</span>
                    </div>
                    <p className="text-sm text-[#5b4c40]">
                      {event.details || "詳細なし"}
                    </p>
                    <p className="text-xs text-[#b59b85]">
                      {event.actorName} ({event.actorId})
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Card>
    </div>
  );
};

const DetailItem = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between">
    <dt className="text-xs uppercase text-[#ad7a46]">{label}</dt>
    <dd className="text-right font-medium text-[#3d3128]">{value}</dd>
  </div>
);

