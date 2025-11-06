import { NextResponse } from "next/server";
import { listDailyReports, saveDailyReport } from "@/server/repositories/daily-reports-repository";
import { env } from "@/config/env";
import { getReportWeekdayCode, reportDateBy29hRule } from "@/lib/time";
import { auth } from "@/server/auth";
import { resolveUserSlug } from "@/config/departments";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get("weekStart") ?? undefined;
  const weekEnd = searchParams.get("weekEnd") ?? undefined;

  const reports = await listDailyReports({
    weekStart,
    weekEnd,
  });

  return NextResponse.json({ data: reports });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const toStringOrEmpty = (value: unknown): string =>
    typeof value === "string" ? value : "";

  const satisfactionToday = toStringOrEmpty(body.satisfactionToday);
  const doneToday = toStringOrEmpty(body.doneToday);
  const goodMoreBackground = toStringOrEmpty(body.goodMoreBackground);
  const moreNext = toStringOrEmpty(body.moreNext);
  const todoTomorrow = toStringOrEmpty(body.todoTomorrow);
  const wishTomorrow = toStringOrEmpty(body.wishTomorrow);
  const personalNews = toStringOrEmpty(body.personalNews);

  const tagsRaw: unknown[] = Array.isArray(body.tags)
    ? body.tags
    : toStringOrEmpty(body.tags).split(" ");
  const tags = Array.from(
    new Set(
      tagsRaw
        .filter((tag: unknown): tag is string => typeof tag === "string")
        .map((tag: string) => tag.replace(/^#/, "").trim())
        .filter(Boolean),
    ),
  );

  if (!doneToday.trim()) {
    return NextResponse.json(
      { error: "今日やったこと（Done）を入力してください" },
      { status: 400 },
    );
  }

  const { dateISO } = reportDateBy29hRule();
  const weekday = getReportWeekdayCode(dateISO);

  const sessionUserName = toStringOrEmpty(session.user.name);
  const sessionEmail = toStringOrEmpty(session.user.email);
  const slackUserId = toStringOrEmpty(session.user.slackUserId);
  const slackTeamId = toStringOrEmpty(session.user.slackTeamId);

  const normalizeSlugCandidate = (input: string): string =>
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

  const slugFromEmail = sessionEmail
    ? sessionEmail.split("@")[0]?.toLowerCase() ?? ""
    : "";
  const fallbackSlugCandidate = normalizeSlugCandidate(
    slugFromEmail || sessionUserName,
  );
  const resolvedSlug =
    resolveUserSlug({
      slackUserId: slackUserId || undefined,
      email: sessionEmail || undefined,
      userSlug: fallbackSlugCandidate || undefined,
    }) ?? fallbackSlugCandidate;
  const userSlug = resolvedSlug || "unknown";

  const userName = sessionUserName || userSlug || sessionEmail || "Unknown";
  const email = sessionEmail;

  const channelId = env.server.SLACK_DAILY_REPORT_CHANNEL_ID.trim();
  if (!channelId) {
    return NextResponse.json(
      { error: "Slack channel id missing" },
      { status: 500 },
    );
  }

  const userToken = null;

  console.info("dr.api.save.intent", {
    haveUserToken: Boolean(userToken),
    channel: channelId,
    userSlug,
    date: dateISO,
  });

  const result = await saveDailyReport({
    satisfactionToday,
    doneToday,
    goodMoreBackground,
    moreNext,
    todoTomorrow,
    wishTomorrow,
    personalNews,
    tags,
    date: dateISO,
    weekday,
    userSlug,
    userName,
    email,
    slackUserId,
    slackTeamId,
    channelId,
    slackUserAccessToken: userToken,
  });

  return NextResponse.json(
    {
      data: result.report,
      slack: result.slack
        ? {
            ok: result.slack.ok,
            ts: result.slack.ts ?? null,
            usedTokenType: result.slack.usedTokenType,
            error: result.slack.error ?? null,
          }
        : null,
    },
    { status: 201 },
  );
}
