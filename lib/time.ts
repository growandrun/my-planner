// Korea Standard Time (KST = UTC+9, no DST) helpers.
// Vercel 함수는 UTC로 도는데 사용자 데이터는 KST 기준으로 저장돼 있어서,
// 서버에서 "오늘"이나 "현재 시각"을 다룰 때는 반드시 KST로 변환해야 합니다.

const KST = "Asia/Seoul";

/** "YYYY-MM-DD" in KST */
export function kstYMD(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KST,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

/** Hour 0..23 in KST */
export function kstHour(d: Date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-GB", {
    timeZone: KST, hour: "2-digit", hour12: false,
  }).format(d);
  // "24" → 0 회피
  return Number(h) % 24;
}

/**
 * KST wall-clock 시간 ("2026-06-15" + "14:00:00") → 실제 UTC instant (Date).
 * KST 14:00 = UTC 05:00.
 */
export function kstWallTimeToInstant(dateStr: string, timeStr: string): Date {
  const [y, mo, da] = dateStr.split("-").map(Number);
  const [hh = 0, mm = 0, ss = 0] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(y, (mo || 1) - 1, da, (hh as number) - 9, mm as number, ss as number));
}
