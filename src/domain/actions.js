import { cashBalanceByCurrency, ensureAssetFromTrade, getAsset, makeInvestor, replayHoldings } from "./portfolio.js";
import { currentUsdKrw, saveState, state, syncUsdAssetFx } from "../state/store.js";
import { showToast } from "../ui/dom.js";
import { render } from "../ui/render/index.js";
import { tradeById } from "../ui/trade-dialog.js";
import { uiState } from "../ui/uistate.js";

export function addInvestorByName(name, options = {}) {
  const clean = name.trim();
  if (!clean) return null;
  const investor = makeInvestor(clean);
  state.investors.push(investor);
  state.selectedInvestorId = investor.id;
  state.pendingDeleteInvestorId = null;
  if (options.openSheet) state.selectedView = "investor";
  saveState();
  render();
  showToast(`${investor.name} 투자자를 추가했습니다.`);
  return investor;
}

export function updateInvestorName(id, name) {
  const clean = name.trim();
  const investor = state.investors.find((item) => item.id === id);
  if (!investor || !clean) return false;
  if (investor.name === clean) return true;
  investor.name = clean;
  investor.initials = clean.slice(0, 1).toUpperCase();
  saveState();
  render();
  showToast("투자자 이름을 저장했습니다.");
  return true;
}


export function commitTrade(data) {
  const ticker = data.ticker.trim().toUpperCase();
  const asset = getAsset(ticker, data);
  const currency = data.currency || asset.currency;
  const fx = currency === "KRW" ? 1 : Number(data.fx || asset.currentFx || currentUsdKrw());
  const currentFx = currency === "KRW" ? 1 : Number(data.currentFx || asset.currentFx || fx);
  const currentPrice = Number(data.currentPrice || asset.currentPrice || data.price);
  const quantity = Number(data.quantity) || 0;
  const price = Number(data.price) || 0;
  const amount = quantity * price * fx;
  const nativeAmount = quantity * price; // 거래 통화(원화/외화) 액면가 — 예수금 풀 검증·자동입금에 쓴다
  const existing = replayHoldings(data.ownerId).find((holding) => holding.ticker === ticker);

  if (!ticker || !quantity || !price) return { ok: false, message: "종목, 수량, 체결가를 입력하세요." };
  const registerHeld = data.registerHeld === true && data.side === "buy";
  // 외화 종목은 외화 예수금 안에서만 매수 가능하다 — 원화 예수금이 아무리 많아도
  // 대신 쓸 수 없다(실제 증권사 계좌처럼 통화별 잔고를 분리한다).
  if (data.side === "buy" && !registerHeld && cashBalanceByCurrency(data.ownerId, currency) < nativeAmount) {
    const label = currency === "KRW" ? "원화" : "외화";
    return { ok: false, field: "quantity", message: `매수금액이 ${label} 예수금을 초과합니다.` };
  }
  if (data.side === "sell" && (!existing || existing.quantity < quantity)) {
    return { ok: false, field: "quantity", message: "매도수량이 보유수량을 초과합니다." };
  }

  const trade = {
    id: crypto.randomUUID(),
    ownerId: data.ownerId,
    date: data.date || new Date().toISOString().slice(0, 10),
    side: data.side,
    ticker,
    name: data.name || asset.name || ticker,
    type: data.type || asset.type,
    currency,
    quantity,
    price,
    fx,
    memo: data.memo || ""
  };
  ensureAssetFromTrade({ ...trade, price: currentPrice, fx: currentFx });
  state.assetCatalog[ticker].currentPrice = currentPrice;
  state.assetCatalog[ticker].currentFx = currentFx;
  // 새로 만들어진 USD 종목이 폼에 적힌 환율에 묶이지 않도록 즉시 현재 환율에 맞춘다.
  // 매입시점 환율(trade.fx)은 위 trade 객체에 그대로 남아 환차손익의 기준이 된다.
  syncUsdAssetFx();
  if (registerHeld && nativeAmount > 0) {
    // 이미 보유 중이던 걸 등록하는 거래라 예수금이 실제로 오간 게 아니다. 매수가
    // 빠져나갈 통화 풀(원화/외화)에 그만큼 자동 입금해서 잔고가 맞아떨어지게 한다.
    state.cashflows.push({
      id: crypto.randomUUID(),
      ownerId: data.ownerId,
      date: trade.date,
      type: "deposit",
      amount: Math.round(nativeAmount),
      currency,
      memo: "보유 등록 자동 입금",
      autoFor: trade.id
    });
  }
  state.trades.push(trade);
  saveState();
  render();
  return { ok: true, trade };
}


export function updateTrade(id, data) {
  const trade = tradeById(id);
  if (!trade) return { ok: false, message: "거래를 찾을 수 없습니다." };
  const ticker = (data.ticker || "").trim().toUpperCase();
  const quantity = Number(data.quantity) || 0;
  const price = Number(data.price) || 0;
  if (!ticker || !quantity || !price) return { ok: false, field: "ticker", message: "종목, 수량, 체결가를 입력하세요." };
  const currency = data.currency;
  const fx = currency === "KRW" ? 1 : Number(data.fx) || 1;
  Object.assign(trade, {
    ownerId: data.ownerId,
    date: data.date || trade.date,
    side: data.side,
    ticker,
    name: (data.name || "").trim() || ticker,
    type: data.type,
    currency,
    quantity,
    price,
    fx,
    memo: (data.memo || "").trim()
  });
  const currentPrice = Number(data.currentPrice) || price;
  const currentFx = currency === "KRW" ? 1 : Number(data.currentFx) || fx;
  ensureAssetFromTrade({ ...trade, price: currentPrice, fx: currentFx });
  state.assetCatalog[ticker].currentPrice = currentPrice;
  state.assetCatalog[ticker].currentFx = currentFx;
  syncUsdAssetFx();
  const auto = state.cashflows.find((flow) => flow.autoFor === id);
  if (auto) {
    if (trade.side === "buy") {
      auto.amount = Math.round(quantity * price); // 거래 통화 액면가
      auto.currency = currency;
      auto.date = trade.date;
      auto.ownerId = trade.ownerId;
    } else {
      state.cashflows = state.cashflows.filter((flow) => flow.autoFor !== id);
    }
  }
  saveState();
  render();
  return { ok: true };
}

export function deleteTrade(id) {
  state.trades = state.trades.filter((trade) => trade.id !== id);
  state.cashflows = state.cashflows.filter((flow) => flow.autoFor !== id);
  uiState.editingTradeId = null;
  saveState();
  render();
}
