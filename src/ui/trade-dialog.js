import { state } from "../state/store.js";
import { populateOwnerSelects, renderTradePreview } from "./forms/common.js";
import { openDialog } from "./render/index.js";
import { uiState } from "./uistate.js";

// 편집 중인 거래 id 는 domain/actions.js 도 초기화하므로 uiState 에 둔다.

export function tradeById(id) {
  return state.trades.find((trade) => trade.id === id);
}

// 거래 수정 모달을 기존 거래 값으로 채워 연다.
export function openTradeEditor(tradeId) {
  const trade = tradeById(tradeId);
  if (!trade) return;
  uiState.editingTradeId = tradeId;
  const form = document.querySelector("#tradeForm");
  populateOwnerSelects();
  form.elements.ownerId.value = trade.ownerId;
  form.elements.date.value = trade.date;
  form.elements.side.value = trade.side;
  form.elements.currency.value = trade.currency;
  form.elements.ticker.value = trade.ticker;
  form.elements.name.value = trade.name || "";
  form.elements.type.value = trade.type || "주식";
  form.elements.quantity.value = trade.quantity;
  form.elements.price.value = trade.price;
  form.elements.fx.value = trade.fx;
  const asset = state.assetCatalog[trade.ticker] || {};
  form.elements.currentPrice.value = asset.currentPrice ?? trade.price;
  form.elements.currentFx.value = trade.currency === "KRW" ? 1 : (asset.currentFx ?? trade.fx);
  form.elements.memo.value = trade.memo || "";
  setTradeDialogMode("edit");
  renderTradePreview();
  openDialog(document.querySelector("#tradeDialog"));
}

export function setTradeDialogMode(mode) {
  const title = document.querySelector("#tradeDialogTitle");
  const del = document.querySelector("#deleteTradeButton");
  if (title) title.textContent = mode === "edit" ? "거래 수정" : "매수·매도 입력";
  if (del) del.hidden = mode !== "edit";
  if (mode !== "edit") uiState.editingTradeId = null;
}

// 기존 거래를 수정. 연결된 '보유 등록 자동 입금'도 함께 동기화한다.

// 한 종목이 여러 거래로 구성된 경우, 거래 목록에서 수정/삭제할 항목을 고른다.
export function openHoldingTrades(ownerId, ticker) {
  const trades = state.trades
    .filter((trade) => trade.ownerId === ownerId && trade.ticker === ticker)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  if (trades.length === 1) {
    openTradeEditor(trades[0].id);
    return;
  }
  const list = document.querySelector("#holdingTradesList");
  const titleEl = document.querySelector("#holdingTradesTitle");
  if (!list) return;
  if (titleEl) titleEl.textContent = `${ticker} 거래 내역`;
  list.innerHTML = trades
    .map((trade) => {
      const label = trade.side === "buy" ? "매수" : "매도";
      const tone = trade.side === "buy" ? "buy" : "sell";
      const nat = trade.currency === "USD" ? `$${trade.price}` : `${Math.round(trade.price).toLocaleString("ko-KR")}원`;
      return `
        <div class="holding-trade-row">
          <div><i class="activity-badge ${tone}">${label}</i><strong>${trade.date}</strong><small>${trade.quantity} × ${nat}${trade.currency === "USD" ? ` · 환율 ${trade.fx}` : ""}</small></div>
          <div class="holding-trade-actions">
            <button type="button" class="ghost-button" data-edit-trade="${trade.id}">수정</button>
            <button type="button" class="danger-text-button" data-delete-trade="${trade.id}">삭제</button>
          </div>
        </div>`;
    })
    .join("");
  openDialog(document.querySelector("#holdingTradesDialog"));
}
