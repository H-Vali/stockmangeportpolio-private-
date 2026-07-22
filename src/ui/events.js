import { SCHEMA_VERSION } from "../config/constants.js";
import { dateFormatter } from "../core/format.js";
import { addInvestorByName, commitTrade, deleteTrade, updateInvestorName, updateTrade } from "../domain/actions.js";
import { refreshFxRate } from "../net/fx.js";
import { loadUsSymbols } from "../net/symbols.js";
import { clearPortfolioData, normalizeState } from "../state/schema.js";
import { currentUsdKrw, exportableState, saveState, setState, state, syncUsdAssetFx } from "../state/store.js";
import { validateImportState } from "../state/validate.js";
import { triggerDashboardChangeDemo } from "./demo.js";
import { showToast } from "./dom.js";
import { canWithdraw, populateOwnerSelects, renderTradePreview, updateAssetFieldsFromTicker } from "./forms/common.js";
import { clearHoldingsFilter } from "./render/dashboard.js";
import { renderDividendCalendar, renderDividendSimulation } from "./render/dividend.js";
import { holdingsDisplayCurrency, renderHoldingsView } from "./render/holdings.js";
import { openDialog, render } from "./render/index.js";
import { renderDeleteConfirm, renderView } from "./render/layout.js";
import { openHoldingTrades, openTradeEditor, setTradeDialogMode } from "./trade-dialog.js";
import { uiState } from "./uistate.js";

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    state.selectedView = button.dataset.view;
    saveState({ snapshot: false });
    render();
  });
});

document.querySelectorAll("[data-expand-ledger]").forEach((link) => {
  link.addEventListener("click", () => {
    uiState.ledgerExpanded = true;
    renderView();
  });
});

document.querySelector("#collapseLedgerButton").addEventListener("click", () => {
  uiState.ledgerExpanded = false;
  renderView();
});

document.querySelector("#clearHoldingsFilterButton").addEventListener("click", clearHoldingsFilter);

document.querySelector("#investorTabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-investor-id]");
  if (!button) return;
  state.selectedInvestorId = button.dataset.investorId;
  state.selectedView = "investor";
  state.pendingDeleteInvestorId = null;
  saveState({ snapshot: false });
  render();
});

document.querySelector("#addInvestorForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = event.currentTarget.elements.investorName;
  if (!input.value.trim()) return;
  addInvestorByName(input.value, { openSheet: true });
  input.value = "";
});

document.querySelector("#dashboardAddInvestorForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = event.currentTarget.elements.investorName;
  if (!input.value.trim()) return;
  addInvestorByName(input.value, { openSheet: false });
  input.value = "";
});

document.querySelector("#editInvestorNameForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = event.currentTarget.elements.investorName;
  const clean = input.value.trim();
  if (!clean) {
    showToast("투자자 이름을 입력하세요.", "error");
    return;
  }
  updateInvestorName(state.selectedInvestorId, clean);
});

document.querySelector("#heroMenuToggle").addEventListener("click", (event) => {
  event.stopPropagation();
  const dropdown = document.querySelector("#heroMenuDropdown");
  dropdown.hidden = !dropdown.hidden;
});

document.querySelector("#heroMenuDropdown").addEventListener("click", (event) => {
  event.stopPropagation();
});

document.addEventListener("click", () => {
  const dropdown = document.querySelector("#heroMenuDropdown");
  if (dropdown) dropdown.hidden = true;
});

document.querySelector("#deleteInvestorButton").addEventListener("click", () => {
  if (state.investors.length <= 1) return;
  document.querySelector("#heroMenuDropdown").hidden = true;
  state.pendingDeleteInvestorId = state.selectedInvestorId;
  renderDeleteConfirm();
});

document.querySelector("#cancelDeleteInvestor").addEventListener("click", () => {
  state.pendingDeleteInvestorId = null;
  renderDeleteConfirm();
});

document.querySelector("#confirmDeleteInvestor").addEventListener("click", () => {
  const id = state.pendingDeleteInvestorId;
  if (!id || state.investors.length <= 1) return;
  state.investors = state.investors.filter((investor) => investor.id !== id);
  state.trades = state.trades.filter((trade) => trade.ownerId !== id);
  state.cashflows = state.cashflows.filter((flow) => flow.ownerId !== id);
  state.selectedInvestorId = state.investors[0].id;
  state.pendingDeleteInvestorId = null;
  saveState();
  render();
});


document.querySelector("#cashflowForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const ownerId = form.elements.ownerId.value;
  const type = event.submitter?.dataset.cashflowType || "deposit";
  const amount = Number(form.elements.amount.value) || 0;
  if (!amount) return;
  if (type === "withdraw" && !canWithdraw(ownerId, amount)) {
    form.elements.amount.setCustomValidity("출금액이 예수금을 초과합니다.");
    form.reportValidity();
    form.elements.amount.setCustomValidity("");
    return;
  }
  state.cashflows.push({
    id: crypto.randomUUID(),
    ownerId,
    date: form.elements.date.value,
    type,
    amount,
    memo: form.elements.memo.value.trim()
  });
  form.reset();
  form.elements.date.valueAsDate = new Date();
  saveState();
  render();
});

document.querySelector("#openTradeForm").addEventListener("click", () => {
  loadUsSymbols();
  const form = document.querySelector("#tradeForm");
  form.reset();
  setTradeDialogMode("add");
  form.elements.date.valueAsDate = new Date();
  form.elements.fx.value = currentUsdKrw();
  form.elements.currentFx.value = currentUsdKrw();
  populateOwnerSelects();
  renderTradePreview();
  openDialog(document.querySelector("#tradeDialog"));
});

document.querySelector("#deleteTradeButton").addEventListener("click", () => {
  const button = document.querySelector("#deleteTradeButton");
  if (button.dataset.confirm !== "1") {
    button.dataset.confirm = "1";
    button.textContent = "삭제 확인";
    return;
  }
  const id = uiState.editingTradeId;
  button.dataset.confirm = "";
  button.textContent = "삭제";
  if (id) {
    deleteTrade(id);
    document.querySelector("#tradeDialog").close();
    showToast("거래를 삭제했습니다.");
  }
});

document.querySelector("#holdingTradesList").addEventListener("click", (event) => {
  const editBtn = event.target.closest("[data-edit-trade]");
  const delBtn = event.target.closest("[data-delete-trade]");
  if (editBtn) {
    document.querySelector("#holdingTradesDialog").close();
    openTradeEditor(editBtn.dataset.editTrade);
  } else if (delBtn) {
    deleteTrade(delBtn.dataset.deleteTrade);
    showToast("거래를 삭제했습니다.");
    document.querySelector("#holdingTradesDialog").close();
  }
});

document.querySelector("#investorHoldingsPreview").addEventListener("click", (event) => {
  const editBtn = event.target.closest("[data-edit-holding]");
  if (!editBtn) return;
  openHoldingTrades(state.selectedInvestorId, editBtn.dataset.editHolding);
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

document.querySelector("#tradeForm").addEventListener("input", (event) => {
  if (event.target.name === "ticker") updateAssetFieldsFromTicker(event.target.value);
  if (event.target.name === "currency" && event.target.value === "KRW") {
    event.currentTarget.elements.fx.value = 1;
    event.currentTarget.elements.currentFx.value = 1;
  }
  renderTradePreview();
});

document.querySelector("#tradeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    ownerId: form.elements.ownerId.value,
    date: form.elements.date.value,
    side: form.elements.side.value,
    ticker: form.elements.ticker.value,
    name: form.elements.name.value.trim(),
    type: form.elements.type.value,
    currency: form.elements.currency.value,
    quantity: Number(form.elements.quantity.value) || 0,
    price: Number(form.elements.price.value) || 0,
    fx: Number(form.elements.fx.value) || 1,
    currentPrice: Number(form.elements.currentPrice.value) || Number(form.elements.price.value) || 0,
    currentFx: form.elements.currency.value === "KRW" ? 1 : Number(form.elements.currentFx.value) || Number(form.elements.fx.value) || 1,
    memo: form.elements.memo.value.trim()
  };
  if (uiState.editingTradeId) {
    const result = updateTrade(uiState.editingTradeId, payload);
    if (!result.ok) {
      const field = form.elements[result.field || "ticker"];
      field.setCustomValidity(result.message);
      form.reportValidity();
      field.setCustomValidity("");
      return;
    }
    setTradeDialogMode("add");
    form.closest("dialog").close();
    showToast("거래를 수정했습니다.");
    return;
  }
  const result = commitTrade({
    ownerId: form.elements.ownerId.value,
    date: form.elements.date.value,
    side: form.elements.side.value,
    ticker: form.elements.ticker.value,
    name: form.elements.name.value.trim(),
    type: form.elements.type.value,
    currency: form.elements.currency.value,
    quantity: Number(form.elements.quantity.value) || 0,
    price: Number(form.elements.price.value) || 0,
    fx: Number(form.elements.fx.value) || 1,
    currentPrice: Number(form.elements.currentPrice.value) || Number(form.elements.price.value) || 0,
    currentFx: form.elements.currency.value === "KRW" ? 1 : Number(form.elements.currentFx.value) || Number(form.elements.fx.value) || 1,
    memo: form.elements.memo.value.trim()
  });
  if (!result.ok) {
    const field = form.elements[result.field || "ticker"];
    field.setCustomValidity(result.message);
    form.reportValidity();
    field.setCustomValidity("");
    return;
  }
  form.closest("dialog").close();
});

document.querySelector("#seedButton").addEventListener("click", () => {
  setState(clearPortfolioData(state));
  saveState();
  render();
  showToast("\uBCF4\uC720/\uC6D0\uC7A5 \uB370\uC774\uD130\uB97C \uCD08\uAE30\uD654\uD588\uC2B5\uB2C8\uB2E4.");
});

document.querySelector("#demoChangeButton").addEventListener("click", triggerDashboardChangeDemo);

document.querySelector("#exportButton").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(exportableState(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `assetpilot-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector("#importButton").addEventListener("click", () => {
  document.querySelector("#importFileInput").click();
});

document.querySelector("#importFileInput").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const errors = validateImportState(parsed);
    if (errors.length) {
      showToast(errors[0], "error");
      return;
    }
    if (parsed.schemaVersion && parsed.schemaVersion !== SCHEMA_VERSION) {
      showToast(`백업 스키마 v${parsed.schemaVersion}입니다. 경고 후 계속 진행할 수 있습니다.`);
    }
    uiState.pendingImportState = normalizeState(parsed);
    openDialog(document.querySelector("#confirmImportDialog"));
  } catch {
    showToast("JSON 파일을 읽을 수 없습니다.", "error");
  } finally {
    event.target.value = "";
  }
});

document.querySelector("#confirmImportButton").addEventListener("click", () => {
  if (!uiState.pendingImportState) return;
  uiState.importRollbackState = structuredClone(state);
  setState(uiState.pendingImportState);
  state.schemaVersion = SCHEMA_VERSION;
  uiState.pendingImportState = null;
  saveState();
  render();
  document.querySelector("#confirmImportDialog").close();
  showToast(`${dateFormatter.format(new Date())} 백업을 불러왔습니다.`);
});

document.querySelector("#undoImportButton").addEventListener("click", () => {
  if (!uiState.importRollbackState) return;
  setState(uiState.importRollbackState);
  uiState.importRollbackState = null;
  saveState();
  render();
  showToast("가져오기 전 상태로 되돌렸습니다.");
});

document.querySelector("#manualFxToggle").addEventListener("change", (event) => {
  state.fx.mode = event.target.checked ? "manual" : "auto";
  if (state.fx.mode === "manual") state.fx.source = "manual";
  saveState();
  render();
  refreshFxRate();
});

document.querySelector("#manualFxInput").addEventListener("change", (event) => {
  const value = Number(event.target.value);
  if (!value) return;
  state.fx.manualUsdkrw = value;
  state.fx.usdkrw = state.fx.mode === "manual" ? value : state.fx.usdkrw;
  // 코인은 제외한다. 코인은 USDT/KRW 로 환산하므로 수동 USD/KRW 를 덮어쓰면 안 된다.
  if (state.fx.mode === "manual") syncUsdAssetFx();
  saveState();
  render();
});

document.querySelector("#dividendSimForm").addEventListener("input", (event) => {
  if (event.target.name === "fx") event.target.dataset.touched = "true";
  if (event.target.name === "currency" && event.target.value === "KRW") {
    event.currentTarget.elements.fx.value = 1;
  }
  renderDividendSimulation();
});
document.querySelector("#toggleDividendDetail").addEventListener("click", () => {
  uiState.dividendDetailOpen = !uiState.dividendDetailOpen;
  renderDividendSimulation();
});
document.querySelector("#targetMonthlyDividend").addEventListener("input", renderDividendSimulation);
document.querySelector("#calendarTargetSelect").addEventListener("change", renderDividendCalendar);

document.querySelector("#holdingsViewOwnerSelect").addEventListener("change", renderHoldingsView);
document.querySelector("#holdingsViewTypeFilter").addEventListener("change", renderHoldingsView);
document.querySelector("#holdingsViewSortSelect").addEventListener("change", renderHoldingsView);
document.querySelector("#holdingsCurrencyToggle").addEventListener("click", () => {
  state.displayCurrency = holdingsDisplayCurrency() === "KRW" ? "USD" : "KRW";
  saveState({ snapshot: false });
  renderHoldingsView();
});
