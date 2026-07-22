import { fxFormatter } from "../../core/format.js";
import { formatClock, formatMinutesAgo } from "../../core/time.js";
import { currentUsdKrw, state } from "../../state/store.js";

export function renderFx() {
  document.querySelector("#fxRateLabel").textContent = fxFormatter.format(currentUsdKrw());
  const source = state.fx.source === "hana" ? "하나은행 기준"
    : state.fx.source === "frankfurter" ? "환율 API 기준 (Frankfurter)"
    : state.fx.source === "exchangerate-api" ? "환율 API 기준 (폴백)"
    : state.fx.source === "fallback" ? "환율 API 기준 (폴백)"
    : "수동 기준";
  document.querySelector("#fxSourceLabel").textContent = `${source} · ${state.fx.updatedAt ? `${formatClock(state.fx.updatedAt)} 갱신` : "업데이트 대기"}`;
  const usdtRate = Number(state.cryptoQuoteFx?.rate || 0);
  document.querySelector("#usdtKrwLabel").textContent = usdtRate ? fxFormatter.format(usdtRate) : "대기 중";
  document.querySelector("#usdtKrwSourceLabel").textContent = state.cryptoQuoteFx?.updatedAt ? `${formatClock(state.cryptoQuoteFx.updatedAt)} 갱신` : "업데이트 대기";
}

export function renderMarketStatus() {
  const label = document.querySelector("#marketStatus");
  if (state.market.error) {
    label.textContent = `시세 갱신 실패 · ${formatMinutesAgo(state.market.lastSuccessAt)}`;
    label.classList.add("negative");
  } else {
    label.textContent = `마지막 갱신: ${formatClock(state.market.lastUpdatedAt)}`;
    label.classList.remove("negative");
  }
}
