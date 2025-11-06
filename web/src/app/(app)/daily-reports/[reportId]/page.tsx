import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays, formatISO, parseISO } from "date-fns";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { listDailyReports } from "@/server/repositories/daily-reports-repository";
import { getWeekStart } from "@/lib/time";
import type { DailyReport } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DailyReportDetailPageProps = {
  params: { reportId: string };
};

const parseReportId = (reportId: string) => {
  const match = /^dr_(.+)_(\d{4}-\d{2}-\d{2})$/.exec(reportId);
  if (!match) {
    return null;
  }
  return {
    userSlug: match[1],
    date: match[2],
  };
};

const formatLabel = (label: string) => label;

const FIELD_DEFINITIONS: Array<{
  key: keyof DailyReport;
  label: string;
  render?: (value: DailyReport[keyof DailyReport]) => string | JSX.Element;
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
        return "タグなし";
      }
      return (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex rounded-full border border-[#ead8c4] bg-white/70 px-3 py-1 text-xs font-medium text-[#7f6b5a]"
            >
              #{tag}
            </span>
          ))}
        </div>
      );
    },
  },
  { key: "source", label: "取得元" },
  { key: "slackTs", label: "Slack TS" },
  { key: "createdAt", label: "作成日時" },
  { key: "updatedAt", label: "更新日時" },
];

const renderFieldValue = (
  report: DailyReport,
  key: keyof DailyReport,
  customRender?: (value: DailyReport[keyof DailyReport]) => string | JSX.Element,
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

export default async function DailyReportDetailPage({
  params,
}: DailyReportDetailPageProps) {
  const parsed = parseReportId(params.reportId);
  if (!parsed) {
    notFound();
  }

  const weekStart = getWeekStart(parsed.date);
  const weekEnd = formatISO(addDays(parseISO(weekStart), 6), {
    representation: "date",
  });

  const reports = await listDailyReports({
    weekStart,
    weekEnd,
  });

  const report = reports.find((item) => item.reportId === params.reportId);
  if (!report) {
    notFound();
  }

  const headerTitle = `${report.date} ${report.userName} のデイリーレポート`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-[#3d3128]">
            {headerTitle}
          </h1>
          <p className="text-sm text-[#7f6b5a]">
            一覧から選択したレポートの全文を表示しています。
          </p>
        </div>
        <Link href="/daily-reports" className={buttonVariants("secondary")}>
          一覧へ戻る
        </Link>
      </div>

      <Card>
        <div className="space-y-6">
          <dl className="grid gap-4 md:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-[#ad7a46]">
                日付
              </dt>
              <dd className="text-sm text-[#3d3128]">{report.date}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-[#ad7a46]">
                投稿者
              </dt>
              <dd className="text-sm text-[#3d3128]">{report.userName}</dd>
            </div>
          </dl>

          <dl className="space-y-6">
            {FIELD_DEFINITIONS.map(({ key, label, render }) => (
              <div key={String(key)} className="space-y-2">
                <dt className="text-xs font-semibold uppercase tracking-widest text-[#ad7a46]">
                  {formatLabel(label)}
                </dt>
                <dd>{renderFieldValue(report, key, render)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Card>
    </div>
  );
}
