import { DIVIDEND_TAX_RATE } from "../config/constants.js";
import { money, qty, signedMoney } from "../core/format.js";
import { currentUsdKrw, state } from "../state/store.js";

export function investorById(id) {
  return state.investors.find((investor) => investor.id === id) || state.investors[0] || {
    id: null,
    name: "투자자 없음",
    initials: "-"
  };
}

export function makeInvestor(name) {
  const clean = name.trim();
  return {
    id: `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: clean,
    initials: clean.slice(0, 1).toUpperCase()
  };
}


export function tradeAmountKrw(trade) {
  return trade.quantity * trade.price * trade.fx;
}

export function getAsset(ticker, fallback = {}) {
  return state.assetCatalog[ticker] || {
    ticker,
    name: fallback.name || ticker,
    type: fallback.type || "주식",
    currency: fallback.currency || "USD",
    currentPrice: fallback.price || 0,
    currentFx: fallback.fx || currentUsdKrw(),
    annualDividend: 0,
    dividendForecast: []
  };
}

export function ensureAssetFromTrade(trade) {
  const existing = state.assetCatalog[trade.ticker];
  state.assetCatalog[trade.ticker] = {
    ticker: trade.ticker,
    name: trade.name || existing?.name || trade.ticker,
    type: trade.type || existing?.type || "주식",
    currency: trade.currency || existing?.currency || "USD",
    currentPrice: existing?.currentPrice ?? trade.price,
    currentFx: existing?.currentFx ?? trade.fx,
    annualDividend: existing?.annualDividend ?? 0,
    dividendForecast: existing?.dividendForecast ?? [],
    dividendFetchedAt: existing?.dividendFetchedAt ?? null
  };
}

export function computeAveragingPreview({ ownerId, side, ticker, quantity, price, fx, currency, currentFx, currentPrice }) {
  const before = replayHoldings(ownerId).find((holding) => holding.ticker === ticker);
  const tradeForeign = quantity * price;
  const tradeKrw = tradeForeign * fx;

  if (!ticker || !quantity || !price) {
    return { before, text: "종목, 수량, 체결가를 입력하면 물타기 결과가 표시됩니다." };
  }

  if (side === "sell") {
    return {
      before,
      text: `예상 매도대금 ${money(tradeKrw)} · 보유수량 ${qty(before?.quantity || 0)}`,
      proceeds: tradeKrw
    };
  }

  const prevQty = before?.quantity || 0;
  const prevForeign = before?.costForeign || 0;
  const prevKrw = before?.costKrw || 0;
  const nextQty = prevQty + quantity;
  const nextForeign = prevForeign + tradeForeign;
  const nextKrw = prevKrw + tradeKrw;
  const beforeAvgPrice = prevQty ? prevForeign / prevQty : 0;
  const beforeAvgFx = prevForeign ? prevKrw / prevForeign : fx;
  const afterAvgPrice = nextQty ? nextForeign / nextQty : 0;
  const afterAvgFx = nextForeign ? nextKrw / nextForeign : fx;
  const expectedValue = nextQty * currentPrice * currentFx;
  const expectedProfit = expectedValue - nextKrw;
  return {
    before,
    beforeAvgPrice,
    beforeAvgFx,
    afterAvgPrice,
    afterAvgFx,
    expectedProfit,
    text: `매수 후 수량 ${qty(nextQty)} · 새 평단 ${money(afterAvgPrice * afterAvgFx)} · 평균환율 ${qty(afterAvgFx)} · 예상손익 ${signedMoney(expectedProfit)}`
  };
}


export function replayHoldings(ownerId) {
  const lots = new Map();
  const trades = state.trades
    .filter((trade) => !ownerId || trade.ownerId === ownerId)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const trade of trades) {
    const key = `${trade.ownerId}:${trade.ticker}`;
    const asset = getAsset(trade.ticker, trade);
    const lot = lots.get(key) || {
      ownerId: trade.ownerId,
      ticker: trade.ticker,
      name: trade.name || asset.name,
      type: trade.type || asset.type,
      currency: trade.currency || asset.currency,
      quantity: 0,
      costForeign: 0,
      costKrw: 0
    };

    const tradeForeign = trade.quantity * trade.price;
    const tradeKrw = tradeForeign * trade.fx;
    if (trade.side === "buy") {
      lot.quantity += trade.quantity;
      lot.costForeign += tradeForeign;
      lot.costKrw += tradeKrw;
    } else if (trade.side === "sell" && lot.quantity > 0) {
      const sellQty = Math.min(trade.quantity, lot.quantity);
      const ratio = sellQty / lot.quantity;
      lot.quantity -= sellQty;
      lot.costForeign -= lot.costForeign * ratio;
      lot.costKrw -= lot.costKrw * ratio;
    }

    if (lot.quantity > 0.00000001) lots.set(key, lot);
    else lots.delete(key);
  }

  return Array.from(lots.values()).map((lot) => {
    const asset = getAsset(lot.ticker, lot);
    const avgPrice = lot.quantity ? lot.costForeign / lot.quantity : 0;
    const avgFx = lot.costForeign ? lot.costKrw / lot.costForeign : 1;
    const currentFx = asset.currency === "KRW" ? 1 : asset.currentFx;
    const currentPrice = asset.currentPrice;
    const valueKrw = lot.quantity * currentPrice * currentFx;
    const stockProfit = lot.quantity * (currentPrice - avgPrice) * currentFx;
    const fxProfit = asset.currency === "KRW" ? 0 : lot.quantity * avgPrice * (currentFx - avgFx);
    // 배당은 Finnhub 이력 기반 예측 스케줄(dividendForecast)로 계산한다.
    // 향후 12개월치 주당 예상 배당 합계 x 보유수량 x 현재 환율(미래 환율은 알 수 없어 현재값으로 근사).
    const dividendForecast = asset.dividendForecast || [];
    const dividendPerShareAnnual = dividendForecast.reduce((sum, p) => sum + p.amountPerShare, 0);
    const annualDividend = lot.quantity * dividendPerShareAnnual * currentFx;
    return {
      ...lot,
      name: asset.name,
      type: asset.type,
      currency: asset.currency,
      currentPrice,
      currentFx,
      avgPrice,
      avgFx,
      valueKrw,
      stockProfit,
      fxProfit,
      profit: stockProfit + fxProfit,
      annualDividend,
      dividendForecast
    };
  });
}

export function netCashflow(ownerId) {
  return state.cashflows
    .filter((flow) => !ownerId || flow.ownerId === ownerId)
    .reduce((sum, flow) => sum + (flow.type === "deposit" ? flow.amount : -flow.amount), 0);
}

export function cashBalance(ownerId) {
  const principal = netCashflow(ownerId);
  const tradeCash = state.trades
    .filter((trade) => !ownerId || trade.ownerId === ownerId)
    .reduce((sum, trade) => sum + (trade.side === "buy" ? -tradeAmountKrw(trade) : tradeAmountKrw(trade)), 0);
  return principal + tradeCash;
}

export function expectedDividend(ownerId) {
  return replayHoldings(ownerId).reduce((sum, holding) => sum + holding.annualDividend, 0);
}

export function summarize(ownerId) {
  const holdings = replayHoldings(ownerId);
  const principal = netCashflow(ownerId);
  const cash = cashBalance(ownerId);
  const holdingsValue = holdings.reduce((sum, holding) => sum + holding.valueKrw, 0);
  const totalValue = holdingsValue + cash;
  const profit = totalValue - principal;
  const dividend = expectedDividend(ownerId);
  const tax = dividend * DIVIDEND_TAX_RATE;
  return {
    holdings,
    principal,
    cash,
    holdingsValue,
    totalValue,
    profit,
    returnRate: principal ? (profit / principal) * 100 : 0,
    dividend,
    tax,
    dividendAfterTax: dividend - tax
  };
}

export function groupedByType(ownerId) {
  const summary = summarize(ownerId);
  const total = Math.max(summary.totalValue, 1);
  const map = new Map();
  for (const holding of summary.holdings) {
    const current = map.get(holding.type) || { type: holding.type, value: 0 };
    current.value += holding.valueKrw;
    map.set(holding.type, current);
  }
  if (summary.cash !== 0) {
    map.set("예수금", { type: "예수금", value: summary.cash });
  }
  return Array.from(map.values()).map((item) => ({
    ...item,
    actual: (item.value / total) * 100
  }));
}
