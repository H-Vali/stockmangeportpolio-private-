// 기반 계층: 저장소 어댑터, HTTP 재시도/타임아웃, 로거.
//
// 이 셋은 "장애가 났을 때 앱이 어떻게 버티는가" 를 결정하는 코드라
// 정상 경로보다 실패 경로를 위주로 검증한다.

import test from "node:test";
import assert from "node:assert/strict";

import { createMemoryStorage } from "../src/state/persistence.js";
import { fetchJson, HttpError } from "../src/core/http.js";
import { logger } from "../src/core/logger.js";

test("메모리 저장소는 localStorage 와 같은 계약을 지킨다", () => {
  const store = createMemoryStorage();
  assert.equal(store.getItem("missing"), null);
  store.setItem("k", "v");
  assert.equal(store.getItem("k"), "v");
  // 값은 항상 문자열로 저장된다(localStorage 동작과 동일)
  store.setItem("n", 42);
  assert.equal(store.getItem("n"), "42");
  store.removeItem("k");
  assert.equal(store.getItem("k"), null);
  store.clear();
  assert.equal(store.getItem("n"), null);
});

// fetch 를 갈아끼워 네트워크 없이 동작을 검증한다.
function withFetch(impl, run) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return Promise.resolve(run()).finally(() => {
    globalThis.fetch = original;
  });
}

test("fetchJson: 정상 응답은 파싱해서 돌려준다", async () => {
  await withFetch(async () => new Response(JSON.stringify({ usdkrw: 1400 }), { status: 200 }), async () => {
    const data = await fetchJson("https://example.test/fx");
    assert.equal(data.usdkrw, 1400);
  });
});

test("fetchJson: 4xx 는 재시도하지 않는다", async () => {
  let calls = 0;
  await withFetch(
    async () => {
      calls += 1;
      return new Response("nope", { status: 404 });
    },
    async () => {
      await assert.rejects(() => fetchJson("https://example.test/x", { retries: 3 }), HttpError);
      assert.equal(calls, 1);
    }
  );
});

test("fetchJson: 5xx 는 지정한 횟수만큼 재시도한다", async () => {
  let calls = 0;
  await withFetch(
    async () => {
      calls += 1;
      return new Response("boom", { status: 503 });
    },
    async () => {
      await assert.rejects(() => fetchJson("https://example.test/x", { retries: 2 }), HttpError);
      assert.equal(calls, 3); // 최초 1회 + 재시도 2회
    }
  );
});

test("fetchJson: 재시도 중 성공하면 그 값을 쓴다", async () => {
  let calls = 0;
  await withFetch(
    async () => {
      calls += 1;
      if (calls === 1) return new Response("boom", { status: 500 });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
    async () => {
      const data = await fetchJson("https://example.test/x", { retries: 2 });
      assert.equal(data.ok, true);
      assert.equal(calls, 2);
    }
  );
});

test("fetchJson: 응답이 없으면 타임아웃으로 끊는다", async () => {
  await withFetch(
    (url, options) =>
      new Promise((_, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
    async () => {
      const error = await fetchJson("https://example.test/slow", { timeoutMs: 30, retries: 0 }).catch((e) => e);
      assert.ok(error instanceof HttpError);
      assert.match(error.message, /시간 초과/);
    }
  );
});

test("fetchJson: 오류에 상태코드와 URL 이 남는다", async () => {
  await withFetch(async () => new Response("no", { status: 418 }), async () => {
    const error = await fetchJson("https://example.test/teapot", { retries: 0 }).catch((e) => e);
    assert.equal(error.status, 418);
    assert.equal(error.url, "https://example.test/teapot");
  });
});

test("logger: 최근 기록을 보관하고 마지막 오류를 짚어준다", () => {
  logger.clear();
  logger.info("t", "첫 번째");
  logger.error("t", "터짐", new Error("원인"));
  const history = logger.history();
  assert.equal(history.length, 2);
  assert.equal(history[0].scope, "t");
  const last = logger.lastError();
  assert.equal(last.message, "터짐");
  assert.equal(last.detail.message, "원인");
  logger.clear();
  assert.equal(logger.history().length, 0);
});

test("logger: 버퍼는 무한히 자라지 않는다", () => {
  logger.clear();
  logger.setLevel("error"); // 콘솔 출력만 막고 기록은 남긴다
  for (let i = 0; i < 500; i += 1) logger.info("t", `m${i}`);
  const history = logger.history();
  assert.ok(history.length <= 200);
  assert.equal(history.at(-1).message, "m499");
  logger.setLevel("info");
  logger.clear();
});
