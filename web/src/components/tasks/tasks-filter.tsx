"use client";

import { useCallback, useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { TaskPriority, TaskStatus } from "@/types";

type TasksFilterProps = {
  assignees: string[];
  projects: string[];
  categories: string[];
  selected: {
    assignee?: string;
    status?: TaskStatus;
    dueBefore?: string;
    priority?: TaskPriority;
    category?: string;
    project?: string;
  };
};

type FilterPatch = {
  assignee?: string | null;
  status?: TaskStatus | null;
  dueBefore?: string | null;
  priority?: TaskPriority | null;
  category?: string | null;
  project?: string | null;
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

const normalizeSpaces = (value: string) =>
  value
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/\u200B/g, "")
    .trim();

const toKey = (value: string) => normalizeSpaces(value).toLowerCase();

export const TasksFilter = ({
  assignees,
  projects,
  categories,
  selected,
}: TasksFilterProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const sortedAssignees = useMemo(() => {
    const map = new Map<string, string>();
    for (const raw of assignees) {
      const normalized = normalizeSpaces(raw);
      const key = toKey(raw);
      if (!normalized || key === "assignee") {
        continue;
      }
      if (!map.has(key)) {
        map.set(key, normalized);
      }
    }
    if (selected.assignee) {
      const normalizedSelected = normalizeSpaces(selected.assignee);
      const selectedKey = toKey(selected.assignee);
      if (normalizedSelected && !map.has(selectedKey)) {
        map.set(selectedKey, normalizedSelected);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "ja"));
  }, [assignees, selected.assignee]);

  const sortedProjects = useMemo(() => {
    const map = new Map<string, string>();
    for (const raw of projects) {
      const normalized = normalizeSpaces(raw);
      const key = toKey(raw);
      if (!normalized || key === "project" || key === "projects") {
        continue;
      }
      if (!map.has(key)) {
        map.set(key, normalized);
      }
    }
    if (selected.project) {
      const normalizedSelected = normalizeSpaces(selected.project);
      const selectedKey = toKey(selected.project);
      if (normalizedSelected && !map.has(selectedKey)) {
        map.set(selectedKey, normalizedSelected);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "ja"));
  }, [projects, selected.project]);

  const sortedCategories = useMemo(() => {
    const map = new Map<string, string>();
    for (const raw of categories) {
      const normalized = normalizeSpaces(raw);
      const key = toKey(raw);
      if (!normalized || key === "category" || key === "categories") {
        continue;
      }
      if (!map.has(key)) {
        map.set(key, normalized);
      }
    }
    if (selected.category) {
      const normalizedSelected = normalizeSpaces(selected.category);
      const selectedKey = toKey(selected.category);
      if (normalizedSelected && !map.has(selectedKey)) {
        map.set(selectedKey, normalizedSelected);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "ja"));
  }, [categories, selected.category]);

  const updateQuery = useCallback(
    (patch: FilterPatch) => {
      const params = new URLSearchParams(searchParams.toString());

      if ("assignee" in patch) {
        const value = normalizeSpaces(patch.assignee ?? "");
        if (value) {
          params.set("assignee", value);
        } else {
          params.delete("assignee");
        }
      }

      if ("status" in patch) {
        const value = patch.status;
        if (value) {
          params.set("status", value);
        } else {
          params.delete("status");
        }
      }

      if ("dueBefore" in patch) {
        const value = normalizeSpaces(patch.dueBefore ?? "");
        if (value) {
          params.set("dueBefore", value);
        } else {
          params.delete("dueBefore");
        }
      }

      if ("priority" in patch) {
        const value = patch.priority;
        if (value) {
          params.set("priority", value);
        } else {
          params.delete("priority");
        }
      }

      if ("category" in patch) {
        const value = normalizeSpaces(patch.category ?? "");
        if (value) {
          params.set("category", value);
        } else {
          params.delete("category");
        }
      }

      if ("project" in patch) {
        const value = normalizeSpaces(patch.project ?? "");
        if (value) {
          params.set("project", value);
        } else {
          params.delete("project");
        }
      }

      const queryString = params.toString();
      startTransition(() => {
        router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
          scroll: false,
        });
        router.refresh();
      });
    },
    [pathname, router, searchParams],
  );

  const resetFilters = () => {
    updateQuery({
      assignee: null,
      status: null,
      dueBefore: null,
      priority: null,
      category: null,
      project: null,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          className="h-7 px-3 text-xs text-[#ad7a46] hover:bg-[#f1e6d8]"
          onClick={resetFilters}
          disabled={isPending}
        >
          フィルタをリセット
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-[#ad7a46]">担当者</span>
          <select
            className="rounded-lg border border-[#ead8c4] bg-white px-3 py-2 text-sm text-[#3d3128] transition focus:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8]"
            value={selected.assignee ?? ""}
            onChange={(event) =>
              updateQuery({ assignee: event.target.value || null })
            }
            disabled={isPending}
          >
            <option value="">すべて</option>
            {sortedAssignees.map((assignee) => (
              <option key={assignee} value={assignee}>
                {assignee}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-[#ad7a46]">状態</span>
          <select
            className="rounded-lg border border-[#ead8c4] bg-white px-3 py-2 text-sm text-[#3d3128] transition focus:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8]"
            value={selected.status ?? ""}
            onChange={(event) =>
              updateQuery({
                status: (event.target.value || null) as TaskStatus | null,
              })
            }
            disabled={isPending}
          >
            <option value="">すべて</option>
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-[#ad7a46]">期限</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="w-full rounded-lg border border-[#ead8c4] bg-white px-3 py-2 text-sm text-[#3d3128] transition focus:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8]"
              value={selected.dueBefore ?? ""}
              onChange={(event) =>
                updateQuery({
                  dueBefore: event.target.value || null,
                })
              }
              disabled={isPending}
            />
            {selected.dueBefore && (
              <Button
                type="button"
                variant="ghost"
                className="h-8 px-3 text-xs text-[#ad7a46] hover:bg-[#f1e6d8]"
                onClick={() => updateQuery({ dueBefore: null })}
                disabled={isPending}
              >
                クリア
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-[#ad7a46]">重要度</span>
          <select
            className="rounded-lg border border-[#ead8c4] bg-white px-3 py-2 text-sm text-[#3d3128] transition focus:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8]"
            value={selected.priority ?? ""}
            onChange={(event) =>
              updateQuery({
                priority: (event.target.value || null) as TaskPriority | null,
              })
            }
            disabled={isPending}
          >
            <option value="">すべて</option>
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-[#ad7a46]">カテゴリ</span>
          <select
            className="rounded-lg border border-[#ead8c4] bg-white px-3 py-2 text-sm text-[#3d3128] transition focus:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8]"
            value={selected.category ?? ""}
            onChange={(event) =>
              updateQuery({ category: event.target.value || null })
            }
            disabled={isPending}
          >
            <option value="">すべて</option>
            {sortedCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-[#ad7a46]">プロジェクト</span>
          <select
            className="rounded-lg border border-[#ead8c4] bg-white px-3 py-2 text-sm text-[#3d3128] transition focus:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8]"
            value={selected.project ?? ""}
            onChange={(event) =>
              updateQuery({ project: event.target.value || null })
            }
            disabled={isPending}
          >
            <option value="">すべて</option>
            {sortedProjects.map((project) => (
              <option key={project} value={project}>
                {project}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
