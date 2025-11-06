import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays, formatISO, parseISO } from "date-fns";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { listDailyReports } from "@/server/repositories/daily-reports-repository";
import { getWeekStart } from "@/lib/time";
import type { DailyReport } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DailyReportDatePageProps = {
  params: { date: string };
};

const isValidDateParam = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value);

const FIELD_DEFINITIONS: Array<{
  key: keyof DailyReport;
  label: string;
  render?: (value: DailyReport[keyof DailyReport]) => ReactNode;
}> = [
  { key: "satisfactionToday", label: "満足度" },
  { key: "doneToday", label: "Done" },
  { key: "goodMoreBackground", label: "Good/More＋背景" },
  { key: "moreNext", label: "More Next" },
  { key: "todoTomorrow", label: "明日やるべきこと（タスク）" },
  { key: "wishTomorrow", label: "明日やりたいこと（非タスク）" },
  { key: "personalNews", label: "個人ニュース" },
  {
    key: "tags",
    label: "タグ",
    render: (value) => {
      const tags = Array.isArray(value) ? value : [];
      if (tags.length === 0) {
        return <span className="text-xs text-[#b59b85]">タグなし</span>;
      }
      return (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex rounded-full border border-[#ead8c4] bg-[#fffaf5] px-3 py-1 text-xs text-[#7f6b5a]"
            >
              #{tag}
            </span>
          ))}
        </div>
      );
    },
  },
];

const renderFieldValue = (
  report: DailyReport,
  key: keyof DailyReport,
  customRender?: (value: DailyReport[keyof DailyReport]) => ReactNode,
) => {
  const value = report[key];
  if (customRender) {
    return customRender(value);
  }
  if (typeof value === "string") {
    return value ? (
      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#3d3128]">
        {value}
      </pre>
    ) : (
      <span className="text-xs text-[#b59b85]">未記入</span>
    );
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-xs text-[#b59b85]">未記入</span>;
    }
    return (
      <ul className="list-inside list-disc text-sm text-[#3d3128]">
        {value.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  if (value === undefined || value === null) {
    return <span className="text-xs text-[#b59b85]">未記入</span>;
  }
  return String(value);
};

export default async function DailyReportDatePage({
  params,
}: DailyReportDatePageProps) {
  const dateParam = params.date;
  if (!isValidDateParam(dateParam)) {
    notFound();
  }

  const weekStart = getWeekStart(dateParam);
  const weekEnd = formatISO(addDays(parseISO(weekStart), 6), {
    representation: "date",
  });

  const reports = await listDailyReports({
    weekStart,
    weekEnd,
  });

  const reportsForDate = reports.filter((report) => report.date === dateParam);

  if (reportsForDate.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-[#3d3128]">
              {dateParam} のデイリーレポート
            </h1>
            <p className="text-sm text-[#7f6b5a]">
              選択した日付のデイリーレポートは見つかりませんでした。
            </p>
          </div>
          <Link href="/daily-reports" className={buttonVariants("secondary")}>
            一覧へ戻る
          </Link>
        </div>
        <Card>
          <p className="text-sm text-[#7f6b5a]">
            Slack取り込み・Google Sheets連携が完了すると、この日に投稿されたレポートが表示されます。
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-[#3d3128]">
            {dateParam} のデイリーレポート
          </h1>
          <p className="text-sm text-[#7f6b5a]">
            この日に投稿された全メンバーのレポートを一覧表示します。
          </p>
        </div>
        <Link href="/daily-reports" className={buttonVariants("secondary")}>
          一覧へ戻る
        </Link>
      </div>

      <div className="grid gap-6">
        {reportsForDate.map((report) => (
          <Card key={report.reportId}>
            <div className="space-y-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-[#ad7a46]">
                    投稿者
                  </div>
                  <div className="text-lg font-semibold text-[#3d3128]">
                    {report.userName}
                  </div>
                </div>
                <Link
                  href={`/daily-reports/${report.reportId}`}
                  className={buttonVariants("secondary")}
                >
                  個別の詳細を見る
                </Link>
              </div>

              <dl className="grid gap-4 md:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-[#ad7a46]">
                    Slack TS
                  </dt>
                  <dd className="text-sm text-[#3d3128]">
                    {report.slackTs ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-[#ad7a46]">
                    更新日時
                  </dt>
                  <dd className="text-sm text-[#3d3128]">
                    {report.updatedAt ?? "—"}
                  </dd>
                </div>
              </dl>

              <dl className="space-y-4">
                {FIELD_DEFINITIONS.map(({ key, label, render }) => (
                  <div key={String(key)} className="space-y-2">
                    <dt className="text-xs font-semibold uppercase tracking-widest text-[#ad7a46]">
                      {label}
                    </dt>
                    <dd>{renderFieldValue(report, key, render)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
