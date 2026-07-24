import { ALLOCATION_ORDER, allocationColors, fallbackColors } from "../../config/constants.js";
import { money, pct, signedMoney, usdFormatter } from "../../core/format.js";
import { getAllocationSlices } from "../../domain/allocation.js";
import { replayHoldings, summarize } from "../../domain/portfolio.js";
import { state } from "../../state/store.js";
import { setMoneyElement, smoothTextUpdate } from "../dom.js";
import { renderView, visibleOwnerId } from "./layout.js";
import { uiState } from "../uistate.js";

export function renderDashboard() {
  const summary = summarize();
  const totalProfit = document.querySelector("#totalProfit");
  setMoneyElement("#totalValue", summary.totalValue);
  setMoneyElement("#totalPrincipal", summary.principal);
  const profitText = signedMoney(summary.profit);
  if (totalProfit.textContent !== profitText) {
    totalProfit.style.transition = "opacity 180ms ease";
    totalProfit.style.opacity = "0.4";
    requestAnimationFrame(() => {
      totalProfit.textContent = profitText;
      totalProfit.className = summary.profit >= 0 ? "positive" : "negative";
      requestAnimationFrame(() => { totalProfit.style.opacity = "1"; });
    });
  }
  smoothTextUpdate("#profitRate", `수익률 ${summary.returnRate >= 0 ? "+" : ""}${pct(summary.returnRate)}`);
  smoothTextUpdate("#totalDividend", `총배당 ${money(summary.dividend)}`);
  setMoneyElement("#cashAmount", summary.cashKrw);
  smoothTextUpdate("#cashRatio", `외화 ${usdFormatter.format(summary.cashUsd)} · 평가금액 포함 ${pct(summary.totalValue ? (summary.cash / summary.totalValue) * 100 : 0)}`);
}

export function renderAllocation() {
  const ownerId = visibleOwnerId();
  const { slices, totalValue } = getAllocationSlices(ownerId);
  renderDonutInto(
    "#allocationDonut",
    "#allocationLegend",
    { label: "#allocationCenterLabel", pct: "#allocationCenterPct", amt: "#allocationCenterAmt" },
    slices,
    totalValue
  );
  renderAllocationInvestorBreakdown();
  wireAllocationInteractions(
    slices,
    totalValue,
    "#allocationDonut",
    "#allocationLegend",
    "#allocationCenterLabel",
    "#allocationCenterPct",
    "#allocationCenterAmt"
  );
}

export function renderAllocationDonut(slices, totalValue) {
  renderDonutInto(
    "#allocationDonut",
    null,
    { label: "#allocationCenterLabel", pct: "#allocationCenterPct", amt: "#allocationCenterAmt" },
    slices,
    totalValue
  );
}

export function renderDonutInto(svgSelector, legendSelector, centerSelectors, slices, totalValue) {
  const svg = document.querySelector(svgSelector);
  if (!svg) return;
  const r = 40;
  const circumference = 2 * Math.PI * r;
  let cursor = 0;
  const segmentsSvg = slices
    .map((slice) => {
      const length = (slice.pct / 100) * circumference;
      const dasharray = `${length.toFixed(2)} ${(circumference - length).toFixed(2)}`;
      const rotate = -90 + (cursor / 100) * 360;
      cursor += slice.pct;
      return `<circle class="donut-seg" data-key="${slice.key}" data-amt="${Math.round(slice.amount)}" data-pct="${slice.pct.toFixed(3)}" stroke="${slice.color}" cx="50" cy="50" r="${r}" fill="none" stroke-width="16" stroke-dasharray="${dasharray}" transform="rotate(${rotate.toFixed(2)} 50 50)"></circle>`;
    })
    .join("");
  svg.innerHTML = `<circle cx="50" cy="50" r="${r}" fill="none" stroke="#1C1C25" stroke-width="16"></circle>${segmentsSvg}`;

  if (legendSelector) {
    renderAllocationLegend(slices, legendSelector);
  }

  if (centerSelectors) {
    const centerAmt = document.querySelector(centerSelectors.amt);
    const centerPct = document.querySelector(centerSelectors.pct);
    const centerLabel = document.querySelector(centerSelectors.label);
    if (centerLabel) centerLabel.textContent = "전체";
    if (centerPct) centerPct.textContent = totalValue > 0 ? "100.0%" : "0.0%";
    if (centerAmt) centerAmt.textContent = money(totalValue);
  }
}

export function renderAllocationLegend(slices, selector = "#allocationLegend") {
  const legend = document.querySelector(selector);
  if (!legend) return;
  legend.innerHTML = slices
    .map((slice) => `
      <div class="leg-row" data-key="${slice.key}">
        <span class="leg-label">
          <i class="swatch" style="background:${slice.color}"></i>${slice.key}
        </span>
        <span class="leg-value">${slice.pct.toFixed(3)}%</span>
      </div>
    `)
    .join("");
}

export function renderAllocationInvestorBreakdown() {
  const container = document.querySelector("#allocationInvestorBreakdown");
  if (!container) return;
  container.innerHTML = state.investors
    .map((investor) => {
      const myHoldings = replayHoldings(investor.id);
      const mySummary = summarize(investor.id);
      const myTotals = {};
      myHoldings.forEach((item) => {
        myTotals[item.type] = (myTotals[item.type] || 0) + item.valueKrw;
      });
      if (mySummary.cash > 0) myTotals["예수금"] = mySummary.cash;
      const segments = ALLOCATION_ORDER
        .filter((key) => myTotals[key] > 0)
        .map((key) => {
          const ratio = mySummary.totalValue > 0 ? (myTotals[key] / mySummary.totalValue) * 100 : 0;
          return `<div class="ibar-seg" style="width:${ratio.toFixed(2)}%;background:${allocationColors[key] || fallbackColors[0]}" title="${key} ${ratio.toFixed(1)}%"></div>`;
        })
        .join("");
      return `
        <div class="investor-bar-row">
          <div class="investor-bar-head"><span style="font-weight:600">${investor.name}</span><span class="muted">${money(mySummary.totalValue)}</span></div>
          <div class="investor-bar-track">${segments}</div>
        </div>
      `;
    })
    .join("");
}

export function wireAllocationInteractions(
  slices,
  totalValue,
  svgSelector = "#allocationDonut",
  legendSelector = "#allocationLegend",
  centerLabelSelector = "#allocationCenterLabel",
  centerPctSelector = "#allocationCenterPct",
  centerAmtSelector = "#allocationCenterAmt"
) {
  const segments = document.querySelectorAll(`${svgSelector} .donut-seg`);
  const rows = document.querySelectorAll(`${legendSelector} .leg-row`);
  const centerLabel = document.querySelector(centerLabelSelector);
  const centerPct = document.querySelector(centerPctSelector);
  const centerAmt = document.querySelector(centerAmtSelector);

  function setCenter(key) {
    if (!centerLabel || !centerPct || !centerAmt) return;
    if (!key) {
      centerLabel.textContent = "전체";
      centerPct.textContent = totalValue > 0 ? "100.0%" : "0.0%";
      centerAmt.textContent = money(totalValue);
      return;
    }
    const slice = slices.find((item) => item.key === key);
    if (!slice) return;
    centerLabel.textContent = slice.key;
    centerPct.textContent = `${slice.pct.toFixed(1)}%`;
    centerAmt.textContent = money(slice.amount);
  }

  function highlight(key) {
    segments.forEach((segment) => {
      const active = segment.dataset.key === key;
      segment.style.strokeWidth = active ? "19" : "16";
      segment.style.opacity = key && !active ? "0.35" : "1";
      segment.style.filter = active ? "drop-shadow(0 0 9px rgba(157, 123, 255, 0.36))" : "";
    });
    rows.forEach((row) => row.classList.toggle("hl", row.dataset.key === key));
    setCenter(key);
  }

  segments.forEach((segment) => {
    segment.addEventListener("mouseenter", () => highlight(segment.dataset.key));
    segment.addEventListener("mouseleave", () => highlight(null));
    segment.addEventListener("click", () => filterHoldingsByType(segment.dataset.key));
  });
  rows.forEach((row) => {
    row.addEventListener("mouseenter", () => highlight(row.dataset.key));
    row.addEventListener("mouseleave", () => highlight(null));
    row.addEventListener("click", () => filterHoldingsByType(row.dataset.key));
  });
}

export function filterHoldingsByType(type) {
  const table = document.querySelector("#holdingsTable");
  if (!table) return;
  uiState.holdingsTypeFilter = type;
  uiState.ledgerExpanded = true;
  renderView();
  table.querySelectorAll("tr").forEach((row) => {
    if (row.dataset.type) row.style.display = row.dataset.type === type ? "" : "none";
  });
  const banner = document.querySelector("#holdingsFilterBanner");
  if (banner) {
    banner.classList.add("active");
    const label = banner.querySelector("#holdingsFilterLabel");
    if (label) label.textContent = `${type} 종목만 표시 중`;
  }
  document.querySelector("#holdings")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function clearHoldingsFilter() {
  uiState.holdingsTypeFilter = null;
  const table = document.querySelector("#holdingsTable");
  if (table) {
    table.querySelectorAll("tr").forEach((row) => {
      row.style.display = "";
    });
  }
  const banner = document.querySelector("#holdingsFilterBanner");
  if (banner) banner.classList.remove("active");
}
