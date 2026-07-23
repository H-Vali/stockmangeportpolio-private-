import { buildDividendForecast, normalizeDividendRecords } from "../domain/dividend-forecast.js";
import { replayHoldings } from "../domain/portfolio.js";
import { saveState, state } from "../state/store.js";
import { render } from "../ui/render/index.js";

// 배당 이력은 하루에도 몇 번씩 바뀌지 않으므로 시세보다 훨씬 느슨하게 캐시한다.
const DIVIDEND_CACHE_MS = 12 * 60 * 60 * 1000; // 12시간

async function fetchDividendHistory(symbol) {
  const response = await fetch(`/dividends?symbol=${encodeURIComponent(symbol)}`);
  if (!response.ok) throw new Error("배당 이력을 가져오지 못했습니다.");
  return response.json();
}

function isStale(asset) {
  if (!asset?.dividendFetchedAt) return true;
  return Date.now() - new Date(asset.dividendFetchedAt).getTime() > DIVIDEND_CACHE_MS;
}

async function ensureDividendForecast(ticker) {
  const asset = state.assetCatalog[ticker];
  if (!asset || !isStale(asset)) return false;
  try {
    const raw = await fetchDividendHistory(ticker);
    const records = normalizeDividendRecords(raw);
    const forecast = buildDividendForecast(records, { now: new Date(), horizonMonths: 12 });
    if (state.assetCatalog[ticker]) {
      state.assetCatalog[ticker].dividendForecast = forecast;
      state.assetCatalog[ticker].dividendFetchedAt = new Date().toISOString();
    }
    return true;
  } catch (error) {
    // 실패해도 다음 주기에 다시 시도한다. 화면은 이전 예측값(또는 빈 값)을 유지.
    if (state.assetCatalog[ticker]) {
      state.assetCatalog[ticker].dividendFetchedAt = new Date().toISOString();
    }
    return false;
  }
}

// 배당을 지급하는(미국 상장) 보유 종목만 대상으로 순차 조회한다.
// 종목 수가 많지 않은 개인 포트폴리오 특성상 Finnhub 예산 부담이 적다.
export async function refreshDividendForecasts() {
  const holdings = replayHoldings().filter((h) => (h.type === "주식" || h.type === "ETF") && h.currency === "USD");
  const tickers = [...new Set(holdings.map((h) => h.ticker))];
  let changed = false;

  for (const ticker of tickers) {
    const updated = await ensureDividendForecast(ticker);
    if (updated) changed = true;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  if (changed) {
    saveState({ snapshot: false, sync: false });
    render();
  }
}
