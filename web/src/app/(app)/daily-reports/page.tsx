import Link from "next/link";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { DailyReportsFilter } from "@/components/daily-reports/daily-reports-filter";
import { listDailyReports } from "@/server/repositories/daily-reports-repository";
import { env } from "@/config/env";
import { DEPARTMENT_OF_USER } from "@/config/departments";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const parseTagsParam = (
  value: string | string[] | undefined,
): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => entry.split(","))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const humanizeSlug = (slug: string) =>
  slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const normalize = (value: string) => value.trim().toLowerCase();

const matchesUser = (reportSlug: string, userFilter?: string) => {
  if (!userFilter) return true;
  return normalize(reportSlug) === normalize(userFilter);
};

const matchesChannel = (channelId: string | undefined, filter?: string) => {
  if (!filter) return true;
  return (channelId ?? "").trim() === filter.trim();
};

const matchesKeyword = (fields: string[], keyword?: string) => {
  if (!keyword) return true;
  const normalizedKeyword = normalize(keyword);
  if (!normalizedKeyword) return true;
  const haystack = fields.join(" ").toLowerCase();
  return haystack.includes(normalizedKeyword);
};

const matchesTags = (reportTags: string[], tagFilters: string[]) => {
  if (tagFilters.length === 0) return true;
  const normalizedTags = reportTags.map((tag) => normalize(tag));
  return tagFilters.every((tag) => normalizedTags.includes(normalize(tag)));
};

export default async function DailyReportsPage({ searchParams }: PageProps) {
  const userFilter =
    typeof searchParams?.user === "string" ? searchParams.user : undefined;
  const channelFilter =
    typeof searchParams?.channel === "string"
      ? searchParams.channel
      : undefined;
  const keywordFilter =
    typeof searchParams?.q === "string" ? searchParams.q : undefined;
  const tagsFilter = parseTagsParam(searchParams?.tags);
  const weekStart =
    typeof searchParams?.weekStart === "string"
      ? searchParams.weekStart
      : undefined;
  const weekEnd =
    typeof searchParams?.weekEnd === "string"
      ? searchParams.weekEnd
      : undefined;

  const trimmedKeyword =
    keywordFilter && keywordFilter.trim().length > 0
      ? keywordFilter.trim()
      : undefined;

  const reports = await listDailyReports({
    weekStart,
    weekEnd,
  });

  const filteredReports = reports.filter((report) =>
    matchesUser(report.userSlug, userFilter) &&
    matchesChannel(report.channelId, channelFilter) &&
    matchesKeyword(
      [
        report.satisfactionToday,
        report.doneToday,
        report.goodMoreBackground,
        report.moreNext,
        report.todoTomorrow,
        report.wishTomorrow,
        report.personalNews,
        report.tags.join(" "),
      ],
      trimmedKeyword,
    ) &&
    matchesTags(report.tags, tagsFilter),
  );

  const fallbackUserPairs = Object.keys(DEPARTMENT_OF_USER).map((slug) => [
    slug,
    humanizeSlug(slug),
  ] as const);
  const userPairs = new Map<string, string>(fallbackUserPairs);
  for (const report of reports) {
    userPairs.set(
      report.userSlug,
      report.userName || humanizeSlug(report.userSlug),
    );
  }
  if (userFilter && !userPairs.has(userFilter)) {
    userPairs.set(userFilter, humanizeSlug(userFilter));
  }
  const userOptions = Array.from(userPairs.entries()).map(([value, label]) => ({
    value,
    label,
  }));

  const defaultChannelId = env.server.SLACK_DAILY_REPORT_CHANNEL_ID.trim();
  const channelPairs = new Map<string, string>();
  if (defaultChannelId) {
    channelPairs.set(defaultChannelId, defaultChannelId);
  }
  for (const report of reports) {
    if (report.channelId) {
      channelPairs.set(report.channelId, report.channelId);
    }
  }
  if (channelFilter && !channelPairs.has(channelFilter)) {
    channelPairs.set(channelFilter, channelFilter);
  }
  const channelOptions = Array.from(channelPairs.entries()).map(
    ([value, label]) => ({ value, label }),
  );

  const tagOptions = Array.from(
    new Set(reports.flatMap((report) => report.tags)),
  ).filter(Boolean);

  const filteredCount = filteredReports.length;
  const totalCount = reports.length;
  const footerText =
    filteredCount === totalCount
      ? `取得件数: ${filteredCount}`
      : `取得件数: ${filteredCount} / 総数 ${totalCount}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#3d3128]">
            デイリーレポート
          </h1>
          <p className="mt-1 text-sm text-[#7f6b5a]">
            今週のDRを既定表示し、週次ナビゲーションと絞り込みを備えます。
          </p>
        </div>
        <Link
          href="/daily-reports/new"
          className={buttonVariants("primary")}
        >
          DRを投稿
        </Link>
      </div>

      <Card
        title="フィルタ"
        description="ユーザー / チャンネル / キーワード / タグを組み合わせて絞り込みできます。"
      >
        <DailyReportsFilter
          users={userOptions}
          channels={channelOptions}
          tags={tagOptions}
          selected={{
            user: userFilter,
            channel: channelFilter,
            keyword: keywordFilter,
            tags: tagsFilter,
          }}
        />
      </Card>

      <Card
        title="今週の一覧"
        description="Google Sheetsのデータをサーバサイドで取得し、週切替をサポートします。"
        footer={footerText}
      >
        <div className="overflow-hidden rounded-xl border border-dashed border-[#ead8c4] bg-[#fffaf5]">
          <table className="min-w-full divide-y divide-[#ead8c4] text-sm">
            <thead className="bg-[#f9efe3] text-left text-xs uppercase tracking-wide text-[#ad7a46]">
              <tr>
                <th className="px-4 py-3 font-semibold">日付</th>
                <th className="px-4 py-3 font-semibold">ユーザー</th>
                <th className="px-4 py-3 font-semibold">満足度</th>
                <th className="px-4 py-3 font-semibold">Done</th>
                <th className="px-4 py-3 font-semibold">タグ</th>
                <th className="px-4 py-3 font-semibold">ソース</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1e6d8] bg-[#fffdf9] text-[#5b4c40]">
              {filteredReports.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-[#b59b85]"
                  >
                    表示できるデータがありません。Slack取り込み・Google Sheets連携を構築後に表示されます。
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => (
                  <tr
                    key={report.reportId}
                    className="group transition-colors duration-200 hover:bg-[#f9efe3]/60"
                  >
                    <td className="px-4 py-3 font-medium text-[#3d3128]">
                      {report.date}
                    </td>
                    <td className="px-4 py-3">{report.userName}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-[#fff0de] px-3 py-1 text-xs font-semibold text-[#ad7a46]">
                        {report.satisfactionToday}
                      </span>
                    </td>
                    <td className="px-4 py-3">{report.doneToday}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {report.tags.length > 0 ? (
                          report.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex rounded-full border border-[#ead8c4] bg-white/70 px-3 py-1 text-xs font-medium text-[#7f6b5a]"
                            >
                              #{tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-[#b59b85]">
                            タグなし
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-[#ead8c4]/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#7f6b5a]">
                        {report.source}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
