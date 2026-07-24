// 배당 예측 로직 — Finnhub 이력을 앞으로의 지급 스케줄로 바꾸는 순수 함수.
//
// 이미 공시된 미래 지급일(estimated:false)은 그대로 쓰고, 그 뒤는 과거 지급
// 간격의 중앙값으로 이어 붙인다(estimated:true). "정확한 예측"이 아니라
// "최대한 근접한 근사"가 목표이므로 여기서는 그 근사 규칙 자체를 고정한다.

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDividendForecast,
  frequencyLabelFromForecast,
  normalizeDividendRecords,
  payoutIntervalDays
} from "../src/domain/dividend-forecast.js";

function rec({ date, payDate, amount, currency = "USD" }) {
  return { date, payDate: payDate || date, amount, currency };
}

test("normalizeDividendRecords: 금액 0 이하/지급일 없는 항목은 제외하고 지급일순 정렬한다", () => {
  const raw = [
    rec({ date: "2026-03-10", amount: 0.5 }),
    rec({ date: "2025-12-10", amount: 0.5 }),
    { date: "2026-01-01", amount: 0 },
    { date: null, amount: 1 }
  ];
  const normalized = normalizeDividendRecords(raw);
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].payDate, "2025-12-10");
  assert.equal(normalized[1].payDate, "2026-03-10");
});

test("normalizeDividendRecords: {data:[...]} 래핑된 응답도 처리한다", () => {
  const normalized = normalizeDividendRecords({ data: [rec({ date: "2026-01-01", amount: 1 })] });
  assert.equal(normalized.length, 1);
});

test("normalizeDividendRecords: Polygon.io 응답({results:[{ex_dividend_date,pay_date,cash_amount}]})을 처리한다", () => {
  const raw = {
    status: "OK",
    results: [
      { ticker: "AAPL", ex_dividend_date: "2026-02-09", pay_date: "2026-02-13", cash_amount: 0.26, currency: "USD" },
      { ticker: "AAPL", ex_dividend_date: "2025-11-10", pay_date: "2025-11-14", cash_amount: 0.26, currency: "USD" }
    ]
  };
  const normalized = normalizeDividendRecords(raw);
  assert.equal(normalized.length, 2);
  // payDate는 ex_dividend_date가 아니라 pay_date를 우선한다
  assert.equal(normalized[0].payDate, "2025-11-14");
  assert.equal(normalized[1].payDate, "2026-02-13");
  assert.equal(normalized[0].amount, 0.26);
});

test("normalizeDividendRecords: Twelve Data 응답({meta,dividends[],ex_date})을 처리하고 meta.currency로 보완한다", () => {
  const raw = {
    meta: { symbol: "AAPL", currency: "USD" },
    dividends: [
      { ex_date: "2026-02-09", amount: 0.26 },
      { ex_date: "2025-11-10", amount: 0.26 }
    ]
  };
  const normalized = normalizeDividendRecords(raw);
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].payDate, "2025-11-10");
  assert.equal(normalized[0].currency, "USD");
  assert.equal(normalized[1].payDate, "2026-02-09");
});

test("buildDividendForecast: 분기 배당 이력이면 다음 분기 간격으로 예측을 이어간다", () => {
  const records = normalizeDividendRecords([
    rec({ date: "2025-01-15", amount: 1 }),
    rec({ date: "2025-04-15", amount: 1 }),
    rec({ date: "2025-07-15", amount: 1 }),
    rec({ date: "2025-10-15", amount: 1 })
  ]);
  const now = new Date("2026-01-01T00:00:00Z");
  const forecast = buildDividendForecast(records, { now });

  // 90일 간격으로 1년 내 대략 4회
  assert.ok(forecast.length >= 3 && forecast.length <= 5, `분기 배당은 12개월에 3~5회여야 함, got ${forecast.length}`);
  forecast.forEach((p) => {
    assert.equal(p.estimated, true);
    assert.equal(p.amountPerShare, 1);
    assert.ok(p.payDate > "2026-01-01");
  });
});

test("buildDividendForecast: 이미 공시된 미래 지급일은 estimated:false 로 그대로 쓴다", () => {
  const records = normalizeDividendRecords([
    rec({ date: "2025-07-15", amount: 1 }),
    rec({ date: "2025-10-15", amount: 1 }),
    rec({ date: "2026-01-15", amount: 1.1 }) // 이미 공시된 다음 지급
  ]);
  const now = new Date("2026-01-01T00:00:00Z");
  const forecast = buildDividendForecast(records, { now });

  const declared = forecast.find((p) => p.payDate === "2026-01-15");
  assert.ok(declared, "공시된 미래 지급일이 포함되어야 함");
  assert.equal(declared.estimated, false);
  assert.equal(declared.amountPerShare, 1.1);
  // 공시된 지급일 이후로는 그 지급일을 기준으로 다음 예측이 이어진다
  const rest = forecast.filter((p) => p.payDate !== "2026-01-15");
  rest.forEach((p) => assert.ok(p.payDate > "2026-01-15"));
});

test("buildDividendForecast: 이력이 1건뿐이면 간격을 알 수 없어 그 값만 반환한다 (미래 지급일인 경우)", () => {
  const records = normalizeDividendRecords([rec({ date: "2026-02-01", amount: 2 })]);
  const forecast = buildDividendForecast(records, { now: new Date("2026-01-01T00:00:00Z") });
  assert.deepEqual(forecast, [{ payDate: "2026-02-01", amountPerShare: 2, currency: "USD", estimated: false }]);
});

test("buildDividendForecast: 이력이 없으면 빈 배열", () => {
  assert.deepEqual(buildDividendForecast([]), []);
});

test("buildDividendForecast: 예측은 올해(1/1~12/31) 범위를 벗어나지 않는다", () => {
  const records = normalizeDividendRecords([
    rec({ date: "2025-01-15", amount: 1 }),
    rec({ date: "2025-02-15", amount: 1 }),
    rec({ date: "2025-03-15", amount: 1 })
  ]);
  const forecast = buildDividendForecast(records, { now: new Date("2026-01-01T00:00:00Z") });
  forecast.forEach((p) => assert.ok(p.payDate >= "2026-01-01" && p.payDate <= "2026-12-31"));
});

test("buildDividendForecast: 올해 이미 지급된 실적은 estimated:false 로 남는다", () => {
  const records = normalizeDividendRecords([
    rec({ date: "2026-01-15", amount: 1 }),
    rec({ date: "2026-04-15", amount: 1 }),
    rec({ date: "2026-07-15", amount: 1 })
  ]);
  const forecast = buildDividendForecast(records, { now: new Date("2026-08-01T00:00:00Z") });
  const past = forecast.filter((p) => p.payDate <= "2026-08-01");
  assert.equal(past.length, 3);
  past.forEach((p) => assert.equal(p.estimated, false));
});

test("buildDividendForecast: 연도가 바뀌면 지난 해 지급 이력은 스케줄에서 빠지고 새해로 리셋된다", () => {
  const records = normalizeDividendRecords([
    rec({ date: "2026-01-15", amount: 1 }),
    rec({ date: "2026-04-15", amount: 1 }),
    rec({ date: "2026-07-15", amount: 1 }),
    rec({ date: "2026-10-15", amount: 1 })
  ]);
  const forecast = buildDividendForecast(records, { now: new Date("2027-01-05T00:00:00Z") });
  forecast.forEach((p) => assert.ok(p.payDate.startsWith("2027-"), `2027년 항목만 있어야 함, got ${p.payDate}`));
  assert.ok(forecast.length > 0);
});

test("payoutIntervalDays: 월배당은 약 30일 간격", () => {
  const records = normalizeDividendRecords([
    rec({ date: "2025-11-01", amount: 0.1 }),
    rec({ date: "2025-12-01", amount: 0.1 }),
    rec({ date: "2026-01-01", amount: 0.1 })
  ]);
  const days = payoutIntervalDays(records);
  assert.ok(days >= 28 && days <= 32);
});

test("payoutIntervalDays: 이력이 1건 이하면 null", () => {
  assert.equal(payoutIntervalDays([]), null);
  assert.equal(payoutIntervalDays(normalizeDividendRecords([rec({ date: "2026-01-01", amount: 1 })])), null);
});

test("frequencyLabelFromForecast: 지급월 개수로 주기를 판단한다", () => {
  const monthly = Array.from({ length: 12 }, (_, i) => ({ payDate: `2026-${String(i + 1).padStart(2, "0")}-01` }));
  const quarterly = [{ payDate: "2026-03-01" }, { payDate: "2026-06-01" }, { payDate: "2026-09-01" }, { payDate: "2026-12-01" }];
  const semiannual = [{ payDate: "2026-06-01" }, { payDate: "2026-12-01" }];
  const annual = [{ payDate: "2026-12-01" }];

  assert.equal(frequencyLabelFromForecast(monthly), "월배당");
  assert.equal(frequencyLabelFromForecast(quarterly), "분기");
  assert.equal(frequencyLabelFromForecast(semiannual), "반기");
  assert.equal(frequencyLabelFromForecast(annual), "연 1회");
  assert.equal(frequencyLabelFromForecast([]), null);
  assert.equal(frequencyLabelFromForecast(null), null);
});
