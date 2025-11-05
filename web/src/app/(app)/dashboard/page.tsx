import { formatInTimeZone } from "date-fns-tz";
import type { DailyReport, Task, WeeklySatisfactionPoint } from "@/types";
import { Card } from "@/components/ui/card";
import { WeeklySatisfactionChart } from "@/components/dashboard/weekly-satisfaction-chart";
import { DEFAULT_TIMEZONE } from "@/config/constants";
import {
  resolveDepartment,
  resolveUserSlug,
  type Department,
} from "@/config/departments";
import { getWeekStart } from "@/lib/time";
import { auth } from "@/server/auth";
import {
  computeWeeklySatisfaction,
  listDailyReports,
} from "@/server/repositories/daily-reports-repository";
import { listTasks } from "@/server/repositories/tasks-repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const WEEKDAY_LABEL: Record<DailyReport["weekday"], string> = {
  Mon: "月",
  Tue: "火",
  Wed: "水",
  Thu: "木",
  Fri: "金",
  Sat: "土",
  Sun: "日",
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

interface ReportWithMeta extends DailyReport {
  resolvedSlug: string;
  department: string;
  satisfactionScore: number | null;
}

type TaskDueTone =
  | "overdue"
  | "today"
  | "soon"
  | "upcoming"
  | "future"
  | "muted";

type DashboardNotification = {
  id: string;
  type: "warning" | "info" | "success";
  title: string;
  body: string;
  timestampLabel: string;
};

const clipText = (value?: string | null, limit = 120): string => {
  if (!value) return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit)}…`;
};

const parseISODate = (value?: string | null): number | null => {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

const parseScore = (raw: string | null | undefined): number | null => {
  if (!raw) return null;
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const score = Number.parseFloat(match[0] ?? "");
  return Number.isFinite(score) ? score : null;
};

const formatReportDate = (report: DailyReport): string => {
  try {
    const date = formatInTimeZone(
      report.date,
      DEFAULT_TIMEZONE,
      "M/d",
    );
    const weekday = WEEKDAY_LABEL[report.weekday] ?? report.weekday;
    return `${date} (${weekday})`;
  } catch {
    const weekday = WEEKDAY_LABEL[report.weekday] ?? report.weekday;
    return `${report.date} (${weekday})`;
  }
};

const formatDateLabel = (value: string, suffix?: string): string => {
  try {
    const base = formatInTimeZone(value, DEFAULT_TIMEZONE, "M/d");
    return suffix ? `${base} ${suffix}` : base;
  } catch {
    return suffix ? `${value} ${suffix}` : value;
  }
};

const formatWeekStartLabel = (weekStart: string): string => {
  return formatDateLabel(weekStart, "週");
};

const pickLatestWeeks = (
  points: WeeklySatisfactionPoint[],
  limit: number,
): WeeklySatisfactionPoint[] => {
  const sorted = [...points].sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart),
  );
  return sorted.slice(-limit);
};

const toneBadgeClass: Record<TaskDueTone, string> = {
  overdue: "bg-[#fbe8e6] text-[#c04747]",
  today: "bg-[#fff0de] text-[#ad7a46]",
  soon: "bg-[#fff4da] text-[#ad7a46]",
  upcoming: "bg-white/70 text-[#7f6b5a]",
  future: "bg-white/70 text-[#7f6b5a]",
  muted: "bg-[#f5f0ea] text-[#b59b85]",
};

const taskContainerClass: Record<TaskDueTone, string> = {
  overdue: "border-[#f5b5a7] bg-[#fff7f5]",
  today: "border-[#f3d2a3] bg-[#fff9ef]",
  soon: "border-[#ead8c4] bg-[#fffaf5]",
  upcoming: "border-[#f1e6d8] bg-white/80",
  future: "border-[#f1e6d8] bg-white/80",
  muted: "border-[#f1e6d8] bg-white/60",
};

const notificationToneClass: Record<
  DashboardNotification["type"],
  string
> = {
  warning: "border-[#f5b5a7] bg-[#fff3f0] text-[#c04747]",
  info: "border-[#ead8c4] bg-[#fffaf5] text-[#7f6b5a]",
  success: "border-[#a8d6b0] bg-[#f3fbf5] text-[#1d9a57]",
};

const notificationIcon: Record<DashboardNotification["type"], string> = {
  warning: "⚠️",
  info: "ℹ️",
  success: "✅",
};

const describeTaskDue = (
  task: Task,
  now: number,
): { label: string; tone: TaskDueTone } => {
  const due = parseISODate(task.dueDate);
  if (due === null) {
    return { label: "期限未設定", tone: "muted" };
  }

  const diffDays = Math.ceil((due - now) / MS_PER_DAY);
  if (due < now) {
    return {
      label: `期限超過 ${Math.abs(diffDays)}日`,
      tone: "overdue",
    };
  }

  if (diffDays === 0) {
    return { label: "今日締切", tone: "today" };
  }

  if (diffDays <= 3) {
    return { label: `${diffDays}日後`, tone: "soon" };
  }

  if (diffDays <= 7) {
    return { label: `${diffDays}日後`, tone: "upcoming" };
  }

  return { label: `${diffDays}日後`, tone: "future" };
};

export default async function DashboardPage() {
  const session = await auth();
  const viewerSlug =
    resolveUserSlug({
      userSlug: session?.user?.id ?? undefined,
      slackUserId: session?.user?.slackUserId ?? undefined,
      email: session?.user?.email ?? undefined,
    }) ?? null;

  const viewerDepartment: Department | null =
    resolveDepartment({
      userSlug: viewerSlug ?? undefined,
      slackUserId: session?.user?.slackUserId ?? undefined,
      email: session?.user?.email ?? undefined,
    }) ?? null;

  const [reportsRaw, weeklySatisfactionRaw, tasks] = await Promise.all([
    listDailyReports({}),
    computeWeeklySatisfaction({}),
    listTasks({}),
  ]);

  const currentWeekStart = getWeekStart(new Date());

  const reportsWithMeta: ReportWithMeta[] = reportsRaw.map((report) => {
    const resolvedSlug =
      resolveUserSlug({
        userSlug: report.userSlug,
        slackUserId: report.slackUserId,
        email: report.email,
      }) ?? report.userSlug;
    const department =
      resolveDepartment({
        userSlug: report.userSlug,
        slackUserId: report.slackUserId,
        email: report.email,
      }) ?? "unknown";

    return {
      ...report,
      resolvedSlug,
      department,
      satisfactionScore: parseScore(report.satisfactionToday),
    };
  });

  const reportsThisWeek = reportsWithMeta.filter(
    (report) => getWeekStart(report.date) === currentWeekStart,
  );

  const uniqueContributors = new Set(
    reportsThisWeek.map((report) => report.resolvedSlug),
  ).size;

  const myReportsThisWeek =
    viewerSlug !== null
      ? reportsThisWeek.filter(
          (report) => report.resolvedSlug === viewerSlug,
        )
      : [];

  const teamReportsThisWeek =
    viewerDepartment !== null
      ? reportsThisWeek.filter(
          (report) => report.department === viewerDepartment,
        )
      : reportsThisWeek;

  const recentReports = [...teamReportsThisWeek]
    .sort((a, b) => {
      const diff =
        (parseISODate(b.date) ?? 0) - (parseISODate(a.date) ?? 0);
      if (diff !== 0) {
        return diff;
      }
      return b.reportId.localeCompare(a.reportId);
    })
    .slice(0, 6);

  // eslint-disable-next-line react-hooks/purity -- ダッシュボードでは最新の期限状況を算出するためレンダー時点の時刻が必要
  const now = Date.now();
  const activeTasks = tasks.filter((task) => task.status !== "完了");

  const overdueTasks = activeTasks.filter((task) => {
    const due = parseISODate(task.dueDate);
    return due !== null && due < now;
  });

  const dueSoonCount = activeTasks.filter((task) => {
    const due = parseISODate(task.dueDate);
    if (due === null) return false;
    const diffDays = Math.ceil((due - now) / MS_PER_DAY);
    return diffDays >= 0 && diffDays <= 3;
  }).length;

  const highlightedTasks = activeTasks
    .filter((task) => {
      const due = parseISODate(task.dueDate);
      if (due === null) return false;
      const diffDays = Math.ceil((due - now) / MS_PER_DAY);
      return due < now || diffDays <= 7;
    })
    .sort((a, b) => {
      const left = parseISODate(a.dueDate) ?? Number.POSITIVE_INFINITY;
      const right = parseISODate(b.dueDate) ?? Number.POSITIVE_INFINITY;
      if (left !== right) {
        return left - right;
      }
      return a.taskId.localeCompare(b.taskId);
    })
    .slice(0, 6);

  const satisfactionSeriesCompany = pickLatestWeeks(
    weeklySatisfactionRaw.filter((point) => point.scope === "company"),
    6,
  );
  const satisfactionSeriesDepartment =
    viewerDepartment !== null
      ? pickLatestWeeks(
          weeklySatisfactionRaw.filter(
            (point) =>
              point.scope === "department" &&
              point.department === viewerDepartment,
          ),
          6,
        )
      : [];
  const satisfactionSeriesIndividual =
    viewerSlug !== null
      ? pickLatestWeeks(
          weeklySatisfactionRaw.filter(
            (point) =>
              point.scope === "individual" &&
              point.userSlug === viewerSlug,
          ),
          6,
        )
      : [];

  const latestCompanyPoint = satisfactionSeriesCompany.at(-1) ?? null;
  const previousCompanyPoint =
    satisfactionSeriesCompany.length >= 2
      ? satisfactionSeriesCompany.at(-2)
      : null;
  const companyDelta =
    latestCompanyPoint && previousCompanyPoint
      ? Number(
          (
            latestCompanyPoint.averageScore -
            previousCompanyPoint.averageScore
          ).toFixed(2),
        )
      : null;

  const statItems = [
    {
      label: "今週のDR",
      value: `${reportsThisWeek.length}件`,
      note:
        uniqueContributors > 0
          ? `${uniqueContributors}名が投稿`
          : "投稿なし",
    },
    {
      label: "あなたの投稿",
      value:
        viewerSlug !== null
          ? `${myReportsThisWeek.length}件`
          : "—",
      note:
        viewerSlug !== null
          ? myReportsThisWeek.length > 0
            ? "投稿済み"
            : "まだ未投稿"
          : "Slack連携で判定",
    },
    {
      label: "最新満足度 (全体)",
      value: latestCompanyPoint
        ? latestCompanyPoint.averageScore.toFixed(2)
        : "—",
      note: latestCompanyPoint
        ? `${latestCompanyPoint.sampleSize}件サンプル`
        : "データ不足",
    },
    {
      label: "期限注意タスク",
      value: `${highlightedTasks.length}`,
      note: `超過 ${overdueTasks.length} / 3日以内 ${dueSoonCount}`,
    },
  ];

  const notifications: DashboardNotification[] = [];

  if (overdueTasks.length > 0) {
    const oldestOverdue = [...overdueTasks].sort((a, b) => {
      const left = parseISODate(a.dueDate) ?? now;
      const right = parseISODate(b.dueDate) ?? now;
      return left - right;
    })[0]!;
    notifications.push({
      id: "overdue-tasks",
      type: "warning",
      title: "期限超過のタスクがあります",
      body: `${oldestOverdue.assigneeName}「${oldestOverdue.title}」など ${overdueTasks.length}件が期限を過ぎています。タスク一覧で優先対応しましょう。`,
      timestampLabel: oldestOverdue.dueDate
        ? formatDateLabel(oldestOverdue.dueDate, "期限")
        : "期限超過",
    });
  }

  if (viewerSlug && myReportsThisWeek.length === 0) {
    notifications.push({
      id: "self-report",
      type: "info",
      title: "今週のDRがまだ投稿されていません",
      body: "数分で振り返りを残しましょう。Slack連携済みなら投稿後に自動共有されます。",
      timestampLabel: formatWeekStartLabel(currentWeekStart),
    });
  }

  if (companyDelta !== null && latestCompanyPoint) {
    if (companyDelta <= -0.3) {
      notifications.push({
        id: "satisfaction-drop",
        type: "warning",
        title: "全体満足度が先週より低下しています",
        body: `最新値 ${latestCompanyPoint.averageScore.toFixed(2)}。定性的なコメントも合わせて確認しましょう。`,
        timestampLabel: formatDateLabel(
          latestCompanyPoint.weekStart,
          "週平均",
        ),
      });
    } else if (companyDelta >= 0.3) {
      notifications.push({
        id: "satisfaction-up",
        type: "success",
        title: "全体満足度が先週より上昇しました",
        body: `最新値 ${latestCompanyPoint.averageScore.toFixed(2)}。良かったポイントをチームで共有しましょう。`,
        timestampLabel: formatDateLabel(
          latestCompanyPoint.weekStart,
          "週平均",
        ),
      });
    }
  }

  const weekLabel = formatWeekStartLabel(currentWeekStart);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#3d3128]">
          ダッシュボード
        </h1>
        <p className="mt-1 text-sm text-[#7f6b5a]">
          今週のデイリーレポート、満足度の推移、タスク状況をまとめて確認します。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statItems.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-[#ead8c4] bg-white/70 px-4 py-4 shadow-[0_18px_35px_-25px_rgba(173,122,70,0.45)] backdrop-blur-sm"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b59b85]">
              {item.label}
            </div>
            <div className="mt-2 text-xl font-semibold text-[#3d3128]">
              {item.value}
            </div>
            <div className="mt-1 text-xs text-[#7f6b5a]">{item.note}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="今週のデイリーレポート"
          description="自分とチームの最新レポートを確認しましょう！"
          footer={`${teamReportsThisWeek.length}件 / ${weekLabel}`}
        >
          {teamReportsThisWeek.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#b59b85]">
              表示できるレポートがありません。Slack取り込み・Google Sheets連携後に反映されます。
            </div>
          ) : (
            <div className="space-y-3">
              {recentReports.map((report) => {
                const isMine =
                  viewerSlug !== null &&
                  report.resolvedSlug === viewerSlug;
                const dueTone =
                  report.satisfactionScore !== null
                    ? report.satisfactionScore >= 4
                      ? "soon"
                      : report.satisfactionScore <= 2
                        ? "overdue"
                        : "upcoming"
                    : "muted";
                const badgeClasses = [
                  "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
                  toneBadgeClass[dueTone],
                ].join(" ");

                return (
                  <div
                    key={report.reportId}
                    className={[
                      "rounded-2xl border px-4 py-4 transition-colors duration-200",
                      isMine
                        ? "border-[#c89b6d] bg-[#fff5ea]"
                        : "border-[#f1e6d8] bg-white/70 hover:bg-[#fff8f0]",
                    ].join(" ")}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#ad7a46]">
                      <span className="font-semibold">
                        {formatReportDate(report)}
                      </span>
                      <span className="text-[#b59b85]">
                        {report.department === "unknown"
                          ? "部署未設定"
                          : `部署 ${report.department}`}
                      </span>
                      {isMine && (
                        <span className="inline-flex items-center rounded-full bg-[#ad7a46]/15 px-2 py-0.5 text-[11px] font-semibold text-[#ad7a46]">
                          あなた
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-start justify-between gap-3">
                      <div className="space-y-2 text-sm">
                        <div className="font-semibold text-[#3d3128]">
                          {report.userName || report.resolvedSlug || "メンバー"}
                        </div>
                        {report.doneToday && (
                          <div className="text-xs leading-relaxed text-[#7f6b5a]">
                            <span className="font-semibold text-[#ad7a46]">
                              Done:
                            </span>{" "}
                            {clipText(report.doneToday, 140)}
                          </div>
                        )}
                        {report.moreNext && (
                          <div className="text-xs leading-relaxed text-[#7f6b5a]">
                            <span className="font-semibold text-[#ad7a46]">
                              More Next:
                            </span>{" "}
                            {clipText(report.moreNext, 120)}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {report.tags.length > 0 ? (
                            report.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex rounded-full border border-[#ead8c4] bg-white/80 px-3 py-1 text-[11px] font-medium text-[#7f6b5a]"
                              >
                                #{tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-[#b59b85]">
                              タグなし
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 text-xs">
                        <span className={badgeClasses}>
                          満足度{" "}
                          {report.satisfactionScore !== null
                            ? report.satisfactionScore.toFixed(1)
                            : report.satisfactionToday || "—"}
                        </span>
                        <span className="text-[11px] text-[#b59b85]">
                          最終更新:{" "}
                          {report.updatedAt
                            ? formatDateLabel(report.updatedAt)
                            : "不明"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card
          title="期限が近いタスク"
          description="期限切れ / 1週間以内のタスクを優先表示します。詳細更新はタスク画面から行えます。"
          footer={`表示中: ${highlightedTasks.length}件 | 期限超過: ${overdueTasks.length}`}
        >
          {highlightedTasks.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#b59b85]">
              期限が迫っているタスクはありません。タスクの作成・更新は一覧画面から行えます。
            </div>
          ) : (
            <div className="space-y-3">
              {highlightedTasks.map((task) => {
                const dueDescriptor = describeTaskDue(task, now);
                const containerClasses = [
                  "rounded-2xl border px-4 py-4 transition-colors duration-200",
                  taskContainerClass[dueDescriptor.tone],
                ].join(" ");

                return (
                  <div key={task.taskId} className={containerClasses}>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#ad7a46]">
                      <span className="font-semibold text-[#3d3128]">
                        {task.title}
                      </span>
                      <span
                        className={[
                          "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold",
                          toneBadgeClass[dueDescriptor.tone],
                        ].join(" ")}
                      >
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                        {dueDescriptor.label}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-[#7f6b5a] sm:grid-cols-2">
                      <div>
                        <span className="font-semibold text-[#ad7a46]">
                          担当:
                        </span>{" "}
                        {task.assigneeName}
                      </div>
                      <div>
                        <span className="font-semibold text-[#ad7a46]">
                          状態:
                        </span>{" "}
                        {task.status}
                      </div>
                      <div>
                        <span className="font-semibold text-[#ad7a46]">
                          期限:
                        </span>{" "}
                        {task.dueDate
                          ? formatDateLabel(task.dueDate, "締切")
                          : "未設定"}
                      </div>
                      <div>
                        <span className="font-semibold text-[#ad7a46]">
                          プロジェクト:
                        </span>{" "}
                        {task.projectName || "未設定"}
                      </div>
                    </div>
                    {task.notes && (
                      <div className="mt-2 text-xs leading-relaxed text-[#7f6b5a]">
                        <span className="font-semibold text-[#ad7a46]">
                          メモ:
                        </span>{" "}
                        {clipText(task.notes, 140)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card
        title="満足度の週平均"
        description="個人 / 部署 / 全体の週次平均を可視化し、変化を早期に把握します。"
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <WeeklySatisfactionChart
            title="あなた (個人)"
            description="自分の投稿から集計された週平均。"
            color="#9c7a5a"
            points={satisfactionSeriesIndividual}
            emptyMessage={
              viewerSlug
                ? "まだ十分なデータがありません。継続して投稿すると推移が見えてきます。"
                : "Slackでログインすると個人の推移が表示されます。"
            }
          />
          <WeeklySatisfactionChart
            title="部署"
            description={
              viewerDepartment
                ? `部署 ${viewerDepartment} の平均。`
                : "所属部署が判定できません。設定ページで紐付けを確認してください。"
            }
            color="#d9a05b"
            points={satisfactionSeriesDepartment}
            emptyMessage={
              viewerDepartment
                ? "部署内の投稿がまだ少ないようです。"
                : "部署情報がないため表示できません。"
            }
          />
          <WeeklySatisfactionChart
            title="全体"
            description="全メンバーの平均。サンプル数と合わせてトレンドを掴みます。"
            color="#c89b6d"
            points={satisfactionSeriesCompany}
            emptyMessage="まだデータがありません。Slack取り込み・Sheets連携を進めてください。"
          />
        </div>
      </Card>

      <Card
        title="通知センター"
        description="Slack投稿失敗やSheets書き込み失敗などのアラートをまとめます。"
      >
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-[#b59b85]">
            特筆すべき通知はありません。Slack・Sheets連携のエラー発生時にここへ蓄積されます。
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((item) => (
              <div
                key={item.id}
                className={[
                  "flex flex-col gap-2 rounded-2xl border px-4 py-4",
                  notificationToneClass[item.type],
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span>{notificationIcon[item.type]}</span>
                    <span>{item.title}</span>
                  </div>
                  <span className="text-[11px] text-[#7f6b5a]/70">
                    {item.timestampLabel}
                  </span>
                </div>
                <p className="text-xs leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
