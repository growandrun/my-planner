import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMessage } from "@/lib/telegram";
import { addMinutes } from "date-fns";
import { kstYMD, kstWallTimeToInstant } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const now = new Date();                          // 실제 UTC 순간
  const soon = addMinutes(now, 60);                // +60분 (UTC instant)
  const today = kstYMD(now);                       // KST 기준 오늘
  const tomorrow = kstYMD(addMinutes(now, 60 * 24)); // KST 기준 내일

  // 1) 1시간 이내 시작 예정인 오늘의 할 일
  const { data: todos } = await db.from("todos").select("*")
    .eq("notified", false).eq("done", false).eq("due_date", today);
  const due: any[] = [];
  for (const t of todos || []) {
    if (!t.due_time) continue;
    const dt = kstWallTimeToInstant(t.due_date, t.due_time); // KST → UTC instant
    if (dt >= now && dt <= soon) due.push(t);
  }

  // 2) 오늘 또는 내일 마감 데드라인
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

  return NextResponse.json({ ok: true, sent, today, tomorrow });
}
