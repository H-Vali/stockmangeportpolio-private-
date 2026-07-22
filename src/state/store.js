import { DEFAULT_USDKRW, LEGACY_STORAGE_KEY, SCHEMA_VERSION, STORAGE_KEY } from "../config/constants.js";
import { summarize } from "../domain/portfolio.js";
import { storage } from "./persistence.js";
import { clearPortfolioData, isOverClearedState, normalizeState, seedState } from "./schema.js";
import { persistLocal, schedulePush } from "./sync.js";
import { validateImportState } from "./validate.js";
import { migrate } from "./migrate.js";
import { logger } from "../core/logger.js";

// 앱 전역 영속 상태.
//
// ES 모듈에서 import 한 바인딩은 읽기 전용이라 다른 모듈이 `state = ...` 로
// 통째 교체할 수 없다. 교체가 필요한 곳(동기화 수신, 백업 가져오기/되돌리기,
// 초기화)은 반드시 setState() 를 쓴다.
export let state = loadState();

/**
 * 상태를 통째로 교체한다. 구독자에게 알리고, 저장은 호출자가 saveState() 로 한다.
 * @param {object} next
 */
export function setState(next) {
  if (!next || typeof next !== "object") throw new TypeError("setState 에는 상태 객체가 필요합니다.");
  state = next;
  notify();
  return state;
}

// --- 변경 구독 --------------------------------------------------------------
// 렌더 계층이 store 를 직접 폴링하지 않게 하는 최소한의 접점. 서버 DB 단계에서
// 실시간 반영(폴링/웹소켓)을 붙일 때 이 자리에 연결한다.
const listeners = new Set();

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (error) {
      logger.error("store", "상태 구독자 처리 실패", error);
    }
  }
}

export function loadState() {
  const raw = storage.getItem(STORAGE_KEY);
  const legacyRaw = storage.getItem(LEGACY_STORAGE_KEY);
  try {
    const legacyParsed = legacyRaw ? JSON.parse(legacyRaw) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      const errors = validateImportState(parsed);
      if (errors.length) {
        logger.warn("store", `저장된 상태 검증 실패(${errors[0]}). 이전 버전 데이터로 복구를 시도합니다.`);
        return legacyParsed ? clearPortfolioData(legacyParsed) : structuredClone(seedState);
      }
      const normalized = normalizeState(migrate(parsed).state);
      if (isOverClearedState(normalized) && legacyParsed) return clearPortfolioData(legacyParsed);
      return normalized;
    }
    if (legacyParsed) return clearPortfolioData(legacyParsed);
    return structuredClone(seedState);
  } catch (error) {
    logger.error("store", "저장된 상태를 읽지 못해 초기 상태로 시작합니다.", error);
    return structuredClone(seedState);
  }
}

export function exportableState() {
  return {
    ...state,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString()
  };
}

/**
 * 상태를 저장한다.
 *
 * @param {{ snapshot?: boolean, sync?: boolean }} options
 *   snapshot - 일별 총자산 스냅샷을 남길지 (기본 true)
 *   sync     - 서버로 올릴지 (기본 true)
 *
 * `sync: false` 는 **시세·환율 갱신처럼 기기마다 알아서 다시 받아오면 되는 변경**
 * 에 쓴다. 서버에 올릴 이유가 없을뿐더러, 시세 폴링은 60초마다 도는 탓에 그대로
 * 두면 하루 1,400회 넘게 서버에 쓴다. Cloudflare KV 무료 한도가 하루 1,000회
 * 쓰기라 탭 하나만 켜둬도 한도를 넘긴다.
 *
 * 서버에 올려야 하는 것은 사람이 입력한 원장(투자자·입출금·거래)뿐이다.
 * 시세는 각 기기가 어차피 스스로 갱신하고, 스냅샷은 원장에서 다시 계산된다.
 */
export function saveState(options = {}) {
  const { snapshot = true, sync = true } = options;
  state.schemaVersion = SCHEMA_VERSION;
  state.updatedAt = new Date().toISOString();
  if (sync) {
    // rev 는 "서버에 올릴 만한 변경이 몇 번 있었는가". 서버가 들고 있는 rev 와
    // 어긋나면 다른 기기가 먼저 저장한 것이므로 sync 계층이 덮어쓰기를 막는다.
    state.rev = (Number(state.rev) || 0) + 1;
  }
  persistLocal();
  if (sync) schedulePush();
  if (snapshot) recordSnapshot();
}


export function currentUsdKrw() {
  return state.fx.mode === "manual" ? Number(state.fx.manualUsdkrw || DEFAULT_USDKRW) : Number(state.fx.usdkrw || DEFAULT_USDKRW);
}

/**
 * USD 자산의 "현재 평가 환율" 을 앱의 현재 환율에 맞춘다.
 *
 * 두 환율은 별개다.
 *   - 매입시점 환율: 거래마다 `trade.fx` 로 남고, 재생 시 `avgFx`(외화원가 가중평균)가 된다.
 *     여기서는 절대 건드리지 않는다. 환차손익의 기준점이다.
 *   - 현재 평가 환율: `asset.currentFx`. 지금 이 순간 평가금액을 원화로 환산하는 값이라
 *     항상 최신 환율이어야 한다.
 *
 * 이 함수가 없던 시절에는 환율을 받아온 뒤에 등록한 종목이 입력 폼에 적힌 환율을
 * 그대로 들고 있었다. 그러면 평가금액뿐 아니라
 * 환차손익 = 수량 x 평단 x (현재환율 - 매입환율) 까지 과소 계상된다.
 *
 * 코인은 제외한다. 코인은 USDT/KRW 로 환산해야 해서 빗썸 시세 경로가 따로 관리한다.
 */
export function syncUsdAssetFx() {
  const rate = currentUsdKrw();
  let changed = 0;
  for (const asset of Object.values(state.assetCatalog)) {
    if (asset.currency !== "USD" || asset.type === "코인") continue;
    if (asset.currentFx === rate) continue;
    asset.currentFx = rate;
    changed += 1;
  }
  return changed;
}


// 일별 총자산 스냅샷. 같은 날짜는 최신 값으로 교체한다.
//
// 서버 푸시는 하지 않는다. 스냅샷 값은 시세가 움직일 때마다 바뀌는데, 여기서
// 올려버리면 시세 폴링이 그대로 서버 쓰기가 된다. 원장이 바뀔 때 saveState()
// 가 어차피 올려주고, 스냅샷은 다른 기기에서도 원장으로부터 다시 만들어진다.
export function recordSnapshot() {
  const today = new Date().toISOString().slice(0, 10);
  const totalValue = summarize().totalValue;
  const next = (state.snapshots || []).filter((item) => item.date !== today);
  next.push({ date: today, totalValue });
  next.sort((a, b) => a.date.localeCompare(b.date));
  state.snapshots = next;
  persistLocal();
}
