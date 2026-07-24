import { cashBalanceByCurrency, computeAveragingPreview, getAsset } from "../../domain/portfolio.js";
import { usSymbolByTicker } from "../../net/symbols.js";
import { state } from "../../state/store.js";

export function populateOwnerSelects() {
  for (const id of ["cashflowOwnerSelect", "tradeOwnerSelect"]) {
    const select = document.querySelector(`#${id}`);
    select.innerHTML = "";
    state.investors.forEach((investor) => {
      const option = document.createElement("option");
      option.value = investor.id;
      option.textContent = investor.name;
      select.appendChild(option);
    });
    select.value = state.selectedInvestorId;
  }

  const calendarSelect = document.querySelector("#calendarTargetSelect");
  for (const select of [calendarSelect]) {
    const current = select.value;
    select.innerHTML = `<option value="">통합</option>`;
    state.investors.forEach((investor) => {
      const option = document.createElement("option");
      option.value = investor.id;
      option.textContent = investor.name;
      select.appendChild(option);
    });
    select.value = current;
  }
}

export function updateAssetFieldsFromTicker(ticker) {
  const upper = ticker.trim().toUpperCase();
  const asset = state.assetCatalog[upper] || usSymbolByTicker(upper);
  if (!asset) return;
  const form = document.querySelector("#tradeForm");
  form.elements.name.value = asset.name;
  form.elements.type.value = asset.type;
  if (asset.currency) form.elements.currency.value = asset.currency;
  if (asset.currentPrice != null) form.elements.currentPrice.value = asset.currentPrice;
  if (asset.currentFx != null) form.elements.currentFx.value = asset.currentFx;
}

export function tradePreviewData() {
  const form = document.querySelector("#tradeForm");
  const ownerId = form.elements.ownerId.value;
  const side = form.elements.side.value;
  const ticker = form.elements.ticker.value.trim().toUpperCase();
  const quantity = Number(form.elements.quantity.value) || 0;
  const price = Number(form.elements.price.value) || 0;
  const fx = Number(form.elements.fx.value) || 1;
  const asset = getAsset(ticker, { price, fx, currency: form.elements.currency.value });
  const currentFx = asset.currency === "KRW" ? 1 : Number(form.elements.currentFx.value || asset.currentFx || fx);
  const currentPrice = Number(form.elements.currentPrice.value || asset.currentPrice || price);
  return computeAveragingPreview({
    ownerId,
    side,
    ticker,
    quantity,
    price,
    fx,
    currency: form.elements.currency.value,
    currentFx,
    currentPrice
  });
}

export function renderTradePreview() {
  const preview = document.querySelector("#tradePreview");
  if (!preview) return;
  preview.textContent = tradePreviewData().text;
}

export function canWithdraw(ownerId, amount, currency = "KRW") {
  return cashBalanceByCurrency(ownerId, currency) >= amount;
}
