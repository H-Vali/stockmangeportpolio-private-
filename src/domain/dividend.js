import { DIVIDEND_MONTHS } from "../config/catalog.js";
import { DIVIDEND_TAX_RATE } from "../config/constants.js";
import { frequencyLabelFromForecast } from "./dividend-forecast.js";
import { replayHoldings } from "./portfolio.js";

export function dividendRows(scenario) {
  let quantity = scenario.quantity;
  const rows = [];
  let cumulativeAfterTax = 0;
  for (let year = 1; year <= scenario.years; year += 1) {
    const valueKrw = quantity * scenario.priceKrw;
    const beforeTax = valueKrw * scenario.annualYield * Math.pow(1 + scenario.growthRate, year - 1);
    const afterTax = beforeTax * (1 - DIVIDEND_TAX_RATE);
    const addedQuantity = scenario.drip && scenario.priceKrw > 0 ? afterTax / scenario.priceKrw : 0;
    if (scenario.drip) {
      quantity += addedQuantity;
    }
    cumulativeAfterTax += afterTax;
    rows.push({ year, valueKrw, beforeTax, afterTax, cumulativeAfterTax, addedQuantity, endingQuantity: quantity });
  }
  return rows;
}


export function dividendFrequencyLabel(ticker) {
  const months = DIVIDEND_MONTHS[ticker];
  if (!months) return "분기";
  if (months.length === 12) return "월배당";
  if (months.length === 4) return "분기";
  if (months.length === 2) return "반기";
  if (months.length === 1) return "연 1회";
  return `연 ${months.length}회`;
}

export function dividendMonthsForTicker(ticker) {
  return DIVIDEND_MONTHS[ticker] || [3, 6, 9, 12];
}

export function consolidatedHoldings(ownerId, typeFilter) {
  const all = replayHoldings(ownerId).filter((h) => h.quantity > 0.00000001);
  if (typeFilter) return all.filter((h) => h.type === typeFilter);
  return all;
}

// Finnhub 이력 기반 예측(dividendForecast)이 있는 종목은 그 값으로,
// 없는 종목은 기존 정적 지급월 맵(DIVIDEND_MONTHS)으로 배당 주기 라벨을 표시한다.
export function dividendFrequencyLabelForTicker(ticker, forecast) {
  return frequencyLabelFromForecast(forecast) || dividendFrequencyLabel(ticker);
}

// 보유 종목별 예측 배당 지급을 실제 지급 예정월(1~12)로 분류한다.
// 정적으로 연간 배당을 12로 균등 분할하던 예전 방식과 달리, 종목별 실제
// 지급 패턴(월배당/분기배당 등 금액이 다를 수 있음)을 그대로 반영한다.
//
// 각 항목에는 캘린더 화면에서 펼쳐 보이는 산출근거(보유수량 x 주당 배당금 -
// 세금 15%, 달러/원화 둘 다)에 필요한 필드를 그대로 실어 보낸다.
export function dividendPayoutsByMonth(ownerId) {
  const holdings = consolidatedHoldings(ownerId).filter((h) => h.dividendForecast?.length);
  const monthlyTotals = new Array(12).fill(0);
  const monthlyItems = Array.from({ length: 12 }, () => []);

  holdings.forEach((holding) => {
    holding.dividendForecast.forEach((payout) => {
      const monthIndex = Number(payout.payDate.slice(5, 7)) - 1;
      const beforeTaxUsd = holding.quantity * payout.amountPerShare;
      const afterTaxUsd = beforeTaxUsd * (1 - DIVIDEND_TAX_RATE);
      const amountAfterTax = afterTaxUsd * holding.currentFx;
      monthlyTotals[monthIndex] += amountAfterTax;
      monthlyItems[monthIndex].push({
        ticker: holding.ticker,
        name: holding.name,
        amount: amountAfterTax,
        payDate: payout.payDate,
        estimated: payout.estimated,
        quantity: holding.quantity,
        amountPerShare: payout.amountPerShare,
        fx: holding.currentFx,
        beforeTaxUsd,
        afterTaxUsd
      });
    });
  });

  return { monthlyTotals, monthlyItems, dividendHoldingsCount: holdings.length };
}

// 가장 가까운 예상 배당 지급 1건 (실제 지급 예정일 기준, 투자자 화면용).
export function nextDividendPayout(ownerId) {
  const holdings = consolidatedHoldings(ownerId).filter((h) => h.dividendForecast?.length);
  let best = null;
  holdings.forEach((holding) => {
    holding.dividendForecast.forEach((payout) => {
      if (!best || payout.payDate < best.payDate) {
        best = {
          ticker: holding.ticker,
          payDate: payout.payDate,
          estimated: payout.estimated,
          amountAfterTax: holding.quantity * payout.amountPerShare * holding.currentFx * (1 - DIVIDEND_TAX_RATE)
        };
      }
    });
  });
  return best;
}
