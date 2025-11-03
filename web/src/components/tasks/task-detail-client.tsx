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
    priority: task.priority,
    dueDate: task.dueDate ?? "",
    startDate: task.startDate ?? "",
    doneDate: task.doneDate ?? "",
    detailUrl: task.detailUrl ?? "",
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
            priority: formState.priority,
            startDate: formState.startDate,
            dueDate: formState.dueDate,
            doneDate: formState.doneDate,
            detailUrl: formState.detailUrl.trim(),
            notes: formState.notes.trim(),
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
            priority: updatedTask.priority,
            dueDate: updatedTask.dueDate ?? "",
            startDate: updatedTask.startDate ?? "",
            doneDate: updatedTask.doneDate ?? "",
            detailUrl: updatedTask.detailUrl ?? "",
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
          ステータスや期限、備考を更新すると履歴に記録されます。
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
            </dl>
          </Card>

          <Card title="スケジュール">
            <div className="space-y-3 text-sm">
              <LabeledInput
                label="開始日"
                name="startDate"
                type="date"
                value={formState.startDate}
                onChange={handleChange}
              />
              <LabeledInput
                label="期限"
                name="dueDate"
                type="date"
                value={formState.dueDate}
                onChange={handleChange}
              />
              <LabeledInput
                label="終了日"
                name="doneDate"
                type="date"
                value={formState.doneDate}
                onChange={handleChange}
              />
            </div>
          </Card>

          <Card title="詳細URL">
            <div className="space-y-3 text-sm text-[#5b4c40]">
              <input
                type="url"
                name="detailUrl"
                value={formState.detailUrl}
                onChange={handleChange}
                placeholder="https://example.com/task-detail"
                className="w-full rounded-xl border border-[#ead8c4] bg-white px-3 py-2 text-sm text-[#3d3128] shadow-inner focus:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8]"
              />
              <p className="text-xs text-[#b59b85]">
                入力しない場合は空欄のままで構いません。
              </p>
            </div>
          </Card>
        </div>

        <Card title="備考">
          <textarea
            name="notes"
            value={formState.notes}
            onChange={handleChange}
            rows={6}
            placeholder="共有したいメモがあれば入力してください。"
            className="w-full rounded-xl border border-[#ead8c4] bg-white px-3 py-2 text-sm text-[#3d3128] shadow-inner focus:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8]"
          />
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
              履歴がありません。更新すると自動で記録されます。
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

const LabeledInput = ({
  label,
  name,
  value,
  onChange,
  type,
}: {
  label: string;
  name: string;
  value: string;
  type: "date" | "text";
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) => (
  <div className="flex flex-col gap-1 text-sm">
    <label className="text-xs font-medium text-[#ad7a46]" htmlFor={name}>
      {label}
    </label>
    <input
      id={name}
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      className="rounded-xl border border-[#ead8c4] bg-white px-3 py-2 text-[#3d3128] shadow-inner focus:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8]"
    />
  </div>
);
