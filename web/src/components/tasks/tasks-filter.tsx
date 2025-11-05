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

const normalizeOption = (value: string) => value.trim();

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

  const sortedAssignees = useMemo(
    () =>
      [...new Set(assignees.map(normalizeOption).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "ja"),
      ),
    [assignees],
  );

  const sortedProjects = useMemo(
    () =>
      [...new Set(projects.map(normalizeOption).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "ja"),
      ),
    [projects],
  );

  const sortedCategories = useMemo(
    () =>
      [...new Set(categories.map(normalizeOption).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "ja"),
      ),
    [categories],
  );

  const updateQuery = useCallback(
    (patch: FilterPatch) => {
      const params = new URLSearchParams(searchParams.toString());

      if ("assignee" in patch) {
        const value = patch.assignee;
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
        const value = patch.dueBefore;
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
        const value = patch.category;
        if (value) {
          params.set("category", value);
        } else {
          params.delete("category");
        }
      }

      if ("project" in patch) {
        const value = patch.project;
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
            disabled={isPending || sortedAssignees.length === 0}
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
            disabled={isPending || sortedCategories.length === 0}
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
            disabled={isPending || sortedProjects.length === 0}
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

