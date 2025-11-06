"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Task } from "@/types";

type TasksTableProps = {
  tasks: Task[];
};

const PRIORITY_FILTER_OPTIONS: Task["priority"][] = ["高", "中", "低"];

const normalizeText = (value?: string | null) =>
  (value ?? "")
    .normalize("NFKC")
    .replace(/\u200B/g, "")
    .replace(/\+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const matchesQuery = (task: Task, query: string) => {
  if (!query) return true;
  const normalizedFields = [
    task.title,
    task.projectName,
    task.assigneeName,
    task.notes,
    task.detailUrl,
    task.sheetTitle,
    (task.tags ?? []).join(" "),
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  return normalizedFields.some((value) => value.includes(query));
};

const toTimestamp = (value?: string | null): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export const TasksTable = ({ tasks }: TasksTableProps) => {
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Task["priority"]>(
    "all",
  );
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [now] = useState(() => Date.now());

  const normalizedQuery = normalizeText(query);

  const dueFromTimestamp = useMemo(() => {
    if (!dueFrom) {
      return null;
    }
    const timestamp = Date.parse(dueFrom);
    return Number.isNaN(timestamp) ? null : timestamp;
  }, [dueFrom]);

  const dueToTimestamp = useMemo(() => {
    if (!dueTo) {
      return null;
    }
    const timestamp = Date.parse(dueTo);
    if (Number.isNaN(timestamp)) {
      return null;
    }
    return timestamp + 24 * 60 * 60 * 1000 - 1;
  }, [dueTo]);

  const hasRangeError =
    dueFromTimestamp !== null &&
    dueToTimestamp !== null &&
    dueFromTimestamp > dueToTimestamp;

  const hasActiveFilters =
    Boolean(normalizedQuery) ||
    priorityFilter !== "all" ||
    Boolean(dueFrom) ||
    Boolean(dueTo);

  const resetFilters = () => {
    setQuery("");
    setPriorityFilter("all");
    setDueFrom("");
    setDueTo("");
  };

  const filteredTasks = useMemo(() => {
    if (hasRangeError) {
      return [];
    }

    return tasks.filter((task) => {
      if (normalizedQuery && !matchesQuery(task, normalizedQuery)) {
        return false;
      }
      if (priorityFilter !== "all" && task.priority !== priorityFilter) {
        return false;
      }
      if (dueFromTimestamp !== null || dueToTimestamp !== null) {
        if (!task.dueDate) {
          return false;
        }
        const due = toTimestamp(task.dueDate);
        if (due === null) {
          return false;
        }
        if (dueFromTimestamp !== null && due < dueFromTimestamp) {
          return false;
        }
        if (dueToTimestamp !== null && due > dueToTimestamp) {
          return false;
        }
      }
      return true;
    });
  }, [
    tasks,
    normalizedQuery,
    priorityFilter,
    dueFromTimestamp,
    dueToTimestamp,
    hasRangeError,
  ]);

  const fieldLabelClass =
    "text-xs font-semibold uppercase tracking-widest text-[#ad7a46]";
  const inputBaseClass =
    "w-full rounded-full border border-[#ead8c4] bg-white px-4 py-2 text-sm text-[#3d3128] placeholder:text-[#c8b5a2] focus:border-[#ad7a46] focus:outline-none focus:ring-2 focus:ring-[#ead8c4]";
  const dateInputClass =
    "w-full rounded-full border border-[#ead8c4] bg-white px-3 py-2 text-sm text-[#3d3128] focus:border-[#ad7a46] focus:outline-none focus:ring-2 focus:ring-[#ead8c4]";

  const renderDueDateBadge = (task: Task) => {
    if (!task.dueDate) {
      return <span className="text-xs text-[#b59b85]">未設定</span>;
    }

    const due = toTimestamp(task.dueDate);
    const baseClass =
      "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium";
    if (due === null) {
      return (
        <div className={`${baseClass} bg-white/70 text-[#7f6b5a]`}>
          <span className="inline-flex h-2 w-2 rounded-full bg-[#c89b6d]" />
          {task.dueDate}
        </div>
      );
    }

    if (due < now && task.status !== "完了") {
      return (
        <div className={`${baseClass} bg-[#fbe8e6] text-[#c04747]`}>
          <span className="inline-flex h-2 w-2 rounded-full bg-[#c04747]" />
          {task.dueDate}
        </div>
      );
    }

    const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 3 && task.status !== "完了") {
      return (
        <div className={`${baseClass} bg-[#fff4da] text-[#ad7a46]`}>
          <span className="inline-flex h-2 w-2 rounded-full bg-[#c89b6d]" />
          {task.dueDate}
        </div>
      );
    }

    return (
      <div className={`${baseClass} bg-white/70 text-[#7f6b5a]`}>
        <span className="inline-flex h-2 w-2 rounded-full bg-[#c89b6d]" />
        {task.dueDate}
      </div>
    );
  };

  const renderEmptyState = () => {
    if (tasks.length === 0) {
      return (
        <tr>
          <td
            colSpan={7}
            className="px-4 py-8 text-center text-sm text-[#b59b85]"
          >
            タスクデータがありません。Google Sheets連携完了後に表示されます。
          </td>
        </tr>
      );
    }

    return (
      <tr>
        <td
          colSpan={7}
          className="px-4 py-8 text-center text-sm text-[#b59b85]"
        >
          条件に一致するタスクがありません。検索条件を見直してください。
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-1 flex-wrap items-end gap-3">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 md:min-w-[260px]">
            <span className={fieldLabelClass}>キーワード</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="タスク名・PJ名・担当者"
              className={inputBaseClass}
            />
          </label>
          <label className="flex w-full max-w-[160px] flex-col gap-1">
            <span className={fieldLabelClass}>優先度</span>
            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value as "all" | Task["priority"])
              }
              className={inputBaseClass}
            >
              <option value="all">すべて</option>
              {PRIORITY_FILTER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-1 flex-wrap items-end gap-3">
            <label className="flex min-w-[160px] flex-col gap-1">
              <span className={fieldLabelClass}>期限(開始)</span>
              <input
                type="date"
                value={dueFrom}
                onChange={(event) => setDueFrom(event.target.value)}
                className={dateInputClass}
              />
            </label>
            <label className="flex min-w-[160px] flex-col gap-1">
              <span className={fieldLabelClass}>期限(終了)</span>
              <input
                type="date"
                value={dueTo}
                onChange={(event) => setDueTo(event.target.value)}
                className={dateInputClass}
              />
            </label>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 text-xs text-[#7f6b5a]">
          <div>
            表示中 {filteredTasks.length} 件 / 全体 {tasks.length} 件
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-full border border-[#ead8c4] px-3 py-2 text-xs font-semibold text-[#ad7a46] transition hover:bg-[#fff4da]"
            >
              条件をリセット
            </button>
          )}
        </div>
      </div>
      {hasRangeError && (
        <p className="text-xs font-semibold text-[#c04747]">
          期限(開始)は期限(終了)より前の日付を選択してください。
        </p>
      )}

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
            {filteredTasks.length === 0
              ? renderEmptyState()
              : filteredTasks.map((task) => (
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
                    <td className="px-4 py-3">{renderDueDateBadge(task)}</td>
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
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
