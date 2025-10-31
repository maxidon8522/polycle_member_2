// web/src/app/api/slack/events/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

export const runtime = "nodejs"; // Slack署名検証でNodeのcryptoを使用
export const dynamic = "force-dynamic";

const MAX_AGE_SECONDS = 60 * 5;

function ok(data: unknown = { ok: true }) {
  return NextResponse.json(data);
}
function badRequest(msg = "bad_request") {
  return NextResponse.json({ ok: false, error: msg }, { status: 400 });
}
function unauthorized(msg = "unauthorized") {
  return NextResponse.json({ ok: false, error: msg }, { status: 401 });
}

function safeJson<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function verifySlackSignature(
  bodyRaw: string,
  ts: string | null,
  sig: string | null,
  signingSecret: string | undefined
): boolean {
  if (!ts || !sig || !signingSecret) return false;

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  const age = Math.abs(Date.now() / 1000 - tsNum);
  if (age > MAX_AGE_SECONDS) return false;

  const base = `v0:${ts}:${bodyRaw}`;
  const hmac = createHmac("sha256", signingSecret).update(base).digest("hex");
  const expected = `v0=${hmac}`;

  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function GET() {
  return ok({ ok: true });
}

export async function POST(req: NextRequest) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  const sig = req.headers.get("x-slack-signature");
  const ts = req.headers.get("x-slack-request-timestamp");
  const bodyRaw = await req.text();

  const probe = safeJson<any>(bodyRaw);
  if (probe?.type === "url_verification" && probe?.challenge) {
    return NextResponse.json({ challenge: probe.challenge });
  }

  if (!verifySlackSignature(bodyRaw, ts, sig, signingSecret)) {
    return unauthorized("invalid_signature");
  }

  const evt = probe;
  if (!evt || evt.type !== "event_callback") {
    return ok();
  }

  (async () => {
    try {
      console.log("Slack event (background):", evt?.event?.type, evt?.event);
    } catch (e) {
      console.error("Slack event handler error:", e);
    }
  })();

  return ok();
}
