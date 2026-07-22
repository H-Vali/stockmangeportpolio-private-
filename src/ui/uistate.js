import { ALLOCATION_RATIOS_KEY } from "../config/constants.js";

// 화면 전용 가변 상태.
//
// 원래 app.js 최상위의 `let` 변수들이었으나, 모듈로 쪼개면서 다른 모듈이
// 재할당하는 값들은 ES 모듈의 live binding 으로는 다룰 수 없다(import 한 바인딩은
// 읽기 전용). 그래서 단일 객체의 프로퍼티로 모아 참조를 공유한다.
//
// 여기 담기는 값은 "저장할 필요가 없는" UI 상태뿐이다. 영속 상태는 state/store.js.
export const uiState = {
  // 배분 도넛 애니메이션용 직전 비율(localStorage 캐시)
  previousAllocationRatios: loadAllocationRatios(),
  // 실시간 변동 데모 루프 핸들
  realtimeDemoInterval: null,
  // 카드별 직전 값 - 증감 배지 계산용
  previousRealtimeValues: {
    market: {},
    investors: {},
    index: {}
  },
  // 대시보드 자산배분 클릭 시 보유종목 목록에 걸리는 필터
  holdingsTypeFilter: null,
  // 빠른 매매 입력 폼의 매수/매도 토글
  quickTradeSide: "buy",
  // 가져오기 확인 대기 중인 상태 / 되돌리기용 직전 상태
  pendingImportState: null,
  importRollbackState: null,
  // 배당 시뮬레이션 상세 표 펼침 여부
  dividendDetailOpen: false,
  // 하단 원장 워크스페이스 펼침 여부
  ledgerExpanded: false,
  // 거래 수정 모달이 편집 중인 거래 id
  editingTradeId: null
};

export function loadAllocationRatios() {
  try {
    return JSON.parse(localStorage.getItem(ALLOCATION_RATIOS_KEY) || "{}") || {};
  } catch (error) {
    return {};
  }
}
