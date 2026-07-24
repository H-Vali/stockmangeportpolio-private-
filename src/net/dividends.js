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
    // 실패(주로 Polygon 429 rate limit)는 dividendFetchedAt 을 건드리지 않는다.
    // 여기서 "지금 시도했다"고 기록해버리면 실패한 종목이 12시간 캐시에 걸려
    // 다음 스케줄(6시간 뒤) 두 번을 그냥 건너뛰게 된다. 화면은 이전 예측값(또는 빈 값)을 유지.
    return false;
  }
}

// Polygon.io 무료 플랜은 분당 5회로 빡빡하다. 종목 수가 많으면 300ms 간격으로는
// 바로 429가 나므로(실측 확인됨), 5회/분보다 넉넉한 13초 간격으로 순차 조회한다.
const DIVIDEND_FETCH_INTERVAL_MS = 13000;

// 배당을 지급하는(미국 상장) 보유 종목만 대상으로 순차 조회한다.
// 종목 하나당 13초씩 걸리므로(레이트리밋 때문), 전부 끝난 뒤 한 번에 반영하면
// 캘린더가 1~2분간 텅 비어 보인다. 종목이 도착하는 대로 바로바로 반영한다.
export async function refreshDividendForecasts() {
  const holdings = replayHoldings().filter((h) => (h.type === "주식" || h.type === "ETF") && h.currency === "USD");
  const tickers = [...new Set(holdings.map((h) => h.ticker))];

  for (const [index, ticker] of tickers.entries()) {
    const updated = await ensureDividendForecast(ticker);
    if (updated) {
      saveState({ snapshot: false, sync: false });
      render();
    }
    if (index < tickers.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DIVIDEND_FETCH_INTERVAL_MS));
    }
  }
}
