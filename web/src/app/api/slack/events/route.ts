// web/src/app/api/slack/events/route.ts
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { formatISO } from "date-fns";
import { env } from "@/config/env";
import { DEFAULT_TIMEZONE } from "@/config/constants";
import { getWeekdayCode, toTimezone } from "@/lib/time";
import { resolveUserSlug } from "@/config/departments";
import { parseDailyReportFromSlack } from "@/lib/slack/dr-format";
import {
  getSlackTimestampForReport,
  setSlackTsOnSheet,
  upsertDailyReport,
} from "@/lib/sheets/daily-reports";

/**
 * Slack は3秒以内のACKを要求します。
 * 重い処理は ack 後に非同期で実行（fire-and-forget）。
 */
export const runtime = "nodejs";      // 署名検証で Node crypto を使う
export const dynamic = "force-dynamic";

const MAX_AGE_SECONDS = 60 * 5;

type SlackEvent =
  | { type: "url_verification"; challenge: string }
  | {
      type: "event_callback";
      event: {
        type?: string;
        text?: string;
        channel?: string;
        user?: string;
        ts?: string;
        team?: string;
        subtype?: string;
        // message_changed などの編集イベント対策
        message?: {
          text?: string;
          user?: string;
          ts?: string;
          subtype?: string;
        };
      };
    };

function jsonSafeParse<T = unknown>(txt: string): T | null {
  try {
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function validateEnv() {
  const missing: string[] = [];
  if (!env.server.SLACK_SIGNING_SECRET) missing.push("SLACK_SIGNING_SECRET");
  if (!env.server.SLACK_DAILY_REPORT_CHANNEL_ID)
    missing.push("SLACK_DAILY_REPORT_CHANNEL_ID");
  if (missing.length) {
    throw new Error(
      `Missing env(s): ${missing.join(", ")} (check web/.env and restart Next)`
    );
  }
}

export async function POST(request: Request) {
  validateEnv();

  // ---- 1) 署名ヘッダ & タイムスタンプ検査 ----
  const tsHeader = request.headers.get("x-slack-request-timestamp");
  const sigHeader = request.headers.get("x-slack-signature");

  if (!tsHeader || !sigHeader) {
    return NextResponse.json({ error: "Missing Slack signature" }, { status: 400 });
  }
  const tsNum = Number(tsHeader);
  if (!Number.isFinite(tsNum)) {
    return NextResponse.json({ error: "Invalid timestamp" }, { status: 400 });
  }
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - tsNum) > MAX_AGE_SECONDS) {
    // リプレイ対策
    return NextResponse.json({ error: "Request timestamp outside tolerance" }, { status: 400 });
  }

  // ---- 2) RAW body を先に読み出す（検証に必須）----
  const raw = await request.text();

  // ---- 3) HMAC 署名検証（v0）----
  const base = `v0:${tsHeader}:${raw}`;
  const expected = `v0=${createHmac("sha256", env.server.SLACK_SIGNING_SECRET)
    .update(base, "utf8")
    .digest("hex")}`;

  if (!constantTimeEqual(expected, sigHeader)) {
    console.warn("slack.events.signature_mismatch", { tsHeader });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // ---- 4) JSON パース & 型ざっくりチェック ----
  const body = jsonSafeParse<SlackEvent>(raw);
  if (!body || typeof body !== "object" || !("type" in body)) {
    console.error("slack.events.invalid_json_or_type");
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // ---- 5) URL Verification は challenge 文字列を即返す ----
  if (body.type === "url_verification") {
    // Slack は text/plain でも JSON でもOK。確実に通るようプレーンで返す。
    return new NextResponse(body.challenge, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }

  // ---- 6) イベント受信（まずは即ACKを返し、非同期で処理）----
  // Slack の再試行ヘッダ（重複排除のヒント）
  const retryNum = request.headers.get("x-slack-retry-num");
  const retryReason = request.headers.get("x-slack-retry-reason");

  queueMicrotask(async () => {
    try {
      console.info("SLACK_EVENT_HIT", {
        retryNum,
        retryReason,
        eventType: body.type,
      });

      if (body.type === "event_callback") {
        await handleEventCallback(body);
      }
    } catch (e) {
      console.error("slack.events.async_handler.error", { e });
    }
  });

  // 3秒制限に間に合うよう、処理は後続に委ねて即ACK
  return NextResponse.json({ ok: true }, { status: 200 });
}

async function handleEventCallback(body: Extract<SlackEvent, { type: "event_callback" }>) {
  const ev = body.event ?? {};
  // 編集イベント（message_changed）はスキップ
  if (ev.subtype === "message_changed") return;
  // Bot 自身などの subtype を持つメッセージはスキップ
  if (ev.subtype) return;
  if (ev.type !== "message") return;

  // channel 絞り込み（環境変数）
  if (ev.channel !== env.server.SLACK_DAILY_REPORT_CHANNEL_ID) {
    return;
  }

  // body.event.message に本体が入るケース（編集/一部アプリ）に対処
  const text = (ev.text ?? ev.message?.text ?? "").trim();
  if (!text) return;

  // DRフォーマット解析（実装は既存の parseDailyReportFromSlack を利用）
  const parsed = parseDailyReportFromSlack(text);
  const hasContent =
    !!(parsed.done ||
      parsed.satisfaction ||
      parsed.good ||
      parsed.moreNext ||
      parsed.todoTomorrow ||
      parsed.wishTomorrow ||
      parsed.personalNews);

  if (!hasContent) return;

  // Slack ユーザーを userSlug に解決
  const slackUserId = (ev.user ?? ev.message?.user) ?? null;
  const userSlug = resolveUserSlug({ slackUserId }) ?? null;
  if (!userSlug) {
    console.warn("slack.events.unresolved_user", { slackUserId });
    return;
  }

  // ts は "秒.マイクロ秒" 形式
  const ts = (ev.ts ?? ev.message?.ts) ?? "";
  if (!ts) {
    console.warn("slack.events.missing_ts", { userSlug });
    return;
  }

  // ts → 日付（ローカルTZ）
  const secStr = ts.split(".")[0] ?? "0";
  const sec = Number.parseInt(secStr, 10);
  const eventDate = Number.isFinite(sec) ? new Date(sec * 1000) : new Date();
  const localDate = formatISO(toTimezone(eventDate, DEFAULT_TIMEZONE), {
    representation: "date",
  });

  // 既存の Slack TS を確認して idempotent に（重複書き込み防止）
  const existingTs = await getSlackTimestampForReport(userSlug, localDate);
  if (existingTs) {
    if (existingTs === ts) return;
    console.info("slack.events.duplicate_skipped", {
      userSlug,
      date: localDate,
      existingTs,
      incomingTs: ts,
    });
    return;
  }

  const nowIso = new Date().toISOString();

  // Upsert（ヘッダーは A〜N まで想定 / weekday, email なども格納）
  await upsertDailyReport({
    reportId: `dr_${userSlug}_${localDate}`,
    date: localDate,
    weekday: getWeekdayCode(localDate),
    userSlug,
    userName: userSlug,
    email: "",
    slackUserId: slackUserId ?? "",
    slackTeamId: ev.team ?? "",
    channelId: ev.channel ?? "",
    satisfactionToday: parsed.satisfaction ?? "",
    doneToday: parsed.done ?? "",
    goodMoreBackground: parsed.good ?? "",
    moreNext: parsed.moreNext ?? "",
    todoTomorrow: parsed.todoTomorrow ?? "",
    wishTomorrow: parsed.wishTomorrow ?? "",
    personalNews: parsed.personalNews ?? "",
    tags: [],
    source: "slack_ingest",
    slackTs: ts,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  // シート側の slackTs カラムにも反映（将来の重複抑止に利用）
  await setSlackTsOnSheet(userSlug, localDate, ts);

  console.info("slack.events.dr_upsert.ok", {
    userSlug,
    date: localDate,
    ts,
  });
}
