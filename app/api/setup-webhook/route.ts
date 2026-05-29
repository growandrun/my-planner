import { NextRequest, NextResponse } from "next/server";

// Visit https://<your-domain>/api/setup-webhook?secret=<CRON_SECRET>
// to register the Telegram webhook against the current deployment URL.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "bad secret" }, { status: 401 });
  }
  const base = `${url.protocol}//${url.host}`;
  const webhook = `${base}/api/telegram`;
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const tgSecret = process.env.TELEGRAM_WEBHOOK_SECRET!;

  const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhook,
      secret_token: tgSecret,
      drop_pending_updates: true,
    }),
  });
  const data = await r.json();
  return NextResponse.json({ webhook, telegram: data });
}
