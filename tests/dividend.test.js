// 배당 시뮬레이션 계산.
//
// 사용자가 이 숫자를 보고 실제 매수 결정을 하므로, 성장률·DRIP·세금이
// 서로 어떻게 얽히는지 표로 고정해 둔다.

import test from "node:test";
import assert from "node:assert/strict";

import { DIVIDEND_TAX_RATE } from "../src/config/constants.js";
import { dividendFrequencyLabel, dividendMonthsForTicker, dividendRows } from "../src/domain/dividend.js";

// 100주 × 10,000원 = 100만원, 연 5% 배당 -> 연 50,000원
const ANNUAL_BEFORE_TAX = 50_000;

function scenario(overrides = {}) {
  return {
    quantity: 100,
    priceKrw: 10_000,
    annualYield: 0.05,
    growthRate: 0,
    years: 3,
    drip: false,
    ...overrides
  };
}

test("성장률 0 · DRIP 없음이면 매년 같은 배당", () => {
  const rows = dividendRows(scenario());
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.equal(row.beforeTax, ANNUAL_BEFORE_TAX);
    assert.equal(row.afterTax, ANNUAL_BEFORE_TAX * (1 - DIVIDEND_TAX_RATE));
    assert.equal(row.addedQuantity, 0);
    assert.equal(row.endingQuantity, 100);
  }
});

test("누적 세후 배당은 각 연도 세후 배당의 합", () => {
  const rows = dividendRows(scenario());
  const sum = rows.reduce((acc, row) => acc + row.afterTax, 0);
  assert.ok(Math.abs(rows.at(-1).cumulativeAfterTax - sum) < 1e-9);
});

test("세율은 세전 배당에 적용된다", () => {
  const [row] = dividendRows(scenario({ years: 1 }));
  assert.equal(row.afterTax, row.beforeTax * (1 - DIVIDEND_TAX_RATE));
});

test("성장률은 1년차를 기준으로 복리 적용된다", () => {
  const rows = dividendRows(scenario({ growthRate: 0.1 }));
  assert.equal(rows[0].beforeTax, ANNUAL_BEFORE_TAX); // 1년차는 성장 미적용
  assert.ok(Math.abs(rows[1].beforeTax - ANNUAL_BEFORE_TAX * 1.1) < 1e-6);
  assert.ok(Math.abs(rows[2].beforeTax - ANNUAL_BEFORE_TAX * 1.1 ** 2) < 1e-6);
});

test("DRIP: 세후 배당으로 수량이 늘고 다음 해 배당이 커진다", () => {
  const rows = dividendRows(scenario({ drip: true }));
  const firstAfterTax = ANNUAL_BEFORE_TAX * (1 - DIVIDEND_TAX_RATE);
  assert.equal(rows[0].addedQuantity, firstAfterTax / 10_000);
  assert.equal(rows[0].endingQuantity, 100 + firstAfterTax / 10_000);
  assert.ok(rows[1].beforeTax > rows[0].beforeTax);
});

test("DRIP 이 없으면 수량이 그대로다", () => {
  const withDrip = dividendRows(scenario({ drip: true }));
  const without = dividendRows(scenario({ drip: false }));
  assert.ok(withDrip.at(-1).cumulativeAfterTax > without.at(-1).cumulativeAfterTax);
  assert.equal(without.at(-1).endingQuantity, 100);
});

test("단가가 0이면 DRIP 재투자 수량은 0 (0으로 나누지 않는다)", () => {
  const rows = dividendRows(scenario({ priceKrw: 0, drip: true }));
  for (const row of rows) {
    assert.equal(row.addedQuantity, 0);
    assert.ok(Number.isFinite(row.endingQuantity));
  }
});

test("연수가 0이면 빈 표", () => {
  assert.deepEqual(dividendRows(scenario({ years: 0 })), []);
});

test("배당 주기 라벨", () => {
  assert.equal(dividendFrequencyLabel("O"), "월배당"); // 12개월
  assert.equal(dividendFrequencyLabel("SCHD"), "분기"); // 3,6,9,12
  assert.equal(dividendFrequencyLabel("모르는종목"), "분기"); // 기본값
});

test("지급월을 모르는 종목은 분기 배당으로 가정한다", () => {
  assert.deepEqual(dividendMonthsForTicker("SCHD"), [3, 6, 9, 12]);
  assert.deepEqual(dividendMonthsForTicker("모르는종목"), [3, 6, 9, 12]);
});
