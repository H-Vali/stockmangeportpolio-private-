export function getKstNowParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23"
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    hours: Number(parts.hour),
    minutes: Number(parts.minute),
    dateKey: `${parts.year}-${parts.month}-${parts.day}`
  };
}

export function currentFxSlot() {
  const { hours, minutes } = getKstNowParts();
  const minutesNow = hours * 60 + minutes;
  if (minutesNow >= 9 * 60 && minutesNow < 15 * 60 + 30) return "open";
  if (minutesNow >= 15 * 60 + 30) return "close";
  return null;
}

const US_SESSION_LABELS = {
  premarket: "프리장",
  regular: "정규장",
  afterhours: "애프터장",
  closed: "휴장"
};

// 미국 증시(뉴욕) 세션 판정. America/New_York 타임존을 그대로 물어봐서
// DST(서머타임) 전환을 직접 계산하지 않는다.
export function getUsMarketSession(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short"
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});

  const hours = Number(parts.hour) % 24;
  const minutes = Number(parts.minute);
  const minutesNow = hours * 60 + minutes;
  const isWeekend = parts.weekday === "Sat" || parts.weekday === "Sun";

  let session = "closed";
  if (!isWeekend) {
    if (minutesNow >= 4 * 60 && minutesNow < 9 * 60 + 30) session = "premarket";
    else if (minutesNow >= 9 * 60 + 30 && minutesNow < 16 * 60) session = "regular";
    else if (minutesNow >= 16 * 60 && minutesNow < 20 * 60) session = "afterhours";
  }

  return { session, label: US_SESSION_LABELS[session], etHours: hours, etMinutes: minutes };
}

export function formatClock(value) {
  if (!value) return "대기 중";
  return new Date(value).toLocaleTimeString("ko-KR", { hour12: false });
}

export function formatMinutesAgo(value) {
  if (!value) return "갱신 전";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  return `${minutes}분 전 기준`;
}
