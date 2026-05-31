"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Todo, Deadline, Goal, SubGoal } from "@/lib/types";
import TodoSidebar from "@/components/TodoSidebar";
import CalendarView from "@/components/CalendarView";
import Timeline from "@/components/Timeline";
import GoalsSidebar from "@/components/GoalsSidebar";
import EventModal from "@/components/EventModal";
import MoneyPanel from "@/components/MoneyPanel";

type Tab = "calendar" | "timeline" | "todos" | "goals" | "money";

export default function Page() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [subgoals, setSubgoals] = useState<SubGoal[]>([]);
  const [openModal, setOpenModal] = useState<null | { kind: "todo" | "deadline"; date?: string }>(null);
  const [tab, setTab] = useState<Tab>("calendar");

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
    const ch = supabase
      .channel("planner")
      .on("postgres_changes", { event: "*", schema: "public", table: "todos" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "deadlines" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "goals" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "subgoals" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ── Desktop (lg+): 3-column ─────────────────────────────
  const desktop = (
    <div className="hidden lg:flex h-screen w-screen flex-row gap-2 p-2 overflow-hidden">
      <aside className="w-72 shrink-0 bg-neutral-900 rounded-xl p-3 overflow-y-auto">
        <TodoSidebar todos={todos} onChange={load} onAdd={() => setOpenModal({ kind: "todo" })} />
        <MoneyPanel />
      </aside>
      <main className="flex-1 flex flex-col gap-2 min-w-0">
        <div className="flex-1 bg-neutral-900 rounded-xl p-3 overflow-auto">
          <CalendarView
            todos={todos} deadlines={deadlines}
            onAdd={(d) => setOpenModal({ kind: "todo", date: d })}
            onAddDeadline={(d) => setOpenModal({ kind: "deadline", date: d })}
            onChange={load}
          />
        </div>
        <div className="h-64 bg-neutral-900 rounded-xl p-3">
          <Timeline deadlines={deadlines} onChange={load} onAdd={() => setOpenModal({ kind: "deadline" })} />
        </div>
      </main>
      <aside className="w-72 shrink-0 bg-neutral-900 rounded-xl p-3 overflow-y-auto">
        <GoalsSidebar goals={goals} subgoals={subgoals} onChange={load} />
      </aside>
    </div>
  );

  // ── Mobile: full-screen tabs ─────────────────────────────
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "calendar", label: "달력", icon: "📅" },
    { id: "timeline", label: "타임라인", icon: "📊" },
    { id: "todos", label: "할 일", icon: "✅" },
    { id: "goals", label: "목표", icon: "🎯" },
    { id: "money", label: "돈", icon: "💰" },
  ];

  const mobile = (
    <div className="lg:hidden flex flex-col h-screen w-screen overflow-hidden">
      <div className="flex-1 overflow-y-auto p-2 pb-20">
        <div className="bg-neutral-900 rounded-xl p-3 min-h-full">
          {tab === "calendar" && (
            <CalendarView
              todos={todos} deadlines={deadlines}
              onAdd={(d) => setOpenModal({ kind: "todo", date: d })}
              onAddDeadline={(d) => setOpenModal({ kind: "deadline", date: d })}
              onChange={load}
            />
          )}
          {tab === "timeline" && (
            <div className="h-[calc(100vh-7rem)]">
              <Timeline deadlines={deadlines} onChange={load} onAdd={() => setOpenModal({ kind: "deadline" })} />
            </div>
          )}
          {tab === "todos" && (
            <TodoSidebar todos={todos} onChange={load} onAdd={() => setOpenModal({ kind: "todo" })} />
          )}
          {tab === "goals" && (
            <GoalsSidebar goals={goals} subgoals={subgoals} onChange={load} />
          )}
          {tab === "money" && <MoneyPanel />}
        </div>
      </div>
      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-neutral-950 border-t border-neutral-800 flex pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center justify-center py-2 text-xs ${
              tab === t.id ? "text-blue-400" : "text-neutral-400"
            }`}
          >
            <span className="text-lg">{t.icon}</span>
            <span className="text-[10px]">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      {desktop}
      {mobile}
      {openModal && (
        <EventModal
          kind={openModal.kind}
          defaultDate={openModal.date}
          onClose={() => setOpenModal(null)}
          onSaved={() => { setOpenModal(null); load(); }}
        />
      )}
    </>
  );
}
