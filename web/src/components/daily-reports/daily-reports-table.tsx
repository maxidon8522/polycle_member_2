"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DailyReport } from "@/types";
import { resolveDepartment } from "@/config/departments";

type DailyReportsTableProps = {
  reports: DailyReport[];
};

type SatisfactionFilter = "all" | "high" | "low";

const truncate = (value: string, maxLength = 20): string => {
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

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [satisfactionFilter, setSatisfactionFilter] =
    useState<SatisfactionFilter>("all");
  const [tagFilter, setTagFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  const dateFromTimestamp = useMemo(() => {
    if (!dateFrom) return null;
    const parsed = Date.parse(dateFrom);
    return Number.isNaN(parsed) ? null : parsed;
  }, [dateFrom]);

  const dateToTimestamp = useMemo(() => {
    if (!dateTo) return null;
    const parsed = Date.parse(dateTo);
    if (Number.isNaN(parsed)) return null;
    return parsed + 24 * 60 * 60 * 1000 - 1;
  }, [dateTo]);

  const hasDateRangeError =
    dateFromTimestamp !== null &&
    dateToTimestamp !== null &&
    dateFromTimestamp > dateToTimestamp;

  const normalizedTagFilter = normalize(tagFilter);
  const hasActiveFilters =
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    userFilter !== "all" ||
    satisfactionFilter !== "all" ||
    Boolean(normalizedTagFilter) ||
    departmentFilter !== "all";

  const resetFilters = () => {
    setDateFrom("");
    setDateTo("");
    setUserFilter("all");
    setSatisfactionFilter("all");
    setTagFilter("");
    setDepartmentFilter("all");
  };

  const filteredReports = useMemo(() => {
    if (hasDateRangeError) {
      return [];
    }

    return reports.filter((report) => {
      const reportDate = Date.parse(report.date);
      if (!Number.isNaN(reportDate)) {
        if (dateFromTimestamp !== null && reportDate < dateFromTimestamp) {
          return false;
        }
        if (dateToTimestamp !== null && reportDate > dateToTimestamp) {
          return false;
        }
      }

      if (userFilter !== "all" && report.userName !== userFilter) {
        return false;
      }

      if (satisfactionFilter !== "all") {
        const score = parseSatisfactionScore(report.satisfactionToday);
        if (satisfactionFilter === "high") {
          if (score === null || score < 0) {
            return false;
          }
        } else if (satisfactionFilter === "low") {
          if (score === null || score >= 0) {
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
    hasDateRangeError,
    dateFromTimestamp,
    dateToTimestamp,
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
            <span className={labelClass}>日付(開始)</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex min-w-[160px] flex-1 flex-col gap-1">
            <span className={labelClass}>日付(終了)</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
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
              <option value="high">高い(0以上)</option>
              <option value="low">低い(0未満)</option>
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
        {hasDateRangeError && (
          <div className="font-semibold text-[#c04747]">
            日付(開始)は日付(終了)より前の日付を選択してください。
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-dashed border-[#ead8c4] bg-[#fffaf5]">
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
                      href={`/daily-reports/${report.reportId}`}
                      className="text-[#ad7a46] underline-offset-4 hover:underline"
                    >
                      {renderPreview(report.date)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{report.userName}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-[#fff0de] px-3 py-1 text-xs font-semibold text-[#ad7a46]">
                      {renderPreview(report.satisfactionToday)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {renderPreview(report.doneToday)}
                  </td>
                  <td className="px-4 py-3">
                    {renderPreview(report.goodMoreBackground)}
                  </td>
                  <td className="px-4 py-3">
                    {renderPreview(report.moreNext)}
                  </td>
                  <td className="px-4 py-3">
                    {renderPreview(report.todoTomorrow)}
                  </td>
                  <td className="px-4 py-3">
                    {renderPreview(report.wishTomorrow)}
                  </td>
                  <td className="px-4 py-3">
                    {renderPreview(report.personalNews)}
                  </td>
                  <td className="px-4 py-3">
                    {renderTagsPreview(report.tags)}
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
