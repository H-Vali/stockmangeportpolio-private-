import { ASSET_DICTIONARY } from "../../config/catalog.js";
import { commitTrade } from "../../domain/actions.js";
import { findAssetLookupMatch, loadUsSymbols } from "../../net/symbols.js";
import { currentUsdKrw, state } from "../../state/store.js";
import { showToast } from "../dom.js";

export function quickTradeAsset() {
  const ticker = document.querySelector("#quickTradeTicker")?.value;
  return ticker ? state.assetCatalog[ticker] : null;
}

export function shouldShowQuickTradeFx(asset) {
  return asset?.currency === "USD";
}

export function newAssetField(selector) {
  return document.querySelector(selector);
}

export function normalizeAssetSearch(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function assetLookupEntries() {
  const merged = new Map();
  ASSET_DICTIONARY.forEach((asset) => {
    merged.set(asset.ticker.toUpperCase(), { ...asset, ticker: asset.ticker.toUpperCase() });
  });
  Object.values(state.assetCatalog || {}).forEach((asset) => {
    const ticker = asset.ticker.toUpperCase();
    const known = merged.get(ticker);
    merged.set(ticker, known ? {
      ...known,
      currentPrice: asset.currentPrice,
      currentFx: asset.currentFx,
      annualDividend: asset.annualDividend
    } : { ...asset, ticker });
  });
  return [...merged.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
}

// 전체 미국 상장 종목(개별주+ETF) DB. 초기 로딩을 막지 않도록 지연 로딩한다.

export function applyNewAssetLookup(asset, sourceField) {
  if (!asset) return;
  const tickerInput = newAssetField("#newAssetTicker");
  const nameInput = newAssetField("#newAssetName");
  const typeInput = newAssetField("#newAssetType");
  const currencyInput = newAssetField("#newAssetCurrency");
  const priceInput = newAssetField("#newAssetPrice");
  const fxInput = newAssetField("#newAssetFx");

  if (tickerInput) tickerInput.value = asset.ticker;
  if (nameInput) nameInput.value = asset.name;
  if (typeInput && asset.type) typeInput.value = asset.type;
  if (currencyInput && asset.currency) currencyInput.value = asset.currency;
  if (priceInput && !priceInput.value && asset.currentPrice) priceInput.value = asset.currentPrice;
  if (fxInput && !fxInput.value && asset.currency === "USD") fxInput.value = Math.round(asset.currentFx || currentUsdKrw());
  updateNewAssetFxVisibility();
  updateNewAssetSubmitState();
}

export function isNewAssetFormValid() {
  const ticker = newAssetField("#newAssetTicker")?.value.trim();
  const name = newAssetField("#newAssetName")?.value.trim();
  const currency = newAssetField("#newAssetCurrency")?.value;
  const quantity = Number(newAssetField("#newAssetQty")?.value);
  const price = Number(newAssetField("#newAssetPrice")?.value);
  const fx = Number(newAssetField("#newAssetFx")?.value);
  if (!ticker || !name || !quantity || quantity <= 0 || !price || price <= 0) return false;
  if (currency === "USD" && (!fx || fx <= 0)) return false;
  return true;
}

export function updateNewAssetSubmitState() {
  const button = newAssetField("#newAssetSubmit");
  if (!button) return;
  button.classList.toggle("enabled", isNewAssetFormValid());
}

export function updateNewAssetFxVisibility() {
  const currency = newAssetField("#newAssetCurrency")?.value;
  const fxWrap = newAssetField("#newAssetFxWrap");
  const fxInput = newAssetField("#newAssetFx");
  if (fxWrap) fxWrap.style.display = currency === "USD" ? "" : "none";
  if (currency === "KRW" && fxInput) fxInput.value = 1;
  if (currency === "USD" && fxInput && !fxInput.value) fxInput.value = Math.round(currentUsdKrw());
  updateNewAssetSubmitState();
}

export function resetNewAssetForm() {
  ["#newAssetTicker", "#newAssetName", "#newAssetQty", "#newAssetPrice", "#newAssetFx"].forEach((selector) => {
    const field = newAssetField(selector);
    if (field) field.value = "";
  });
  updateNewAssetFxVisibility();
}

export function setupNewAssetForm() {
  const submit = newAssetField("#newAssetSubmit");
  if (!submit) return;
  ["#newAssetTicker", "#newAssetName"].forEach((selector) => {
    newAssetField(selector)?.addEventListener("focus", loadUsSymbols, { once: true });
  });
  newAssetField("#newAssetTicker")?.addEventListener("input", (event) => {
    const match = findAssetLookupMatch(event.target.value, "ticker");
    if (match) applyNewAssetLookup(match, "ticker");
    updateNewAssetSubmitState();
  });
  newAssetField("#newAssetTicker")?.addEventListener("change", (event) => {
    applyNewAssetLookup(findAssetLookupMatch(event.target.value, "ticker"), "ticker");
  });
  newAssetField("#newAssetName")?.addEventListener("input", (event) => {
    const match = findAssetLookupMatch(event.target.value, "name");
    if (match) applyNewAssetLookup(match, "name");
    updateNewAssetSubmitState();
  });
  newAssetField("#newAssetName")?.addEventListener("change", (event) => {
    applyNewAssetLookup(findAssetLookupMatch(event.target.value, "name"), "name");
  });
  ["#newAssetTicker", "#newAssetName", "#newAssetQty", "#newAssetPrice", "#newAssetFx"].forEach((selector) => {
    newAssetField(selector)?.addEventListener("input", updateNewAssetSubmitState);
  });
  newAssetField("#newAssetCurrency")?.addEventListener("change", updateNewAssetFxVisibility);
  newAssetField("#newAssetType")?.addEventListener("change", () => {
    // 코인은 빗썸(원화) 거래가 기본 — 통화를 KRW로 맞춰준다.
    const currencyField = newAssetField("#newAssetCurrency");
    if (newAssetField("#newAssetType")?.value === "코인" && currencyField) {
      currencyField.value = "KRW";
      updateNewAssetFxVisibility();
    }
    updateNewAssetSubmitState();
  });
  submit.addEventListener("click", () => {
    if (!isNewAssetFormValid()) {
      showToast("필수 항목을 모두 입력하세요.", "error");
      return;
    }
    const ticker = newAssetField("#newAssetTicker").value.trim().toUpperCase();
    const name = newAssetField("#newAssetName").value.trim();
    const type = newAssetField("#newAssetType").value;
    const currency = newAssetField("#newAssetCurrency").value;
    const quantity = Number(newAssetField("#newAssetQty").value);
    const price = Number(newAssetField("#newAssetPrice").value);
    const fx = currency === "USD" ? Number(newAssetField("#newAssetFx").value) : 1;
    const currentFx = currency === "USD" ? fx : 1;
    const registerHeld = newAssetField("#newAssetRegisterHeld")?.checked === true;

    const hadAsset = Boolean(state.assetCatalog[ticker]);
    if (!hadAsset) {
      state.assetCatalog[ticker] = {
        ticker,
        name,
        type,
        currency,
        currentPrice: price,
        currentFx,
        annualDividend: 0
      };
    }

    const result = commitTrade({
      ownerId: state.selectedInvestorId,
      side: "buy",
      ticker,
      name,
      type,
      currency,
      quantity,
      price,
      fx,
      currentPrice: price,
      currentFx,
      registerHeld,
      date: new Date().toISOString().slice(0, 10),
      memo: registerHeld ? "보유 종목 등록" : "신규 자산 등록"
    });
    if (!result.ok) {
      if (!hadAsset) delete state.assetCatalog[ticker];
      showToast(result.message, "error");
      return;
    }
    resetNewAssetForm();
    showToast(registerHeld ? `${ticker} 보유분을 등록했습니다 (예수금 유지).` : `${ticker} 신규 등록 및 매수가 반영되었습니다.`);
  });
  updateNewAssetFxVisibility();
}
