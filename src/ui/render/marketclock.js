import { getKstNowParts, getUsMarketSession } from "../../core/time.js";

const SESSION_CLASS = {
  regular: "positive",
  premarket: "neutral-text",
  afterhours: "neutral-text",
  closed: "neutral-text"
};

export function renderMarketClock() {
  const timeEl = document.querySelector("#usMarketClockTime");
  const sessionEl = document.querySelector("#usMarketClockSession");
  if (!timeEl || !sessionEl) return;

  const now = new Date();
  const { hours, minutes } = getKstNowParts(now);
  const { label, session } = getUsMarketSession(now);

  timeEl.textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  sessionEl.textContent = label;
  sessionEl.className = `market-session-badge ${SESSION_CLASS[session]}`;
}

let clockTimer = null;
export function startMarketClock() {
  renderMarketClock();
  clearInterval(clockTimer);
  clockTimer = setInterval(renderMarketClock, 1000 * 30);
}
