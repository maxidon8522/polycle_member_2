import { Card } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#3d3128]">設定</h1>
        <p className="mt-1 text-sm text-[#7f6b5a]">
          Googleスプレッドシート / Slack ワークスペース / 権限を管理します。
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card
          title="Google連携"
          description="スプレッドシートの参照／書き込み範囲を設定します。"
        >
          <ul className="list-disc space-y-2 pl-5 text-sm text-[#5b4c40] marker:text-[#c89b6d]">
            <li>シートID: 環境変数から読み込み予定</li>
            <li>個人タブの命名規則: 要確認</li>
            <li>集約ビューの要否: ユーザーと合意後に実装</li>
          </ul>
        </Card>

        <Card
          title="Slack連携"
          description="#00_dailyreport の投稿 / 取り込みを管理します。"
        >
          <ul className="list-disc space-y-2 pl-5 text-sm text-[#5b4c40] marker:text-[#c89b6d]">
            <li>ユーザーOAuthで本人投稿を実現</li>
            <li>Events API の署名検証・再試行を実装予定</li>
            <li>Slackトークンの保管フローは要確認事項</li>
          </ul>
        </Card>

        <Card
          title="権限 / 監査"
          description="管理者 / メンバー / 閲覧者のロールを想定。"
        >
          <ul className="list-disc space-y-2 pl-5 text-sm text-[#5b4c40] marker:text-[#c89b6d]">
            <li>更新系APIは監査ログへ記録</li>
            <li>監査ログのエクスポート機能を後続追加</li>
            <li>ロールごとの画面制御は設計中</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
