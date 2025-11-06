"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DailyReport } from "@/types";
import { resolveDepartment } from "@/config/departments";

type DailyReportsTableProps = {
  reports: DailyReport[];
};

type SatisfactionFilter = "all" | "high" | "low";

const PREVIEW_LENGTH = 9;

const truncate = (value: string, maxLength = PREVIEW_LENGTH): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  const graphemes = Array.from(normalized);
  if (graphemes.length <= maxLength) {
    return normalized;
  }
  return `${graphemes.slice(0, maxLength).join("")}…`;
};

const formatDateLabel = (isoDate: string): string => {
  if (!isoDate) return "—";
  const match = isoDate.match(/^\d{4}-(\d{2}-\d{2})$/);
  if (match) {
    return match[1];
  }
  return isoDate;
};

const parseSatisfactionScore = (value: string): number | null => {
  if (!value) return null;
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const score = Number.parseFloat(match[0]);
  return Number.isFinite(score) ? score : null;
};

const normalize = (value: string): string =>
  value
    .normalize("NFKC")
    .replace(/\u200B/g, "")
    .replace(/\+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const buildDepartmentMap = (reports: DailyReport[]): Map<string, string> => {
  const map = new Map<string, string>();
  reports.forEach((report) => {
    const department =
      resolveDepartment({
        userSlug: report.userSlug,
        slackUserId: report.slackUserId,
        email: report.email,
      }) ?? "Unassigned";
    map.set(report.userSlug, department);
  });
  return map;
};

const getReportDepartment = (
  report: DailyReport,
  departmentMap: Map<string, string>,
): string => {
  const department = departmentMap.get(report.userSlug);
  return department ?? "Unassigned";
};

export const DailyReportsTable = ({ reports }: DailyReportsTableProps) => {
  const departmentMap = useMemo(() => buildDepartmentMap(reports), [reports]);
  const departmentOptions = useMemo(() => {
    const unique = new Set<string>();
    departmentMap.forEach((department) => unique.add(department));
    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
  }, [departmentMap]);

  const userOptions = useMemo(() => {
    const unique = new Set<string>(
      reports.map((report) => report.userName).filter(Boolean),
    );
    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
  }, [reports]);

  const [selectedDate, setSelectedDate] = useState("");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [satisfactionFilter, setSatisfactionFilter] =
    useState<SatisfactionFilter>("all");
  const [tagFilter, setTagFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  const normalizedTagFilter = normalize(tagFilter);
  const hasActiveFilters =
    Boolean(selectedDate) ||
    userFilter !== "all" ||
    satisfactionFilter !== "all" ||
    Boolean(normalizedTagFilter) ||
    departmentFilter !== "all";

  const resetFilters = () => {
    setSelectedDate("");
    setUserFilter("all");
    setSatisfactionFilter("all");
    setTagFilter("");
    setDepartmentFilter("all");
  };

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      if (selectedDate && report.date !== selectedDate) {
        return false;
      }

      if (userFilter !== "all" && report.userName !== userFilter) {
        return false;
      }

      if (satisfactionFilter !== "all") {
        const score = parseSatisfactionScore(report.satisfactionToday);
        if (satisfactionFilter === "high") {
          if (score === null || score < 5) {
            return false;
          }
        } else if (satisfactionFilter === "low") {
          if (score === null || score >= 5) {
            return false;
          }
        }
      }

      if (normalizedTagFilter) {
        const tags = report.tags ?? [];
        const normalizedTags = tags.map((tag) => normalize(tag));
        const matchesTag = normalizedTags.some((tag) =>
          tag.includes(normalizedTagFilter),
        );
        if (!matchesTag) {
          return false;
        }
      }

      if (departmentFilter !== "all") {
        const department = getReportDepartment(report, departmentMap);
        if (department !== departmentFilter) {
          return false;
        }
      }

      return true;
    });
  }, [
    reports,
    selectedDate,
    userFilter,
    satisfactionFilter,
    normalizedTagFilter,
    departmentFilter,
    departmentMap,
  ]);

  const labelClass =
    "text-xs font-semibold uppercase tracking-widest text-[#ad7a46]";
  const inputClass =
    "w-full rounded-full border border-[#ead8c4] bg-white px-3 py-2 text-sm text-[#3d3128] focus:border-[#ad7a46] focus:outline-none focus:ring-2 focus:ring-[#ead8c4]";

  const renderPreview = (value: string) => {
    const preview = truncate(value);
    return preview || "—";
  };

  const renderTagsPreview = (tags: string[]) => {
    if (!tags || tags.length === 0) {
      return "タグなし";
    }
    const normalized = tags.map((tag) => `#${tag}`.trim()).filter(Boolean);
    const preview = truncate(normalized.join(" "));
    return preview || "タグなし";
  };

  const unmatchedMessage =
    reports.length === 0
      ? "表示できるデータがありません。Slack取り込み・Google Sheets連携を構築後に表示されます。"
      : "条件に一致するレポートがありません。検索条件を見直してください。";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap gap-3">
          <label className="flex min-w-[160px] flex-1 flex-col gap-1">
            <span className={labelClass}>日付</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex min-w-[180px] flex-1 flex-col gap-1">
            <span className={labelClass}>ユーザー</span>
            <select
              value={userFilter}
              onChange={(event) => setUserFilter(event.target.value)}
              className={inputClass}
            >
              <option value="all">すべて</option>
              {userOptions.map((user) => (
                <option key={user} value={user}>
                  {user}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[160px] flex-1 flex-col gap-1">
            <span className={labelClass}>満足度</span>
            <select
              value={satisfactionFilter}
              onChange={(event) =>
                setSatisfactionFilter(event.target.value as SatisfactionFilter)
              }
              className={inputClass}
            >
              <option value="all">すべて</option>
              <option value="high">高い(5以上)</option>
              <option value="low">低い(5未満)</option>
            </select>
          </label>
        </div>
        <div className="flex flex-1 flex-wrap gap-3">
          <label className="flex min-w-[180px] flex-1 flex-col gap-1">
            <span className={labelClass}>タグ</span>
            <input
              type="search"
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              placeholder="タグを入力"
              className={inputClass}
            />
          </label>
          <label className="flex min-w-[180px] flex-1 flex-col gap-1">
            <span className={labelClass}>部署</span>
            <select
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
              className={inputClass}
            >
              <option value="all">すべて</option>
              {departmentOptions.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-full border border-[#ead8c4] px-4 py-2 text-xs font-semibold text-[#ad7a46] transition hover:bg-[#fff4da]"
              >
                条件をリセット
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-[#7f6b5a]">
        <div>
          表示中 {filteredReports.length} 件 / 全体 {reports.length} 件
        </div>
      </div>

      <div className="relative overflow-visible rounded-xl border border-dashed border-[#ead8c4] bg-[#fffaf5]">
        <table className="min-w-full divide-y divide-[#ead8c4] text-sm">
          <thead className="bg-[#f9efe3] text-left text-xs uppercase tracking-wide text-[#ad7a46]">
            <tr>
              <th className="px-4 py-3 font-semibold">日付</th>
              <th className="px-4 py-3 font-semibold">ユーザー</th>
              <th className="px-4 py-3 font-semibold">満足度</th>
              <th className="px-4 py-3 font-semibold">Done</th>
              <th className="px-4 py-3 font-semibold">Good/More+背景</th>
              <th className="px-4 py-3 font-semibold">More Next</th>
              <th className="px-4 py-3 font-semibold">明日タスク</th>
              <th className="px-4 py-3 font-semibold">明日やりたい</th>
              <th className="px-4 py-3 font-semibold">個人ニュース</th>
              <th className="px-4 py-3 font-semibold">タグ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1e6d8] bg-[#fffdf9] text-[#5b4c40]">
            {filteredReports.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-8 text-center text-sm text-[#b59b85]"
                >
                  {unmatchedMessage}
                </td>
              </tr>
            ) : (
              filteredReports.map((report) => (
                <tr
                  key={report.reportId}
                  className="group transition-colors duration-200 hover:bg-[#f9efe3]/60"
                >
                  <td className="px-4 py-3 font-medium text-[#3d3128]">
                    <Link
                      href={`/daily-reports/date/${report.date}`}
                      className="text-[#ad7a46] underline-offset-4 hover:underline"
                    >
                      {formatDateLabel(report.date)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{report.userName}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-[#fff0de] px-3 py-1 text-xs font-semibold text-[#ad7a46]">
                      {renderPreview(report.satisfactionToday)}
                    </span>
                  </td>
                  {(
                    [
                      ["doneToday", report.doneToday, "Done"],
                      [
                        "goodMoreBackground",
                        report.goodMoreBackground,
                        "Good / More + 背景",
                      ],
                      ["moreNext", report.moreNext, "More Next"],
                      ["todoTomorrow", report.todoTomorrow, "明日タスク"],
                      ["wishTomorrow", report.wishTomorrow, "明日やりたい"],
                      ["personalNews", report.personalNews, "個人ニュース"],
                    ] satisfies Array<[string, string, string]>
                  ).map(([key, value, label]) => (
                    <td key={key} className="px-4 py-3">
                      <div className="relative group/field">
                        <span className="block">{renderPreview(value)}</span>
                        {value && (
                          <div className="pointer-events-none absolute left-0 top-full z-30 mt-2 hidden w-[320px] rounded-xl border border-[#ead8c4] bg-white p-4 text-sm text-[#3d3128] shadow-xl group-hover/field:block">
                            <div className="font-semibold text-[#ad7a46]">
                              {label}
                            </div>
                            <div className="mt-2 whitespace-pre-wrap">
                              {value}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="relative group/field">
                      <span className="block">
                        {renderTagsPreview(report.tags)}
                      </span>
                      {report.tags.length > 0 && (
                        <div className="pointer-events-none absolute left-0 top-full z-30 mt-2 hidden w-[320px] rounded-xl border border-[#ead8c4] bg-white p-4 text-sm text-[#3d3128] shadow-xl group-hover/field:block">
                          <div className="font-semibold text-[#ad7a46]">
                            タグ
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {report.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex rounded-full border border-[#ead8c4] bg-[#fffaf5] px-3 py-1 text-xs"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
