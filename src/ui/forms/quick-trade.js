import { money, qty } from "../../core/format.js";
import { commitTrade } from "../../domain/actions.js";
import { computeAveragingPreview, replayHoldings } from "../../domain/portfolio.js";
import { findAssetLookupMatch, loadUsSymbols } from "../../net/symbols.js";
import { currentUsdKrw, state } from "../../state/store.js";
import { showToast } from "../dom.js";
import { populateOwnerSelects, renderTradePreview } from "./common.js";
import { openDialog } from "../render/index.js";
import { setTradeDialogMode } from "../trade-dialog.js";
import { uiState } from "../uistate.js";

function field(selector) {
  return document.querySelector(selector);
}

function isQuickTradeValid() {
  const ticker = field("#qtTicker")?.value.trim();
  const name = field("#qtName")?.value.trim();
  const currency = field("#qtCurrency")?.value;
  const quantity = Number(field("#qtQty")?.value);
  const price = Number(field("#qtPrice")?.value);
  const fx = Number(field("#qtFx")?.value);
  if (!ticker || !name || !quantity || quantity <= 0 || !price || price <= 0) return false;
  if (currency === "USD" && (!fx || fx <= 0)) return false;
  return true;
}

function applyQuickTradeLookup(asset) {
  if (!asset) return;
  const tickerInput = field("#qtTicker");
  const nameInput = field("#qtName");
  const typeInput = field("#qtType");
  const currencyInput = field("#qtCurrency");
  const priceInput = field("#qtPrice");
  const fxInput = field("#qtFx");
  if (tickerInput) tickerInput.value = asset.ticker;
  if (nameInput) nameInput.value = asset.name;
  if (typeInput && asset.type) typeInput.value = asset.type;
  if (currencyInput && asset.currency) currencyInput.value = asset.currency;
  if (priceInput && !priceInput.value && asset.currentPrice) priceInput.value = asset.currentPrice;
  if (fxInput && !fxInput.value && asset.currency === "USD") fxInput.value = Math.round(asset.currentFx || currentUsdKrw());
  updateQuickTradeFxVisibility();
  renderQuickTradePreview();
}

function updateQuickTradeFxVisibility() {
  const currency = field("#qtCurrency")?.value;
  const fxWrap = field("#qtFxWrap");
  const fxInput = field("#qtFx");
  if (fxWrap) fxWrap.style.display = currency === "USD" ? "" : "none";
  if (currency === "KRW" && fxInput) fxInput.value = 1;
  if (currency === "USD" && fxInput && !fxInput.value) fxInput.value = Math.round(currentUsdKrw());
  updateQuickTradeSubmitState();
}

function updateQuickTradeSubmitState() {
  const button = field("#qtSubmit");
  if (!button) return;
  button.classList.toggle("enabled", isQuickTradeValid());
  const registerHeld = uiState.quickTradeSide === "buy" && field("#qtRegisterHeld")?.checked === true;
  button.textContent = uiState.quickTradeSide === "sell" ? "매도 추가" : registerHeld ? "보유분 등록" : "매수 추가";
}

export function renderQuickTradePreview() {
  const preview = field("#qtPreview");
  if (!preview) return;
  const ticker = field("#qtTicker")?.value.trim().toUpperCase();
  const quantity = Number(field("#qtQty")?.value) || 0;
  const price = Number(field("#qtPrice")?.value) || 0;
  const currency = field("#qtCurrency")?.value;
  if (!ticker || !quantity || !price) {
    preview.hidden = true;
    return;
  }
  const known = state.assetCatalog[ticker];
  const fxInput = Number(field("#qtFx")?.value) || 0;
  const fx = currency === "KRW" ? 1 : fxInput || known?.currentFx || currentUsdKrw();
  const currentPrice = known?.currentPrice || price;
  const currentFx = currency === "KRW" ? 1 : known?.currentFx || fx;
  const result = computeAveragingPreview({
    ownerId: state.selectedInvestorId,
    side: uiState.quickTradeSide,
    ticker,
    quantity,
    price,
    fx,
    currency,
    currentFx,
    currentPrice
  });
  preview.hidden = false;
  if (uiState.quickTradeSide === "sell") {
    preview.innerHTML = `<strong>매도 미리보기</strong><span>${result.text}</span>`;
    return;
  }
  preview.innerHTML = `
    <strong>매수 미리보기</strong>
    <span>평단 ${money((result.beforeAvgPrice || 0) * (result.beforeAvgFx || fx))} → ${money((result.afterAvgPrice || 0) * (result.afterAvgFx || fx))}</span>
    <span>평균환율 ${qty(result.beforeAvgFx || fx)} → ${qty(result.afterAvgFx || fx)}</span>
  `;
}

export function setQuickTradeSide(side) {
  uiState.quickTradeSide = side;
  const buyBtn = field("#qtBuy");
  const sellBtn = field("#qtSell");
  buyBtn.classList.toggle("active", side === "buy");
  buyBtn.classList.toggle("buy", side === "buy");
  sellBtn.classList.toggle("active", side === "sell");
  sellBtn.classList.toggle("sell", side === "sell");
  const fxLabel = field("#qtFxLabel");
  if (fxLabel) fxLabel.textContent = side === "buy" ? "매입환율" : "매도환율";
  const registerRow = field("#qtRegisterHeldRow");
  if (registerRow) registerRow.style.display = side === "buy" ? "" : "none";
  updateQuickTradeSubmitState();
  renderQuickTradePreview();
}

// 투자자 시트 진입/전환마다 호출된다. 과거엔 보유 종목만 담긴 select였지만
// 통합 폼에서는 자유 입력 티커에 자동완성 후보를 제공하는 datalist로 대체했다.
export function populateQuickTradeTicker() {
  const datalist = field("#qtTickerOptions");
  if (datalist) {
    const holdings = replayHoldings(state.selectedInvestorId);
    datalist.innerHTML = holdings
      .map((item) => `<option value="${item.ticker}">${item.name || item.ticker}</option>`)
      .join("");
  }
  renderQuickTradePreview();
}

export function resetQuickTrade() {
  ["#qtTicker", "#qtName", "#qtQty", "#qtPrice", "#qtFx"].forEach((selector) => {
    const el = field(selector);
    if (el) el.value = "";
  });
  const registerHeld = field("#qtRegisterHeld");
  if (registerHeld) registerHeld.checked = false;
  if (field("#qtType")) field("#qtType").value = "주식";
  if (field("#qtCurrency")) field("#qtCurrency").value = "USD";
  updateQuickTradeFxVisibility();
  field("#qtPreview").hidden = true;
  updateQuickTradeSubmitState();
}

export function setupQuickTrade() {
  field("#qtBuy").addEventListener("click", () => setQuickTradeSide("buy"));
  field("#qtSell").addEventListener("click", () => setQuickTradeSide("sell"));

  ["#qtTicker", "#qtName"].forEach((selector) => {
    field(selector)?.addEventListener("focus", loadUsSymbols, { once: true });
  });
  field("#qtTicker")?.addEventListener("input", (event) => {
    const match = findAssetLookupMatch(event.target.value, "ticker");
    if (match) applyQuickTradeLookup(match);
    updateQuickTradeSubmitState();
    renderQuickTradePreview();
  });
  field("#qtTicker")?.addEventListener("change", (event) => {
    applyQuickTradeLookup(findAssetLookupMatch(event.target.value, "ticker"));
  });
  field("#qtName")?.addEventListener("input", (event) => {
    const match = findAssetLookupMatch(event.target.value, "name");
    if (match) applyQuickTradeLookup(match);
    updateQuickTradeSubmitState();
    renderQuickTradePreview();
  });
  field("#qtName")?.addEventListener("change", (event) => {
    applyQuickTradeLookup(findAssetLookupMatch(event.target.value, "name"));
  });
  field("#qtCurrency")?.addEventListener("change", updateQuickTradeFxVisibility);
  field("#qtType")?.addEventListener("change", () => {
    // 코인은 빗썸(원화) 거래가 기본 — 통화를 KRW로 맞춰준다.
    const currencyField = field("#qtCurrency");
    if (field("#qtType")?.value === "코인" && currencyField) {
      currencyField.value = "KRW";
      updateQuickTradeFxVisibility();
    }
    updateQuickTradeSubmitState();
  });
  ["#qtQty", "#qtPrice", "#qtFx"].forEach((selector) => {
    field(selector)?.addEventListener("input", () => {
      updateQuickTradeSubmitState();
      renderQuickTradePreview();
    });
  });
  field("#qtRegisterHeld")?.addEventListener("change", updateQuickTradeSubmitState);

  field("#qtSubmit").addEventListener("click", () => {
    if (!isQuickTradeValid()) {
      showToast("티커, 종목명, 수량, 체결가를 입력하세요.", "error");
      return;
    }
    const ticker = field("#qtTicker").value.trim().toUpperCase();
    const name = field("#qtName").value.trim();
    const type = field("#qtType").value;
    const currency = field("#qtCurrency").value;
    const quantity = Number(field("#qtQty").value);
    const price = Number(field("#qtPrice").value);
    const fx = currency === "USD" ? Number(field("#qtFx").value) : 1;
    const side = uiState.quickTradeSide;
    const registerHeld = side === "buy" && field("#qtRegisterHeld")?.checked === true;

    const known = state.assetCatalog[ticker];
    const currentPrice = known?.currentPrice || price;
    const currentFx = currency === "KRW" ? 1 : known?.currentFx || fx;

    const result = commitTrade({
      ownerId: state.selectedInvestorId,
      side,
      ticker,
      name,
      type,
      currency,
      quantity,
      price,
      fx,
      currentPrice,
      currentFx,
      registerHeld,
      date: new Date().toISOString().slice(0, 10),
      memo: registerHeld ? "보유 종목 등록" : "빠른 입력"
    });
    if (!result.ok) {
      showToast(result.message, "error");
      return;
    }
    resetQuickTrade();
    showToast(
      registerHeld
        ? `${ticker} 보유분을 등록했습니다 (예수금 유지).`
        : `${ticker} ${side === "buy" ? "매수" : "매도"} 거래를 추가했습니다.`
    );
  });

  field("#qtOpenModalLink")?.addEventListener("click", (event) => {
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

  updateQuickTradeFxVisibility();
}
