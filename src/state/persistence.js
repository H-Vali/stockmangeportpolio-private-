// 저장소 어댑터.
//
// 앱 코드가 localStorage 를 직접 부르면 (1) 브라우저 밖(테스트/스크립트)에서 죽고,
// (2) 사파리 프라이빗 모드나 용량 초과처럼 setItem 이 throw 하는 상황에서
// 화면 전체가 멈춘다. 그래서 모든 영속화는 이 어댑터를 통과시킨다.
//
// 나중에 서버 DB 로 옮길 때 교체 지점이 되는 곳이기도 하다.

import { logger } from "../core/logger.js";

// 브라우저가 아니거나 localStorage 가 막혔을 때 쓰는 대체 구현.
function createMemoryStorage() {
  const map = new Map();
  return {
    kind: "memory",
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => void map.set(key, String(value)),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear()
  };
}

function probeLocalStorage() {
  try {
    if (typeof localStorage === "undefined") return null;
    const probe = "__assetpilot_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return localStorage;
  } catch (error) {
    return null;
  }
}

function createStorage() {
  const native = probeLocalStorage();
  if (!native) {
    logger.warn("storage", "localStorage 를 쓸 수 없어 메모리 저장소로 동작합니다. 새로고침하면 데이터가 사라집니다.");
    return createMemoryStorage();
  }

  // 용량 초과(QuotaExceededError) 등으로 쓰기가 실패해도 앱이 죽지 않게 감싼다.
  return {
    kind: "local",
    getItem(key) {
      try {
        return native.getItem(key);
      } catch (error) {
        logger.error("storage", `읽기 실패: ${key}`, error);
        return null;
      }
    },
    setItem(key, value) {
      try {
        native.setItem(key, String(value));
        return true;
      } catch (error) {
        logger.error("storage", `쓰기 실패: ${key} (용량 초과 가능성)`, error);
        return false;
      }
    },
    removeItem(key) {
      try {
        native.removeItem(key);
      } catch (error) {
        logger.error("storage", `삭제 실패: ${key}`, error);
      }
    },
    clear() {
      try {
        native.clear();
      } catch (error) {
        logger.error("storage", "초기화 실패", error);
      }
    }
  };
}

export const storage = createStorage();
export { createMemoryStorage };
