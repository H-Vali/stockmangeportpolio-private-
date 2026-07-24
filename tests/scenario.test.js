// 브라우저에서 손으로 확인한 시나리오를 그대로 고정한 통합 테스트.
//
// 2026-07-22 브라우저 점검에서 확인한 값과 동일한 숫자가 나오는지 검사한다.
// 화면 없이 도는 테스트라, 렌더 계층을 건드려도 계산이 어긋나면 여기서 먼저 걸린다.
//
// 예수금은 원화 풀/외화 풀로 나뉜다(2026-07-24). 외화 종목은 외화 예수금
// 안에서만 매수 가능하므로, 김철수는 SCHD를 사기 전에 별도로 USD를 입금해
// 뒀다고 가정한다.
//
// 시나리오
//   김철수: 2,000만원 입금 + $10,000 입금 -> SCHD 100주 @$80 (환율 1300)
//           -> 50주 @$60 (환율 1400) -> 30주 @$95 매도 (환율 1400).
//           현재가 $90, 현재환율(상태) 1380, SCHD 평가환율 1400
//   이영희: 1,000만 입금 -> 360750 500주 @15,000원. 현재가 16,000원

import test from "node:test";
import assert from "node:assert/strict";

import { setState, currentUsdKrw } from "../src/state/store.js";
import { seedState } from "../src/state/schema.js";
import { cashBalance, cashBalanceKrw, cashBalanceUsd, replayHoldings, summarize } from "../src/domain/portfolio.js";

const A = "inv_kim";
const B = "inv_lee";

function scenarioState() {
  return {
    ...structuredClone(seedState),
    investors: [
      { id: A, name: "김철수", initials: "김" },
      { id: B, name: "이영희", initials: "이" }
    ],
    cashflows: [
      { id: "c1", ownerId: A, date: "2026-01-02", type: "deposit", amount: 20_000_000 },
      { id: "c1b", ownerId: A, date: "2026-01-02", type: "deposit", amount: 10_000, currency: "USD" },
      { id: "c2", ownerId: B, date: "2026-01-02", type: "deposit", amount: 10_000_000 }
    ],
    trades: [
      { id: "t1", ownerId: A, date: "2026-01-10", side: "buy", ticker: "SCHD", name: "SCHD", type: "ETF", currency: "USD", quantity: 100, price: 80, fx: 1300 },
      { id: "t2", ownerId: A, date: "2026-02-10", side: "buy", ticker: "SCHD", name: "SCHD", type: "ETF", currency: "USD", quantity: 50, price: 60, fx: 1400 },
      { id: "t3", ownerId: A, date: "2026-04-01", side: "sell", ticker: "SCHD", name: "SCHD", type: "ETF", currency: "USD", quantity: 30, price: 95, fx: 1400 },
      { id: "t4", ownerId: B, date: "2026-01-15", side: "buy", ticker: "360750", name: "TIGER 미국S&P500", type: "ETF", currency: "KRW", quantity: 500, price: 15_000, fx: 1 }
    ],
    assetCatalog: {
      SCHD: { ticker: "SCHD", name: "SCHD", type: "ETF", currency: "USD", currentPrice: 90, currentFx: 1400, annualDividend: 0 },
      "360750": { ticker: "360750", name: "TIGER 미국S&P500", type: "ETF", currency: "KRW", currentPrice: 16_000, currentFx: 1, annualDividend: 0 }
    }
  };
}

// 매수 150주 - 매도 30주 = 120주. 외화 원가 11,000 중 20% 가 매도로 빠져 8,800.
const AVG_PRICE = 8_800 / 120; // 73.3333...
const AVG_FX = 11_680_000 / 8_800; // 1327.2727...
// 외화 예수금: $10,000 입금 - $8,000(100주@80) - $3,000(50주@60) + $2,850(30주@95) = $1,850
// (매수/매도 모두 거래 통화 액면가 그대로 외화 풀에서 드나든다. 환산 없음.)
const A_CASH_USD = 1_850;
const A_CASH_KRW = 20_000_000;
const A_CASH = A_CASH_KRW + A_CASH_USD * 1380; // 상태 기본 환율(DEFAULT_USDKRW)로 환산
const A_HOLDINGS = 120 * 90 * 1400; // 15,120,000
const B_HOLDINGS = 500 * 16_000; // 8,000,000
const B_CASH = 10_000_000 - 7_500_000; // 2,500,000

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 0.5, `${actual} !== ${expected}`);
}

test.beforeEach(() => {
  setState(scenarioState());
});

test("김철수 SCHD 보유분이 브라우저 점검값과 일치한다", () => {
  const schd = replayHoldings(A).find((holding) => holding.ticker === "SCHD");
  assert.equal(schd.quantity, 120);
  near(schd.avgPrice, AVG_PRICE);
  near(schd.avgFx, AVG_FX);
  near(schd.valueKrw, A_HOLDINGS);
  near(schd.stockProfit, 2_800_000);
  near(schd.fxProfit, 640_000);
  near(schd.profit, 3_440_000);
});

test("예수금이 매수·매도·입금을 모두 반영한다 (원화/외화 풀이 각각)", () => {
  near(cashBalanceKrw(A), A_CASH_KRW);
  near(cashBalanceUsd(A), A_CASH_USD);
  near(cashBalance(A), A_CASH);
  near(cashBalance(B), B_CASH);
});

test("투자자별 평가금액과 평가손익", () => {
  const a = summarize(A);
  const aPrincipal = A_CASH_KRW + 10_000 * currentUsdKrw(); // 원화 입금 + 외화 입금(환산)
  near(a.principal, aPrincipal);
  near(a.totalValue, A_HOLDINGS + A_CASH);
  near(a.profit, A_HOLDINGS + A_CASH - aPrincipal);

  const b = summarize(B);
  near(b.principal, 10_000_000);
  near(b.totalValue, B_HOLDINGS + B_CASH); // 10,500,000
  near(b.profit, 500_000);
});

test("전체 합계는 투자자 합과 같다", () => {
  const all = summarize();
  near(all.totalValue, summarize(A).totalValue + summarize(B).totalValue);
  near(all.principal, summarize(A).principal + summarize(B).principal);
  near(all.profit, summarize(A).profit + summarize(B).profit);
});

test("원화 ETF 는 환차손익이 0이고 손익이 전부 주가손익이다", () => {
  const [krwEtf] = replayHoldings(B);
  assert.equal(krwEtf.fxProfit, 0);
  near(krwEtf.stockProfit, 500_000);
});

test("투자자 삭제 시 해당 투자자의 원장만 사라진다", () => {
  const next = scenarioState();
  next.investors = next.investors.filter((investor) => investor.id !== B);
  next.trades = next.trades.filter((trade) => trade.ownerId !== B);
  next.cashflows = next.cashflows.filter((flow) => flow.ownerId !== B);
  setState(next);

  assert.equal(replayHoldings(B).length, 0);
  assert.equal(cashBalance(B), 0);
  // 남은 투자자는 영향을 받지 않는다
  near(summarize(A).totalValue, A_HOLDINGS + A_CASH);
  near(summarize().totalValue, A_HOLDINGS + A_CASH);
});

test("매도 거래를 지우면 수량과 예수금이 매도 전으로 돌아간다", () => {
  const next = scenarioState();
  next.trades = next.trades.filter((trade) => trade.id !== "t3");
  setState(next);

  const schd = replayHoldings(A).find((holding) => holding.ticker === "SCHD");
  assert.equal(schd.quantity, 150);
  // 매도($2,850 유입)가 사라지므로 외화 예수금은 $10,000 - $8,000 - $3,000 = -$1,000
  near(cashBalanceUsd(A), -1_000);
  near(cashBalance(A), A_CASH_KRW + -1_000 * currentUsdKrw());
});
