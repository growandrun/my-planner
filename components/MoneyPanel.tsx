"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Expense, Income } from "@/lib/types";
import { format } from "date-fns";
import MoneyStats from "./MoneyStats";

const fmt = (n: number) => n.toLocaleString("ko-KR") + "원";

export default function MoneyPanel({ withDivider = false }: { withDivider?: boolean }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [startBalance, setStartBalance] = useState<number>(0);
  const [mode, setMode] = useState<"expense" | "income">("expense");
  const [field1, setField1] = useState("");
  const [memo, setMemo] = useState("");
  const [amount, setAmount] = useState("");
  const [editingBalance, setEditingBalance] = useState(false);
  const [newBalance, setNewBalance] = useState("");
  const [showStats, setShowStats] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");

  async function load() {
    try {
      const [eRes, iRes, sRes] = await Promise.allSettled([
        supabase.from("expenses").select("*").order("spent_at", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("incomes").select("*").order("earned_at", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("settings").select("value").eq("key", "starting_balance").maybeSingle(),
      ]);
      const expArr = eRes.status === "fulfilled" && Array.isArray(eRes.value.data) ? (eRes.value.data as Expense[]) : [];
      const incArr = iRes.status === "fulfilled" && Array.isArray(iRes.value.data) ? (iRes.value.data as Income[]) : [];
      const setVal = sRes.status === "fulfilled" ? sRes.value.data?.value : 0;
      setExpenses(expArr);
      setIncomes(incArr);
      setStartBalance(Number(setVal ?? 0));
    } catch (err) {
      console.error("[MoneyPanel.load] error", err);
      setExpenses([]); setIncomes([]); setStartBalance(0);
    }
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("money")
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "incomes" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const totalSpent = expenses.reduce((s, e) => s + (Number(e?.amount) || 0), 0);
  const totalEarned = incomes.reduce((s, e) => s + (Number(e?.amount) || 0), 0);
  const balance = startBalance - totalSpent + totalEarned;
  const todayExpenses = expenses.filter((e) => e.spent_at === today);
  const todayIncomes = incomes.filter((e) => e.earned_at === today);
  const todaySpent = todayExpenses.reduce((s, e) => s + e.amount, 0);
  const todayEarned = todayIncomes.reduce((s, e) => s + e.amount, 0);

  // ── 전체 내역: 날짜별로 묶기 (지출 + 수입 통합) ──
  type Row = { id: string; date: string; kind: "expense" | "income"; label: string; memo: string | null; amount: number };
  const allRows: Row[] = useMemo(() => {
    const safeExp = Array.isArray(expenses) ? expenses : [];
    const safeInc = Array.isArray(incomes) ? incomes : [];
    const r: Row[] = [
      ...safeExp.filter(Boolean).map((e) => ({
        id: "e:" + (e.id || ""), date: e.spent_at || "", kind: "expense" as const,
        label: e.place || "", memo: e.memo ?? null, amount: Number(e.amount) || 0,
      })),
      ...safeInc.filter(Boolean).map((i) => ({
        id: "i:" + (i.id || ""), date: i.earned_at || "", kind: "income" as const,
        label: i.source || "", memo: i.memo ?? null, amount: Number(i.amount) || 0,
      })),
    ];
    r.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
    return r;
  }, [expenses, incomes]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of allRows) {
      const arr = map.get(r.date) ?? [];
      arr.push(r);
      map.set(r.date, arr);
    }
    return [...map.entries()];
  }, [allRows]);

  async function add() {
    const n = Number(amount.replace(/[^\d-]/g, ""));
    if (!field1.trim() || !n) return;
    if (mode === "expense") {
      await supabase.from("expenses").insert({
        spent_at: today, place: field1.trim(), memo: memo.trim() || null, amount: n,
      });
    } else {
      await supabase.from("incomes").insert({
        earned_at: today, source: field1.trim(), memo: memo.trim() || null, amount: n,
      });
    }
    setField1(""); setMemo(""); setAmount("");
  }
  async function removeRow(r: Row) {
    const table = r.kind === "expense" ? "expenses" : "incomes";
    const realId = r.id.slice(2);
    await supabase.from(table).delete().eq("id", realId);
  }
  async function saveBalance() {
    const n = Number(newBalance.replace(/[^\d-]/g, ""));
    if (!Number.isFinite(n)) return;
    const target = n + totalSpent - totalEarned;
    await supabase.from("settings").upsert({ key: "starting_balance", value: target as any, updated_at: new Date().toISOString() });
    setEditingBalance(false); setNewBalance("");
  }

  return (
    <div className={`space-y-2 ${withDivider ? "mt-6 pt-4 border-t border-neutral-800" : ""}`}>
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
          <div className="text-xs text-neutral-400 mt-1 flex gap-3 flex-wrap">
            <span>오늘 지출: <span className="text-orange-300">{fmt(todaySpent)}</span></span>
            <span>오늘 수입: <span className="text-green-300">{fmt(todayEarned)}</span></span>
          </div>
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex gap-1">
        <button
          onClick={() => setMode("expense")}
          className={`flex-1 text-xs py-1 rounded ${mode === "expense" ? "bg-orange-600" : "bg-neutral-800"}`}
        >💸 지출</button>
        <button
          onClick={() => setMode("income")}
          className={`flex-1 text-xs py-1 rounded ${mode === "income" ? "bg-green-600" : "bg-neutral-800"}`}
        >💵 수입</button>
      </div>

      <div className="space-y-1">
        <input value={field1} onChange={(e) => setField1(e.target.value)}
          placeholder={mode === "expense" ? "지출한 곳" : "수입 출처 (예: 월급, 알바)"}
          className="w-full bg-neutral-800 text-sm px-2 py-1 rounded outline-none" />
        <input value={memo} onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
          className="w-full bg-neutral-800 text-sm px-2 py-1 rounded outline-none" />
        <div className="flex gap-1">
          <input value={amount} onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="금액 (원)" inputMode="numeric"
            className="flex-1 bg-neutral-800 text-sm px-2 py-1 rounded outline-none" />
          <button onClick={add} className={`text-xs px-3 rounded ${mode === "expense" ? "bg-orange-600" : "bg-green-600"}`}>
            + 기록
          </button>
        </div>
      </div>

      {/* 오늘 내역 */}
      <div className="mt-2">
        <div className="text-xs text-neutral-400 mb-1">오늘 ({today})</div>
        <ul className="space-y-1">
          {todayIncomes.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 group text-xs bg-green-900/20 px-2 py-1 rounded border-l-2 border-green-600">
              <div className="flex-1 min-w-0">
                <div className="truncate">💵 {e.source}</div>
                {e.memo && <div className="text-[10px] text-neutral-500 truncate">{e.memo}</div>}
              </div>
              <div className="text-green-300 shrink-0">+{fmt(e.amount)}</div>
              <button onClick={() => supabase.from("incomes").delete().eq("id", e.id)} className="opacity-60 hover:opacity-100 text-red-400">✕</button>
            </li>
          ))}
          {todayExpenses.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 group text-xs bg-neutral-900/50 px-2 py-1 rounded">
              <div className="flex-1 min-w-0">
                <div className="truncate">{e.place}</div>
                {e.memo && <div className="text-[10px] text-neutral-500 truncate">{e.memo}</div>}
              </div>
              <div className="text-orange-300 shrink-0">−{fmt(e.amount)}</div>
              <button onClick={() => supabase.from("expenses").delete().eq("id", e.id)} className="opacity-60 hover:opacity-100 text-red-400">✕</button>
            </li>
          ))}
          {todayExpenses.length === 0 && todayIncomes.length === 0 && (
            <li className="text-xs text-neutral-500">기록 없음</li>
          )}
        </ul>
      </div>

      {/* 전체 내역 */}
      <div className="mt-3">
        <button onClick={() => setShowAll(!showAll)} className="text-xs text-neutral-300 hover:text-white">
          📂 전체 내역 ({allRows.length}) {showAll ? "▼" : "▶"}
        </button>
        {showAll && (
          <div className="mt-2 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {groupedByDate.length === 0 && <div className="text-xs text-neutral-500">기록 없음</div>}
            {groupedByDate.map(([date, rows]) => {
              const dayInc = rows.filter((r) => r.kind === "income").reduce((s, r) => s + r.amount, 0);
              const dayExp = rows.filter((r) => r.kind === "expense").reduce((s, r) => s + r.amount, 0);
              return (
                <div key={date}>
                  <div className="flex items-center justify-between text-[11px] text-neutral-400 border-b border-neutral-800 pb-1 mb-1">
                    <span className="font-semibold">{date === today ? `${date} (오늘)` : date}</span>
                    <span className="space-x-2">
                      {dayInc > 0 && <span className="text-green-300">+{fmt(dayInc)}</span>}
                      {dayExp > 0 && <span className="text-orange-300">−{fmt(dayExp)}</span>}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {rows.map((r) => (
                      <li key={r.id}
                        className={`flex items-center justify-between gap-2 group text-xs px-2 py-1 rounded ${
                          r.kind === "income" ? "bg-green-900/20 border-l-2 border-green-600" : "bg-neutral-900/50"
                        }`}>
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{r.kind === "income" ? "💵 " : ""}{r.label}</div>
                          {r.memo && <div className="text-[10px] text-neutral-500 truncate">{r.memo}</div>}
                        </div>
                        <div className={`shrink-0 ${r.kind === "income" ? "text-green-300" : "text-orange-300"}`}>
                          {r.kind === "income" ? "+" : "−"}{fmt(r.amount)}
                        </div>
                        <button onClick={() => removeRow(r)} className="opacity-60 hover:opacity-100 text-red-400">✕</button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
