import { WebClient, LogLevel } from "@slack/web-api";
import type { Block, KnownBlock } from "@slack/web-api";
import { env } from "@/config/env";
import { DailyReport } from "@/types";
import {
  formatDailyReportMessage,
  type DrFields,
} from "@/lib/slack/dr-format";

let slackClient: WebClient | null = null;

export const getSlackClient = () => {
  if (slackClient) {
    return slackClient;
  }

  slackClient = new WebClient(env.server.SLACK_BOT_TOKEN, {
    logLevel: process.env.NODE_ENV === "development" ? LogLevel.DEBUG : LogLevel.ERROR,
    retryConfig: {
      retries: 3,
    },
  });

  return slackClient;
};

export interface SlackPostOptions {
  channelId: string;
  threadTs?: string;
  userAccessToken?: string | null;
  allowBotFallback?: boolean;
}

export interface SlackPostResult {
  ok: boolean;
  ts?: string;
  channel?: string;
  error?: string;
  needed?: string;
  provided?: string;
  usedTokenType: "user" | "bot";
  raw: unknown;
}

const toDrFields = (report: DailyReport): DrFields => ({
  date: report.date,
  userName: report.userName ?? "",
  satisfaction: report.satisfactionToday ?? "",
  done: report.doneToday ?? "",
  good: report.goodMoreBackground ?? "",
  moreNext: report.moreNext ?? "",
  tomorrowTasks: report.todoTomorrow ?? "",
  todoTomorrow: report.todoTomorrow ?? "",
  nonTask: report.wishTomorrow ?? "",
  wishTomorrow: report.wishTomorrow ?? "",
  personalNews: report.personalNews ?? "",
  dateISO: report.date,
});

export const buildSlackMessagePayload = (report: DailyReport) => {
  const { text, blocks } = formatDailyReportMessage(toDrFields(report));
  const tagsLine = report.tags.length
    ? `\n\n${report.tags.map((tag) => `#${tag}`).join(" ")}`
    : "";

  return {
    text: `${text}${tagsLine}`,
    blocks: [
      ...blocks,
      ...(tagsLine
        ? [
            {
              type: "context" as const,
              elements: [
                {
                  type: "mrkdwn" as const,
                  text: tagsLine.trim(),
                },
              ],
            },
          ]
        : []),
    ],
  };
};

export const postDailyReportToSlack = async (
  report: DailyReport,
  options: SlackPostOptions,
): Promise<SlackPostResult> => {
  const payload = buildSlackMessagePayload(report);
  const channelId = options.channelId.trim();
  const allowBotFallback = options.allowBotFallback ?? true;
  const userToken =
    typeof options.userAccessToken === "string" &&
    options.userAccessToken.trim().startsWith("xoxp-")
      ? options.userAccessToken.trim()
      : null;

  if (!channelId) {
    return {
      ok: false,
      error: "channel_missing",
      usedTokenType: userToken ? "user" : "bot",
      raw: null,
    };
  }

  const sendWithToken = async (
    token: string,
    usedTokenType: "user" | "bot",
  ): Promise<SlackPostResult> => {
    const tokenPrefix = token.slice(0, 5);
    const client =
      usedTokenType === "user"
        ? new WebClient(token, {
            logLevel:
              process.env.NODE_ENV === "development"
                ? LogLevel.DEBUG
                : LogLevel.ERROR,
          })
        : getSlackClient();

    console.log("DEBUG slack.postMessage.request", {
      using: usedTokenType,
      tokenPrefix,
      channelId,
      text: payload.text?.slice(0, 120),
    });

    try {
      const safeBlocks: (Block | KnownBlock)[] | undefined = Array.isArray(payload.blocks)
        ? (payload.blocks as unknown as (Block | KnownBlock)[])
        : undefined;

      const response = await client.chat.postMessage({
        channel: channelId,
        text: payload.text,
        blocks: safeBlocks,
        thread_ts: options.threadTs,
      });
      const responseMetadata = (response as {
        response_metadata?: { scopes?: unknown; acceptedScopes?: unknown };
      }).response_metadata;
      console.log("DEBUG slack.postMessage.response", {
        usedTokenType,
        ok: response.ok,
        error: (response as { error?: string }).error,
        channel: response.channel,
        ts: response.ts,
        scopes:
          (response as { scopes?: unknown }).scopes ??
          (response as { acceptedScopes?: unknown }).acceptedScopes ??
          responseMetadata?.scopes ??
          responseMetadata?.acceptedScopes ??
          null,
      });
      return {
        ok: Boolean(response.ok),
        ts: typeof response.ts === "string" ? response.ts : undefined,
        channel:
          typeof response.channel === "string" ? response.channel : undefined,
        error: (response as { error?: string }).error,
        needed: (response as { needed?: string }).needed,
        provided: (response as { provided?: string }).provided,
        usedTokenType,
        raw: response,
      };
    } catch (unknownError) {
      const toRecord = (value: unknown): Record<string, unknown> | undefined =>
        value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
      const pickString = (value: unknown): string | undefined =>
        typeof value === "string" ? value : undefined;
      const pickNumber = (value: unknown): number | null =>
        typeof value === "number" ? value : null;

      const err = (unknownError ?? {}) as Record<string, unknown>;
      const responseObj = toRecord((err as { response?: unknown }).response);
      const responseData =
        toRecord(responseObj?.data) ?? toRecord((err as { data?: unknown }).data);

      const status =
        pickNumber(responseObj?.status) ??
        pickNumber(err.status) ??
        pickNumber(err.code) ??
        null;

      const message = pickString(err.message);
      const errorCode = pickString(responseData?.error) ?? message ?? "slack_unknown_error";
      const needed = pickString(responseData?.needed);
      const provided = pickString(responseData?.provided);

      console.error("slack.post_daily_report.error", {
        channel: channelId,
        reportId: report.reportId,
        usingUserToken: usedTokenType === "user",
        message,
        data: responseData,
        status,
        error: unknownError,
      });
      return {
        ok: false,
        error: errorCode,
        needed,
        provided,
        usedTokenType,
        raw: unknownError,
      };
    }
  };

  if (userToken) {
    const userResult = await sendWithToken(userToken, "user");
    if (userResult.ok || !allowBotFallback) {
      return userResult;
    }
  }

  const botToken = env.server.SLACK_BOT_TOKEN.trim();
  if (!botToken) {
    return {
      ok: false,
      error: "bot_token_missing",
      usedTokenType: "bot",
      raw: null,
    };
  }

  return sendWithToken(botToken, "bot");
};
