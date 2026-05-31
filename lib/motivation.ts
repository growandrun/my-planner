// 시간대별 독설 메시지. {balance} 자리에 잔액(원, 포맷팅 적용)이 들어감.
// KST 기준 hour → message. "밤 12시" = 0시 포함, 7시부터 자정까지 총 18개.

export const MOTIVATION_BY_HOUR: Record<number, string> = {
  7: "벌써 7시다. 통장에 <b>{balance}</b> 들고 이불 속에서 뭐 하냐. 그 돈으로 평생 살 자신 있으면 계속 누워있어. 없으면 일어나라.",

  8: "남들 다 출근하고 있는 시간이다. 너 잔고 <b>{balance}</b>. 이게 너의 위치다. 인정하기 싫으면 위로 끌어올려.",

  9: "9시. 본격적으로 시간이 돈으로 환산되는 시간이다. 멍 때리는 1분마다 <b>{balance}</b>이 너를 비웃는다. 일해라.",

  10: "오전 10시. 카페 가서 5천원짜리 라떼 마시는 사이, 잔고 <b>{balance}</b>이 또 줄었다. 너의 입에 들어가는 게 너의 미래를 갉아먹는다.",

  11: "점심 메뉴 고민할 머리로 부수입 한 줄이라도 더 짜내. <b>{balance}</b> 그대로 가만히 있는 건 너의 게으름이 매일 적어내는 영수증이다.",

  12: "12시. 또 사 먹을 거지? 만 원이면 <b>{balance}</b>에서 1만원이 사라진다. 도시락 싸기 어려운 게 아니라 자존심이 어려운 거 아니냐.",

  13: "낮잠 자고 싶지? 자라. 단 깨어났을 때 <b>{balance}</b>은 한 푼도 늘어있지 않을 거다. 그게 너의 오후다.",

  14: "여자친구가 미래를 상상할 때, 너의 잔고는 <b>{balance}</b>이다. 사랑은 마음만으로 안 된다. 통장이 비면 약속도 거짓말이 된다. 더 벌어라.",

  15: "오후 3시. 가장 집중력이 떨어지는 시간이라며 SNS 켜는 순간 <b>{balance}</b>은 죽은 돈이 된다. 손에 든 폰부터 내려놔.",

  16: "퇴근까지 한 시간. 지금 게으르게 마무리하면 <b>{balance}</b>은 오늘도 그대로다. 너의 가치를 1시간 안에 증명해라.",

  17: "퇴근하자마자 술 마시러 가는 너에게, 잔고 <b>{balance}</b>이 묻는다. 진심으로 행복하냐? 아니면 도망치는 거냐?",

  18: "저녁 6시. 가장 충동적으로 돈을 쓰는 시간이다. <b>{balance}</b>을 지키고 싶으면 카드부터 가방 안에 넣어라. 의지는 환경을 못 이긴다.",

  19: "또 배달이냐. 그 만 원으로 <b>{balance}</b>에서 또 빠진다. 너의 식습관이 너의 노후를 결정한다. 가스불 켜는 게 그렇게 어렵냐.",

  20: "여자친구한테 좋은 거 사주고 싶다며. <b>{balance}</b>으로? 부끄러우면 화 내지 말고 더 벌어라. 사랑은 능력으로 증명하는 거다.",

  21: "유튜브 알고리즘이 너를 위로해주는 동안, <b>{balance}</b>은 1원도 늘지 않는다. 위로받지 말고 분노해라. 그게 너를 움직인다.",

  22: "지금 옆에 있는 사람이 너의 <b>{balance}</b> 잔고를 알고도 같이 있어 주는 거다. 그 사람한테 부끄럽지 않으려면 내일은 오늘보다 단 1원이라도 더 벌어라.",

  23: "잘 시간이지? 오늘 너는 얼마를 벌었고 얼마를 썼나? <b>{balance}</b>이 그 답이다. 변명 말고 숫자를 봐라.",

  0: "자정이다. 하루가 끝났고 잔고는 <b>{balance}</b>이다. \"내일은 다를 거야\"라는 거짓말, 너 스스로한테 몇 번째냐? 이번엔 다르게 만들어라.",
};

export function pickMotivation(hourKST: number, balance: number): string | null {
  const tmpl = MOTIVATION_BY_HOUR[hourKST];
  if (!tmpl) return null;
  const fmt = balance.toLocaleString("ko-KR") + "원";
  return tmpl.replaceAll("{balance}", fmt);
}

export function currentKSTHour(d: Date = new Date()): number {
  // Convert any Date to KST hour (UTC+9, no DST in Korea)
  const utc = d.getTime() + d.getTimezoneOffset() * 60_000;
  const kst = new Date(utc + 9 * 60 * 60_000);
  return kst.getHours();
}
