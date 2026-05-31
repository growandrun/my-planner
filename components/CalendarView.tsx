"use client";
import { useState } from "react";
import {
  addMonths, format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday,
} from "date-fns";
import type { Todo, Deadline } from "@/lib/types";

export default function CalendarView({
  todos, deadlines, onAdd, onAddDeadline, onChange,
}: {
  todos: Todo[]; deadlines: Deadline[];
  onAdd: (date: string) => void;
  onAddDeadline: (date: string) => void;
  onChange: () => void;
}) {
  const [cursor, setCursor] = useState(new Date());
  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  function eventsFor(date: Date) {
    const ds = format(date, "yyyy-MM-dd");
    const t = todos.filter((x) => x.due_date === ds);
    const d = deadlines.filter((x) => x.start_date <= ds && x.end_date >= ds);
    return { t, d };
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex gap-1 items-center">
          <button onClick={() => setCursor(addMonths(cursor, -1))} className="px-2 py-1 bg-neutral-800 rounded">‹</button>
          <button onClick={() => setCursor(new Date())} className="px-2 py-1 bg-neutral-800 rounded text-xs">오늘</button>
          <button onClick={() => setCursor(addMonths(cursor, 1))} className="px-2 py-1 bg-neutral-800 rounded">›</button>
          <h2 className="font-bold text-base sm:text-lg ml-2">{format(cursor, "yyyy년 M월")}</h2>
        </div>
        <div className="flex gap-1">
          <button onClick={() => onAdd(format(new Date(), "yyyy-MM-dd"))} className="text-xs bg-blue-600 px-2 py-1 rounded">+ 할 일</button>
          <button onClick={() => onAddDeadline(format(new Date(), "yyyy-MM-dd"))} className="text-xs bg-purple-600 px-2 py-1 rounded">+ 데드라인</button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-xs text-neutral-400 mb-1">
        {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
          <div key={d} className={`text-center ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : ""}`}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {days.map((d) => {
          const { t, d: dl } = eventsFor(d);
          const ds = format(d, "yyyy-MM-dd");
          return (
            <button
              key={ds}
              onClick={() => onAdd(ds)}
              className={`text-left p-1 rounded border min-h-[72px] flex flex-col ${
                isSameMonth(d, cursor) ? "border-neutral-800 bg-neutral-950" : "border-transparent bg-neutral-900/50 text-neutral-600"
              } ${isToday(d) ? "ring-2 ring-blue-500" : ""} hover:bg-neutral-800`}
            >
              <div className="text-xs">{format(d, "d")}</div>
              <div className="space-y-0.5 mt-0.5">
                {dl.map((x) => (
                  <div key={x.id} className="truncate text-[10px] bg-purple-700/60 px-1 rounded">{x.title}</div>
                ))}
                {t.map((x) => (
                  <div key={x.id} className={`truncate text-[10px] bg-blue-700/60 px-1 rounded ${x.done ? "line-through opacity-50" : ""}`}>
                    {x.title}
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
