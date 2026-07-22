import { populateOwnerSelects } from "../forms/common.js";
import { renderAllocation, renderDashboard } from "./dashboard.js";
import { renderDividendCalendar, renderDividendSimulation } from "./dividend.js";
import { renderHoldings, renderHoldingsPreview, renderHoldingsView } from "./holdings.js";
import { renderInvestorSheet, renderInvestorTabs } from "./investor.js";
import { renderView } from "./layout.js";
import { renderIndexMonitor, renderInvestorComparison, renderMarket } from "./market.js";
import { renderFx, renderMarketStatus } from "./status.js";
import { renderLedgerPreview, renderTransactions } from "./transactions.js";
import { renderTrend } from "./trend.js";

export let _renderRafId = null;
export function render() {
  if (_renderRafId) return;
  _renderRafId = requestAnimationFrame(() => {
    _renderRafId = null;
    renderView();
    renderDashboard();
    renderAllocation();
    renderMarket();
    renderIndexMonitor();
    renderInvestorComparison();
    renderInvestorTabs();
    renderInvestorSheet();
    renderHoldings();
    renderHoldingsPreview();
    renderHoldingsView();
    renderTransactions();
    renderLedgerPreview();
    renderTrend();
    renderFx();
    renderMarketStatus();
    populateOwnerSelects();
    renderDividendSimulation();
    renderDividendCalendar();
  });
}

export function openDialog(dialog) {
  if (typeof dialog.showModal === "function") dialog.showModal();
}
