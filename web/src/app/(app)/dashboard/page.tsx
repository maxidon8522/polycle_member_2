import { Card } from "@/components/ui/card";
import {
  computeWeeklySatisfaction,
  listDailyReports,
} from "@/server/repositories/daily-reports-repository";
import { listTasks } from "@/server/repositories/tasks-repository";

export default async function DashboardPage() {
  const [reports, weeklySatisfaction, tasks] = await Promise.all([
    listDailyReports({}),
    computeWeeklySatisfaction({}),
    listTasks({}),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">ダッシュボード</h1>
        <p className="mt-1 text-sm text-slate-500">
          今週のデイリーレポート、満足度の推移、タスク状況をまとめて確認します。
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="今週のデイリーレポート"
          description="自分とチームの最新レポートを一覧で把握します。"
          footer={`総件数: ${reports.length}`}
        >
          <div className="text-sm text-slate-500">
            レポートの取得ロジックは後続で Sheets と連携します。
          </div>
        </Card>
        <Card
          title="期限が近いタスク"
          description="期限切れ/今週締めのタスクを優先的に表示します。"
          footer={`対象タスク: ${tasks.length}`}
        >
          <div className="text-sm text-slate-500">
            タスク一覧のフィルタリングは今後実装予定です。
          </div>
        </Card>
      </div>

      <Card
        title="満足度の週平均"
        description="個人 / 部署 / 全体の週次平均を折れ線グラフで表示します。"
      >
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          {weeklySatisfaction.length === 0
            ? "グラフ描画ロジックを後続実装。データ取得後に Recharts / Chart.js 等で表示予定。"
            : "グラフコンポーネントをここに表示します。"}
        </div>
      </Card>

      <Card
        title="通知センター"
        description="Slack投稿失敗やシート書き込み失敗などのアラート履歴を表示します。"
      >
        <div className="text-sm text-slate-500">
          通知ストリームの設計は未着手のためプレースホルダーを表示しています。
        </div>
      </Card>
    </div>
  );
}
