// 원장 재생과 요약 계산 — 돈이 걸린 핵심 로직이라 여기부터 고정한다.
//
// replayHoldings / summarize 는 전역 state 를 읽으므로, 각 테스트에서
// state 를 통째로 갈아끼운 뒤 검증한다.

import test from "node:test";
import assert from "node:assert/strict";

import { currentUsdKrw, setState } from "../src/state/store.js";
import { seedState } from "../src/state/schema.js";
import {
  cashBalance,
  cashBalanceKrw,
  cashBalanceUsd,
  computeAveragingPreview,
  groupedByType,
  netCashflow,
  netCashflowKrw,
  netCashflowUsd,
  replayHoldings,
  summarize
} from "../src/domain/portfolio.js";

const OWNER = "inv_a";
const OTHER = "inv_b";

function useState({ trades = [], cashflows = [], assetCatalog = {}, investors = [] } = {}) {
  setState({
    ...structuredClone(seedState),
    investors: investors.length ? investors : [{ id: OWNER, name: "가", initials: "가" }],
    trades,
    cashflows,
    assetCatalog
  });
}

function buy(overrides = {}) {
  return {
    id: `t_${Math.random().toString(36).slice(2)}`,
    ownerId: OWNER,
    date: "2026-01-10",
    side: "buy",
    ticker: "SCHD",
    name: "Schwab U.S. Dividend Equity ETF",
    type: "ETF",
    currency: "USD",
    quantity: 10,
    price: 80,
    fx: 1300,
    ...overrides
  };
}

const SCHD_AT = (currentPrice, currentFx) => ({
  SCHD: {
    ticker: "SCHD",
    name: "Schwab U.S. Dividend Equity ETF",
    type: "ETF",
    currency: "USD",
    currentPrice,
    currentFx,
    annualDividend: 0
  }
});

test("단일 매수: 평단·평균환율·평가금액", () => {
  useState({ trades: [buy()], assetCatalog: SCHD_AT(80, 1300) });

  const [holding] = replayHoldings(OWNER);
  assert.equal(holding.quantity, 10);
  assert.equal(holding.avgPrice, 80);
  assert.equal(holding.avgFx, 1300);
  assert.equal(holding.valueKrw, 10 * 80 * 1300);
  assert.equal(holding.profit, 0);
});

test("물타기: 외화 원가 가중으로 평단과 평균환율이 섞인다", () => {
  useState({
    trades: [
      buy({ quantity: 10, price: 80, fx: 1300 }),
      buy({ date: "2026-02-10", quantity: 10, price: 60, fx: 1400 })
    ],
    assetCatalog: SCHD_AT(70, 1400)
  });

  const [holding] = replayHoldings(OWNER);
  assert.equal(holding.quantity, 20);
  // 평단 = (10*80 + 10*60) / 20
  assert.equal(holding.avgPrice, 70);
  // 평균환율 = (800*1300 + 600*1400) / 1400  -- 외화 원가 가중
  const expectedAvgFx = (800 * 1300 + 600 * 1400) / 1400;
  assert.ok(Math.abs(holding.avgFx - expectedAvgFx) < 1e-9);
});

test("손익 분해: 주가손익 + 환차손익 = 총손익", () => {
  useState({ trades: [buy({ quantity: 10, price: 80, fx: 1300 })], assetCatalog: SCHD_AT(90, 1400) });

  const [holding] = replayHoldings(OWNER);
  assert.equal(holding.stockProfit, 10 * (90 - 80) * 1400);
  assert.equal(holding.fxProfit, 10 * 80 * (1400 - 1300));
  assert.equal(holding.profit, holding.stockProfit + holding.fxProfit);
});

test("원화 자산은 환차손익이 발생하지 않는다", () => {
  useState({
    trades: [buy({ ticker: "069500", currency: "KRW", quantity: 100, price: 9000, fx: 1 })],
    assetCatalog: {
      "069500": { ticker: "069500", name: "KODEX 200", type: "ETF", currency: "KRW", currentPrice: 10000, currentFx: 1, annualDividend: 0 }
    }
  });

  const [holding] = replayHoldings(OWNER);
  assert.equal(holding.fxProfit, 0);
  assert.equal(holding.profit, 100 * (10000 - 9000) * 1);
});

test("부분 매도: 수량과 원가가 비율대로 줄고 평단은 유지된다", () => {
  useState({
    trades: [
      buy({ quantity: 10, price: 80, fx: 1300 }),
      buy({ date: "2026-03-01", side: "sell", quantity: 4, price: 100, fx: 1350 })
    ],
    assetCatalog: SCHD_AT(100, 1350)
  });

  const [holding] = replayHoldings(OWNER);
  assert.equal(holding.quantity, 6);
  assert.equal(holding.avgPrice, 80); // 평단은 매도로 바뀌지 않는다
  assert.equal(holding.avgFx, 1300);
});

test("전량 매도하면 보유 목록에서 사라진다", () => {
  useState({
    trades: [
      buy({ quantity: 10 }),
      buy({ date: "2026-03-01", side: "sell", quantity: 10, price: 100, fx: 1350 })
    ],
    assetCatalog: SCHD_AT(100, 1350)
  });

  assert.equal(replayHoldings(OWNER).length, 0);
});

test("보유수량을 넘는 매도는 보유분까지만 차감한다", () => {
  useState({
    trades: [
      buy({ quantity: 5 }),
      buy({ date: "2026-03-01", side: "sell", quantity: 999, price: 100, fx: 1350 })
    ],
    assetCatalog: SCHD_AT(100, 1350)
  });

  assert.equal(replayHoldings(OWNER).length, 0);
});

test("거래는 날짜순으로 재생된다(입력 순서와 무관)", () => {
  const late = buy({ date: "2026-05-01", quantity: 10, price: 60, fx: 1400 });
  const early = buy({ date: "2026-01-01", quantity: 10, price: 80, fx: 1300 });
  useState({ trades: [late, early], assetCatalog: SCHD_AT(70, 1400) });
  const forward = replayHoldings(OWNER)[0];

  useState({ trades: [early, late], assetCatalog: SCHD_AT(70, 1400) });
  const reversed = replayHoldings(OWNER)[0];

  assert.deepEqual(forward, reversed);
});

test("투자자별 원장이 서로 섞이지 않는다", () => {
  useState({
    investors: [
      { id: OWNER, name: "가", initials: "가" },
      { id: OTHER, name: "나", initials: "나" }
    ],
    trades: [buy({ ownerId: OWNER, quantity: 10 }), buy({ ownerId: OTHER, quantity: 3 })],
    cashflows: [
      { id: "c1", ownerId: OWNER, date: "2026-01-01", type: "deposit", amount: 2_000_000 },
      { id: "c2", ownerId: OTHER, date: "2026-01-01", type: "deposit", amount: 500_000 }
    ],
    assetCatalog: SCHD_AT(80, 1300)
  });

  assert.equal(replayHoldings(OWNER)[0].quantity, 10);
  assert.equal(replayHoldings(OTHER)[0].quantity, 3);
  assert.equal(netCashflow(OWNER), 2_000_000);
  assert.equal(netCashflow(OTHER), 500_000);
  // ownerId 를 주지 않으면 전체 합산
  assert.equal(netCashflow(), 2_500_000);
  assert.equal(replayHoldings().length, 2);
});

test("외화 예수금 = 입금 - 출금 - 매수금액 + 매도대금 (거래 통화 액면가, 환산 없음)", () => {
  useState({
    trades: [
      buy({ quantity: 10, price: 80, fx: 1300 }), // $800 매수
      buy({ date: "2026-02-01", side: "sell", quantity: 5, price: 90, fx: 1350 }) // $450 매도
    ],
    cashflows: [
      { id: "c1", ownerId: OWNER, date: "2026-01-01", type: "deposit", amount: 2000, currency: "USD" },
      { id: "c2", ownerId: OWNER, date: "2026-01-05", type: "withdraw", amount: 300, currency: "USD" }
    ],
    assetCatalog: SCHD_AT(90, 1350)
  });

  assert.equal(netCashflowUsd(OWNER), 1700);
  assert.equal(cashBalanceUsd(OWNER), 1700 - 800 + 450);
  // 원화 풀은 건드리지 않는다
  assert.equal(netCashflowKrw(OWNER), 0);
  assert.equal(cashBalanceKrw(OWNER), 0);
});

test("원화 예수금과 외화 예수금은 서로 다른 풀이다 — 원화 입금으로 외화 매수 자금이 채워지지 않는다", () => {
  useState({
    trades: [buy({ quantity: 10, price: 80, fx: 1300 })], // $800 매수, 외화 풀에서 빠진다
    cashflows: [{ id: "c1", ownerId: OWNER, date: "2026-01-01", type: "deposit", amount: 2_000_000 }], // currency 없음 -> 원화
    assetCatalog: SCHD_AT(90, 1350)
  });

  assert.equal(cashBalanceKrw(OWNER), 2_000_000);
  assert.equal(cashBalanceUsd(OWNER), -800);
});

test("요약: 평가금액 = 보유평가 + 예수금(원화+외화 환산), 평가손익 = 평가금액 - 투자원금", () => {
  useState({
    trades: [buy({ quantity: 10, price: 80, fx: 1300 })],
    cashflows: [{ id: "c1", ownerId: OWNER, date: "2026-01-01", type: "deposit", amount: 2_000_000 }],
    assetCatalog: SCHD_AT(90, 1400)
  });

  const summary = summarize(OWNER);
  assert.equal(summary.principal, 2_000_000);
  assert.equal(summary.cashKrw, 2_000_000);
  assert.equal(summary.cashUsd, -800);
  assert.equal(summary.cash, summary.cashKrw + summary.cashUsd * currentUsdKrw());
  assert.equal(summary.holdingsValue, 10 * 90 * 1400);
  assert.equal(summary.totalValue, summary.holdingsValue + summary.cash);
  assert.equal(summary.profit, summary.totalValue - summary.principal);
  assert.equal(summary.returnRate, (summary.profit / summary.principal) * 100);
});

test("투자원금이 0이면 수익률은 0 (0으로 나누지 않는다)", () => {
  useState({});
  assert.equal(summarize(OWNER).returnRate, 0);
});

test("자산배분: 유형별 합계와 예수금이 모두 잡힌다", () => {
  useState({
    trades: [buy({ quantity: 10, price: 80, fx: 1300 })],
    cashflows: [{ id: "c1", ownerId: OWNER, date: "2026-01-01", type: "deposit", amount: 2_000_000 }],
    assetCatalog: SCHD_AT(80, 1300)
  });

  const groups = groupedByType(OWNER);
  const etf = groups.find((group) => group.type === "ETF");
  const cash = groups.find((group) => group.type === "예수금");
  assert.equal(etf.value, 1_040_000);
  assert.equal(cash.value, 2_000_000 - 800 * currentUsdKrw());
  assert.ok(Math.abs(etf.actual + cash.actual - 100) < 1e-9);
});

test("물타기 미리보기: 매수 후 평단과 평균환율을 미리 계산한다", () => {
  useState({ trades: [buy({ quantity: 10, price: 80, fx: 1300 })], assetCatalog: SCHD_AT(70, 1400) });

  const preview = computeAveragingPreview({
    ownerId: OWNER,
    side: "buy",
    ticker: "SCHD",
    quantity: 10,
    price: 60,
    fx: 1400,
    currency: "USD",
    currentFx: 1400,
    currentPrice: 70
  });

  assert.equal(preview.beforeAvgPrice, 80);
  assert.equal(preview.afterAvgPrice, 70);
  assert.equal(preview.afterAvgFx, (800 * 1300 + 600 * 1400) / 1400);
  // 예상손익 = 20주 * 70 * 1400 - 총원가
  assert.equal(preview.expectedProfit, 20 * 70 * 1400 - (800 * 1300 + 600 * 1400));
});

test("물타기 미리보기: 입력이 비면 안내 문구만 돌려준다", () => {
  useState({});
  const preview = computeAveragingPreview({
    ownerId: OWNER,
    side: "buy",
    ticker: "",
    quantity: 0,
    price: 0,
    fx: 1300,
    currency: "USD",
    currentFx: 1300,
    currentPrice: 0
  });
  assert.equal(preview.expectedProfit, undefined);
  assert.match(preview.text, /입력하면/);
});
