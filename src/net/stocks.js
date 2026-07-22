import { INDEX_MONITOR_LIST } from "../config/catalog.js";
import { replayHoldings } from "../domain/portfolio.js";
import { startCryptoRealtime, updateCoinQuotes } from "./crypto.js";
import { currentUsdKrw, saveState, state } from "../state/store.js";
import { render } from "../ui/render/index.js";
import { renderMarketStatus } from "../ui/render/status.js";

export async function updateStockQuotes() {
  const holdings = replayHoldings().filter((holding) => holding.type === "주식" && holding.currency === "USD");
  const symbols = [...new Set(holdings.map((holding) => holding.ticker))];
  for (const symbol of symbols) {
    const response = await fetch(`/quote?symbol=${encodeURIComponent(symbol)}`);
    if (!response.ok) throw new Error("미국주식 시세를 가져오지 못했습니다.");
    const quote = await response.json();
    if (quote.c && state.assetCatalog[symbol]) {
      state.assetCatalog[symbol].currentPrice = Number(quote.c);
      state.assetCatalog[symbol].currentFx = currentUsdKrw();
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export async function updateIndexQuotes() {
  state.indexQuotes = state.indexQuotes || {};
  for (const idx of INDEX_MONITOR_LIST) {
    const response = await fetch(`/quote?symbol=${encodeURIComponent(idx.ticker)}`);
    if (!response.ok) throw new Error("주요 지수 시세를 가져오지 못했습니다.");
    const quote = await response.json();
    const price = Number(quote.c || 0);
    const changePercent = Number(quote.dp || 0);
    if (price) {
      state.indexQuotes[idx.ticker] = { price, changePercent, updatedAt: new Date().toISOString() };
      if (state.assetCatalog[idx.ticker]) {
        state.assetCatalog[idx.ticker].currentPrice = price;
        state.assetCatalog[idx.ticker].currentFx = currentUsdKrw();
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

// Finnhub 요청 한도(분당 60회) 초과 등으로 연속 실패하면 다음 몇 번의 폴링
// 주기를 건너뛴다. 실패 직후에도 매 60초마다 계속 두드리면 한도가 풀릴 시간을
// 주지 못한다. 성공하면 즉시 초기화된다.
let consecutiveFailures = 0;
let skipTicks = 0;

export async function refreshQuotes() {
  if (skipTicks > 0) {
    skipTicks -= 1;
    return;
  }
  try {
    await updateCoinQuotes();
    await updateStockQuotes();
    await updateIndexQuotes();
    consecutiveFailures = 0;
    state.market = {
      lastUpdatedAt: new Date().toISOString(),
      lastSuccessAt: new Date().toISOString(),
      failedAt: null,
      error: null
    };
    // 시세는 로컬에만 저장한다. 60초마다 도는 폴링을 서버로 올리면
    // Cloudflare KV 무료 쓰기 한도(하루 1,000회)를 하루 만에 넘긴다.
    saveState({ snapshot: true, sync: false });
    startCryptoRealtime();
    render();
  } catch (error) {
    consecutiveFailures += 1;
    skipTicks = Math.min(consecutiveFailures, 3); // 최대 3분(3주기)까지 건너뜀
    state.market.failedAt = new Date().toISOString();
    state.market.error = error.message;
    saveState({ snapshot: false, sync: false });
    renderMarketStatus();
  }
}
