"use server";

import "server-only";

import { DailyReport, WeeklySatisfactionPoint } from "@/types";
import {
  DailyReportQueryOptions,
  fetchDailyReports,
  getSlackTimestampForReport,
  setSlackTsOnSheet,
  upsertDailyReport,
} from "@/lib/sheets/daily-reports";
import { getWeekStart } from "@/lib/time";
import {
  resolveDepartment,
  resolveUserSlug,
} from "@/config/departments";
import { env } from "@/config/env";
import {
  postDailyReportToSlack,
  type SlackPostResult,
} from "@/lib/slack/client";

const parseSatisfactionScore = (value: string): number | null => {
  if (!value) return null;
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const score = Number.parseFloat(match[0]);
  return Number.isFinite(score) ? score : null;
};

export const listDailyReports = async (
  options: DailyReportQueryOptions,
): Promise<DailyReport[]> => {
  return fetchDailyReports(options);
};

export interface SaveDailyReportInput {
  satisfactionToday: string;
  doneToday: string;
  goodMoreBackground: string;
  moreNext: string;
  todoTomorrow: string;
  wishTomorrow: string;
  personalNews: string;
  tags: string[];
  date: string;
  weekday: DailyReport["weekday"];
  userSlug: string;
  userName: string;
  email: string;
  slackUserId: string;
  slackTeamId: string;
  channelId: string;
  slackUserAccessToken: string | null;
}

export interface SaveDailyReportResult {
  report: DailyReport;
  slack: SlackPostResult | null;
}

export const saveDailyReport = async (
  input: SaveDailyReportInput,
): Promise<SaveDailyReportResult> => {
  const {
    satisfactionToday,
    doneToday,
    goodMoreBackground,
    moreNext,
    todoTomorrow,
    wishTomorrow,
    personalNews,
    tags,
    date,
    weekday,
    userSlug,
    userName,
    email,
    slackUserId,
    slackTeamId,
    channelId,
    slackUserAccessToken,
  } = input;

  const expectedChannel = env.server.SLACK_DAILY_REPORT_CHANNEL_ID.trim();
  if (!channelId || channelId.trim() !== expectedChannel) {
    throw new Error("Invalid or missing Slack channel id");
  }

  const now = new Date().toISOString();
  const reportId = `dr_${userSlug}_${date}`;
  const existingSlackTs = await getSlackTimestampForReport(userSlug, date);

  const report: DailyReport = {
    reportId,
    date,
    weekday,
    userSlug,
    userName: userName || userSlug,
    email,
    slackUserId,
    slackTeamId,
    channelId: expectedChannel,
    satisfactionToday,
    doneToday,
    goodMoreBackground,
    moreNext,
    todoTomorrow,
    wishTomorrow,
    personalNews,
    tags,
    source: "web_form",
    slackTs: existingSlackTs ?? undefined,
    createdAt: now,
    updatedAt: now,
  };

  await upsertDailyReport(report);

  let slackResult: SlackPostResult | null = null;

  if (!existingSlackTs) {
    const preferUserToken =
      typeof slackUserAccessToken === "string" &&
      slackUserAccessToken.trim().startsWith("xoxp-")
        ? slackUserAccessToken.trim()
        : null;

    console.log("DEBUG dailyReports.repo.post", {
      reportId: report.reportId,
      channelId: expectedChannel,
      prefer: preferUserToken ? "user" : "bot",
    });

    try {
      slackResult = await postDailyReportToSlack(report, {
        channelId: expectedChannel,
        userAccessToken: preferUserToken,
        allowBotFallback: true,
      });
      console.log("DEBUG dailyReports.repo.post.result", slackResult);

      if (slackResult.ok && slackResult.ts) {
        await setSlackTsOnSheet(userSlug, date, slackResult.ts);
        report.slackTs = slackResult.ts;
      } else if (slackResult && !slackResult.ok) {
        console.error("ERROR dailyReports.repo.post.result", slackResult);
      }
    } catch (error) {
      const err = error as {
        message?: string;
        data?: unknown;
        response?: { data?: unknown; status?: number };
        status?: number;
      };
      console.error("ERROR dailyReports.repo.post", {
        reportId: report.reportId,
        message: err?.message,
        data: err?.response?.data ?? err?.data ?? null,
        status: err?.response?.status ?? err?.status ?? null,
      });
      throw error;
    }
  }

  return {
    report,
    slack: slackResult,
  };
};

export const computeWeeklySatisfaction = async (
  options: DailyReportQueryOptions,
): Promise<WeeklySatisfactionPoint[]> => {
  const reports = await fetchDailyReports(options);
  const aggregates = new Map<
    string,
    {
      sum: number;
      count: number;
      meta: Omit<WeeklySatisfactionPoint, "averageScore" | "sampleSize">;
    }
  >();

  for (const report of reports) {
    const score = parseSatisfactionScore(report.satisfactionToday);
    if (score === null) {
      continue;
    }

    const weekStart = getWeekStart(report.date);
    const userSlug =
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

    const register = (
      key: string,
      meta: Omit<WeeklySatisfactionPoint, "averageScore" | "sampleSize">,
    ) => {
      const entry = aggregates.get(key) ?? { sum: 0, count: 0, meta };
      entry.sum += score;
      entry.count += 1;
      aggregates.set(key, entry);
    };

    register(`individual:${userSlug}:${weekStart}`, {
      userSlug,
      department,
      weekStart,
      scope: "individual",
    });

    register(`department:${department}:${weekStart}`, {
      userSlug: `dept:${department}`,
      department,
      weekStart,
      scope: "department",
    });

    register(`company:${weekStart}`, {
      userSlug: "company",
      department: "all",
      weekStart,
      scope: "company",
    });
  }

  return Array.from(aggregates.values()).map(({ sum, count, meta }) => ({
    ...meta,
    averageScore: Number.parseFloat((sum / count).toFixed(2)),
    sampleSize: count,
  }));
};
