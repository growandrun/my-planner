import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMessage } from "@/lib/telegram";
import { format, addMinutes } from "date-fns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/notify?secret=...
// Run every few minutes via Vercel Cron or GitHub Actions
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const auth = req.headers.get("authorization");
  const okAuth =
    secret === process.env.CRON_SECRET ||
    auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!okAuth) return NextResponse.json({ ok: false }, { status: 401 });
  const chat_id = Number(process.env.TELEGRAM_ALLOWED_CHAT_ID);
  const db = supabaseAdmin();
  const now = new Date();
  const soon = addMinutes(now, 60);
  const today = format(now, "yyyy-MM-dd");

  // 1. Todos within next 60 min (need due_time set)
  const { data: todos } = await db.from("todos").select("*")
    .eq("notified", false).eq("done", false).eq("due_date", today);
  const due: any[] = [];
  for (const t of todos || []) {
    if (!t.due_time) continue;
    const dt = new Date(`${t.due_date}T${t.due_time}`);
    if (dt >= now && dt <= soon) due.push(t);
  }

  // 2. Deadlines ending today or tomorrow
  const tomorrow = format(addMinutes(now, 60 * 24), "yyyy-MM-dd");
  const { data: dls } = await db.from("deadlines").select("*")
    .eq("notified", false).eq("done", false).in("end_date", [today, tomorrow]);

  let sent = 0;
  for (const t of due) {
    await sendMessage(chat_id, `⏰ <b>곧 시작</b>\n${t.title}\n${t.due_time?.slice(0,5)}${t.memo ? "\n💬 " + t.memo : ""}`);
    await db.from("todos").update({ notified: true }).eq("id", t.id);
    sent++;
  }
  for (const d of dls || []) {
    const when = d.end_date === today ? "오늘 마감" : "내일 마감";
    await sendMessage(chat_id, `📅 <b>${when}</b>\n${d.title}\n${d.start_date} ~ ${d.end_date}${d.memo ? "\n💬 " + d.memo : ""}`);
    await db.from("deadlines").update({ notified: true }).eq("id", d.id);
    sent++;
  }

  return NextResponse.json({ ok: true, sent });
}
