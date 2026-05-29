"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Goal, SubGoal } from "@/lib/types";

export default function GoalsSidebar({
  goals, subgoals, onChange,
}: { goals: Goal[]; subgoals: SubGoal[]; onChange: () => void }) {
  const [newGoal, setNewGoal] = useState("");
  const [openGoal, setOpenGoal] = useState<string | null>(null);
  const [newSub, setNewSub] = useState("");

  async function addGoal() {
    if (!newGoal.trim()) return;
    await supabase.from("goals").insert({ title: newGoal.trim() });
    setNewGoal(""); onChange();
  }
  async function delGoal(id: string) {
    if (!confirm("목표와 세부목표 모두 삭제할까요?")) return;
    await supabase.from("goals").delete().eq("id", id);
    onChange();
  }
  async function addSub(goalId: string) {
    if (!newSub.trim()) return;
    await supabase.from("subgoals").insert({ goal_id: goalId, title: newSub.trim() });
    setNewSub(""); onChange();
  }
  async function toggleSub(s: SubGoal) {
    await supabase.from("subgoals").update({ done: !s.done }).eq("id", s.id);
    onChange();
  }
  async function delSub(id: string) {
    await supabase.from("subgoals").delete().eq("id", id);
    onChange();
  }

  return (
    <div className="space-y-3">
      <h2 className="font-bold text-lg">목표</h2>
      <div className="flex gap-1">
        <input
          value={newGoal} onChange={(e) => setNewGoal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addGoal()}
          placeholder="새 목표..."
          className="flex-1 bg-neutral-800 text-sm px-2 py-1 rounded outline-none"
        />
        <button onClick={addGoal} className="text-xs bg-green-600 px-2 rounded">+</button>
      </div>
      <ul className="space-y-2">
        {goals.map((g) => {
          const subs = subgoals.filter((s) => s.goal_id === g.id);
          const done = subs.filter((s) => s.done).length;
          const open = openGoal === g.id;
          return (
            <li key={g.id} className="bg-neutral-800/60 rounded p-2">
              <div className="flex justify-between items-center">
                <button onClick={() => setOpenGoal(open ? null : g.id)} className="text-left flex-1">
                  <div className="font-medium text-sm">{g.title}</div>
                  {subs.length > 0 && (
                    <div className="text-[10px] text-neutral-400">{done}/{subs.length} 완료</div>
                  )}
                </button>
                <button onClick={() => delGoal(g.id)} className="text-xs text-red-400">✕</button>
              </div>
              {open && (
                <div className="mt-2 space-y-1">
                  {subs.map((s) => (
                    <div key={s.id} className="flex items-center gap-1 group">
                      <input type="checkbox" checked={s.done} onChange={() => toggleSub(s)} />
                      <span className={`flex-1 text-xs ${s.done ? "line-through text-neutral-500" : ""}`}>{s.title}</span>
                      <button onClick={() => delSub(s.id)} className="opacity-0 group-hover:opacity-100 text-[10px] text-red-400">✕</button>
                    </div>
                  ))}
                  <div className="flex gap-1 mt-1">
                    <input
                      value={openGoal === g.id ? newSub : ""}
                      onChange={(e) => setNewSub(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addSub(g.id)}
                      placeholder="세부 목표..."
                      className="flex-1 bg-neutral-900 text-xs px-2 py-1 rounded outline-none"
                    />
                    <button onClick={() => addSub(g.id)} className="text-xs bg-green-700 px-2 rounded">+</button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
