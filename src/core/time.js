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

export function formatClock(value) {
  if (!value) return "대기 중";
  return new Date(value).toLocaleTimeString("ko-KR", { hour12: false });
}

export function formatMinutesAgo(value) {
  if (!value) return "갱신 전";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  return `${minutes}분 전 기준`;
}
