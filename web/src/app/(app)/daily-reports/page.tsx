import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { listDailyReports } from "@/server/repositories/daily-reports-repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function DailyReportsPage({ searchParams }: PageProps) {
  noStore();

  const weekStart =
    typeof searchParams?.weekStart === "string"
      ? searchParams.weekStart
      : undefined;
  const weekEnd =
    typeof searchParams?.weekEnd === "string"
      ? searchParams.weekEnd
      : undefined;

  const reports = await listDailyReports({
    weekStart,
    weekEnd,
  });

  const totalCount = reports.length;
  const footerText = `取得件数: ${totalCount}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#3d3128]">
            デイリーレポート
          </h1>
          <p className="mt-1 text-sm text-[#7f6b5a]">
            今週のDRを既定表示し、週次ナビゲーションを提供します。
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
              {reports.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-[#b59b85]"
                  >
                    表示できるデータがありません。Slack取り込み・Google Sheets連携を構築後に表示されます。
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
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
