// Finnhub 배당 이력을 앞으로의 예상 지급 스케줄로 바꾼다.
//
// 캘린더는 "오늘부터 12개월"이 아니라 "올해 1~12월" 고정 범위를 보여준다.
// 그래서 연도가 바뀌면(1/1) now.getUTCFullYear() 가 자동으로 새 연도를
// 가리키게 되어, 별도 리셋 로직 없이 캘린더가 새해 1월부터 다시 예측치로
// 채워진다. 올해 이미 지난 지급(과거 실적)은 확정으로, 아직 공시되지
// 않은 나머지 달은 최근 지급 간격(중앙값)을 반복 적용해 근사치로 채운다.

function toDateOnly(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`);
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function daysBetween(aKey, bKey) {
  return Math.round((toDateOnly(bKey).getTime() - toDateOnly(aKey).getTime()) / 86400000);
}

function median(values) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Polygon.io({results:[{ex_dividend_date, pay_date, cash_amount, currency}]})를 기본으로,
// (혹시 또 갈아탈 경우를 대비한) Twelve Data/Finnhub 스타일 필드명도 함께 받아들인다.
export function normalizeDividendRecords(raw) {
  const list = Array.isArray(raw) ? raw : (raw?.results || raw?.dividends || raw?.data || []);
  const fallbackCurrency = raw?.meta?.currency;
  return list
    .map((r) => ({
      exDate: r.ex_dividend_date || r.date || r.exDate || r.ex_date || null,
      payDate: r.pay_date || r.payDate || r.ex_dividend_date || r.date || r.exDate || r.ex_date || null,
      amount: Number(r.cash_amount ?? r.adjustedAmount ?? r.amount ?? 0),
      currency: r.currency || fallbackCurrency || "USD"
    }))
    .filter((r) => r.payDate && r.amount > 0)
    .sort((a, b) => a.payDate.localeCompare(b.payDate));
}

// records: normalizeDividendRecords()의 결과 (오름차순)
export function buildDividendForecast(records, { now = new Date() } = {}) {
  if (!records.length) return [];

  const year = now.getUTCFullYear();
  const yearStartKey = `${year}-01-01`;
  const yearEndKey = `${year}-12-31`;
  const nowKey = toDateKey(now);

  // 올해 안에서 이미 지급된 실적(확정) + 이미 공시된 올해 남은 지급일(확정)
  const pastThisYear = records.filter((r) => r.payDate >= yearStartKey && r.payDate <= nowKey);
  const futureDeclaredThisYear = records.filter((r) => r.payDate > nowKey && r.payDate <= yearEndKey);
  const allPast = records.filter((r) => r.payDate <= nowKey);

  const schedule = [...pastThisYear, ...futureDeclaredThisYear].map((r) => ({
    payDate: r.payDate,
    amountPerShare: r.amount,
    currency: r.currency,
    estimated: false
  }));

  // 주기 파악은 연도 경계와 무관하게 전체 과거 이력(최근 8건)으로 한다.
  const recentPast = allPast.slice(-8);
  if (recentPast.length >= 2) {
    const intervals = [];
    for (let i = 1; i < recentPast.length; i += 1) {
      intervals.push(daysBetween(recentPast[i - 1].payDate, recentPast[i].payDate));
    }
    const validIntervals = intervals.filter((d) => d > 0);
    const intervalDays = Math.round(median(validIntervals) || 91);
    const last = recentPast.at(-1);
    let cursor = toDateOnly(futureDeclaredThisYear.length ? futureDeclaredThisYear.at(-1).payDate : last.payDate);

    let guard = 0;
    while (guard < 60) {
      cursor = addDays(cursor, intervalDays);
      const cursorKey = toDateKey(cursor);
      if (cursorKey > yearEndKey) break;
      if (cursorKey >= yearStartKey) {
        schedule.push({
          payDate: cursorKey,
          amountPerShare: last.amount,
          currency: last.currency,
          estimated: true
        });
      }
      guard += 1;
    }
  }

  return schedule.sort((a, b) => a.payDate.localeCompare(b.payDate));
}

export function payoutIntervalDays(records) {
  const recentPast = records.slice(-8);
  if (recentPast.length < 2) return null;
  const intervals = [];
  for (let i = 1; i < recentPast.length; i += 1) {
    intervals.push(daysBetween(recentPast[i - 1].payDate, recentPast[i].payDate));
  }
  const validIntervals = intervals.filter((d) => d > 0);
  return validIntervals.length ? Math.round(median(validIntervals)) : null;
}

export function frequencyLabelFromForecast(forecast) {
  if (!forecast || !forecast.length) return null;
  const months = new Set(forecast.map((p) => Number(p.payDate.slice(5, 7))));
  const count = months.size;
  if (count >= 10) return "월배당";
  if (count >= 3) return "분기";
  if (count === 2) return "반기";
  return "연 1회";
}
