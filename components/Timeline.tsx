"use client";
import { useMemo, useRef } from "react";
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
  const origin = addDays(today, -DAYS_BEFORE);
  const totalDays = DAYS_BEFORE + DAYS_AFTER;

  // Assign each deadline a "lane" (row) so they don't overlap visually
  const rows = useMemo(() => {
    const sorted = [...deadlines].sort((a, b) => a.start_date.localeCompare(b.start_date));
    const lanes: { end: string }[] = [];
    const out: Array<Deadline & { lane: number }> = [];
    for (const d of sorted) {
      let lane = lanes.findIndex((l) => l.end < d.start_date);
      if (lane === -1) { lane = lanes.length; lanes.push({ end: d.end_date }); }
      else lanes[lane].end = d.end_date;
      out.push({ ...d, lane });
    }
    return { items: out, laneCount: Math.max(1, lanes.length) };
  }, [deadlines]);

  function pos(date: string) {
    return Math.max(0, differenceInCalendarDays(parseISO(date), origin));
  }

  async function remove(id: string) {
    if (!confirm("삭제할까요?")) return;
    await supabase.from("deadlines").delete().eq("id", id);
    onChange();
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold">데드라인 타임라인</h2>
        <div className="flex gap-1">
          <button
            onClick={() => scrollRef.current?.scrollTo({ left: DAYS_BEFORE * DAY_W - 100, behavior: "smooth" })}
            className="text-xs bg-neutral-800 px-2 py-1 rounded"
          >오늘</button>
          <button onClick={onAdd} className="text-xs bg-purple-600 px-2 py-1 rounded">+ 추가</button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden no-scrollbar">
        <div className="relative" style={{ width: totalDays * DAY_W, height: "100%" }}>
          {/* Day grid header */}
          <div className="flex sticky top-0 z-10">
            {Array.from({ length: totalDays }).map((_, i) => {
              const d = addDays(origin, i);
              const isToday = differenceInCalendarDays(d, today) === 0;
              return (
                <div
                  key={i}
                  className={`shrink-0 text-center border-r border-neutral-800 text-[10px] py-1 ${
                    isToday ? "bg-blue-900/50 text-white" : "text-neutral-400"
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
                  className={`absolute h-7 rounded px-2 text-xs flex items-center gap-1 cursor-pointer ${
                    d.done ? "bg-neutral-700 line-through" : "bg-purple-600 hover:bg-purple-500"
                  }`}
                  style={{ left, width, top: d.lane * 32 }}
                  onClick={() => remove(d.id)}
                  title={`${d.title} (${d.start_date}${d.start_time ? " " + d.start_time.slice(0,5) : ""} ~ ${d.end_date}${d.end_time ? " " + d.end_time.slice(0,5) : ""})${d.memo ? "\n" + d.memo : ""}`}
                >
                  <span className="truncate">{d.title}{d.end_time ? ` →${d.end_time.slice(0,5)}` : ""}</span>
                  {d.priority > 0 && <span className="text-yellow-300 text-[10px]">{"★".repeat(d.priority)}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
