// 배당 시뮬레이션 계산.
//
// 사용자가 이 숫자를 보고 실제 매수 결정을 하므로, 성장률·DRIP·세금이
// 서로 어떻게 얽히는지 표로 고정해 둔다.

import test from "node:test";
import assert from "node:assert/strict";

import { DIVIDEND_TAX_RATE } from "../src/config/constants.js";
import {
  dividendFrequencyLabel,
  dividendFrequencyLabelForTicker,
  dividendMonthsForTicker,
  dividendPayoutsByMonth,
  dividendRows,
  nextDividendPayout
} from "../src/domain/dividend.js";
import { setState } from "../src/state/store.js";
import { seedState } from "../src/state/schema.js";

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

// --- Finnhub 예측(dividendForecast) 기반 집계 ---
// replayHoldings 가 assetCatalog[ticker].dividendForecast 를 그대로 holding 에
// 실어 보내므로, 여기서는 상태를 구성해 domain/dividend.js 의 집계 함수를 검증한다.

const OWNER = "inv_a";

function useDividendState({ trades, assetCatalog }) {
  setState({
    ...structuredClone(seedState),
    investors: [{ id: OWNER, name: "가", initials: "가" }],
    trades,
    assetCatalog
  });
}

function buy(overrides = {}) {
  return {
    id: `t_${Math.random().toString(36).slice(2)}`,
    ownerId: OWNER,
    date: "2026-01-10",
    side: "buy",
    ticker: "QQQI",
    name: "NEOS Nasdaq-100 High Income ETF",
    type: "ETF",
    currency: "USD",
    quantity: 10,
    price: 50,
    fx: 1400,
    ...overrides
  };
}

test("dividendFrequencyLabelForTicker: 예측이 있으면 예측 지급월 개수로, 없으면 정적 맵으로 폴백한다", () => {
  const monthlyForecast = Array.from({ length: 12 }, (_, i) => ({ payDate: `2026-${String(i + 1).padStart(2, "0")}-15`, amountPerShare: 0.2, estimated: true }));
  assert.equal(dividendFrequencyLabelForTicker("QQQI", monthlyForecast), "월배당");
  assert.equal(dividendFrequencyLabelForTicker("SCHD", null), dividendFrequencyLabel("SCHD"));
});

test("dividendPayoutsByMonth: 보유수량 x 주당배당 x 환율의 세후 금액을 실제 지급월에 집계한다", () => {
  useDividendState({
    trades: [buy({ quantity: 10, price: 50, fx: 1400 })],
    assetCatalog: {
      QQQI: {
        ticker: "QQQI",
        name: "NEOS Nasdaq-100 High Income ETF",
        type: "ETF",
        currency: "USD",
        currentPrice: 55,
        currentFx: 1450,
        annualDividend: 0,
        dividendForecast: [
          { payDate: "2026-08-15", amountPerShare: 0.3, currency: "USD", estimated: false },
          { payDate: "2026-09-15", amountPerShare: 0.3, currency: "USD", estimated: true }
        ]
      }
    }
  });

  const { monthlyTotals, monthlyItems, dividendHoldingsCount } = dividendPayoutsByMonth(OWNER);
  assert.equal(dividendHoldingsCount, 1);
  const expectedPerPayout = 10 * 0.3 * 1450 * (1 - DIVIDEND_TAX_RATE);
  assert.ok(Math.abs(monthlyTotals[7] - expectedPerPayout) < 1e-9); // 8월 = index 7
  assert.ok(Math.abs(monthlyTotals[8] - expectedPerPayout) < 1e-9); // 9월 = index 8
  assert.equal(monthlyItems[7][0].ticker, "QQQI");
  assert.equal(monthlyItems[7][0].estimated, false);
  assert.equal(monthlyItems[8][0].estimated, true);
});

test("dividendPayoutsByMonth: 예측 데이터가 없는 종목은 집계에서 빠진다", () => {
  useDividendState({
    trades: [buy()],
    assetCatalog: {
      QQQI: { ticker: "QQQI", name: "QQQI", type: "ETF", currency: "USD", currentPrice: 55, currentFx: 1450, annualDividend: 0, dividendForecast: [] }
    }
  });
  const { monthlyTotals, dividendHoldingsCount } = dividendPayoutsByMonth(OWNER);
  assert.equal(dividendHoldingsCount, 0);
  assert.deepEqual(monthlyTotals, new Array(12).fill(0));
});

test("nextDividendPayout: 가장 가까운 지급일 1건을 세후 금액과 함께 반환한다", () => {
  useDividendState({
    trades: [buy({ quantity: 10, price: 50, fx: 1400 })],
    assetCatalog: {
      QQQI: {
        ticker: "QQQI",
        name: "QQQI",
        type: "ETF",
        currency: "USD",
        currentPrice: 55,
        currentFx: 1450,
        annualDividend: 0,
        dividendForecast: [
          { payDate: "2026-09-15", amountPerShare: 0.3, currency: "USD", estimated: true },
          { payDate: "2026-08-15", amountPerShare: 0.3, currency: "USD", estimated: false }
        ]
      }
    }
  });

  const best = nextDividendPayout(OWNER);
  assert.equal(best.ticker, "QQQI");
  assert.equal(best.payDate, "2026-08-15");
  assert.equal(best.estimated, false);
  assert.ok(Math.abs(best.amountAfterTax - 10 * 0.3 * 1450 * (1 - DIVIDEND_TAX_RATE)) < 1e-9);
});

test("nextDividendPayout: 배당 예측이 전혀 없으면 null", () => {
  useDividendState({ trades: [], assetCatalog: {} });
  assert.equal(nextDividendPayout(OWNER), null);
});
