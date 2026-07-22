import { ALLOCATION_ORDER, allocationColors, fallbackColors } from "../config/constants.js";
import { pct } from "../core/format.js";
import { replayHoldings, summarize } from "./portfolio.js";

export function getAllocationSlices(ownerId) {
  const holdings = replayHoldings(ownerId);
  const summary = summarize(ownerId);
  const totals = {};

  holdings.forEach((item) => {
    totals[item.type] = (totals[item.type] || 0) + item.valueKrw;
  });
  if (summary.cash > 0) totals["예수금"] = summary.cash;

  const slices = ALLOCATION_ORDER
    .filter((key) => totals[key] > 0)
    .map((key) => ({
      key,
      amount: totals[key],
      pct: summary.totalValue > 0 ? (totals[key] / summary.totalValue) * 100 : 0,
      color: allocationColors[key] || fallbackColors[0]
    }));

  return { slices, totalValue: summary.totalValue };
}
