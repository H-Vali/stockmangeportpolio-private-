// Finnhub 배당 이력을 앞으로의 예상 지급 스케줄로 바꾼다.
//
// 회사가 이미 다음 지급일을 공시한 건(payDate > 오늘)은 그대로 쓰고,
// 그 이후는 최근 지급 간격(중앙값)을 반복 적용해 근사치를 채운다.
// 정확한 배당락일/금액 예측은 불가능하므로 "최대한 근접한" 값이 목표다.

function toDateOnly(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`);
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(date, months) {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
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

export function normalizeDividendRecords(raw) {
  const list = Array.isArray(raw) ? raw : (raw?.data || []);
  return list
    .map((r) => ({
      exDate: r.date || r.exDate || null,
      payDate: r.payDate || r.date || r.exDate || null,
      amount: Number(r.adjustedAmount ?? r.amount ?? 0),
      currency: r.currency || "USD"
    }))
    .filter((r) => r.payDate && r.amount > 0)
    .sort((a, b) => a.payDate.localeCompare(b.payDate));
}

// records: normalizeDividendRecords()의 결과 (오름차순)
export function buildDividendForecast(records, { now = new Date(), horizonMonths = 12 } = {}) {
  if (!records.length) return [];

  const nowKey = toDateKey(now);
  const horizonKey = toDateKey(addMonths(now, horizonMonths));
  const past = records.filter((r) => r.payDate <= nowKey);
  const future = records.filter((r) => r.payDate > nowKey && r.payDate <= horizonKey);

  const schedule = future.map((r) => ({
    payDate: r.payDate,
    amountPerShare: r.amount,
    currency: r.currency,
    estimated: false
  }));

  const recentPast = past.slice(-8);
  if (recentPast.length >= 2) {
    const intervals = [];
    for (let i = 1; i < recentPast.length; i += 1) {
      intervals.push(daysBetween(recentPast[i - 1].payDate, recentPast[i].payDate));
    }
    const validIntervals = intervals.filter((d) => d > 0);
    const intervalDays = Math.round(median(validIntervals) || 91);
    const last = recentPast.at(-1);
    let cursor = toDateOnly(future.length ? future.at(-1).payDate : last.payDate);

    let guard = 0;
    while (guard < 24) {
      cursor = addDays(cursor, intervalDays);
      const cursorKey = toDateKey(cursor);
      if (cursorKey > horizonKey) break;
      schedule.push({
        payDate: cursorKey,
        amountPerShare: last.amount,
        currency: last.currency,
        estimated: true
      });
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
