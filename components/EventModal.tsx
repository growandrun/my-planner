"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";

export default function EventModal({
  kind, defaultDate, onClose, onSaved,
}: {
  kind: "todo" | "deadline";
  defaultDate?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = defaultDate || format(new Date(), "yyyy-MM-dd");
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [priority, setPriority] = useState(0);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [endDate, setEndDate] = useState(today);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) return;
    setSaving(true); setErr(null);
    let res;
    if (kind === "todo") {
      res = await supabase.from("todos").insert({
        title: title.trim(),
        memo: memo.trim() || null,
        due_date: date,
        due_time: time || null,
        priority,
      });
    } else {
      res = await supabase.from("deadlines").insert({
        title: title.trim(),
        memo: memo.trim() || null,
        start_date: date,
        end_date: endDate,
        start_time: startTime || null,
        end_time: endTime || null,
        priority,
      });
    }
    setSaving(false);
    if (res?.error) {
      setErr(res.error.message || "저장에 실패했습니다.");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-neutral-900 rounded-xl p-4 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-bold text-lg">
          {kind === "todo" ? "할 일 추가" : "데드라인 추가"}
        </h2>
        <input
          autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="제목" className="w-full bg-neutral-800 px-3 py-2 rounded outline-none"
        />
        <textarea
          value={memo} onChange={(e) => setMemo(e.target.value)}
          placeholder="메모" className="w-full bg-neutral-800 px-3 py-2 rounded outline-none h-20 resize-none"
        />
        {kind === "todo" ? (
          <div className="flex gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="flex-1 bg-neutral-800 px-3 py-2 rounded outline-none" />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
              className="flex-1 bg-neutral-800 px-3 py-2 rounded outline-none" />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="flex-1 bg-neutral-800 px-3 py-2 rounded outline-none" />
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="flex-1 bg-neutral-800 px-3 py-2 rounded outline-none" placeholder="시작 시간" />
            </div>
            <div className="flex gap-2">
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 bg-neutral-800 px-3 py-2 rounded outline-none" />
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="flex-1 bg-neutral-800 px-3 py-2 rounded outline-none" placeholder="끝 시간" />
            </div>
          </div>
        )}
        <div>
          <div className="text-xs text-neutral-400 mb-1">중요도</div>
          <div className="flex gap-1">
            {[0,1,2,3,4,5].map((p) => (
              <button key={p} onClick={() => setPriority(p)}
                className={`px-2 py-1 rounded text-xs ${priority === p ? "bg-yellow-600" : "bg-neutral-800"}`}>
                {p === 0 ? "없음" : "★".repeat(p)}
              </button>
            ))}
          </div>
        </div>
        {err && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-700/50 rounded p-2 break-words">
            ❌ {err}
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-2 rounded bg-neutral-800">취소</button>
          <button onClick={save} disabled={saving || !title.trim()}
            className="px-3 py-2 rounded bg-blue-600 disabled:opacity-50">저장</button>
        </div>
      </div>
    </div>
  );
}
