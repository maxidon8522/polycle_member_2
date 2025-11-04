"use client";

import { useMemo, useState } from "react";
import type { FC } from "react";
import { Gantt, ViewMode, type Task as GanttTaskItem } from "gantt-task-react";
import type { Task } from "@/types";

type TasksGanttProps = {
  tasks: Task[];
};

type StatusMeta = {
  background: string;
  progress: string;
  description: string;
  defaultProgress: number;
};

const STATUS_META: Record<Task["status"], StatusMeta> = {
  未着手: {
    background: "#f5e8d8",
    progress: "#d9bb93",
    description: "未着手",
    defaultProgress: 0,
  },
  進行中: {
    background: "#ffe9c7",
    progress: "#f7a436",
    description: "進行中",
    defaultProgress: 45,
  },
  レビュー待ち: {
    background: "#dfe8ff",
    progress: "#4b79ff",
    description: "レビュー待ち",
    defaultProgress: 70,
  },
  完了: {
    background: "#dff0df",
    progress: "#4caf50",
    description: "完了",
    defaultProgress: 100,
  },
  保留: {
    background: "#ffe1e1",
    progress: "#f46d6d",
    description: "保留",
    defaultProgress: 10,
  },
  棄却: {
    background: "#e5e5e5",
    progress: "#9e9e9e",
    description: "棄却",
    defaultProgress: 0,
  },
};

const STATUS_ORDER: Task["status"][] = [
  "進行中",
  "レビュー待ち",
  "完了",
  "未着手",
  "保留",
  "棄却",
];

const parseDate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const resolveDate = (
  ...candidates: Array<string | undefined | null>
): Date | null => {
  for (const candidate of candidates) {
    const parsed = parseDate(candidate);
    if (parsed) {
      return parsed;
    }
  }
  return null;
};

const formatDate = (date: Date | null): string => {
  if (!date) {
    return "未設定";
  }
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
  }).format(date);
};

type ExtendedGanttTask = GanttTaskItem & { payload: Task };

const toGanttTask = (task: Task): ExtendedGanttTask | null => {
  const startCandidate =
    resolveDate(task.startDate, task.dueDate, task.createdAt) ?? new Date();
  const endCandidate =
    resolveDate(task.dueDate, task.doneDate, task.startDate) ?? startCandidate;

  const normalizedStart = new Date(startCandidate.getTime());
  const normalizedEnd = new Date(endCandidate.getTime());

  if (normalizedEnd.getTime() < normalizedStart.getTime()) {
    normalizedEnd.setTime(normalizedStart.getTime());
  }

  const statusMeta = STATUS_META[task.status] ?? STATUS_META["未着手"];

  return {
    id: task.taskId,
    name: task.title || task.projectName || "名称未設定",
    start: normalizedStart,
    end: normalizedEnd,
    progress: statusMeta.defaultProgress,
    type: "task",
    dependencies: [],
    project: task.projectName,
    isDisabled: false,
    styles: {
      backgroundColor: statusMeta.background,
      progressColor: statusMeta.progress,
      backgroundSelectedColor: statusMeta.background,
      progressSelectedColor: statusMeta.progress,
    },
    payload: task,
  };
};

type TaskListHeaderProps = {
  headerHeight: number;
  rowWidth: string;
  fontFamily: string;
  fontSize: string;
};

const TaskListHeader: FC<TaskListHeaderProps> = ({
  headerHeight,
  rowWidth,
  fontFamily,
  fontSize,
}) => {
  const width = Number.parseFloat(rowWidth) || 320;
  const [nameWidth, startWidth, endWidth] = [
    `${width * 0.5}px`,
    `${width * 0.25}px`,
    `${width * 0.25}px`,
  ];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: headerHeight,
        fontFamily,
        fontSize,
        fontWeight: 600,
        color: "#3d3128",
        padding: "0 12px",
      }}
    >
      <div style={{ width: nameWidth }}>タスク名</div>
      <div style={{ width: startWidth }}>開始</div>
      <div style={{ width: endWidth }}>期限</div>
    </div>
  );
};

type TaskListTableProps = {
  rowHeight: number;
  rowWidth: string;
  fontFamily: string;
  fontSize: string;
  locale: string;
  tasks: GanttTaskItem[];
  selectedTaskId: string;
  setSelectedTask: (taskId: string) => void;
  onExpanderClick: (task: GanttTaskItem) => void;
  onRowSelect?: (taskId: string) => void;
};

const TaskListTable: FC<TaskListTableProps> = ({
  rowHeight,
  rowWidth,
  fontFamily,
  fontSize,
  tasks,
  selectedTaskId,
  setSelectedTask,
  onRowSelect,
}) => {
  const width = Number.parseFloat(rowWidth) || 320;
  const [nameWidth, startWidth, endWidth] = [
    `${width * 0.5}px`,
    `${width * 0.25}px`,
    `${width * 0.25}px`,
  ];
  const extendedTasks = tasks as ExtendedGanttTask[];

  return (
    <div style={{ fontFamily, fontSize }}>
      {extendedTasks.map((task) => {
        const isSelected = task.id === selectedTaskId;
        const assignee = task.payload.assigneeName || "";
        const project = task.payload.projectName || "";
        const meta = STATUS_META[task.payload.status] ?? STATUS_META["未着手"];

        return (
          <div
            key={task.id}
            style={{
              display: "flex",
              alignItems: "center",
              height: rowHeight,
              padding: "0 12px",
              backgroundColor: isSelected ? "#fbead8" : undefined,
              borderBottom: "1px solid #f1e6d8",
              cursor: "pointer",
            }}
            onClick={() => {
              setSelectedTask(task.id);
              onRowSelect?.(task.id);
            }}
          >
            <div
              style={{
                width: nameWidth,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontWeight: 600,
                color: "#3d3128",
              }}
              title={task.name}
            >
              {task.name}
              {(assignee || project) && (
                <div
                  style={{
                    marginTop: 2,
                    fontSize: "11px",
                    color: "#ad7a46",
                    fontWeight: 500,
                  }}
                >
                  {[
                    assignee ? `担当: ${assignee}` : null,
                    project ? `PJ: ${project}` : null,
                  ]
                    .filter(Boolean)
                    .join(" / ")}
                </div>
              )}
            </div>
            <div
              style={{
                width: startWidth,
                color: meta.progress,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatDate(task.start ?? null)}
            </div>
            <div
              style={{
                width: endWidth,
                color: meta.progress,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatDate(task.end ?? null)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const StatusLegend = () => (
  <div className="rounded-2xl border border-[#ead8c4] bg-[#fffaf5] p-4">
    <h3 className="text-sm font-semibold text-[#7f6b5a]">ステータスの凡例</h3>
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#5b4c40]">
      {STATUS_ORDER.map((status) => {
        const meta = STATUS_META[status];
        if (!meta) return null;
        return (
          <div
            key={status}
            className="flex items-center gap-2 rounded-full border border-[#ead8c4] bg-white px-3 py-1 shadow-sm"
          >
            <span
              className="inline-flex h-3 w-3 rounded-full border border-[#ad7a46]"
              style={{ backgroundColor: meta.background }}
            />
            <span>{meta.description}</span>
          </div>
        );
      })}
    </div>
  </div>
);

export const TasksGantt = ({ tasks }: TasksGanttProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Week);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const ganttTasks = useMemo<ExtendedGanttTask[]>(() => {
    return tasks
      .map(toGanttTask)
      .filter((item): item is ExtendedGanttTask => item !== null)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [tasks]);

  const hasRenderableTasks = ganttTasks.length > 0;

  const viewOptions: { mode: ViewMode; label: string }[] = [
    { mode: ViewMode.Day, label: "日表示" },
    { mode: ViewMode.Week, label: "週表示" },
    { mode: ViewMode.Month, label: "月表示" },
  ];

  const columnWidth =
    viewMode === ViewMode.Day
      ? 110
      : viewMode === ViewMode.Week
        ? 190
        : 240;

  const ganttHeight = Math.max(360, ganttTasks.length * 64);

  return (
    <div className="tasks-gantt space-y-5">
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

      <div className="rounded-2xl border border-[#ead8c4] bg-white p-4 shadow-inner shadow-[#ead8c4]/40">
        {hasRenderableTasks ? (
          <Gantt
            tasks={ganttTasks}
            viewMode={viewMode}
            columnWidth={columnWidth}
            listCellWidth="320px"
            todayColor="#f46d6d"
            locale="ja-JP"
            barFill={55}
            fontSize="13px"
            headerHeight={56}
            rowHeight={56}
            ganttHeight={ganttHeight}
            barCornerRadius={8}
            onSelect={(task, isSelected) =>
              setSelectedTaskId(isSelected ? task.id : null)
            }
            onClick={(task) => setSelectedTaskId(task.id)}
            TaskListHeader={TaskListHeader}
            TaskListTable={(props) => (
              <TaskListTable
                {...props}
                selectedTaskId={selectedTaskId ?? ""}
                onRowSelect={(taskId) => setSelectedTaskId(taskId)}
              />
            )}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-[#ead8c4] bg-[#fffaf5] px-4 py-6 text-center text-sm text-[#b59b85]">
            ガントチャートを表示できるタスク（開始日または期限が設定済み）がありません。
          </div>
        )}
      </div>

      <StatusLegend />
    </div>
  );
};
