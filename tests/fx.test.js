// 환율 두 가지의 역할 구분.
//
//   매입시점 환율(trade.fx -> avgFx) : 환차손익의 기준점. 절대 덮어쓰지 않는다.
//   현재 평가 환율(asset.currentFx)  : 지금 평가금액을 원화로 환산하는 값. 항상 최신.
//
// 2026-07-22 브라우저 점검에서 두 번째가 갱신되지 않아 표시 환율(1,478.4)과
// 평가 환율(1,400)이 어긋났다. 환차손익이 절반 이하로 계상되던 문제라 여기서 고정한다.

import test from "node:test";
import assert from "node:assert/strict";

import { setState, state, syncUsdAssetFx } from "../src/state/store.js";
import { seedState } from "../src/state/schema.js";
import { replayHoldings } from "../src/domain/portfolio.js";

const OWNER = "inv_a";

function useState(usdkrw, catalog, trades = []) {
  setState({
    ...structuredClone(seedState),
    investors: [{ id: OWNER, name: "가", initials: "가" }],
    trades,
    cashflows: [],
    fx: { ...seedState.fx, mode: "auto", usdkrw },
    assetCatalog: catalog
  });
}

const usdEtf = (currentFx) => ({
  SCHD: { ticker: "SCHD", name: "SCHD", type: "ETF", currency: "USD", currentPrice: 90, currentFx, annualDividend: 0 }
});

test("USD 자산의 현재 평가 환율을 앱 환율에 맞춘다", () => {
  useState(1478.4, usdEtf(1400));
  const changed = syncUsdAssetFx();
  assert.equal(changed, 1);
  assert.equal(state.assetCatalog.SCHD.currentFx, 1478.4);
});

test("이미 최신이면 아무것도 바꾸지 않는다", () => {
  useState(1478.4, usdEtf(1478.4));
  assert.equal(syncUsdAssetFx(), 0);
});

test("원화 자산은 건드리지 않는다", () => {
  useState(1478.4, {
    "360750": { ticker: "360750", name: "TIGER", type: "ETF", currency: "KRW", currentPrice: 16000, currentFx: 1, annualDividend: 0 }
  });
  assert.equal(syncUsdAssetFx(), 0);
  assert.equal(state.assetCatalog["360750"].currentFx, 1);
});

test("코인은 제외한다 — USDT/KRW 로 환산하므로 USD/KRW 를 덮어쓰면 안 된다", () => {
  useState(1478.4, {
    BTC: { ticker: "BTC", name: "Bitcoin", type: "코인", currency: "USD", currentPrice: 65990, currentFx: 1465, annualDividend: 0 },
    ...usdEtf(1400)
  });
  assert.equal(syncUsdAssetFx(), 1); // SCHD 만 바뀐다
  assert.equal(state.assetCatalog.BTC.currentFx, 1465, "코인 환율(USDT/KRW)이 보존되어야 한다");
  assert.equal(state.assetCatalog.SCHD.currentFx, 1478.4);
});

test("수동 환율 모드에서는 수동값을 따른다", () => {
  useState(1478.4, usdEtf(1400));
  state.fx.mode = "manual";
  state.fx.manualUsdkrw = 1350;
  syncUsdAssetFx();
  assert.equal(state.assetCatalog.SCHD.currentFx, 1350);
});

test("동기화해도 매입시점 환율과 평단은 그대로다", () => {
  const trades = [
    { id: "t1", ownerId: OWNER, date: "2026-01-10", side: "buy", ticker: "SCHD", name: "SCHD", type: "ETF", currency: "USD", quantity: 100, price: 80, fx: 1300 },
    { id: "t2", ownerId: OWNER, date: "2026-02-10", side: "buy", ticker: "SCHD", name: "SCHD", type: "ETF", currency: "USD", quantity: 50, price: 60, fx: 1400 }
  ];
  useState(1478.4, usdEtf(1400), trades);

  const before = replayHoldings(OWNER)[0];
  syncUsdAssetFx();
  const after = replayHoldings(OWNER)[0];

  assert.equal(after.avgPrice, before.avgPrice, "평단은 환율 동기화와 무관하다");
  assert.equal(after.avgFx, before.avgFx, "매입시점 평균환율은 보존되어야 한다");
  assert.equal(after.avgFx, 14600000 / 11000); // 1327.2727...
  // 거래 원장 자체도 그대로
  assert.deepEqual(state.trades.map((trade) => trade.fx), [1300, 1400]);
});

test("환율이 오르면 평가금액과 환차손익이 함께 늘어난다", () => {
  const trades = [
    { id: "t1", ownerId: OWNER, date: "2026-01-10", side: "buy", ticker: "SCHD", name: "SCHD", type: "ETF", currency: "USD", quantity: 100, price: 80, fx: 1300 }
  ];
  useState(1478.4, usdEtf(1400), trades);

  const stale = replayHoldings(OWNER)[0];
  assert.equal(stale.fxProfit, 8000 * (1400 - 1300)); // 800,000

  syncUsdAssetFx();
  const fresh = replayHoldings(OWNER)[0];

  assert.equal(fresh.fxProfit, 8000 * (1478.4 - 1300)); // 1,427,200
  assert.equal(fresh.valueKrw, 100 * 90 * 1478.4);
  // 주가손익은 환율에 비례해 커지지만 평단 자체는 그대로
  assert.equal(fresh.avgPrice, 80);
  // 분해 합은 언제나 총손익과 같다
  assert.ok(Math.abs(fresh.stockProfit + fresh.fxProfit - fresh.profit) < 1e-6);
});

test("환율이 매입시점보다 낮으면 환차손익이 음수가 된다", () => {
  const trades = [
    { id: "t1", ownerId: OWNER, date: "2026-01-10", side: "buy", ticker: "SCHD", name: "SCHD", type: "ETF", currency: "USD", quantity: 100, price: 80, fx: 1400 }
  ];
  useState(1300, usdEtf(1400), trades);
  syncUsdAssetFx();

  const holding = replayHoldings(OWNER)[0];
  assert.equal(holding.fxProfit, 8000 * (1300 - 1400)); // -800,000
  assert.ok(holding.fxProfit < 0);
});
