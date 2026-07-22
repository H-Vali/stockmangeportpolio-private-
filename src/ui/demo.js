import { INDEX_MONITOR_LIST } from "../config/catalog.js";
import { ENABLE_AUTO_REALTIME_DEMO } from "../config/constants.js";
import { replayHoldings } from "../domain/portfolio.js";
import { state } from "../state/store.js";
import { showToast } from "./dom.js";
import { render } from "./render/index.js";
import { uiState } from "./uistate.js";

export function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function nudgeValue(value, percent, minimum = 0) {
  return Math.max(minimum, value * (1 + percent / 100));
}

export function triggerDashboardChangeDemo(options = {}) {
  const silent = Boolean(options.silent);
  const now = new Date().toISOString();

  replayHoldings().forEach((holding) => {
    if (holding.type === "코인") return;
    const asset = state.assetCatalog[holding.ticker];
    if (asset?.currentPrice) {
      asset.currentPrice = Number(nudgeValue(asset.currentPrice, randomBetween(-0.36, 0.44), 0.0001).toFixed(asset.currency === "KRW" ? 0 : 2));
    }
  });

  state.indexQuotes = state.indexQuotes || {};
  INDEX_MONITOR_LIST.forEach((idx) => {
    const asset = state.assetCatalog[idx.ticker];
    if (!asset) return;
    const existing = state.indexQuotes[idx.ticker];
    const move = randomBetween(-0.58, 0.72);
    const basePrice = Number(existing?.price || asset.currentPrice || 1);
    const nextPrice = Number(nudgeValue(basePrice, move, 0.0001).toFixed(2));
    asset.currentPrice = nextPrice;
    state.indexQuotes[idx.ticker] = {
      price: nextPrice,
      changePercent: Math.max(-7.5, Math.min(7.5, Number(((existing?.changePercent || 0) + move).toFixed(2)))),
      updatedAt: now
    };
  });

  render();
  if (!silent) showToast("실시간 변동 효과 테스트 중입니다. 실제 데이터는 저장되지 않습니다.");
}

export function startRealtimeDemoLoop() {
  if (!ENABLE_AUTO_REALTIME_DEMO) return;
  clearInterval(uiState.realtimeDemoInterval);
  uiState.realtimeDemoInterval = setInterval(() => {
    if (state.selectedView === "dashboard") triggerDashboardChangeDemo({ silent: true });
  }, 3000);
}
