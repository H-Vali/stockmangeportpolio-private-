import { INDEX_MONITOR_LIST } from "../config/catalog.js";
import { replayHoldings } from "../domain/portfolio.js";
import { currentUsdKrw, saveState, state } from "../state/store.js";
import { render } from "../ui/render/index.js";
import { renderMarketStatus } from "../ui/render/status.js";

async function fetchQuote(symbol) {
  const response = await fetch(`/quote?symbol=${encodeURIComponent(symbol)}`);
  if (!response.ok) throw new Error("시세를 가져오지 못했습니다.");
  return response.json();
}

// Finnhub 요청 한도(분당 60회) 초과 등으로 연속 실패하면 다음 몇 번의 폴링
// 주기를 건너뛴다. 실패 직후에도 계속 두드리면 한도가 풀릴 시간을 주지 못한다.
// 성공하면 즉시 초기화된다. 보유주식/지수는 폴링 주기가 서로 달라(15초/30초)
// 백오프 상태도 따로 둔다 — 한쪽이 막혀도 다른 쪽까지 같이 멈추지 않는다.
function createBackoff(maxSkipTicks) {
  let consecutiveFailures = 0;
  let skipTicks = 0;
  return {
    shouldSkip() {
      if (skipTicks <= 0) return false;
      skipTicks -= 1;
      return true;
    },
    onSuccess() {
      consecutiveFailures = 0;
    },
    onFailure() {
      consecutiveFailures += 1;
      skipTicks = Math.min(consecutiveFailures, maxSkipTicks);
    }
  };
}

const stockBackoff = createBackoff(8); // 15초 주기 x 최대 8회 = 최대 2분 대기
const indexBackoff = createBackoff(4); // 30초 주기 x 최대 4회 = 최대 2분 대기

// 종목을 한 번에 하나씩 순서대로 조회한다. 한 종목이 429로 실패해도 나머지
// 종목까지 통째로 버리지 않고, 성공한 종목은 그 자리에서 바로 반영한다
// (예: 5종목 중 1개만 아직 한도에 걸려도 나머지 4개는 즉시 화면에 뜬다).
export async function refreshStockQuotes() {
  if (stockBackoff.shouldSkip()) return;
  // 미국 개별주·ETF 둘 다 Finnhub /quote로 조회한다. 국내(KRW) 상장 ETF는 제외.
  const holdings = replayHoldings().filter((holding) => (holding.type === "주식" || holding.type === "ETF") && holding.currency === "USD");
  const symbols = [...new Set(holdings.map((holding) => holding.ticker))];
  let failureCount = 0;

  for (const symbol of symbols) {
    try {
      const quote = await fetchQuote(symbol);
      if (quote.c && state.assetCatalog[symbol]) {
        state.assetCatalog[symbol].currentPrice = Number(quote.c);
        state.assetCatalog[symbol].currentFx = currentUsdKrw();
      }
      state.market.lastSuccessAt = new Date().toISOString();
      saveState({ snapshot: true, sync: false });
      render();
    } catch (error) {
      failureCount += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  state.market.lastUpdatedAt = new Date().toISOString();
  if (failureCount === 0) {
    stockBackoff.onSuccess();
    state.market.failedAt = null;
    state.market.error = null;
  } else {
    stockBackoff.onFailure();
    state.market.failedAt = new Date().toISOString();
    state.market.error = symbols.length > 1
      ? `${failureCount}/${symbols.length}개 종목 갱신 실패`
      : "시세를 가져오지 못했습니다.";
  }
  saveState({ snapshot: false, sync: false });
  renderMarketStatus();
}

export async function refreshIndexQuotes() {
  if (indexBackoff.shouldSkip()) return;
  state.indexQuotes = state.indexQuotes || {};
  let failureCount = 0;

  for (const idx of INDEX_MONITOR_LIST) {
    try {
      const quote = await fetchQuote(idx.ticker);
      const price = Number(quote.c || 0);
      const changePercent = Number(quote.dp || 0);
      if (price) {
        state.indexQuotes[idx.ticker] = { price, changePercent, updatedAt: new Date().toISOString() };
        if (state.assetCatalog[idx.ticker]) {
          state.assetCatalog[idx.ticker].currentPrice = price;
          state.assetCatalog[idx.ticker].currentFx = currentUsdKrw();
        }
      }
      // 지수는 손익 계산에 안 쓰이는 참고용이라 서버 상태 pill(state.market)은 건드리지 않는다.
      saveState({ snapshot: false, sync: false });
      render();
    } catch (error) {
      failureCount += 1;
      console.warn(`지수 시세 갱신 실패: ${idx.ticker}`, error);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  if (failureCount === 0) indexBackoff.onSuccess();
  else indexBackoff.onFailure();
}
