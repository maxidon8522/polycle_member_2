"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { Session } from "next-auth";
import { Button } from "@/components/ui/button";

const TASK_STATUS_OPTIONS = [
  "未着手",
  "進行中",
  "レビュー待ち",
  "完了",
  "保留",
  "棄却",
] as const;

const TASK_PRIORITY_OPTIONS = ["高", "中", "低"] as const;

type FormState = {
  projectName: string;
  title: string;
  description: string;
  assigneeName: string;
  assigneeEmail: string;
  slackUserId: string;
  category: string;
  taskType: string;
  status: (typeof TASK_STATUS_OPTIONS)[number];
  progressPercent: string;
  priority: (typeof TASK_PRIORITY_OPTIONS)[number];
  importance: string;
  startDate: string;
  dueDate: string;
  doneDate: string;
  links: string;
  notes: string;
  watchers: string;
};

const parseLinks = (raw: string) => {
  const entries = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return entries.map((entry) => {
    const [label, url] = entry.split("|").map((item) => item.trim());
    if (url) {
      return { label: label || undefined, url };
    }
    return { url: label ?? "" };
  });
};

const parseWatchers = (raw: string): string[] => {
  return raw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

export default function TaskNewPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<"idle" | "success" | "error">(
    "idle",
  );

  const [formState, setFormState] = useState<FormState>({
    projectName: "",
    title: "",
    description: "",
    assigneeName: "",
    assigneeEmail: "",
    slackUserId: "",
    category: "",
    taskType: "",
    status: "未着手",
    progressPercent: "0",
    priority: "中",
    importance: "",
    startDate: "",
    dueDate: "",
    doneDate: "",
    links: "",
    notes: "",
    watchers: "",
  });

  useEffect(() => {
    let cancelled = false;
    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as Session;
        if (!cancelled) {
          setSession(data);
        }
      } catch (error) {
        console.error("tasks.new.session.error", error);
      } finally {
        if (!cancelled) {
          setLoadingSession(false);
        }
      }
    };

    loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const createdBy = useMemo(() => {
    if (!session?.user) {
      return "unknown";
    }
    return (
      session.user.name ??
      session.user.email ??
      session.user.slackUserId ??
      "unknown"
    );
  }, [session]);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setStatusMessage(null);
    setStatusType("idle");

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectName: formState.projectName.trim(),
          title: formState.title.trim(),
          description: formState.description,
          assigneeName: formState.assigneeName.trim(),
          assigneeEmail: formState.assigneeEmail.trim(),
          slackUserId: formState.slackUserId.trim() || undefined,
          category: formState.category.trim() || undefined,
          taskType: formState.taskType.trim() || undefined,
          status: formState.status,
          progressPercent: Number.parseInt(formState.progressPercent, 10) || 0,
          priority: formState.priority,
          importance: formState.importance.trim() || undefined,
          startDate: formState.startDate || undefined,
          dueDate: formState.dueDate || undefined,
          doneDate: formState.doneDate || undefined,
          links: parseLinks(formState.links),
          notes: formState.notes || undefined,
          createdBy,
          watchers: parseWatchers(formState.watchers),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message =
          typeof data.error === "string"
            ? data.error
            : "タスクの登録に失敗しました。";
        setStatusMessage(message);
        setStatusType("error");
        return;
      }

      const data = await response.json();
      setStatusMessage("タスクを登録しました。タスク詳細へ移動します。");
      setStatusType("success");
      setTimeout(() => {
        if (data?.data?.taskId) {
          router.push(`/tasks/${data.data.taskId}`);
        } else {
          router.push("/tasks");
        }
      }, 800);
    } catch (error) {
      console.error("tasks.new.submit.error", error);
      setStatusMessage("タスクの登録に失敗しました。");
      setStatusType("error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[#3d3128]">新規タスク</h1>
        <p className="text-sm text-[#7f6b5a]">
          プロジェクト名や担当者、期限、優先度を入力してタスクを登録します。
        </p>
      </header>

      <section className="rounded-2xl border border-[#ead8c4] bg-[#fffaf5] p-6 text-sm text-[#5b4c40]">
        <dl className="grid gap-3 md:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-widest text-[#ad7a46]">
              作成者
            </dt>
            <dd>{createdBy}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-widest text-[#ad7a46]">
              SlackユーザーID
            </dt>
            <dd>{session?.user?.slackUserId ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-widest text-[#ad7a46]">
              状態
            </dt>
            <dd>登録直後は {formState.status} です。</dd>
          </div>
        </dl>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="プロジェクト名"
            name="projectName"
            value={formState.projectName}
            onChange={handleChange}
            required
          />
          <TextField
            label="タスク名"
            name="title"
            value={formState.title}
            onChange={handleChange}
            required
          />
          <TextField
            label="担当者名"
            name="assigneeName"
            value={formState.assigneeName}
            onChange={handleChange}
            required
          />
          <TextField
            label="担当者メールアドレス"
            name="assigneeEmail"
            value={formState.assigneeEmail}
            onChange={handleChange}
            required
            type="email"
          />
          <TextField
            label="SlackユーザーID"
            name="slackUserId"
            value={formState.slackUserId}
            onChange={handleChange}
            placeholder="U0123456789"
          />
          <TextField
            label="カテゴリ"
            name="category"
            value={formState.category}
            onChange={handleChange}
          />
          <TextField
            label="タスク形式"
            name="taskType"
            value={formState.taskType}
            onChange={handleChange}
          />
          <TextField
            label="重要度（任意入力）"
            name="importance"
            value={formState.importance}
            onChange={handleChange}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <SelectField
            label="状態"
            name="status"
            value={formState.status}
            onChange={handleChange}
            options={TASK_STATUS_OPTIONS}
          />
          <SelectField
            label="優先度"
            name="priority"
            value={formState.priority}
            onChange={handleChange}
            options={TASK_PRIORITY_OPTIONS}
          />
          <TextField
            label="進捗率"
            name="progressPercent"
            value={formState.progressPercent}
            onChange={handleChange}
            type="number"
            min={0}
            max={100}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <TextField
            label="着手日"
            name="startDate"
            value={formState.startDate}
            onChange={handleChange}
            type="date"
          />
          <TextField
            label="期限"
            name="dueDate"
            value={formState.dueDate}
            onChange={handleChange}
            type="date"
          />
          <TextField
            label="完了日"
            name="doneDate"
            value={formState.doneDate}
            onChange={handleChange}
            type="date"
          />
        </div>

        <TextareaField
          label="タスク概要"
          name="description"
          value={formState.description}
          onChange={handleChange}
        />

        <TextareaField
          label="リンク（1行ごとに `ラベル|URL` または URL のみ）"
          name="links"
          value={formState.links}
          onChange={handleChange}
          placeholder="要件定義|https://example.com/spec"
        />

        <TextareaField
          label="備考"
          name="notes"
          value={formState.notes}
          onChange={handleChange}
        />

        <TextareaField
          label="ウォッチャー（カンマまたは改行区切り）"
          name="watchers"
          value={formState.watchers}
          onChange={handleChange}
          placeholder="山田太郎, 佐藤花子"
        />

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={submitting || loadingSession}>
            {submitting ? "登録中..." : "タスクを登録"}
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
    </div>
  );
}

const TextField = ({
  label,
  name,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
  min,
  max,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  min?: number;
  max?: number;
}) => (
  <div className="flex flex-col gap-1 text-sm">
    <label className="text-xs font-medium text-[#ad7a46]" htmlFor={name}>
      {label}
    </label>
    <input
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      type={type}
      placeholder={placeholder}
      min={min}
      max={max}
      className="rounded-xl border border-[#ead8c4] bg-white px-3 py-2 text-[#3d3128] shadow-inner focus:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8]"
    />
  </div>
);

const TextareaField = ({
  label,
  name,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
}) => (
  <div className="flex flex-col gap-1 text-sm">
    <label className="text-xs font-medium text-[#ad7a46]" htmlFor={name}>
      {label}
    </label>
    <textarea
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      rows={5}
      placeholder={placeholder}
      className="rounded-xl border border-[#ead8c4] bg-white px-3 py-2 text-[#3d3128] shadow-inner focus:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8]"
    />
  </div>
);

const SelectField = ({
  label,
  name,
  value,
  onChange,
  options,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  options: readonly string[];
}) => (
  <div className="flex flex-col gap-1 text-sm">
    <label className="text-xs font-medium text-[#ad7a46]" htmlFor={name}>
      {label}
    </label>
    <select
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      className="rounded-xl border border-[#ead8c4] bg-white px-3 py-2 text-[#3d3128] shadow-inner focus:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8]"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  </div>
);

