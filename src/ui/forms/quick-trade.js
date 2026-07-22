import { money, qty } from "../../core/format.js";
import { commitTrade } from "../../domain/actions.js";
import { computeAveragingPreview, replayHoldings } from "../../domain/portfolio.js";
import { currentUsdKrw, state } from "../../state/store.js";
import { showToast } from "../dom.js";
import { populateOwnerSelects, renderTradePreview } from "./common.js";
import { quickTradeAsset, shouldShowQuickTradeFx } from "./new-asset.js";
import { openDialog } from "../render/index.js";
import { setTradeDialogMode } from "../trade-dialog.js";
import { uiState } from "../uistate.js";

export function populateQuickTradeTicker() {
  const select = document.querySelector("#quickTradeTicker");
  if (!select) return;
  const current = select.value;
  const holdings = replayHoldings(state.selectedInvestorId);
  select.innerHTML = holdings.length
    ? holdings.map((item) => `<option value="${item.ticker}">${item.ticker} · ${item.name || item.ticker}</option>`).join("")
    : `<option value="">보유 종목 없음</option>`;
  if (holdings.some((item) => item.ticker === current)) select.value = current;
  updateQuickTradeDefaults();
}

export function updateQuickTradeDefaults() {
  const asset = quickTradeAsset();
  const fxRow = document.querySelector("#quickTradeFxRow");
  const fxInput = document.querySelector("#quickTradeFx");
  const fxLabel = document.querySelector("#quickTradeFxLabel");
  const priceInput = document.querySelector("#quickTradePrice");
  const submit = document.querySelector("#quickTradeSubmit");
  if (!fxInput || !priceInput) return;
  if (fxLabel) fxLabel.textContent = uiState.quickTradeSide === "buy" ? "매입환율" : "매도환율";
  if (!asset) {
    if (fxRow) fxRow.style.display = "none";
    if (submit) submit.disabled = true;
    renderQuickTradePreview();
    return;
  }
  if (submit) submit.disabled = false;
  if (fxRow) fxRow.style.display = shouldShowQuickTradeFx(asset) ? "" : "none";
  if (!fxInput.value) fxInput.value = asset.currency === "KRW" ? 1 : Math.round(asset.currentFx || currentUsdKrw());
  if (!priceInput.value) priceInput.value = asset.currentPrice || "";
  renderQuickTradePreview();
}

export function renderQuickTradePreview() {
  const preview = document.querySelector("#quickTradePreview");
  if (!preview) return;
  const ticker = document.querySelector("#quickTradeTicker")?.value;
  const asset = quickTradeAsset();
  const quantity = Number(document.querySelector("#quickTradeQty")?.value) || 0;
  const price = Number(document.querySelector("#quickTradePrice")?.value) || 0;
  if (!ticker || !asset || !quantity || !price) {
    preview.hidden = true;
    return;
  }
  const fxInput = Number(document.querySelector("#quickTradeFx")?.value) || 0;
  const fx = asset.currency === "KRW" ? 1 : shouldShowQuickTradeFx(asset) ? fxInput || asset.currentFx || currentUsdKrw() : currentUsdKrw();
  const result = computeAveragingPreview({
    ownerId: state.selectedInvestorId,
    side: uiState.quickTradeSide,
    ticker,
    quantity,
    price,
    fx,
    currency: asset.currency,
    currentFx: asset.currency === "KRW" ? 1 : asset.currentFx || fx,
    currentPrice: asset.currentPrice || price
  });
  preview.hidden = false;
  if (uiState.quickTradeSide === "sell") {
    preview.innerHTML = `<strong>매도 미리보기</strong><span>${result.text}</span>`;
    return;
  }
  preview.innerHTML = `
    <strong>물타기 미리보기</strong>
    <span>평단 ${money((result.beforeAvgPrice || 0) * (result.beforeAvgFx || fx))} → ${money((result.afterAvgPrice || 0) * (result.afterAvgFx || fx))}</span>
    <span>평균환율 ${qty(result.beforeAvgFx || fx)} → ${qty(result.afterAvgFx || fx)}</span>
  `;
}

export function setQuickTradeSide(side) {
  uiState.quickTradeSide = side;
  const buyBtn = document.querySelector("#quickTradeBuy");
  const sellBtn = document.querySelector("#quickTradeSell");
  buyBtn.classList.toggle("active", side === "buy");
  buyBtn.classList.toggle("buy", side === "buy");
  sellBtn.classList.toggle("active", side === "sell");
  sellBtn.classList.toggle("sell", side === "sell");
  document.querySelector("#quickTradeSubmit").textContent = side === "buy" ? "매수 추가" : "매도 추가";
  const fxLabel = document.querySelector("#quickTradeFxLabel");
  if (fxLabel) fxLabel.textContent = side === "buy" ? "매입환율" : "매도환율";
  renderQuickTradePreview();
}

export function resetQuickTradeInputs() {
  document.querySelector("#quickTradeQty").value = "";
  document.querySelector("#quickTradePrice").value = "";
  document.querySelector("#quickTradeFx").value = "";
  document.querySelector("#quickTradePreview").hidden = true;
  updateQuickTradeDefaults();
}

export function setupQuickTrade() {
  document.querySelector("#quickTradeBuy").addEventListener("click", () => setQuickTradeSide("buy"));
  document.querySelector("#quickTradeSell").addEventListener("click", () => setQuickTradeSide("sell"));
  document.querySelector("#quickTradeTicker").addEventListener("change", updateQuickTradeDefaults);
  ["#quickTradeQty", "#quickTradePrice", "#quickTradeFx"].forEach((selector) => {
    document.querySelector(selector).addEventListener("input", renderQuickTradePreview);
  });
  document.querySelector("#quickTradeSubmit").addEventListener("click", () => {
    const ticker = document.querySelector("#quickTradeTicker").value;
    const asset = quickTradeAsset();
    const quantity = Number(document.querySelector("#quickTradeQty").value) || 0;
    const price = Number(document.querySelector("#quickTradePrice").value) || 0;
    if (!ticker || !asset || !quantity || !price) {
      showToast("보유 종목, 수량, 체결가를 입력하세요.", "error");
      return;
    }
    const fxInput = Number(document.querySelector("#quickTradeFx").value) || 0;
    const fx = asset.currency === "KRW" ? 1 : shouldShowQuickTradeFx(asset) ? fxInput || asset.currentFx || currentUsdKrw() : currentUsdKrw();
    const result = commitTrade({
      ownerId: state.selectedInvestorId,
      side: uiState.quickTradeSide,
      ticker,
      name: asset.name,
      type: asset.type,
      currency: asset.currency,
      quantity,
      price,
      fx,
      currentPrice: asset.currentPrice || price,
      currentFx: asset.currency === "KRW" ? 1 : asset.currentFx || fx,
      date: new Date().toISOString().slice(0, 10),
      memo: "빠른 입력"
    });
    if (!result.ok) {
      showToast(result.message, "error");
      return;
    }
    resetQuickTradeInputs();
    showToast(`${ticker} ${uiState.quickTradeSide === "buy" ? "매수" : "매도"} 거래를 추가했습니다.`);
  });
  document.querySelector("#openTradeModalLink").addEventListener("click", (event) => {
    event.preventDefault();
    const form = document.querySelector("#tradeForm");
    form.reset();
    setTradeDialogMode("add");
    populateOwnerSelects();
    form.elements.ownerId.value = state.selectedInvestorId;
    form.elements.date.valueAsDate = new Date();
    form.elements.fx.value = currentUsdKrw();
    form.elements.currentFx.value = currentUsdKrw();
    renderTradePreview();
    openDialog(document.querySelector("#tradeDialog"));
  });
}
