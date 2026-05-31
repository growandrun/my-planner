"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Expense } from "@/lib/types";
import { format } from "date-fns";
import MoneyStats from "./MoneyStats";

const fmt = (n: number) => n.toLocaleString("ko-KR") + "원";

export default function MoneyPanel() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [startBalance, setStartBalance] = useState<number>(0);
  const [place, setPlace] = useState("");
  const [memo, setMemo] = useState("");
  const [amount, setAmount] = useState("");
  const [editingBalance, setEditingBalance] = useState(false);
  const [newBalance, setNewBalance] = useState("");
  const [showStats, setShowStats] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");

  async function load() {
    const [e, s] = await Promise.all([
      supabase.from("expenses").select("*").order("created_at", { ascending: false }),
      supabase.from("settings").select("value").eq("key", "starting_balance").maybeSingle(),
    ]);
    setExpenses((e.data as Expense[]) ?? []);
    setStartBalance(Number(s.data?.value ?? 0));
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("money")
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const balance = startBalance - totalSpent;
  const todayExpenses = expenses.filter((e) => e.spent_at === today);
  const todaySpent = todayExpenses.reduce((s, e) => s + e.amount, 0);

  async function add() {
    const n = Number(amount.replace(/[^\d-]/g, ""));
    if (!place.trim() || !n) return;
    await supabase.from("expenses").insert({
      spent_at: today, place: place.trim(), memo: memo.trim() || null, amount: n,
    });
    setPlace(""); setMemo(""); setAmount("");
  }
  async function remove(id: string) {
    await supabase.from("expenses").delete().eq("id", id);
  }
  async function saveBalance() {
    const n = Number(newBalance.replace(/[^\d-]/g, ""));
    if (!Number.isFinite(n)) return;
    // Set starting_balance so that current balance = n
    const target = n + totalSpent;
    await supabase.from("settings").upsert({ key: "starting_balance", value: target as any, updated_at: new Date().toISOString() });
    setEditingBalance(false); setNewBalance("");
  }

  return (
    <div className="space-y-2 mt-6 pt-4 border-t border-neutral-800">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">💰 돈 관리</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowStats(true)} className="text-[10px] text-blue-400 underline">📊 통계</button>
          <button onClick={() => { setEditingBalance(!editingBalance); setNewBalance(String(balance)); }} className="text-[10px] text-neutral-400 underline">
            {editingBalance ? "닫기" : "잔액 수정"}
          </button>
        </div>
      </div>
      {showStats && <MoneyStats onClose={() => setShowStats(false)} />}

      {editingBalance ? (
        <div className="flex gap-1">
          <input value={newBalance} onChange={(e) => setNewBalance(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveBalance()}
            placeholder="새 잔액" inputMode="numeric"
            className="flex-1 bg-neutral-800 text-sm px-2 py-1 rounded outline-none" />
          <button onClick={saveBalance} className="text-xs bg-blue-600 px-2 rounded">설정</button>
        </div>
      ) : (
        <div className="bg-neutral-800/60 rounded p-2">
          <div className="text-xs text-neutral-400">현재 잔액</div>
          <div className={`text-xl font-bold ${balance < 0 ? "text-red-400" : "text-green-400"}`}>{fmt(balance)}</div>
          <div className="text-xs text-neutral-400 mt-1">오늘 지출: <span className="text-orange-300">{fmt(todaySpent)}</span></div>
        </div>
      )}

      <div className="space-y-1">
        <input value={place} onChange={(e) => setPlace(e.target.value)}
          placeholder="지출한 곳"
          className="w-full bg-neutral-800 text-sm px-2 py-1 rounded outline-none" />
        <input value={memo} onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
          className="w-full bg-neutral-800 text-sm px-2 py-1 rounded outline-none" />
        <div className="flex gap-1">
          <input value={amount} onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="금액 (원)" inputMode="numeric"
            className="flex-1 bg-neutral-800 text-sm px-2 py-1 rounded outline-none" />
          <button onClick={add} className="text-xs bg-orange-600 px-3 rounded">+ 기록</button>
        </div>
      </div>

      <div className="mt-2">
        <div className="text-xs text-neutral-400 mb-1">오늘 ({today})</div>
        <ul className="space-y-1 max-h-48 overflow-y-auto">
          {todayExpenses.length === 0 && <li className="text-xs text-neutral-500">기록 없음</li>}
          {todayExpenses.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 group text-xs bg-neutral-900/50 px-2 py-1 rounded">
              <div className="flex-1 min-w-0">
                <div className="truncate">{e.place}</div>
                {e.memo && <div className="text-[10px] text-neutral-500 truncate">{e.memo}</div>}
              </div>
              <div className="text-orange-300 shrink-0">{fmt(e.amount)}</div>
              <button onClick={() => remove(e.id)} className="opacity-0 group-hover:opacity-100 text-red-400">✕</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
