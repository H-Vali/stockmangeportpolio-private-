import { refreshCoinQuotes, startCryptoRealtime } from "./crypto.js";
import { refreshDividendForecasts } from "./dividends.js";
import { refreshFxRate } from "./fx.js";
import { refreshIndexQuotes, refreshStockQuotes } from "./stocks.js";

export let stockTimer = null;
export let indexTimer = null;
export let coinTimer = null;
export let fxTimer = null;
export let dividendTimer = null;

// 탭이 백그라운드일 때는 시세를 갱신하지 않는다.
//
// 여러 PC/탭에서 동시에 열어두는 게 이 앱의 정상 사용 패턴이다. 탭마다 독립적으로
// 폴링이 돌면 실제로 보고 있지 않은 탭까지 합산되어 Finnhub 무료 한도
// (분당 60회)를 다 같이 갉아먹는다. 화면에 보이는 탭만 갱신하면 체감은 그대로면서
// 호출 수는 "열어둔 탭 개수"가 아니라 "실제로 보는 탭 1개"로 준다.
function whenVisible(fn) {
  return () => {
    if (document.hidden) return;
    fn();
  };
}

// 보유주식·지수·코인은 예산/실시간성 요구가 서로 달라 별도 주기로 돈다.
//   - 보유주식(15초): 손익에 직접 반영되는 값이라 가장 자주.
//   - 지수(30초): 참고용 위젯이라 보유주식보다 느슨하게, Finnhub 예산을 아낀다.
//   - 코인(15초): Finnhub를 안 쓰므로 예산 걱정 없이 실시간에 가깝게. 해외(WS)·
//     국내(5초 폴링)는 이미 더 촘촘히 따로 돌고 있고, 이건 전체 재동기화용.
export function startPolling() {
  refreshFxRate();
  refreshStockQuotes();
  refreshIndexQuotes();
  refreshCoinQuotes();
  refreshDividendForecasts();
  startCryptoRealtime();

  clearInterval(stockTimer);
  clearInterval(indexTimer);
  clearInterval(coinTimer);
  clearInterval(fxTimer);
  clearInterval(dividendTimer);

  stockTimer = setInterval(whenVisible(refreshStockQuotes), 15000);
  indexTimer = setInterval(whenVisible(refreshIndexQuotes), 30000);
  coinTimer = setInterval(whenVisible(refreshCoinQuotes), 15000);
  fxTimer = setInterval(whenVisible(refreshFxRate), 5 * 60 * 1000);
  // 배당 지급 스케줄은 하루에도 잘 안 바뀌므로 6시간 주기면 충분하다.
  dividendTimer = setInterval(whenVisible(refreshDividendForecasts), 6 * 60 * 60 * 1000);

  // 백그라운드에 있다가 다시 보게 되면 최신 시세로 바로 갱신한다.
  // (건너뛴 주기만큼 낡아 있던 값이 탭 복귀 순간 바로 채워진다.)
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshStockQuotes();
      refreshIndexQuotes();
      refreshCoinQuotes();
      refreshFxRate();
    }
  });
}
