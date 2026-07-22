import { DIVIDEND_MONTHS } from "../config/catalog.js";
import { DIVIDEND_TAX_RATE } from "../config/constants.js";
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
