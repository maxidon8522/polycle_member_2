import { formatInTimeZone } from "date-fns-tz";
import type { WeeklySatisfactionPoint } from "@/types";
import { DEFAULT_TIMEZONE } from "@/config/constants";

interface WeeklySatisfactionChartProps {
  title: string;
  description?: string;
  color?: string;
  points: WeeklySatisfactionPoint[];
  emptyMessage?: string;
}

const DEFAULT_COLOR = "#c89b6d";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const WeeklySatisfactionChart = ({
  title,
  description,
  color = DEFAULT_COLOR,
  points,
  emptyMessage = "まだ十分なデータがありません。",
}: WeeklySatisfactionChartProps) => {
  const gradientId = `satisfactionArea-${title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "") || "default"}`;

  const sortedPoints = [...points].sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart),
  );

  const latest = sortedPoints.at(-1) ?? null;
  const previous = sortedPoints.length >= 2 ? sortedPoints.at(-2) : null;
  const delta =
    latest && previous
      ? Number((latest.averageScore - previous.averageScore).toFixed(2))
      : null;

  const values = sortedPoints.map((point) => point.averageScore);
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 1;

  const paddedMin = Math.min(Math.floor(minValue * 10) / 10, 0);
  const paddedMax = Math.max(Math.ceil(maxValue * 10) / 10, 5);

  const chartWidth = 280;
  const chartHeight = 160;
  const margin = { top: 16, right: 16, bottom: 30, left: 28 };
  const innerWidth = chartWidth - margin.left - margin.right;
  const innerHeight = chartHeight - margin.top - margin.bottom;

  const yScale = (value: number) => {
    const range = paddedMax - paddedMin || 1;
    const ratio = (value - paddedMin) / range;
    const y = margin.top + innerHeight * (1 - ratio);
    return clamp(y, margin.top, margin.top + innerHeight);
  };

  const xScale = (index: number, total: number) => {
    if (total <= 1) {
      return margin.left + innerWidth / 2;
    }
    const step = innerWidth / (total - 1);
    return margin.left + step * index;
  };

  const chartPoints = sortedPoints.map((point, index) => ({
    x: xScale(index, sortedPoints.length),
    y: yScale(point.averageScore),
    point,
  }));

  const pathD =
    chartPoints.length > 0
      ? chartPoints
          .map(({ x, y }, index) =>
            `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`,
          )
          .join(" ")
      : "";

  const areaD =
    chartPoints.length > 0
      ? [
          `M ${chartPoints[0]!.x.toFixed(2)} ${(
            margin.top +
            innerHeight
          ).toFixed(2)}`,
          ...chartPoints.map(
            ({ x, y }) => `L ${x.toFixed(2)} ${y.toFixed(2)}`,
          ),
          `L ${chartPoints.at(-1)!.x.toFixed(2)} ${(
            margin.top +
            innerHeight
          ).toFixed(2)}`,
          "Z",
        ].join(" ")
      : "";

  const axisLabels =
    sortedPoints.length > 0
      ? sortedPoints.map((point) => ({
          weekStart: point.weekStart,
          label: formatInTimeZone(
            point.weekStart,
            DEFAULT_TIMEZONE,
            "M/d",
          ),
        }))
      : [];

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-[#3d3128]">{title}</h4>
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-[#7f6b5a]">
              {description}
            </p>
          )}
        </div>
        {latest && (
          <div className="text-right text-xs text-[#7f6b5a]">
            <div className="text-[11px] uppercase tracking-[0.16em] text-[#b59b85]">
              最新
            </div>
            <div className="flex items-baseline justify-end gap-1 whitespace-nowrap">
              <span className="text-lg font-semibold text-[#3d3128]">
                {latest.averageScore.toFixed(2)}
              </span>
              <span className="text-[11px] text-[#b59b85]">
                {latest.sampleSize}件
              </span>
            </div>
            {delta !== null && (
              <div
                className={[
                  "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  delta > 0
                    ? "bg-[#f0faf2] text-[#1d9a57]"
                    : delta < 0
                      ? "bg-[#fbe8e6] text-[#c04747]"
                      : "bg-[#f5f0ea] text-[#7f6b5a]",
                ].join(" ")}
              >
                <span>{delta > 0 ? "↗" : delta < 0 ? "↘" : "→"}</span>
                <span>
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(2)} vs 前週
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[#ead8c4] bg-white/85 p-4">
        {chartPoints.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#b59b85]">
            {emptyMessage}
          </div>
        ) : (
          <>
            <svg
              width={chartWidth}
              height={chartHeight}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              role="img"
              aria-label={`${title} の折れ線グラフ`}
              className="w-full"
            >
              <defs>
                <linearGradient
                  id={gradientId}
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={color}
                    stopOpacity={0.18}
                  />
                  <stop
                    offset="100%"
                    stopColor={color}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>

              <rect
                x={margin.left}
                y={margin.top}
                width={innerWidth}
                height={innerHeight}
                fill="#fffaf5"
                stroke="#f1e6d8"
                strokeDasharray="6 6"
                strokeWidth={1}
                rx={12}
                ry={12}
              />

              {[0, 0.5, 1].map((ratio) => {
                const y =
                  margin.top + innerHeight * ratio;
                const value =
                  paddedMax - (paddedMax - paddedMin) * ratio;
                return (
                  <g key={ratio}>
                    <line
                      x1={margin.left}
                      y1={y}
                      x2={margin.left + innerWidth}
                      y2={y}
                      stroke="#ead8c4"
                      strokeDasharray="4 6"
                      strokeWidth={0.8}
                    />
                    <text
                      x={margin.left - 8}
                      y={y + 4}
                      textAnchor="end"
                      fontSize={10}
                      fill="#b59b85"
                    >
                      {value.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              <path
                d={areaD}
                fill={`url(#${gradientId})`}
                stroke="none"
              />

              <path
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth={2.5}
                strokeLinecap="round"
              />

              {chartPoints.map(({ x, y, point }, index) => (
                <g key={point.weekStart}>
                  <circle
                    cx={x}
                    cy={y}
                    r={5}
                    fill="#fff"
                    stroke={color}
                    strokeWidth={2}
                  />
                  <text
                    x={x}
                    y={y - 10}
                    fontSize={10}
                    fill="#7f6b5a"
                    textAnchor="middle"
                  >
                    {point.averageScore.toFixed(1)}
                  </text>
                  {index === chartPoints.length - 1 && (
                    <text
                      x={x}
                      y={y + 18}
                      fontSize={10}
                      fill="#b59b85"
                      textAnchor="middle"
                    >
                      {point.sampleSize}件
                    </text>
                  )}
                </g>
              ))}
            </svg>

            <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] text-[#7f6b5a]">
              {axisLabels.map((item) => (
                <div
                  key={item.weekStart}
                  className="rounded-lg bg-[#fff4e5] px-2 py-1 text-center font-medium text-[#ad7a46]"
                >
                  {item.label}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
