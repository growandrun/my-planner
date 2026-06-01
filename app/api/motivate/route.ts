import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMessage } from "@/lib/telegram";
import { currentKSTHour, pickMotivation } from "@/lib/motivation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const auth = req.headers.get("authorization");
  const okAuth = secret === process.env.CRON_SECRET || auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!okAuth) return NextResponse.json({ ok: false }, { status: 401 });

  // Optional override (for testing): ?hour=14
  const hourOverride = url.searchParams.get("hour");
  const hour = hourOverride !== null ? Number(hourOverride) : currentKSTHour();

  const db = supabaseAdmin();
  const { data: setting } = await db.from("settings").select("value").eq("key", "starting_balance").maybeSingle();
  const { data: exps } = await db.from("expenses").select("amount");
  const { data: incs } = await db.from("incomes").select("amount");
  const start = Number(setting?.value ?? 0);
  const totalSpent = (exps || []).reduce((s: number, e: any) => s + Number(e.amount), 0);
  const totalEarned = (incs || []).reduce((s: number, e: any) => s + Number(e.amount), 0);
  const balance = start - totalSpent + totalEarned;

  const msg = pickMotivation(hour, balance);
  if (!msg) return NextResponse.json({ ok: true, skipped: true, hour });

  const chat_id = Number(process.env.TELEGRAM_ALLOWED_CHAT_ID);
  await sendMessage(chat_id, msg);
  return NextResponse.json({ ok: true, hour, balance });
}
