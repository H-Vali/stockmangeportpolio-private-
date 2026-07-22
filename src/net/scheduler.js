import { startCryptoRealtime } from "./crypto.js";
import { refreshFxRate } from "./fx.js";
import { refreshQuotes } from "./stocks.js";

export let pollingTimer = null;
export let fxTimer = null;

// 탭이 백그라운드일 때는 시세를 갱신하지 않는다.
//
// 여러 PC/탭에서 동시에 열어두는 게 이 앱의 정상 사용 패턴이다. 탭마다 독립적으로
// 60초 폴링이 돌면 실제로 보고 있지 않은 탭까지 합산되어 Finnhub 무료 한도
// (분당 60회)를 다 같이 갉아먹는다. 화면에 보이는 탭만 갱신하면 체감은 그대로면서
// 호출 수는 "열어둔 탭 개수"가 아니라 "실제로 보는 탭 1개"로 준다.
function whenVisible(fn) {
  return () => {
    if (document.hidden) return;
    fn();
  };
}

export function startPolling() {
  refreshFxRate();
  refreshQuotes();
  startCryptoRealtime();
  clearInterval(pollingTimer);
  clearInterval(fxTimer);
  pollingTimer = setInterval(whenVisible(refreshQuotes), 60000);
  fxTimer = setInterval(whenVisible(refreshFxRate), 5 * 60 * 1000);

  // 백그라운드에 있다가 다시 보게 되면 최신 시세로 바로 갱신한다.
  // (건너뛴 주기만큼 낡아 있던 값이 탭 복귀 순간 바로 채워진다.)
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshQuotes();
      refreshFxRate();
    }
  });
}
