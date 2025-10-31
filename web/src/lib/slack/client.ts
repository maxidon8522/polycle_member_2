import { WebClient, LogLevel } from "@slack/web-api";
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
  satisfaction: report.satisfactionToday ?? "",
  done: report.doneToday ?? "",
  good: report.goodMoreBackground ?? "",
  moreNext: report.moreNext ?? "",
  tomorrowTasks: report.todoTomorrow ?? "",
  nonTask: report.wishTomorrow ?? "",
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
      const response = await client.chat.postMessage({
        channel: channelId,
        text: payload.text,
        blocks: payload.blocks,
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
    } catch (error) {
      const err = error as {
        message?: string;
        data?: { error?: string; needed?: string; provided?: string };
        response?: { data?: { error?: string; needed?: string; provided?: string } };
        status?: number;
      };
      const responseData = err?.response?.data ?? err?.data ?? {};
      console.error("slack.post_daily_report.error", {
        channel: channelId,
        reportId: report.reportId,
        usingUserToken: usedTokenType === "user",
        message: err?.message,
        data: responseData,
        status: err?.response?.status ?? err?.status ?? null,
        error,
      });
      return {
        ok: false,
        error:
          typeof (responseData as { error?: string }).error === "string"
            ? (responseData as { error?: string }).error
            : err?.message,
        needed:
          typeof (responseData as { needed?: string }).needed === "string"
            ? (responseData as { needed?: string }).needed
            : undefined,
        provided:
          typeof (responseData as { provided?: string }).provided === "string"
            ? (responseData as { provided?: string }).provided
            : undefined,
        usedTokenType,
        raw: error,
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
