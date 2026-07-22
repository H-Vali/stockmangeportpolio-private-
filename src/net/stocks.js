import { INDEX_MONITOR_LIST } from "../config/catalog.js";
import { replayHoldings } from "../domain/portfolio.js";
import { startCryptoRealtime, updateCoinQuotes } from "./crypto.js";
import { currentUsdKrw, proxyBaseUrl, saveState, state } from "../state/store.js";
import { render } from "../ui/render/index.js";
import { renderMarketStatus } from "../ui/render/status.js";

export async function updateStockQuotes() {
  const baseUrl = proxyBaseUrl();
  if (!baseUrl) return;
  const holdings = replayHoldings().filter((holding) => holding.type === "주식" && holding.currency === "USD");
  const symbols = [...new Set(holdings.map((holding) => holding.ticker))];
  for (const symbol of symbols) {
    const response = await fetch(`${baseUrl}/quote?symbol=${encodeURIComponent(symbol)}`);
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
  const baseUrl = proxyBaseUrl();
  if (!baseUrl) return;
  state.indexQuotes = state.indexQuotes || {};
  for (const idx of INDEX_MONITOR_LIST) {
    const response = await fetch(`${baseUrl}/quote?symbol=${encodeURIComponent(idx.ticker)}`);
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

export async function refreshQuotes() {
  try {
    await updateCoinQuotes();
    await updateStockQuotes();
    await updateIndexQuotes();
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
    state.market.failedAt = new Date().toISOString();
    state.market.error = error.message;
    saveState({ snapshot: false, sync: false });
    renderMarketStatus();
  }
}
