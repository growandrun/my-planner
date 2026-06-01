import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMessage, editMessage, answerCallback } from "@/lib/telegram";
import { addDays, format } from "date-fns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = () => Number(process.env.TELEGRAM_ALLOWED_CHAT_ID);

type State = {
  step?:
    | "type" | "title" | "memo"
    | "date" | "date_text" | "time" | "time_text"
    | "start" | "start_text" | "start_time" | "start_time_text"
    | "end" | "end_text" | "end_time" | "end_time_text"
    | "priority";
  kind?: "todo" | "deadline";
  title?: string;
  memo?: string;
  date?: string;
  time?: string;
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
};

async function getState(chat_id: number): Promise<State> {
  const db = supabaseAdmin();
  const { data } = await db.from("tg_sessions").select("state").eq("chat_id", chat_id).maybeSingle();
  return (data?.state as State) ?? {};
}
async function setState(chat_id: number, state: State) {
  const db = supabaseAdmin();
  await db.from("tg_sessions").upsert({ chat_id, state, updated_at: new Date().toISOString() });
}
async function clearState(chat_id: number) { await setState(chat_id, {}); }

function dateKeyboard(prefix: string, base = new Date()) {
  const rows: any[] = [];
  for (let r = 0; r < 4; r++) {
    const row = [];
    for (let c = 0; c < 4; c++) {
      const i = r * 4 + c;
      const d = addDays(base, i);
      row.push({ text: i === 0 ? "오늘" : i === 1 ? "내일" : format(d, "M/d(E)"), callback_data: `${prefix}:${format(d, "yyyy-MM-dd")}` });
    }
    rows.push(row);
  }
  rows.push([{ text: "✍️ 직접 입력 (MM-DD)", callback_data: `${prefix}:__type__` }]);
  return { inline_keyboard: rows };
}

function parseDateText(text: string): string | null {
  const t = text.trim();
  // YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t);
  if (m) {
    const y = +m[1], mo = +m[2], d = +m[3];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    }
  }
  // MM-DD / MM/DD / MM.DD / M.D etc → current year
  m = /^(\d{1,2})[-/.](\d{1,2})$/.exec(t);
  if (m) {
    const mo = +m[1], d = +m[2];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      const y = new Date().getFullYear();
      return `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    }
  }
  // Compact 8-digit YYYYMMDD
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(t);
  if (m) {
    const y = +m[1], mo = +m[2], d = +m[3];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    }
  }
  return null;
}
function timeKeyboard(prefix: string = "time") {
  const times = ["없음", "06:00", "08:00", "09:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "21:00", "22:00"];
  const rows: any[] = [];
  for (let i = 0; i < times.length; i += 4) {
    rows.push(times.slice(i, i + 4).map((t) => ({ text: t, callback_data: `${prefix}:${t === "없음" ? "_" : t}` })));
  }
  rows.push([{ text: "✍️ 직접 입력 (HH:MM)", callback_data: `${prefix}:__type__` }]);
  return { inline_keyboard: rows };
}
function priorityKeyboard() {
  return {
    inline_keyboard: [
      [0,1,2,3,4,5].map((p) => ({ text: p === 0 ? "없음" : "★".repeat(p), callback_data: `prio:${p}` })),
    ],
  };
}
function typeKeyboard() {
  return {
    inline_keyboard: [[
      { text: "📝 할 일", callback_data: "kind:todo" },
      { text: "📅 데드라인", callback_data: "kind:deadline" },
    ]],
  };
}

async function saveAndFinish(chat_id: number, s: State) {
  const db = supabaseAdmin();
  if (s.kind === "todo") {
    await db.from("todos").insert({
      title: s.title!, memo: s.memo || null, due_date: s.date!, due_time: s.time || null, priority: 0,
    });
  }
}

export async function POST(req: NextRequest) {
  // Optional secret-check via header set when registering webhook
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== expected) return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = await req.json();
  const msg = update.message;
  const cb = update.callback_query;
  const chat_id: number | undefined = msg?.chat?.id ?? cb?.message?.chat?.id;
  if (!chat_id) return NextResponse.json({ ok: true });
  if (chat_id !== ALLOWED()) {
    await sendMessage(chat_id, "Unauthorized.");
    return NextResponse.json({ ok: true });
  }

  const state = await getState(chat_id);

  // ─── Text messages ─────────────────────────────────────
  if (msg?.text) {
    const text: string = msg.text.trim();
    if (text === "/start" || text === "/new" || text === "/add") {
      await clearState(chat_id);
      await sendMessage(chat_id, "무엇을 추가할까요?", typeKeyboard());
      return NextResponse.json({ ok: true });
    }
    if (text === "/list" || text === "/today") {
      const db = supabaseAdmin();
      const today = format(new Date(), "yyyy-MM-dd");
      const { data: todos } = await db.from("todos").select("*").gte("due_date", today).order("due_date").limit(20);
      const { data: dls } = await db.from("deadlines").select("*").lte("start_date", today).gte("end_date", today);
      let out = `<b>오늘 (${today})</b>\n`;
      out += "진행중 데드라인:\n";
      out += (dls || []).map((d) => `• ${d.title} (~${d.end_date})`).join("\n") || "  없음";
      out += "\n\n다가오는 할 일:\n";
      out += (todos || []).map((t: any) => `• ${t.due_date}${t.due_time ? " " + t.due_time.slice(0,5) : ""} ${t.title}${t.done ? " ✅" : ""}`).join("\n") || "  없음";
      await sendMessage(chat_id, out);
      return NextResponse.json({ ok: true });
    }
    if (text === "/cancel") {
      await clearState(chat_id);
      await sendMessage(chat_id, "취소되었습니다.");
      return NextResponse.json({ ok: true });
    }
    if (text === "/help") {
      await sendMessage(chat_id,
        "<b>명령어</b>\n/new - 새 항목 추가\n/today - 오늘 일정\n/list - 다가오는 할 일\n/done - 완료 토글 (오늘+활성 데드라인)\n/web - 웹사이트 열기\n/balance - 잔액/오늘 지출\n/spend - 지출 기록 (지출처 금액 [메모])\n/setbalance - 잔액 직접 설정\n/cancel - 입력 취소\n/help - 도움말");
      return NextResponse.json({ ok: true });
    }
    if (text === "/done") {
      const db = supabaseAdmin();
      const today = format(new Date(), "yyyy-MM-dd");
      const { data: ts } = await db.from("todos").select("id,title,done,due_time").eq("due_date", today).order("due_time", { nullsFirst: true });
      const { data: ds } = await db.from("deadlines").select("id,title,done,start_date,end_date").lte("start_date", today).gte("end_date", today);
      const rows: any[] = [];
      for (const t of ts || []) {
        rows.push([{
          text: `${t.done ? "✅" : "⬜"} ${t.due_time ? t.due_time.slice(0,5) + " " : ""}${t.title}`,
          callback_data: `done:t:${t.id}`,
        }]);
      }
      for (const d of ds || []) {
        rows.push([{
          text: `${d.done ? "✅" : "⬜"} [기간] ${d.title}`,
          callback_data: `done:d:${d.id}`,
        }]);
      }
      if (rows.length === 0) {
        await sendMessage(chat_id, "오늘 항목이 없습니다.");
      } else {
        await sendMessage(chat_id, "토글할 항목을 선택하세요:", { inline_keyboard: rows });
      }
      return NextResponse.json({ ok: true });
    }
    if (text === "/web" || text === "/open" || text === "/site") {
      const url = process.env.NEXT_PUBLIC_APP_URL || "(NEXT_PUBLIC_APP_URL 환경변수 미설정)";
      await sendMessage(chat_id, `🌐 <a href="${url}">${url}</a>`, {
        inline_keyboard: [[{ text: "🌐 웹사이트 열기", url }]],
      });
      return NextResponse.json({ ok: true });
    }
    if (text === "/balance") {
      const db = supabaseAdmin();
      const today = format(new Date(), "yyyy-MM-dd");
      const { data: setting } = await db.from("settings").select("value").eq("key", "starting_balance").maybeSingle();
      const { data: all } = await db.from("expenses").select("amount,spent_at,place,memo");
      const start = Number(setting?.value ?? 0);
      const total = (all || []).reduce((s: number, e: any) => s + e.amount, 0);
      const todayList = (all || []).filter((e: any) => e.spent_at === today);
      const todaySum = todayList.reduce((s: number, e: any) => s + e.amount, 0);
      const fmt = (n: number) => n.toLocaleString("ko-KR") + "원";
      let out = `💰 <b>잔액: ${fmt(start - total)}</b>\n오늘 지출: ${fmt(todaySum)}\n\n오늘 내역:`;
      out += "\n" + (todayList.map((e: any) => `• ${e.place} ${e.memo ? "(" + e.memo + ") " : ""}${fmt(e.amount)}`).join("\n") || "  없음");
      await sendMessage(chat_id, out);
      return NextResponse.json({ ok: true });
    }
    if (text.startsWith("/spend")) {
      // Usage: /spend <지출처> <금액> [메모...]
      const args = text.slice(6).trim();
      if (!args) {
        await sendMessage(chat_id, "사용법: <code>/spend 스타벅스 4500 카페라떼</code>\n순서: 지출처 금액 [메모]");
        return NextResponse.json({ ok: true });
      }
      // Parse: first token = place, second numeric = amount, rest = memo
      const parts = args.split(/\s+/);
      // Find first pure-number token
      let amtIdx = parts.findIndex((p) => /^-?\d[\d,]*$/.test(p));
      if (amtIdx < 1) {
        await sendMessage(chat_id, "형식이 올바르지 않아요. 예: <code>/spend 스타벅스 4500 메모</code>");
        return NextResponse.json({ ok: true });
      }
      const place = parts.slice(0, amtIdx).join(" ");
      const amount = Number(parts[amtIdx].replace(/,/g, ""));
      const memo = parts.slice(amtIdx + 1).join(" ") || null;
      const db = supabaseAdmin();
      const today = format(new Date(), "yyyy-MM-dd");
      await db.from("expenses").insert({ spent_at: today, place, memo, amount });
      const { data: setting } = await db.from("settings").select("value").eq("key", "starting_balance").maybeSingle();
      const { data: all } = await db.from("expenses").select("amount");
      const start = Number(setting?.value ?? 0);
      const total = (all || []).reduce((s: number, e: any) => s + e.amount, 0);
      const fmt = (n: number) => n.toLocaleString("ko-KR") + "원";
      await sendMessage(chat_id, `✅ 기록됨\n${place} ${fmt(amount)}${memo ? "\n💬 " + memo : ""}\n\n잔액: <b>${fmt(start - total)}</b>`);
      return NextResponse.json({ ok: true });
    }
    if (text.startsWith("/setbalance")) {
      const arg = text.slice(11).trim().replace(/[^\d-]/g, "");
      const n = Number(arg);
      if (!Number.isFinite(n) || !arg) {
        await sendMessage(chat_id, "사용법: <code>/setbalance 500000</code>");
        return NextResponse.json({ ok: true });
      }
      const db = supabaseAdmin();
      const { data: all } = await db.from("expenses").select("amount");
      const total = (all || []).reduce((s: number, e: any) => s + e.amount, 0);
      await db.from("settings").upsert({ key: "starting_balance", value: (n + total) as any, updated_at: new Date().toISOString() });
      const fmt = (x: number) => x.toLocaleString("ko-KR") + "원";
      await sendMessage(chat_id, `잔액을 <b>${fmt(n)}</b>으로 설정했습니다.`);
      return NextResponse.json({ ok: true });
    }

    // Stateful text input
    if (state.step === "title") {
      state.title = text;
      state.step = "memo";
      await setState(chat_id, state);
      await sendMessage(chat_id, "메모를 입력하세요. (없으면 - 또는 'skip')");
      return NextResponse.json({ ok: true });
    }
    if (state.step === "date_text" || state.step === "start_text" || state.step === "end_text") {
      const parsed = parseDateText(text);
      if (!parsed) {
        await sendMessage(chat_id, "형식이 올바르지 않아요. <b>MM-DD</b> 또는 <b>YYYY-MM-DD</b> 로 다시 입력하세요.\n예: <code>06-15</code> / <code>2026-06-15</code>");
        return NextResponse.json({ ok: true });
      }
      if (state.step === "date_text") {
        state.date = parsed; state.step = "time";
        await setState(chat_id, state);
        await sendMessage(chat_id, `날짜: <b>${parsed}</b>\n시간을 선택하세요.`, timeKeyboard());
      } else if (state.step === "start_text") {
        state.start_date = parsed; state.step = "start_time";
        await setState(chat_id, state);
        await sendMessage(chat_id, `시작 날짜: <b>${parsed}</b>\n시작 시간을 선택하세요.`, timeKeyboard("stime"));
      } else {
        if (parsed < (state.start_date || "")) {
          await sendMessage(chat_id, `끝 날짜(${parsed})는 시작 날짜(${state.start_date}) 이후여야 해요. 다시 입력하세요.`);
          return NextResponse.json({ ok: true });
        }
        state.end_date = parsed; state.step = "end_time";
        await setState(chat_id, state);
        await sendMessage(chat_id, `끝 날짜: <b>${parsed}</b>\n끝 시간을 선택하세요.`, timeKeyboard("etime"));
      }
      return NextResponse.json({ ok: true });
    }
    if (state.step === "time_text" || state.step === "start_time_text" || state.step === "end_time_text") {
      const m = /^([0-2]\d):([0-5]\d)$/.exec(text);
      if (!m || Number(m[1]) > 23) {
        await sendMessage(chat_id, "형식이 올바르지 않아요. <b>HH:MM</b> 5글자 (예: <code>18:30</code>)로 다시 입력해주세요.");
        return NextResponse.json({ ok: true });
      }
      const tval = `${m[1]}:${m[2]}:00`;
      if (state.step === "time_text") {
        state.time = tval;
        state.step = "priority";
        await setState(chat_id, state);
        await sendMessage(chat_id, `시간: <b>${m[1]}:${m[2]}</b>\n중요도를 선택하세요.`, priorityKeyboard());
      } else if (state.step === "start_time_text") {
        state.start_time = tval;
        state.step = "end";
        await setState(chat_id, state);
        await sendMessage(chat_id, `시작 시간: <b>${m[1]}:${m[2]}</b>\n끝 날짜를 선택하세요.`, dateKeyboard("end", new Date(state.start_date!)));
      } else {
        state.end_time = tval;
        state.step = "priority";
        await setState(chat_id, state);
        await sendMessage(chat_id, `끝 시간: <b>${m[1]}:${m[2]}</b>\n중요도를 선택하세요.`, priorityKeyboard());
      }
      return NextResponse.json({ ok: true });
    }
    if (state.step === "memo") {
      state.memo = (text === "-" || text.toLowerCase() === "skip") ? "" : text;
      if (state.kind === "todo") {
        state.step = "date";
        await setState(chat_id, state);
        await sendMessage(chat_id, "날짜를 선택하세요.", dateKeyboard("date"));
      } else {
        state.step = "start";
        await setState(chat_id, state);
        await sendMessage(chat_id, "시작 날짜를 선택하세요.", dateKeyboard("start"));
      }
      return NextResponse.json({ ok: true });
    }

    await sendMessage(chat_id, "/new 으로 시작하세요.");
    return NextResponse.json({ ok: true });
  }

  // ─── Callback queries (button clicks) ──────────────────
  if (cb) {
    const data: string = cb.data;
    const [k, v] = data.split(":");
    await answerCallback(cb.id);

    if (k === "done") {
      const [, kind, id] = data.split(":");
      const table = kind === "t" ? "todos" : "deadlines";
      const db = supabaseAdmin();
      const { data: row } = await db.from(table).select("done,title").eq("id", id).maybeSingle();
      if (row) {
        await db.from(table).update({ done: !row.done }).eq("id", id);
        await sendMessage(chat_id, `${!row.done ? "✅ 완료" : "⬜ 미완료"}: ${row.title}`);
      }
      return NextResponse.json({ ok: true });
    }
    if (k === "kind") {
      state.kind = v as any;
      state.step = "title";
      await setState(chat_id, state);
      await sendMessage(chat_id, `<b>${v === "todo" ? "할 일" : "데드라인"}</b> 추가\n제목을 입력하세요.`);
      return NextResponse.json({ ok: true });
    }
    if (k === "date" && state.step === "date") {
      if (v === "__type__") {
        state.step = "date_text";
        await setState(chat_id, state);
        await sendMessage(chat_id, "날짜를 입력하세요. <b>MM-DD</b> 또는 <b>YYYY-MM-DD</b>\n예: <code>06-15</code> 또는 <code>2026-06-15</code>");
        return NextResponse.json({ ok: true });
      }
      state.date = v; state.step = "time";
      await setState(chat_id, state);
      await sendMessage(chat_id, "시간을 선택하세요.", timeKeyboard());
      return NextResponse.json({ ok: true });
    }
    if (k === "time" && state.step === "time") {
      if (v === "__type__") {
        state.step = "time_text";
        await setState(chat_id, state);
        await sendMessage(chat_id, "시간을 <b>HH:MM</b> 형식으로 입력하세요. (예: <code>18:30</code>, <code>15:23</code>)");
        return NextResponse.json({ ok: true });
      }
      state.time = v === "_" ? "" : v + ":00";
      state.step = "priority";
      await setState(chat_id, state);
      await sendMessage(chat_id, "중요도를 선택하세요.", priorityKeyboard());
      return NextResponse.json({ ok: true });
    }
    if (k === "start" && state.step === "start") {
      if (v === "__type__") {
        state.step = "start_text";
        await setState(chat_id, state);
        await sendMessage(chat_id, "시작 날짜를 입력하세요. <b>MM-DD</b> 또는 <b>YYYY-MM-DD</b>\n예: <code>06-15</code>");
        return NextResponse.json({ ok: true });
      }
      state.start_date = v; state.step = "start_time";
      await setState(chat_id, state);
      await sendMessage(chat_id, "시작 시간을 선택하세요.", timeKeyboard("stime"));
      return NextResponse.json({ ok: true });
    }
    if (k === "stime" && state.step === "start_time") {
      if (v === "__type__") {
        state.step = "start_time_text";
        await setState(chat_id, state);
        await sendMessage(chat_id, "시작 시간을 <b>HH:MM</b> 형식으로 입력하세요. (예: <code>09:00</code>)");
        return NextResponse.json({ ok: true });
      }
      state.start_time = v === "_" ? "" : v + ":00";
      state.step = "end";
      await setState(chat_id, state);
      await sendMessage(chat_id, "끝 날짜를 선택하세요.", dateKeyboard("end", new Date(state.start_date!)));
      return NextResponse.json({ ok: true });
    }
    if (k === "end" && state.step === "end") {
      if (v === "__type__") {
        state.step = "end_text";
        await setState(chat_id, state);
        await sendMessage(chat_id, "끝 날짜를 입력하세요. <b>MM-DD</b> 또는 <b>YYYY-MM-DD</b>\n예: <code>06-20</code>");
        return NextResponse.json({ ok: true });
      }
      if (v < (state.start_date || "")) {
        await sendMessage(chat_id, "끝 날짜는 시작 날짜 이후여야 해요. 다시 선택하세요.", dateKeyboard("end", new Date(state.start_date!)));
        return NextResponse.json({ ok: true });
      }
      state.end_date = v; state.step = "end_time";
      await setState(chat_id, state);
      await sendMessage(chat_id, "끝 시간을 선택하세요.", timeKeyboard("etime"));
      return NextResponse.json({ ok: true });
    }
    if (k === "etime" && state.step === "end_time") {
      if (v === "__type__") {
        state.step = "end_time_text";
        await setState(chat_id, state);
        await sendMessage(chat_id, "끝 시간을 <b>HH:MM</b> 형식으로 입력하세요. (예: <code>18:30</code>)");
        return NextResponse.json({ ok: true });
      }
      state.end_time = v === "_" ? "" : v + ":00";
      state.step = "priority";
      await setState(chat_id, state);
      await sendMessage(chat_id, "중요도를 선택하세요.", priorityKeyboard());
      return NextResponse.json({ ok: true });
    }
    if (k === "prio" && state.step === "priority") {
      const priority = Number(v);
      const db = supabaseAdmin();
      if (state.kind === "todo") {
        await db.from("todos").insert({
          title: state.title!, memo: state.memo || null,
          due_date: state.date!, due_time: state.time || null, priority,
        });
        await sendMessage(chat_id, `✅ 할 일 저장됨\n<b>${state.title}</b>\n${state.date}${state.time ? " " + state.time.slice(0,5) : ""}${priority ? "\n" + "★".repeat(priority) : ""}${state.memo ? "\n💬 " + state.memo : ""}`);
      } else {
        await db.from("deadlines").insert({
          title: state.title!, memo: state.memo || null,
          start_date: state.start_date!, end_date: state.end_date!,
          start_time: state.start_time || null, end_time: state.end_time || null,
          priority,
        });
        const st = state.start_time ? " " + state.start_time.slice(0,5) : "";
        const et = state.end_time ? " " + state.end_time.slice(0,5) : "";
        await sendMessage(chat_id, `✅ 데드라인 저장됨\n<b>${state.title}</b>\n${state.start_date}${st} ~ ${state.end_date}${et}${priority ? "\n" + "★".repeat(priority) : ""}${state.memo ? "\n💬 " + state.memo : ""}`);
      }
      await clearState(chat_id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
