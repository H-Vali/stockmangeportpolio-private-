// 스키마 정규화 · 검증 · 마이그레이션.
//
// 이 계층이 무너지면 "저장된 데이터가 조용히 초기화되는" 최악의 사고가 난다.
// 그래서 정상 경로보다 깨진 입력을 더 많이 넣어 본다.

import test from "node:test";
import assert from "node:assert/strict";

import { SCHEMA_VERSION } from "../src/config/constants.js";
import { clearPortfolioData, isOverClearedState, normalizeState, seedState } from "../src/state/schema.js";
import { validateImportState } from "../src/state/validate.js";
import { migrate, needsMigration } from "../src/state/migrate.js";

const VALID = {
  schemaVersion: SCHEMA_VERSION,
  investors: [{ id: "inv_a", name: "가", initials: "가" }],
  cashflows: [{ id: "c1", ownerId: "inv_a", date: "2026-01-01", type: "deposit", amount: 1000 }],
  trades: [
    { id: "t1", ownerId: "inv_a", date: "2026-01-02", side: "buy", ticker: "SCHD", quantity: 1, price: 80, fx: 1300 }
  ]
};

test("정상 상태는 검증을 통과한다", () => {
  assert.deepEqual(validateImportState(VALID), []);
});

test("필수 배열이 없으면 그 사실만 보고하고 더 파고들지 않는다", () => {
  const errors = validateImportState({});
  assert.equal(errors.length, 3);
  assert.ok(errors.some((error) => error.includes("investors")));
  assert.ok(errors.some((error) => error.includes("trades")));
  assert.ok(errors.some((error) => error.includes("cashflows")));
});

test("입출금 type 이 deposit/withdraw 가 아니면 잡아낸다", () => {
  const errors = validateImportState({
    ...VALID,
    cashflows: [{ id: "c1", ownerId: "inv_a", date: "2026-01-01", type: "transfer", amount: 1000 }]
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /cashflows\[0\]/);
});

test("금액이 문자열이면 잡아낸다(JSON 편집 사고 방지)", () => {
  const errors = validateImportState({
    ...VALID,
    cashflows: [{ id: "c1", ownerId: "inv_a", date: "2026-01-01", type: "deposit", amount: "1000" }]
  });
  assert.equal(errors.length, 1);
});

test("거래의 side/수량/체결가/환율 타입을 검증한다", () => {
  const errors = validateImportState({
    ...VALID,
    trades: [{ id: "t1", ownerId: "inv_a", date: "2026-01-02", side: "short", ticker: "SCHD", quantity: 1, price: 80, fx: 1300 }]
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /trades\[0\]/);
});

test("정규화: 빠진 필드는 기본값으로 채우고 준 값은 보존한다", () => {
  const normalized = normalizeState({ investors: [], cashflows: [], trades: [], fx: { usdkrw: 1450 } });
  assert.equal(normalized.fx.usdkrw, 1450);
  assert.equal(normalized.fx.mode, seedState.fx.mode);
  assert.deepEqual(normalized.snapshots, []);
  assert.ok(normalized.marketIndicators.length > 0);
});

test("정규화: 객체가 아닌 입력도 죽지 않고 기본 상태를 낸다", () => {
  for (const input of [null, undefined, 42, "x"]) {
    const normalized = normalizeState(input);
    assert.equal(typeof normalized, "object");
    assert.equal(normalized.schemaVersion, 1);
  }
});

test("marketIndicators 는 symbol 기준으로 기본값 위에 덮어쓴다", () => {
  const normalized = normalizeState({
    investors: [],
    cashflows: [],
    trades: [],
    marketIndicators: [{ symbol: "BTC", domestic: 99, globalKrw: 98, domesticChange: 1, globalChange: 1 }]
  });
  const btc = normalized.marketIndicators.find((item) => item.symbol === "BTC");
  assert.equal(btc.domestic, 99);
  // 기본 목록의 다른 심볼은 그대로 남는다
  assert.ok(normalized.marketIndicators.some((item) => item.symbol === "ETH"));
});

test("clearPortfolioData 는 원장만 비우고 투자자와 시세는 남긴다", () => {
  const cleared = clearPortfolioData(VALID);
  assert.deepEqual(cleared.trades, []);
  assert.deepEqual(cleared.cashflows, []);
  assert.deepEqual(cleared.snapshots, []);
  assert.equal(cleared.investors.length, 1);
  assert.equal(cleared.selectedInvestorId, "inv_a");
  assert.ok(cleared.marketIndicators.length > 0);
});

test("isOverClearedState 는 전부 비었을 때만 참", () => {
  assert.equal(isOverClearedState({ investors: [], cashflows: [], trades: [], marketIndicators: [] }), true);
  assert.equal(isOverClearedState({ investors: [], cashflows: [], trades: [], marketIndicators: [{}] }), false);
  assert.equal(isOverClearedState(VALID), false);
});

test("마이그레이션: 구버전 데이터에 rev 메타데이터가 붙는다", () => {
  const { state, applied, from, to } = migrate({ ...VALID, schemaVersion: 3 });
  assert.deepEqual(applied, [4]);
  assert.equal(from, 3);
  assert.equal(to, SCHEMA_VERSION);
  assert.equal(state.rev, 0);
  assert.equal(state.updatedAt, null);
  // 기존 데이터는 손대지 않는다
  assert.deepEqual(state.trades, VALID.trades);
});

test("마이그레이션: 최신 버전이면 아무것도 적용하지 않는다", () => {
  const { applied } = migrate(VALID);
  assert.deepEqual(applied, []);
  assert.equal(needsMigration(VALID), false);
});

test("마이그레이션: 이미 있는 rev 는 덮어쓰지 않는다", () => {
  const { state } = migrate({ ...VALID, schemaVersion: 3, rev: 7 });
  assert.equal(state.rev, 7);
});

test("마이그레이션: 미래 버전 데이터는 변환하지 않고 그대로 둔다", () => {
  const future = { ...VALID, schemaVersion: SCHEMA_VERSION + 5, mystery: true };
  const { state, applied, to } = migrate(future);
  assert.deepEqual(applied, []);
  assert.equal(to, SCHEMA_VERSION + 5);
  assert.equal(state.mystery, true);
});

test("마이그레이션은 입력 객체를 변형하지 않는다", () => {
  const input = { ...VALID, schemaVersion: 3 };
  const before = structuredClone(input);
  migrate(input);
  assert.deepEqual(input, before);
});
