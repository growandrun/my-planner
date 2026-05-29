"use client";
import { supabase } from "@/lib/supabase";
import type { Todo } from "@/lib/types";
import { format } from "date-fns";

export default function TodoSidebar({
  todos, onChange, onAdd,
}: { todos: Todo[]; onChange: () => void; onAdd: () => void }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const todayTodos = todos.filter((t) => t.due_date === today);
  const upcoming = todos.filter((t) => t.due_date > today && !t.done).slice(0, 10);

  async function toggle(t: Todo) {
    await supabase.from("todos").update({ done: !t.done }).eq("id", t.id);
    onChange();
  }
  async function remove(id: string) {
    await supabase.from("todos").delete().eq("id", id);
    onChange();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">오늘 할 일</h2>
        <button onClick={onAdd} className="text-xs bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded">+ 추가</button>
      </div>
      <div className="text-xs text-neutral-400">{today}</div>
      <ul className="space-y-1">
        {todayTodos.length === 0 && <li className="text-sm text-neutral-500">없음</li>}
        {todayTodos.map((t) => (
          <li key={t.id} className="flex items-center gap-2 group">
            <input type="checkbox" checked={t.done} onChange={() => toggle(t)} className="w-4 h-4" />
            <span className={`flex-1 text-sm ${t.done ? "line-through text-neutral-500" : ""}`}>
              {t.due_time && <span className="text-neutral-400 mr-1">{t.due_time.slice(0,5)}</span>}
              {t.title}
              {t.priority > 0 && <span className="ml-1 text-yellow-400">{"★".repeat(t.priority)}</span>}
            </span>
            <button onClick={() => remove(t.id)} className="opacity-0 group-hover:opacity-100 text-xs text-red-400">✕</button>
          </li>
        ))}
      </ul>

      <div>
        <h3 className="font-semibold text-sm text-neutral-300 mb-2">다가오는 일</h3>
        <ul className="space-y-1">
          {upcoming.map((t) => (
            <li key={t.id} className="text-xs text-neutral-400 flex justify-between">
              <span>{t.title}</span>
              <span>{t.due_date.slice(5)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
