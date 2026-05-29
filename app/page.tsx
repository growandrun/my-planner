"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Todo, Deadline, Goal, SubGoal } from "@/lib/types";
import TodoSidebar from "@/components/TodoSidebar";
import CalendarView from "@/components/CalendarView";
import Timeline from "@/components/Timeline";
import GoalsSidebar from "@/components/GoalsSidebar";
import EventModal from "@/components/EventModal";

export default function Page() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [subgoals, setSubgoals] = useState<SubGoal[]>([]);
  const [openModal, setOpenModal] = useState<null | { kind: "todo" | "deadline"; date?: string }>(null);

  async function load() {
    const [t, d, g, s] = await Promise.all([
      supabase.from("todos").select("*").order("due_date"),
      supabase.from("deadlines").select("*").order("start_date"),
      supabase.from("goals").select("*").order("created_at"),
      supabase.from("subgoals").select("*").order("created_at"),
    ]);
    setTodos((t.data as Todo[]) ?? []);
    setDeadlines((d.data as Deadline[]) ?? []);
    setGoals((g.data as Goal[]) ?? []);
    setSubgoals((s.data as SubGoal[]) ?? []);
  }

  useEffect(() => {
    load();
    // Realtime sync — instant updates across devices & from Telegram bot
    const ch = supabase
      .channel("planner")
      .on("postgres_changes", { event: "*", schema: "public", table: "todos" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "deadlines" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "goals" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "subgoals" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col lg:flex-row gap-2 p-2 overflow-hidden">
      {/* Left: today's todos */}
      <aside className="lg:w-72 lg:shrink-0 bg-neutral-900 rounded-xl p-3 overflow-y-auto">
        <TodoSidebar todos={todos} onChange={load} onAdd={() => setOpenModal({ kind: "todo" })} />
      </aside>

      {/* Main: calendar on top, horizontal timeline bottom */}
      <main className="flex-1 flex flex-col gap-2 min-w-0">
        <div className="flex-1 bg-neutral-900 rounded-xl p-3 overflow-auto">
          <CalendarView
            todos={todos}
            deadlines={deadlines}
            onAdd={(date) => setOpenModal({ kind: "todo", date })}
            onAddDeadline={(date) => setOpenModal({ kind: "deadline", date })}
            onChange={load}
          />
        </div>
        <div className="h-56 lg:h-64 bg-neutral-900 rounded-xl p-3">
          <Timeline deadlines={deadlines} onChange={load} onAdd={() => setOpenModal({ kind: "deadline" })} />
        </div>
      </main>

      {/* Right: goals */}
      <aside className="lg:w-72 lg:shrink-0 bg-neutral-900 rounded-xl p-3 overflow-y-auto">
        <GoalsSidebar goals={goals} subgoals={subgoals} onChange={load} />
      </aside>

      {openModal && (
        <EventModal
          kind={openModal.kind}
          defaultDate={openModal.date}
          onClose={() => setOpenModal(null)}
          onSaved={() => { setOpenModal(null); load(); }}
        />
      )}
    </div>
  );
}
