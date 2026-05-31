"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Todo } from "@/lib/types";
import { format, parseISO } from "date-fns";

export default function TodoSidebar({
  todos, onChange, onAdd, selectedDate, onSelectToday,
}: {
  todos: Todo[];
  onChange: () => void;
  onAdd: () => void;
  selectedDate: string;        // YYYY-MM-DD
  onSelectToday: () => void;
}) {
  const today = format(new Date(), "yyyy-MM-dd");
  const isToday = selectedDate === today;
  const [showDone, setShowDone] = useState(false);

  const dayTodos = todos.filter((t) => t.due_date === selectedDate);
  const active = dayTodos.filter((t) => !t.done).sort((a, b) => (a.due_time || "").localeCompare(b.due_time || ""));
  const done = dayTodos.filter((t) => t.done);
  const upcoming = todos.filter((t) => t.due_date > selectedDate && !t.done).slice(0, 10);

  async function toggle(t: Todo) {
    await supabase.from("todos").update({ done: !t.done }).eq("id", t.id);
    onChange();
  }
  async function remove(id: string) {
    if (!confirm("완전히 삭제할까요?")) return;
    await supabase.from("todos").delete().eq("id", id);
    onChange();
  }

  const title = isToday
    ? "오늘 할 일"
    : `${format(parseISO(selectedDate), "M월 d일")} 할 일`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">{title}</h2>
        <div className="flex gap-1">
          {!isToday && (
            <button onClick={onSelectToday} className="text-xs bg-neutral-700 hover:bg-neutral-600 px-2 py-1 rounded">오늘</button>
          )}
          <button onClick={onAdd} className="text-xs bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded">+ 추가</button>
        </div>
      </div>
      <div className="text-xs text-neutral-400">{selectedDate}</div>

      <ul className="space-y-1">
        {active.length === 0 && done.length === 0 && (
          <li className="text-sm text-neutral-500">일정이 없습니다</li>
        )}
        {active.map((t) => (
          <li key={t.id} className="flex items-center gap-2 group">
            <input type="checkbox" checked={t.done} onChange={() => toggle(t)} className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-sm">
              {t.due_time && <span className="text-neutral-400 mr-1">{t.due_time.slice(0,5)}</span>}
              {t.title}
              {t.priority > 0 && <span className="ml-1 text-yellow-400">{"★".repeat(t.priority)}</span>}
            </span>
            <button onClick={() => remove(t.id)} className="opacity-0 group-hover:opacity-100 text-xs text-red-400">✕</button>
          </li>
        ))}
      </ul>

      {done.length > 0 && (
        <div>
          <button onClick={() => setShowDone(!showDone)} className="text-xs text-neutral-500 hover:text-neutral-300">
            ✓ 완료 {done.length}개 {showDone ? "▼" : "▶"}
          </button>
          {showDone && (
            <ul className="space-y-1 mt-1 opacity-60">
              {done.map((t) => (
                <li key={t.id} className="flex items-center gap-2 group">
                  <input type="checkbox" checked onChange={() => toggle(t)} className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-sm line-through text-neutral-500">
                    {t.due_time && <span className="mr-1">{t.due_time.slice(0,5)}</span>}
                    {t.title}
                  </span>
                  <button onClick={() => remove(t.id)} className="opacity-0 group-hover:opacity-100 text-xs text-red-400">✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div>
        <h3 className="font-semibold text-sm text-neutral-300 mb-2">다가오는 일</h3>
        <ul className="space-y-1">
          {upcoming.length === 0 && <li className="text-xs text-neutral-500">없음</li>}
          {upcoming.map((t) => (
            <li key={t.id} className="text-xs text-neutral-400 flex justify-between gap-2">
              <span className="truncate">{t.title}</span>
              <span className="shrink-0">{t.due_date.slice(5)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
