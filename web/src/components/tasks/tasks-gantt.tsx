"use client";

import { useMemo, useState } from "react";
import {
  Gantt,
  ViewMode,
  Task as GanttTaskItem,
} from "gantt-task-react";
import type { Task } from "@/types";

type TasksGanttProps = {
  tasks: Task[];
};

const STATUS_PROGRESS: Record<Task["status"], number> = {
  未着手: 0,
  進行中: 40,
  レビュー待ち: 70,
  完了: 100,
  保留: 10,
  棄却: 0,
};

const STATUS_COLORS: Record<
  Task["status"],
  { backgroundColor: string; progressColor: string }
> = {
  未着手: { backgroundColor: "#f1e6d8", progressColor: "#c8ad90" },
  進行中: { backgroundColor: "#fff4da", progressColor: "#f2a227" },
  レビュー待ち: { backgroundColor: "#e7f0ff", progressColor: "#4b79ff" },
  完了: { backgroundColor: "#e4f5e4", progressColor: "#4caf50" },
  保留: { backgroundColor: "#fef0f0", progressColor: "#f46d6d" },
  棄却: { backgroundColor: "#ebebeb", progressColor: "#9e9e9e" },
};

const fallbackStyle = {
  backgroundColor: "#f1e6d8",
  progressColor: "#c8ad90",
};

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const toGanttTask = (task: Task): GanttTaskItem | null => {
  const start = parseDate(task.startDate ?? task.dueDate);
  const end = parseDate(task.dueDate ?? task.startDate);
  if (!start || !end) {
    return null;
  }

  if (end.getTime() < start.getTime()) {
    end.setTime(start.getTime());
  }

  const styles =
    STATUS_COLORS[task.status] ??
    fallbackStyle;

  return {
    id: task.taskId,
    name: task.title || task.projectName,
    start,
    end,
    progress: STATUS_PROGRESS[task.status] ?? 0,
    type: "task",
    dependencies: [],
    project: task.projectName,
    isDisabled: false,
    styles: {
      backgroundColor: styles.backgroundColor,
      progressColor: styles.progressColor,
      backgroundSelectedColor: styles.backgroundColor,
      progressSelectedColor: styles.progressColor,
    },
  };
};

export const TasksGantt = ({ tasks }: TasksGanttProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Week);

  const ganttTasks = useMemo(() => {
    return tasks
      .map(toGanttTask)
      .filter((item): item is GanttTaskItem => item !== null)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [tasks]);

  if (ganttTasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#ead8c4] bg-[#fffaf5] px-4 py-6 text-center text-sm text-[#b59b85]">
        ガントチャートを表示できるタスク（開始日または期限が設定済み）がありません。
      </div>
    );
  }

  const viewOptions: { mode: ViewMode; label: string }[] = [
    { mode: ViewMode.Day, label: "日表示" },
    { mode: ViewMode.Week, label: "週表示" },
    { mode: ViewMode.Month, label: "月表示" },
  ];

  const columnWidth =
    viewMode === ViewMode.Day
      ? 80
      : viewMode === ViewMode.Week
        ? 150
        : 200;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#3d3128]">
            ガントチャート
          </h2>
          <p className="text-sm text-[#7f6b5a]">
            スプレッドシートの開始日・期限を元に自動描画しています。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {viewOptions.map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={[
                "rounded-full border px-3 py-1 text-xs font-semibold transition",
                viewMode === mode
                  ? "border-[#ad7a46] bg-[#ad7a46] text-white shadow-sm"
                  : "border-[#ead8c4] bg-white text-[#7f6b5a] hover:border-[#dcbfa5]",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#ead8c4] bg-white p-2 shadow-inner shadow-[#ead8c4]/40">
        <Gantt
          tasks={ganttTasks}
          viewMode={viewMode}
          columnWidth={columnWidth}
          listCellWidth="0"
          todayColor="#f46d6d"
          locale="ja-JP"
          barFill={60}
        />
      </div>
    </div>
  );
};
