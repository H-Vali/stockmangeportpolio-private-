import { SCHEMA_VERSION, STORAGE_KEY, SYNC_PUSH_DEBOUNCE_MS, SYNC_TOKEN_KEY } from "../config/constants.js";
import { logger } from "../core/logger.js";
import { storage } from "./persistence.js";
import { migrate } from "./migrate.js";
import { isOverClearedState, normalizeState } from "./schema.js";
import { setState, state } from "./store.js";
import { validateImportState } from "./validate.js";
import { showToast } from "../ui/dom.js";
import { render } from "../ui/render/index.js";

// --- 다기기 동기화 (Cloudflare Pages Functions + KV) -----------------------
//
// 이전 구조는 저장할 때마다 상태 전체를 무조건 PUT 했다. 두 기기가 같은 시간대에
// 입력하면 나중에 저장한 쪽이 앞사람 입력을 통째로 지웠다(last-write-wins).
//
// 지금은 서버가 rev(개정 번호)를 함께 보관하고, 클라이언트는 "내가 마지막으로 본
// rev" 를 함께 보낸다. 서버 rev 가 그 사이 올라갔으면 409 를 돌려주고 덮어쓰지
// 않는다. 사용자에게 알린 뒤 다시 불러오도록 안내한다.

let syncPushTimer = null;
let syncPushInFlight = false;
let syncPushQueued = false;

// 서버에서 마지막으로 확인한 개정 번호. null 이면 아직 서버와 만난 적 없음.
let knownServerRev = null;
// 충돌 상태에서는 자동 푸시를 멈춘다(사용자가 해소할 때까지 데이터를 지키기 위해).
let conflicted = false;

export function getSyncToken() {
  return (storage.getItem(SYNC_TOKEN_KEY) || "").trim();
}

// 동기화는 인증 토큰이 설정되어 있을 때만 활성화됨(같은 오리진의 /state Functions 사용).
export function syncEnabled() {
  return Boolean(getSyncToken());
}

// 로컬 캐시(오프라인 대비 및 즉시 첫 화면 렌더용).
export function persistLocal() {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// 잦은 저장을 묶어서 서버로 한 번만 올림.
export function schedulePush() {
  if (!syncEnabled() || conflicted) return;
  if (syncPushTimer) clearTimeout(syncPushTimer);
  syncPushTimer = setTimeout(pushStateToServer, SYNC_PUSH_DEBOUNCE_MS);
}

export async function pushStateToServer() {
  if (!syncEnabled() || conflicted) return;
  if (syncPushInFlight) { syncPushQueued = true; return; }
  syncPushInFlight = true;
  try {
    const payload = { ...state, schemaVersion: SCHEMA_VERSION, syncedAt: new Date().toISOString() };
    const response = await fetch("/state", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getSyncToken()}`,
        // 서버가 이 값과 자기 rev 를 비교한다. null 이면 검사를 건너뛴다(최초 업로드).
        ...(knownServerRev == null ? {} : { "X-Expected-Rev": String(knownServerRev) })
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 409) {
      conflicted = true;
      const detail = await response.json().catch(() => ({}));
      logger.warn("sync", `개정 충돌: 로컬 ${knownServerRev} / 서버 ${detail?.rev}`);
      setSyncStatus(
        "conflict",
        "다른 기기에서 먼저 저장했습니다. 이 기기 변경은 아직 서버에 올리지 않았습니다. 새로고침해 서버 데이터를 받아오세요."
      );
      return;
    }

    if (response.ok) {
      const detail = await response.json().catch(() => ({}));
      if (detail?.rev != null) knownServerRev = Number(detail.rev);
    }
    setSyncStatus(response.ok ? "synced" : "error", response.ok ? null : `저장 실패 (${response.status})`);
  } catch (error) {
    logger.error("sync", "상태 업로드 실패", error);
    setSyncStatus("offline", "서버에 연결할 수 없어 로컬에만 저장했습니다.");
  } finally {
    syncPushInFlight = false;
    if (syncPushQueued) {
      syncPushQueued = false;
      schedulePush();
    }
  }
}

// 부팅 시: 서버(공유 원본)에 저장된 상태가 있으면 그걸 정본으로 채택.
// 서버가 비어 있으면 현재 로컬 상태를 서버에 최초 업로드.
export async function hydrateFromServer() {
  if (!syncEnabled()) return;
  try {
    const response = await fetch("/state", {
      headers: { "Authorization": `Bearer ${getSyncToken()}` }
    });
    if (!response.ok) {
      setSyncStatus("error", `동기화 불러오기 실패 (${response.status})`);
      return;
    }
    const data = await response.json();
    if (data?.rev != null) knownServerRev = Number(data.rev);

    if (!data || data.state == null) {
      // 서버가 비어 있음 -> 현재 로컬 상태를 최초 업로드.
      await pushStateToServer();
      return;
    }
    const errors = validateImportState(data.state);
    if (errors.length) {
      logger.warn("sync", `서버 데이터 검증 실패: ${errors[0]}`);
      setSyncStatus("error", "서버 데이터 형식 오류로 로컬 상태를 유지합니다.");
      return;
    }
    if (Number(data.state?.schemaVersion || 0) < SCHEMA_VERSION) {
      // 구버전 서버 데이터는 변환해서 올려준다(기존처럼 로컬을 통째로 밀지 않음).
      const upgraded = normalizeState(migrate(data.state).state);
      setState(upgraded);
      persistLocal();
      await pushStateToServer();
      setSyncStatus("synced");
      render();
      return;
    }
    const serverState = normalizeState(data.state);
    if (isOverClearedState(serverState) && !isOverClearedState(state)) {
      await pushStateToServer();
      setSyncStatus("synced");
      return;
    }
    setState(serverState);
    conflicted = false;
    persistLocal();
    setSyncStatus("synced");
    render();
  } catch (error) {
    logger.error("sync", "서버 상태 조회 실패", error);
    setSyncStatus("offline", "서버에 연결할 수 없어 로컬 데이터로 시작합니다.");
  }
}

/** 충돌 해소: 서버 상태를 다시 받아 로컬을 대체한다. */
export async function resolveConflictWithServer() {
  conflicted = false;
  knownServerRev = null;
  await hydrateFromServer();
}

/** 현재 동기화 상태(디버깅/상태 표시용) */
export function syncSnapshot() {
  return { enabled: syncEnabled(), conflicted, knownServerRev, status: lastSyncStatus };
}

let lastSyncStatus = null;
export function setSyncStatus(status, message) {
  // 상태가 바뀔 때만 토스트로 알림(성공은 조용히, 실패/오프라인은 안내).
  if (status !== lastSyncStatus && message) {
    showToast(message, status === "error" || status === "offline" || status === "conflict" ? "error" : "info");
  }
  lastSyncStatus = status;
}
