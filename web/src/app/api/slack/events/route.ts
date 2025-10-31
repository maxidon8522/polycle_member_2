import { NextResponse } from "next/server";
import crypto from "crypto";
import { env } from "@/config/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifySlackSignature({
  signingSecret,
  body,
  timestamp,
  signature,
}: {
  signingSecret: string;
  body: string;
  timestamp: string;
  signature: string;
}) {
  const base = `v0:${timestamp}:${body}`;
  const mySig = `v0=${crypto
    .createHmac("sha256", signingSecret)
    .update(base, "utf8")
    .digest("hex")}`;

  const a = Buffer.from(mySig, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const raw = await req.text();

  const ts = req.headers.get("x-slack-request-timestamp") ?? "";
  const sig = req.headers.get("x-slack-signature") ?? "";

  if (Math.abs(Date.now() / 1000 - Number(ts)) > 60 * 5) {
    return NextResponse.json({ ok: false, error: "stale_request" }, { status: 400 });
  }

  if (
    !verifySlackSignature({
      signingSecret: env.SLACK_SIGNING_SECRET,
      body: raw,
      timestamp: ts,
      signature: sig,
    })
  ) {
    return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  if (payload.type === "url_verification" && payload.challenge) {
    return new NextResponse(payload.challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/slack/events" });
}
