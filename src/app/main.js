// 앱 진입점(composition root).
//
// 여기서만 부팅 순서를 정한다. 다른 모듈은 서로를 함수 단위로만 참조하고,
// "언제 무엇이 시작되는가" 는 이 파일 하나만 읽으면 알 수 있게 유지한다.
//
// 순서가 중요한 이유
//   1) bootstrap  : ?synckey / ?view URL 파라미터를 저장소에 반영.
//                   동기화 호출이 이 값을 읽으므로 반드시 먼저 실행한다.
//   2) events     : DOM 이벤트 등록. import 만으로 등록되는 부수효과 모듈이라
//                   이름을 가져오지 않아도 명시적으로 import 해야 한다.
//   3) 폼 초기화 / 최초 렌더
//   4) 서버 동기화 -> 시세 폴링 (네트워크 의존 작업은 첫 화면을 그린 뒤에)

import "./bootstrap.js";
import "../ui/events.js";

import { logger } from "../core/logger.js";
import { startPolling } from "../net/scheduler.js";
import { loadUsSymbols } from "../net/symbols.js";
import { recordSnapshot } from "../state/store.js";
import { hydrateFromServer } from "../state/sync.js";
import { startRealtimeDemoLoop } from "../ui/demo.js";
import { setupQuickTrade } from "../ui/forms/quick-trade.js";
import { render } from "../ui/render/index.js";
import { startMarketClock } from "../ui/render/marketclock.js";

// 어디서 죽었는지 모른 채 흰 화면만 보는 상황을 막는다.
window.addEventListener("error", (event) => {
  logger.error("window", event.message, event.error);
});
window.addEventListener("unhandledrejection", (event) => {
  logger.error("window", "처리되지 않은 Promise 거부", event.reason);
});

document.querySelector("#cashflowForm").elements.date.valueAsDate = new Date();
setupQuickTrade();
recordSnapshot();
render();
startMarketClock();

hydrateFromServer();
setTimeout(loadUsSymbols, 1500);
startPolling();
startRealtimeDemoLoop();

// 콘솔에서 진단할 수 있도록 로그 버퍼만 노출한다(상태는 노출하지 않음).
window.assetpilotLogs = () => logger.history();

logger.info("app", "AssetPilot 부팅 완료");
