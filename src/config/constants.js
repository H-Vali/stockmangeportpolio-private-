// 설정 상수 단일 출처. 어떤 모듈도 import 하지 않는 leaf 모듈로 유지한다.
export const STORAGE_KEY = "assetpilot-ledger-state-v3";
export const LEGACY_STORAGE_KEY = "assetpilot-ledger-state-v2";
// 스키마 버전. 올릴 때는 state/migrate.js 에 N-1 -> N 변환을 함께 등록한다.
export const SCHEMA_VERSION = 4;
export const DIVIDEND_TAX_RATE = 0.15;
export const DEFAULT_USDKRW = 1380;
// frankfurter는 api.frankfurter.app 도메인이 폐기되어 api.frankfurter.dev(/v1)로 이전됨.
// 기존 .app URL은 CORS/네트워크 실패로 항상 폴백만 타던 문제가 있어 .dev로 교체.
export const FX_API_PRIMARY_URL = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW";
export const FX_API_FALLBACK_URL = "https://open.er-api.com/v6/latest/USD";
export const CRYPTO_REALTIME_RENDER_INTERVAL_MS = 3000;
export const CRYPTO_CHANGE_EFFECT_THRESHOLD_PP = 0.05;
export const CRYPTO_CHANGE_EFFECT_MIN_INTERVAL_MS = 9000;
export const REALTIME_CHANGE_BADGE_DURATION_MS = 3000;
export const REALTIME_CHANGE_BADGE_FADE_MS = 650;
export const ALLOCATION_RATIOS_KEY = "assetpilot-allocation-ratios-v1";
// 대시보드에서 3초마다 가짜 가격 변동을 흘려 보내는 데모 루프 스위치.
//
// 끈 이유: 이 루프는 state.assetCatalog[*].currentPrice 를 난수로 덮어쓴다.
// 시세 공급원이 없는 종목(국내 ETF, 프록시 미설정 상태의 미국주식)은 화면에
// 보이는 평가금액이 실제 입력값과 무관하게 계속 흔들린다. 저장은 되지 않지만
// 사용자가 보는 숫자가 사실이 아니게 되므로 기본값을 false 로 둔다.
// 시연용으로 켜려면 true 로 바꾸거나 상단 '변동 테스트' 버튼을 쓰면 된다.
export const ENABLE_AUTO_REALTIME_DEMO = false;
// 다기기 동기화: 상태를 Cloudflare Pages Functions(/state)로 저장/조회하기 위한 인증 토큰.
// 상단 "동기화 설정"에서 입력하거나 ?synckey=... 로 접속하면 저장되고 이후 자동으로 사용됩니다.
export const SYNC_TOKEN_KEY = "assetpilot-sync-token";
export const SYNC_PUSH_DEBOUNCE_MS = 1200;


export const allocationColors = {
  코인: "#7C5CFC",
  주식: "#FF7AC8",
  ETF: "#3BB5A6",
  채권: "#E8B339",
  예수금: "#5A5A68"
};
export const ALLOCATION_ORDER = ["주식", "ETF", "코인", "채권", "예수금"];
export const fallbackColors = ["#ff7ac8", "#3bb5a6", "#7c5cfc", "#e8b339", "#5a5a68"];
export const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

export const DEFAULT_MARKET_INDICATORS = [
  { symbol: "BTC", domestic: 52000000, globalKrw: 50420000, domesticChange: 0, globalChange: 0, updatedAt: null },
  { symbol: "ETH", domestic: 3300000, globalKrw: 3244000, domesticChange: 0, globalChange: 0, updatedAt: null },
  { symbol: "SOL", domestic: 224000, globalKrw: 216800, domesticChange: 0, globalChange: 0, updatedAt: null },
  { symbol: "BNB", domestic: 978000, globalKrw: 951000, domesticChange: 0, globalChange: 0, updatedAt: null },
  { symbol: "XRP", domestic: 3500, globalKrw: 3370, domesticChange: 0, globalChange: 0, updatedAt: null }
];
