"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import type { Deadline } from "@/lib/types";
import { supabase } from "@/lib/supabase";

const DAY_W = 64; // px per day
const DAYS_BEFORE = 14;
const DAYS_AFTER = 90;

export default function Timeline({
  deadlines, onChange, onAdd,
}: { deadlines: Deadline[]; onChange: () => void; onAdd: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = startOfDay(new Date());
  const [showDone, setShowDone] = useState(false);

  // Range: cover [today-14 .. today+90], but extend if a deadline lies outside
  const { origin, totalDays } = useMemo(() => {
    let earliest = addDays(today, -DAYS_BEFORE);
    let latest = addDays(today, DAYS_AFTER);
    for (const d of deadlines) {
      const s = parseISO(d.start_date);
      const e = parseISO(d.end_date);
      if (s < earliest) earliest = addDays(s, -7);
      if (e > latest) latest = addDays(e, 14);
    }
    return { origin: earliest, totalDays: differenceInCalendarDays(latest, earliest) + 1 };
  }, [deadlines, today.getTime()]);

  const visible = showDone ? deadlines : deadlines.filter((d) => !d.done);

  // Assign lanes
  const rows = useMemo(() => {
    const sorted = [...visible].sort((a, b) => a.start_date.localeCompare(b.start_date));
    const lanes: { end: string }[] = [];
    const out: Array<Deadline & { lane: number }> = [];
    for (const d of sorted) {
      let lane = lanes.findIndex((l) => l.end < d.start_date);
      if (lane === -1) { lane = lanes.length; lanes.push({ end: d.end_date }); }
      else lanes[lane].end = d.end_date;
      out.push({ ...d, lane });
    }
    return { items: out, laneCount: Math.max(1, lanes.length) };
  }, [visible]);

  function pos(date: string) {
    return Math.max(0, differenceInCalendarDays(parseISO(date), origin));
  }

  // ── Auto-center on earliest deadline on first render ──
  const centeredRef = useRef(false);
  useLayoutEffect(() => {
    if (centeredRef.current || !scrollRef.current) return;
    if (deadlines.length === 0) {
      // No deadlines: center today
      const todayPos = differenceInCalendarDays(today, origin) * DAY_W;
      scrollRef.current.scrollLeft = todayPos - scrollRef.current.clientWidth / 2 + DAY_W / 2;
      centeredRef.current = true;
      return;
    }
    const undone = deadlines.filter((d) => !d.done);
    const target = (undone.length ? undone : deadlines)
      .reduce((min, d) => (d.start_date < min ? d.start_date : min), "9999-12-31");
    if (target === "9999-12-31") return;
    const px = differenceInCalendarDays(parseISO(target), origin) * DAY_W;
    scrollRef.current.scrollLeft = px - scrollRef.current.clientWidth / 2 + DAY_W / 2;
    centeredRef.current = true;
  }, [deadlines, origin]);

  // ── Mouse drag scroll ──
  const drag = useRef({ down: false, startX: 0, startScroll: 0, moved: false });
  const onMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    drag.current = { down: true, startX: e.pageX, startScroll: scrollRef.current.scrollLeft, moved: false };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag.current.down || !scrollRef.current) return;
    const dx = e.pageX - drag.current.startX;
    if (Math.abs(dx) > 3) drag.current.moved = true;
    scrollRef.current.scrollLeft = drag.current.startScroll - dx;
  };
  const onMouseUpOrLeave = () => { drag.current.down = false; };

  async function toggleDone(d: Deadline) {
    if (drag.current.moved) return; // Don't toggle if user was dragging
    await supabase.from("deadlines").update({ done: !d.done }).eq("id", d.id);
    onChange();
  }
  async function remove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("완전히 삭제할까요?")) return;
    await supabase.from("deadlines").delete().eq("id", id);
    onChange();
  }

  function jumpToToday() {
    if (!scrollRef.current) return;
    const px = differenceInCalendarDays(today, origin) * DAY_W;
    scrollRef.current.scrollTo({ left: px - scrollRef.current.clientWidth / 2 + DAY_W / 2, behavior: "smooth" });
  }
  function jumpToEarliest() {
    if (!scrollRef.current || deadlines.length === 0) return;
    const undone = deadlines.filter((d) => !d.done);
    const target = (undone.length ? undone : deadlines)
      .reduce((min, d) => (d.start_date < min ? d.start_date : min), "9999-12-31");
    const px = differenceInCalendarDays(parseISO(target), origin) * DAY_W;
    scrollRef.current.scrollTo({ left: px - scrollRef.current.clientWidth / 2 + DAY_W / 2, behavior: "smooth" });
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
        <h2 className="font-bold">데드라인 타임라인</h2>
        <div className="flex gap-1 flex-wrap">
          <button onClick={jumpToEarliest} className="text-xs bg-neutral-800 px-2 py-1 rounded">가장 이른</button>
          <button onClick={jumpToToday} className="text-xs bg-neutral-800 px-2 py-1 rounded">오늘</button>
          <button onClick={() => setShowDone(!showDone)} className="text-xs bg-neutral-800 px-2 py-1 rounded">
            {showDone ? "완료 숨김" : "완료 보기"}
          </button>
          <button onClick={onAdd} className="text-xs bg-purple-600 px-2 py-1 rounded">+ 추가</button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUpOrLeave}
        onMouseLeave={onMouseUpOrLeave}
        className="flex-1 overflow-x-auto overflow-y-hidden no-scrollbar select-none cursor-grab active:cursor-grabbing"
      >
        <div className="relative" style={{ width: totalDays * DAY_W, height: "100%" }}>
          {/* Day grid header */}
          <div className="flex sticky top-0 z-10">
            {Array.from({ length: totalDays }).map((_, i) => {
              const d = addDays(origin, i);
              const isTodayCell = differenceInCalendarDays(d, today) === 0;
              return (
                <div
                  key={i}
                  className={`shrink-0 text-center border-r border-neutral-800 text-[10px] py-1 ${
                    isTodayCell ? "bg-blue-900/50 text-white" : "text-neutral-400"
                  }`}
                  style={{ width: DAY_W }}
                >
                  <div>{format(d, "M/d")}</div>
                  <div>{["일","월","화","수","목","금","토"][d.getDay()]}</div>
                </div>
              );
            })}
          </div>

          {/* Bars */}
          <div className="relative mt-2" style={{ height: rows.laneCount * 32 }}>
            {rows.items.map((d) => {
              const left = pos(d.start_date) * DAY_W + 2;
              const width = Math.max(DAY_W - 4, (differenceInCalendarDays(parseISO(d.end_date), parseISO(d.start_date)) + 1) * DAY_W - 4);
              return (
                <div
                  key={d.id}
                  className={`absolute h-7 rounded px-2 text-xs flex items-center gap-1 group ${
                    d.done ? "bg-neutral-700 line-through text-neutral-400 opacity-60" : "bg-purple-600 hover:bg-purple-500"
                  }`}
                  style={{ left, width, top: d.lane * 32 }}
                  onClick={() => toggleDone(d)}
                  title={`클릭: 완료 토글 / ${d.title} (${d.start_date}${d.start_time ? " " + d.start_time.slice(0,5) : ""} ~ ${d.end_date}${d.end_time ? " " + d.end_time.slice(0,5) : ""})${d.memo ? "\n" + d.memo : ""}`}
                >
                  <span className="truncate flex-1">{d.title}{d.end_time ? ` →${d.end_time.slice(0,5)}` : ""}</span>
                  {d.priority > 0 && <span className="text-yellow-300 text-[10px] shrink-0">{"★".repeat(d.priority)}</span>}
                  <button onClick={(e) => remove(d.id, e)} className="opacity-0 group-hover:opacity-100 text-[10px] text-white/80 hover:text-red-300 shrink-0">✕</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
