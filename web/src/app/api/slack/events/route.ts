import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET!;

function verifySlackSignature(req: NextRequest, body: string) {
  const timestamp = req.headers.get("x-slack-request-timestamp");
  const sig = req.headers.get("x-slack-signature");

  if (!timestamp || !sig) return false;

  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (Number(timestamp) < fiveMinutesAgo) return false;

  const base = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac("sha256", SLACK_SIGNING_SECRET);
  hmac.update(base, "utf8");
  const computed = `v0=${hmac.digest("hex")}`;

  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(sig));
}

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    const body = JSON.parse(bodyText);

    // ✅ Slack challenge を返す（必須）
    if (body.type === "url_verification" && body.challenge) {
      return NextResponse.json({ challenge: body.challenge });
    }

    // ✅ セキュリティ：署名チェック
    if (!verifySlackSignature(req, bodyText)) {
      console.error("Slack signature verification failed");
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }

    // ✅ イベント受信ログ
    console.log("SLACK_EVENT_HIT", {
      retryNum: req.headers.get("x-slack-retry-num"),
      retryReason: req.headers.get("x-slack-retry-reason"),
      eventType: body?.type,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Slack event error:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
