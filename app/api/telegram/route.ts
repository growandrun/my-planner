import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMessage, editMessage, answerCallback } from "@/lib/telegram";
import { addDays, format } from "date-fns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = () => Number(process.env.TELEGRAM_ALLOWED_CHAT_ID);

type State = {
  step?: "type" | "title" | "memo" | "date" | "time" | "start" | "end" | "priority";
  kind?: "todo" | "deadline";
  title?: string;
  memo?: string;
  date?: string;
  time?: string;
  start_date?: string;
  end_date?: string;
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
  return { inline_keyboard: rows };
}
function timeKeyboard() {
  const times = ["없음", "06:00", "08:00", "09:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "21:00", "22:00"];
  const rows: any[] = [];
  for (let i = 0; i < times.length; i += 4) {
    rows.push(times.slice(i, i + 4).map((t) => ({ text: t, callback_data: `time:${t === "없음" ? "_" : t}` })));
  }
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
        "<b>명령어</b>\n/new - 새 항목 추가\n/today - 오늘 일정\n/list - 다가오는 할 일\n/cancel - 입력 취소\n/help - 도움말");
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

    if (k === "kind") {
      state.kind = v as any;
      state.step = "title";
      await setState(chat_id, state);
      await sendMessage(chat_id, `<b>${v === "todo" ? "할 일" : "데드라인"}</b> 추가\n제목을 입력하세요.`);
      return NextResponse.json({ ok: true });
    }
    if (k === "date" && state.step === "date") {
      state.date = v; state.step = "time";
      await setState(chat_id, state);
      await sendMessage(chat_id, "시간을 선택하세요.", timeKeyboard());
      return NextResponse.json({ ok: true });
    }
    if (k === "time" && state.step === "time") {
      state.time = v === "_" ? "" : v + ":00";
      state.step = "priority";
      await setState(chat_id, state);
      await sendMessage(chat_id, "중요도를 선택하세요.", priorityKeyboard());
      return NextResponse.json({ ok: true });
    }
    if (k === "start" && state.step === "start") {
      state.start_date = v; state.step = "end";
      await setState(chat_id, state);
      const base = new Date(v);
      await sendMessage(chat_id, "끝 날짜를 선택하세요.", dateKeyboard("end", base));
      return NextResponse.json({ ok: true });
    }
    if (k === "end" && state.step === "end") {
      if (v < (state.start_date || "")) {
        await sendMessage(chat_id, "끝 날짜는 시작 날짜 이후여야 해요. 다시 선택하세요.", dateKeyboard("end", new Date(state.start_date!)));
        return NextResponse.json({ ok: true });
      }
      state.end_date = v; state.step = "priority";
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
          start_date: state.start_date!, end_date: state.end_date!, priority,
        });
        await sendMessage(chat_id, `✅ 데드라인 저장됨\n<b>${state.title}</b>\n${state.start_date} ~ ${state.end_date}${priority ? "\n" + "★".repeat(priority) : ""}${state.memo ? "\n💬 " + state.memo : ""}`);
      }
      await clearState(chat_id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
