import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { listDailyReports } from "@/server/repositories/daily-reports-repository";
import { DailyReportsTable } from "@/components/daily-reports/daily-reports-table";

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
        <DailyReportsTable reports={reports} />
      </Card>
    </div>
  );
}
