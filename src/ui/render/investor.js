import { DIVIDEND_MONTHS } from "../../config/catalog.js";
import { DIVIDEND_TAX_RATE } from "../../config/constants.js";
import { formatCompact, money, pct, signedMoney } from "../../core/format.js";
import { getAllocationSlices } from "../../domain/allocation.js";
import { investorById, replayHoldings, summarize, tradeAmountKrw } from "../../domain/portfolio.js";
import { state } from "../../state/store.js";
import { setMoneyElement, setSignedMoneyElement } from "../dom.js";
import { renderDeleteConfirm } from "./layout.js";
import { renderTradePreview } from "../forms/common.js";
import { populateQuickTradeTicker } from "../forms/quick-trade.js";
import { renderDonutInto, wireAllocationInteractions } from "./dashboard.js";
import { renderCashflows, visibleTransactions } from "./transactions.js";

export function renderInvestorTabs() {
  const tabs = document.querySelector("#investorTabs");
  tabs.innerHTML = "";
  state.investors.forEach((investor) => {
    const summary = summarize(investor.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `investor-chip ${investor.id === state.selectedInvestorId ? "active" : ""}`;
    button.dataset.investorId = investor.id;
    button.innerHTML = `<span class="chip-initial">${investor.initials}</span><span class="chip-name">${investor.name}</span><span class="tab-balance">${formatCompact(summary.totalValue)}</span>`;
    tabs.appendChild(button);
  });
}

export function renderInvestorSheet() {
  const investor = investorById(state.selectedInvestorId);
  const summary = summarize(investor.id);
  document.querySelector("#selectedInvestorLabel").textContent = `${investor.name}님의 평가금액`;
  const editNameInput = document.querySelector("#editInvestorNameInput");
  if (editNameInput && document.activeElement !== editNameInput) editNameInput.value = investor.name;
  setMoneyElement("#investorValue", summary.totalValue);
  document.querySelector("#investorProfit").textContent = signedMoney(summary.profit);
  document.querySelector("#investorProfit").className = summary.profit >= 0 ? "positive" : "negative";
  document.querySelector("#investorReturn").textContent = `수익률 ${summary.returnRate >= 0 ? "+" : ""}${pct(summary.returnRate)}`;
  document.querySelector("#investorHoldingsCount").textContent = `${summary.holdings.length}개 종목`;
  setMoneyElement("#investorPrincipal", summary.principal);
  setSignedMoneyElement("#investorStatProfit", summary.profit);
  document.querySelector("#investorStatProfit").className = summary.profit >= 0 ? "positive" : "negative";
  document.querySelector("#investorReturnRate").textContent = `${summary.returnRate >= 0 ? "+" : ""}${pct(summary.returnRate)}`;
  setMoneyElement("#investorDividendAfterTax", summary.dividendAfterTax);
  document.querySelector("#investorDividendDetail").textContent = `세전 ${money(summary.dividend)} · 세금 ${money(summary.tax)}`;
  setMoneyElement("#investorCash", summary.cash);
  document.querySelector("#deleteInvestorButton").disabled = state.investors.length <= 1;
  renderDeleteConfirm();
  renderInvestorAllocation();
  renderInvestorHoldingsPreview();
  renderUpcomingDividend();
  renderInvestorProfitBreakdown();
  renderInvestorActivityTimeline();
  populateQuickTradeTicker();
  renderCashflows();
  renderTradePreview();
}

export function renderInvestorAllocation() {
  const { slices, totalValue } = getAllocationSlices(state.selectedInvestorId);
  renderDonutInto(
    "#investorAllocationDonut",
    "#investorAllocationLegend",
    {
      label: "#investorAllocationCenterLabel",
      pct: "#investorAllocationCenterPct",
      amt: "#investorAllocationCenterAmt"
    },
    slices,
    totalValue
  );
  wireAllocationInteractions(
    slices,
    totalValue,
    "#investorAllocationDonut",
    "#investorAllocationLegend",
    "#investorAllocationCenterLabel",
    "#investorAllocationCenterPct",
    "#investorAllocationCenterAmt"
  );
}

export function renderInvestorHoldingsPreview() {
  const list = document.querySelector("#investorHoldingsPreview");
  if (!list) return;
  const holdings = replayHoldings(state.selectedInvestorId)
    .slice()
    .sort((a, b) => b.valueKrw - a.valueKrw);
  if (!holdings.length) {
    list.innerHTML = `<p class="empty-hint">보유 종목이 없습니다.</p>`;
    return;
  }
  const nativePrice = (currency, value) =>
    currency === "USD"
      ? `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
      : `${Math.round(value).toLocaleString("ko-KR")}원`;
  const krw = (value) => Math.round(value).toLocaleString("ko-KR");
  const rows = holdings
    .map((item) => {
      const cost = item.costKrw || item.valueKrw - item.profit;
      const ret = cost ? (item.profit / cost) * 100 : 0;
      const tone = item.profit >= 0 ? "up" : "down";
      const qtyText = Number(item.quantity).toLocaleString("en-US", { maximumFractionDigits: 8 });
      return `
        <tr>
          <td class="ih-name"><strong>${item.ticker}</strong><small>${item.type} · ${item.currency}</small></td>
          <td class="ih-num">${qtyText}</td>
          <td class="ih-num">${nativePrice(item.currency, item.avgPrice)}<small>→ ${nativePrice(item.currency, item.currentPrice)}</small></td>
          <td class="ih-num">${krw(item.valueKrw)}</td>
          <td class="ih-num ${tone}">${item.profit >= 0 ? "+" : "-"}${krw(Math.abs(item.profit))}<small class="${tone}">${ret >= 0 ? "+" : ""}${ret.toFixed(1)}%</small></td>
          <td class="ih-edit"><button type="button" class="ih-edit-btn" data-edit-holding="${item.ticker}" title="거래 수정" aria-label="${item.ticker} 거래 수정">수정</button></td>
        </tr>`;
    })
    .join("");
  list.innerHTML = `
    <table class="inv-holdings-table">
      <thead>
        <tr>
          <th>종목</th>
          <th class="ih-num">수량</th>
          <th class="ih-num">평단 → 현재가</th>
          <th class="ih-num">평가금액<small>KRW</small></th>
          <th class="ih-num">손익 / 수익률</th>
          <th class="ih-edit" aria-label="수정"></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function renderUpcomingDividend() {
  const el = document.querySelector("#investorUpcomingDividend");
  if (!el) return;
  const holdings = replayHoldings(state.selectedInvestorId).filter((item) => item.annualDividend > 0);
  const currentMonth = new Date().getMonth() + 1;
  let best = null;
  holdings.forEach((item) => {
    const months = DIVIDEND_MONTHS[item.ticker] || [];
    months.forEach((month) => {
      const diff = month >= currentMonth ? month - currentMonth : month + 12 - currentMonth;
      if (!best || diff < best.diff) {
        best = {
          ticker: item.ticker,
          diff,
          perPayment: (item.annualDividend / months.length) * (1 - DIVIDEND_TAX_RATE)
        };
      }
    });
  });
  const summary = summarize(state.selectedInvestorId);
  if (!best) {
    el.innerHTML = `<p class="empty-hint">예정된 배당이 없습니다.</p>`;
    return;
  }
  el.innerHTML = `
    <div class="investor-kpi-line"><strong>${best.ticker}</strong><span>약 D-${best.diff * 30}</span></div>
    <div class="investor-kpi-value positive">${signedMoney(best.perPayment)}</div>
    <small class="muted">연간 예상 세후 배당 ${money(summary.dividendAfterTax)}</small>
  `;
}

export function renderInvestorProfitBreakdown() {
  const el = document.querySelector("#investorProfitBreakdown");
  if (!el) return;
  const holdings = replayHoldings(state.selectedInvestorId);
  const stockProfit = holdings.reduce((sum, item) => sum + (item.stockProfit || 0), 0);
  const fxProfit = holdings.reduce((sum, item) => sum + (item.fxProfit || 0), 0);
  const summary = summarize(state.selectedInvestorId);
  const rows = [
    ["주가", stockProfit],
    ["환차", fxProfit],
    ["배당", summary.dividendAfterTax]
  ];
  el.innerHTML = rows
    .map(([label, value]) => `
      <div class="breakdown-row">
        <span>${label}</span>
        <strong class="${value >= 0 ? "positive" : "negative"}">${signedMoney(value)}</strong>
      </div>
    `)
    .join("");
}

export function renderInvestorActivityTimeline() {
  const list = document.querySelector("#investorActivity");
  if (!list) return;
  const items = visibleTransactions().slice(0, 8);
  if (!items.length) {
    list.innerHTML = `<p class="empty-hint">활동 내역이 없습니다.</p>`;
    return;
  }
  list.innerHTML = items
    .map((item) => {
      const isCashflow = item.kind === "cashflow";
      const label = isCashflow ? (item.type === "deposit" ? "입금" : "출금") : item.side === "buy" ? "매수" : "매도";
      const tone = isCashflow ? "cash" : item.side === "buy" ? "buy" : "sell";
      const detail = isCashflow ? (item.memo ? ` · ${item.memo}` : "") : ` · ${item.ticker}`;
      const amount = isCashflow ? item.amount : tradeAmountKrw(item);
      return `
        <div class="activity-row">
          <span><i class="activity-badge ${tone}">${label}</i>${item.date}${detail}</span>
          <strong>${money(amount)}</strong>
        </div>
      `;
    })
    .join("");
}
