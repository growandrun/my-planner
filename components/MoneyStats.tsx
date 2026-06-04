"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Expense } from "@/lib/types";
import { addMonths, endOfMonth, format, getDaysInMonth, parseISO, startOfMonth, subMonths } from "date-fns";

const fmt = (n: number) => n.toLocaleString("ko-KR") + "원";
const fmtShort = (n: number) => {
  if (n >= 10000) return Math.round(n / 1000) / 10 + "만";
  if (n >= 1000) return Math.round(n / 100) / 10 + "k";
  return String(n);
};

export default function MoneyStats({ onClose }: { onClose: () => void }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cursor, setCursor] = useState(new Date());

  useEffect(() => {
    supabase.from("expenses").select("*").then(({ data }) => setExpenses((data as Expense[]) ?? []));
    const ch = supabase.channel(`stats-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" },
        async () => {
          const { data } = await supabase.from("expenses").select("*");
          setExpenses((data as Expense[]) ?? []);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const monthStr = format(cursor, "yyyy-MM");
  const monthExpenses = expenses.filter((e) => e.spent_at.startsWith(monthStr));

  // Daily totals for current month
  const daysIn = getDaysInMonth(cursor);
  const dailyTotals = useMemo(() => {
    const arr = new Array(daysIn).fill(0) as number[];
    for (const e of monthExpenses) {
      const day = Number(e.spent_at.slice(8, 10));
      arr[day - 1] += e.amount;
    }
    return arr;
  }, [monthExpenses, daysIn]);
  const dailyMax = Math.max(1, ...dailyTotals);
  const monthTotal = dailyTotals.reduce((s, x) => s + x, 0);
  const daysWithSpend = dailyTotals.filter((x) => x > 0).length;
  const avgPerDay = daysWithSpend ? Math.round(monthTotal / daysWithSpend) : 0;

  // Top places
  const byPlace = useMemo(() => {
    const m = new Map<string, { amount: number; count: number }>();
    for (const e of monthExpenses) {
      const cur = m.get(e.place) ?? { amount: 0, count: 0 };
      cur.amount += e.amount; cur.count += 1;
      m.set(e.place, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].amount - a[1].amount).slice(0, 8);
  }, [monthExpenses]);

  // 6-month trend (including current)
  const trend = useMemo(() => {
    const months: { label: string; total: number; ym: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(cursor, i);
      const ym = format(m, "yyyy-MM");
      const total = expenses.filter((e) => e.spent_at.startsWith(ym)).reduce((s, e) => s + e.amount, 0);
      months.push({ label: format(m, "M월"), total, ym });
    }
    return months;
  }, [expenses, cursor]);
  const trendMax = Math.max(1, ...trend.map((m) => m.total));

  const today = new Date();
  const isCurMonth = format(today, "yyyy-MM") === monthStr;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto" onClick={onClose}>
      <div className="min-h-full p-3 sm:p-6 flex items-start justify-center" onClick={(e) => e.stopPropagation()}>
        <div className="bg-neutral-900 rounded-xl p-4 w-full max-w-2xl space-y-5 my-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">📊 지출 통계</h2>
            <button onClick={onClose} className="text-neutral-400 hover:text-white text-xl px-2">✕</button>
          </div>

          {/* Month nav */}
          <div className="flex items-center justify-between bg-neutral-800/50 rounded p-2">
            <button onClick={() => setCursor(subMonths(cursor, 1))} className="px-3 py-1 bg-neutral-700 rounded">‹</button>
            <div className="text-center">
              <div className="font-bold text-lg">{format(cursor, "yyyy년 M월")}</div>
              <div className="text-xs text-neutral-400">{isCurMonth ? "이번달" : ""}</div>
            </div>
            <button onClick={() => setCursor(addMonths(cursor, 1))} className="px-3 py-1 bg-neutral-700 rounded">›</button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-neutral-800/60 rounded p-2 text-center">
              <div className="text-[10px] text-neutral-400">월 지출</div>
              <div className="font-bold text-orange-300">{fmt(monthTotal)}</div>
            </div>
            <div className="bg-neutral-800/60 rounded p-2 text-center">
              <div className="text-[10px] text-neutral-400">지출 일수</div>
              <div className="font-bold">{daysWithSpend}/{daysIn}일</div>
            </div>
            <div className="bg-neutral-800/60 rounded p-2 text-center">
              <div className="text-[10px] text-neutral-400">일평균</div>
              <div className="font-bold">{fmt(avgPerDay)}</div>
            </div>
          </div>

          {/* Daily bar chart */}
          <div>
            <div className="text-sm font-semibold mb-2">일별 지출</div>
            <div className="bg-neutral-950 rounded p-2 overflow-x-auto">
              <div className="flex items-end gap-[2px] h-32 min-w-fit">
                {dailyTotals.map((v, i) => {
                  const h = v === 0 ? 2 : Math.max(4, (v / dailyMax) * 120);
                  const isToday = isCurMonth && (i + 1) === today.getDate();
                  return (
                    <div key={i} className="flex flex-col items-center gap-0.5" style={{ minWidth: 14 }}>
                      <div
                        className={`w-3 rounded-t transition-all ${v === 0 ? "bg-neutral-800" : isToday ? "bg-yellow-400" : "bg-orange-500"}`}
                        style={{ height: h }}
                        title={v > 0 ? `${i + 1}일: ${fmt(v)}` : `${i + 1}일`}
                      />
                      <div className={`text-[8px] ${isToday ? "text-yellow-400 font-bold" : "text-neutral-500"}`}>{i + 1}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top places */}
          <div>
            <div className="text-sm font-semibold mb-2">지출 많은 곳 TOP {byPlace.length}</div>
            <ul className="space-y-1">
              {byPlace.length === 0 && <li className="text-xs text-neutral-500">기록 없음</li>}
              {byPlace.map(([place, { amount, count }], idx) => {
                const ratio = amount / (byPlace[0]?.[1].amount || 1);
                return (
                  <li key={place} className="bg-neutral-800/40 rounded px-2 py-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="truncate"><span className="text-neutral-400 mr-1">{idx + 1}.</span>{place} <span className="text-neutral-500">({count}회)</span></span>
                      <span className="text-orange-300 shrink-0 ml-2">{fmt(amount)}</span>
                    </div>
                    <div className="h-1 bg-neutral-700 rounded mt-1 overflow-hidden">
                      <div className="h-full bg-orange-500" style={{ width: `${ratio * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* 6-month trend */}
          <div>
            <div className="text-sm font-semibold mb-2">최근 6개월 추이</div>
            <div className="bg-neutral-950 rounded p-3">
              <div className="flex items-end justify-between gap-2 h-28">
                {trend.map((m) => {
                  const h = m.total === 0 ? 2 : Math.max(4, (m.total / trendMax) * 100);
                  const isCur = m.ym === monthStr;
                  return (
                    <button
                      key={m.ym}
                      onClick={() => setCursor(parseISO(m.ym + "-01"))}
                      className="flex-1 flex flex-col items-center gap-1"
                    >
                      <div className="text-[10px] text-neutral-400">{fmtShort(m.total)}</div>
                      <div
                        className={`w-full rounded-t ${isCur ? "bg-yellow-400" : "bg-purple-500"}`}
                        style={{ height: h }}
                      />
                      <div className={`text-[10px] ${isCur ? "text-yellow-400 font-bold" : "text-neutral-400"}`}>{m.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
