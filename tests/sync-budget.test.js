// 서버 쓰기 예산.
//
// Cloudflare KV 무료 한도는 하루 1,000회 쓰기다. 시세 폴링(60초)과 환율 폴링(5분)이
// 서버 쓰기를 유발하면 탭 하나만 켜둬도 하루 1,400회를 넘겨 한도를 태운다.
//
// 규칙: 사람이 입력한 원장이 바뀔 때만 서버로 올린다. 시세·환율·스냅샷은 로컬 전용.

import test from "node:test";
import assert from "node:assert/strict";

import { recordSnapshot, saveState, setState, state } from "../src/state/store.js";
import { seedState } from "../src/state/schema.js";

// schedulePush 는 동기화가 꺼져 있으면(프록시/토큰 없음) 조용히 반환한다.
// 여기서는 "올리려는 의도가 있었는가" 를 rev 증가로 판정한다.
// rev 는 sync: true 인 저장에서만 오르기 때문이다.
function freshState() {
  setState({
    ...structuredClone(seedState),
    investors: [{ id: "inv_a", name: "가", initials: "가" }],
    cashflows: [],
    trades: [],
    rev: 0
  });
}

test("기본 저장은 서버로 올린다 (원장 변경)", () => {
  freshState();
  saveState();
  assert.equal(state.rev, 1);
  saveState();
  assert.equal(state.rev, 2);
});

test("sync: false 저장은 rev 를 올리지 않는다 (시세·환율)", () => {
  freshState();
  saveState({ sync: false });
  saveState({ sync: false });
  saveState({ snapshot: false, sync: false });
  assert.equal(state.rev, 0, "시세 갱신은 서버 쓰기를 유발하면 안 된다");
});

test("시세 폴링 하루치를 흉내내도 서버 쓰기가 0이다", () => {
  freshState();
  // 60초 폴링 x 24시간 = 1,440회
  for (let i = 0; i < 1440; i += 1) saveState({ snapshot: true, sync: false });
  // 5분 환율 폴링 x 24시간 = 288회
  for (let i = 0; i < 288; i += 1) saveState({ snapshot: true, sync: false });
  assert.equal(state.rev, 0);
});

test("하루 원장 입력 횟수는 무료 한도 안에 들어온다", () => {
  freshState();
  // 하루에 거래·입출금을 50번 입력하는 아주 활발한 경우
  for (let i = 0; i < 50; i += 1) saveState();
  assert.equal(state.rev, 50);
  assert.ok(state.rev < 1000, "Cloudflare KV 무료 쓰기 한도(1,000/일) 이내");
});

test("recordSnapshot 은 단독으로 서버 쓰기를 만들지 않는다", () => {
  freshState();
  recordSnapshot();
  recordSnapshot();
  assert.equal(state.rev, 0);
  assert.equal(state.snapshots.length, 1, "같은 날짜는 하나로 유지된다");
});

test("스냅샷은 같은 날짜를 최신 값으로 교체한다", () => {
  freshState();
  recordSnapshot();
  const first = state.snapshots[0].totalValue;
  state.cashflows.push({ id: "c1", ownerId: "inv_a", date: "2026-01-01", type: "deposit", amount: 1_000_000 });
  recordSnapshot();
  assert.equal(state.snapshots.length, 1);
  assert.notEqual(state.snapshots[0].totalValue, first);
  assert.equal(state.snapshots[0].totalValue, 1_000_000);
});

test("저장할 때마다 updatedAt 은 갱신된다 (sync 여부와 무관)", () => {
  freshState();
  saveState({ sync: false });
  const at = state.updatedAt;
  assert.ok(at, "로컬 저장에도 시각은 남는다");
});
