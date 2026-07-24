import { SYNC_TOKEN_KEY } from "../config/constants.js";
import { addInvestorByName, commitTrade, deleteTrade, updateInvestorName, updateTrade } from "../domain/actions.js";
import { loadUsSymbols } from "../net/symbols.js";
import { storage } from "../state/persistence.js";
import { currentUsdKrw, saveState, state } from "../state/store.js";
import { getSyncToken, hydrateFromServer, setSyncStatus } from "../state/sync.js";
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
    closeMobileSidebar();
  });
});

const sidebarEl = document.querySelector("#sidebar");
const sidebarToggleButton = document.querySelector("#sidebarToggle");

function closeMobileSidebar() {
  if (!sidebarEl) return;
  sidebarEl.classList.remove("nav-open");
  sidebarToggleButton?.setAttribute("aria-expanded", "false");
}

sidebarToggleButton?.addEventListener("click", () => {
  const isOpen = sidebarEl.classList.toggle("nav-open");
  sidebarToggleButton.setAttribute("aria-expanded", String(isOpen));
});

// 데스크톱(>1120px)에서는 모바일 전용 <details> 아코디언(코인 시세/주요 지수)이
// 항상 펼쳐져 보여야 한다. CSS의 display 오버라이드만으로는 부족했다 — 최신
// 크롬은 닫힌 details 내부를 content-visibility:hidden 으로도 숨겨서, DOM엔
// 내용이 있어도 화면엔 빈 패널로 보이는 사고가 있었다(2026-07-24). [open]
// 속성을 실제로 붙이는 쪽이 브라우저 구현에 안 흔들리는 확실한 방법이다.
function syncCollapsiblesForViewport() {
  if (!window.matchMedia("(min-width: 1121px)").matches) return;
  document.querySelectorAll(".mobile-collapsible:not([open])").forEach((el) => el.setAttribute("open", ""));
}
syncCollapsiblesForViewport();
window.addEventListener("resize", syncCollapsiblesForViewport);

document.querySelectorAll("[data-expand-ledger]").forEach((link) => {
  link.addEventListener("click", (event) => {
    const isNavShortcut = link.dataset.navExpandLedger !== undefined;
    if (isNavShortcut) {
      event.preventDefault();
      if (!["dashboard", "investor"].includes(state.selectedView)) {
        state.selectedView = "dashboard";
        saveState({ snapshot: false });
      }
    }
    uiState.ledgerExpanded = true;
    renderView();
    if (isNavShortcut) {
      document.querySelector("#transactions")?.scrollIntoView({ behavior: "smooth", block: "start" });
      closeMobileSidebar();
    }
  });
});

document.querySelector("#collapseLedgerButton").addEventListener("click", () => {
  uiState.ledgerExpanded = false;
  renderView();
});

// 투자자 시트 "신규 자산 등록" / "보유 종목 거래" 탭. 두 폼을 동시에 노출하면
// 필드가 12개 넘게 한 화면에 쌓여 입력 흐름이 헷갈려서 탭으로 분리했다.
function applyQuickTradeTab() {
  document.querySelectorAll("[data-quick-trade-tab]").forEach((tab) => {
    const active = tab.dataset.quickTradeTab === uiState.quickTradeTab;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-quick-trade-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.quickTradePanel !== uiState.quickTradeTab;
  });
}

document.querySelectorAll("[data-quick-trade-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    uiState.quickTradeTab = tab.dataset.quickTradeTab;
    applyQuickTradeTab();
  });
});

applyQuickTradeTab();

// 대시보드 모바일: 보유 종목/원장 내역 미리보기를 세로로 둘 다 쌓지 않고 탭으로 전환한다.
document.querySelector("#dashboardPreviewTabs")?.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-preview-tab]");
  if (!tab) return;
  const target = tab.dataset.previewTab;
  document.querySelector("#dashboardWorkspace").dataset.activePreview = target;
  document.querySelectorAll("#dashboardPreviewTabs [data-preview-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn === tab);
  });
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
  if (editBtn) {
    openHoldingTrades(state.selectedInvestorId, editBtn.dataset.editHolding);
    return;
  }
  const sortTh = event.target.closest("[data-sort-key]");
  if (!sortTh) return;
  const key = sortTh.dataset.sortKey;
  const current = uiState.holdingsPreviewSort;
  uiState.holdingsPreviewSort = current.key === key
    ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
    : { key, dir: "desc" };
  render();
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

document.querySelector("#syncSettingsButton").addEventListener("click", () => {
  document.querySelector("#syncTokenInput").value = getSyncToken();
  openDialog(document.querySelector("#syncSettingsDialog"));
});

document.querySelector("#saveSyncTokenButton").addEventListener("click", () => {
  const token = document.querySelector("#syncTokenInput").value.trim();
  if (token) {
    storage.setItem(SYNC_TOKEN_KEY, token);
    showToast("\uB3D9\uAE30\uD654 \uD1A0\uD070\uC744 \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uC11C\uBC84 \uB370\uC774\uD130\uC640 \uB3D9\uAE30\uD654\uD569\uB2C8\uB2E4.");
    hydrateFromServer();
  } else {
    storage.removeItem(SYNC_TOKEN_KEY);
  }
  document.querySelector("#syncSettingsDialog").close();
});

document.querySelector("#clearSyncTokenButton").addEventListener("click", () => {
  storage.removeItem(SYNC_TOKEN_KEY);
  document.querySelector("#syncTokenInput").value = "";
  showToast("\uB3D9\uAE30\uD654\uB97C \uD574\uC81C\uD588\uC2B5\uB2C8\uB2E4. \uC774 \uAE30\uAE30\uB294 \uB85C\uCEEC \uB370\uC774\uD130\uB9CC \uC0AC\uC6A9\uD569\uB2C8\uB2E4.");
  setSyncStatus("off", null);
  document.querySelector("#syncSettingsDialog").close();
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
