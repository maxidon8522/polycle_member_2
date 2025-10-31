import Link from "next/link";
import { Card } from "@/components/ui/card";
import { listDailyReports } from "@/server/repositories/daily-reports-repository";

export default async function DailyReportsPage() {
  const reports = await listDailyReports({});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            デイリーレポート
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            今週のDRを既定表示し、週次ナビゲーションと絞り込みを備えます。
          </p>
        </div>
        <Link
          href="/daily-reports/new"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          DRを投稿
        </Link>
      </div>

      <Card
        title="フィルタ"
        description="ユーザー / チャンネル / キーワード / タグで絞り込み可能にします。"
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-slate-500">ユーザー</span>
            <div className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-slate-400">
              フィルタ UI 実装予定
            </div>
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-slate-500">
              チャンネル
            </span>
            <div className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-slate-400">
              フィルタ UI 実装予定
            </div>
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-slate-500">
              キーワード
            </span>
            <div className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-slate-400">
              フィルタ UI 実装予定
            </div>
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-slate-500">タグ</span>
            <div className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-slate-400">
              Chip UI 実装予定
            </div>
          </div>
        </div>
      </Card>

      <Card
        title="今週の一覧"
        description="Google Sheetsのデータをサーバサイドで取得し、週切替をサポートします。"
        footer={`取得件数: ${reports.length}`}
      >
        <div className="overflow-hidden rounded-md border border-dashed border-slate-300">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">日付</th>
                <th className="px-4 py-3">ユーザー</th>
                <th className="px-4 py-3">満足度</th>
                <th className="px-4 py-3">Done</th>
                <th className="px-4 py-3">タグ</th>
                <th className="px-4 py-3">ソース</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
              {reports.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-slate-400"
                  >
                    表示できるデータがありません。Slack取り込み・Google Sheets連携を構築後に表示されます。
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.reportId}>
                    <td className="px-4 py-3">{report.date}</td>
                    <td className="px-4 py-3">{report.userName}</td>
                    <td className="px-4 py-3">{report.satisfactionToday}</td>
                    <td className="px-4 py-3">{report.doneToday}</td>
                    <td className="px-4 py-3">
                      {report.tags.map((tag) => `#${tag}`).join(" ")}
                    </td>
                    <td className="px-4 py-3 uppercase">{report.source}</td>
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
