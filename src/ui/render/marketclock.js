import { getUsMarketSession } from "../../core/time.js";

const SESSION_CLASS = {
  regular: "positive",
  premarket: "neutral-text",
  afterhours: "neutral-text",
  closed: "neutral-text"
};

// 초 단위는 core/time.js의 getKstNowParts()(분 단위까지만 줌)로는 못 얻으므로
// 여기서만 필요한 초를 직접 뽑는다.
function getKstTimeWithSeconds(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23"
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  return { hours: parts.hour, minutes: parts.minute, seconds: parts.second };
}

export function renderMarketClock() {
  const timeEl = document.querySelector("#usMarketClockTime");
  const sessionEl = document.querySelector("#usMarketClockSession");
  if (!timeEl || !sessionEl) return;

  const now = new Date();
  const { hours, minutes, seconds } = getKstTimeWithSeconds(now);
  const { label, session } = getUsMarketSession(now);

  timeEl.textContent = `${hours}:${minutes}:${seconds}`;
  sessionEl.textContent = label;
  sessionEl.className = `market-session-badge ${SESSION_CLASS[session]}`;
}

let clockTimer = null;
export function startMarketClock() {
  renderMarketClock();
  clearInterval(clockTimer);
  clockTimer = setInterval(renderMarketClock, 1000);
}
