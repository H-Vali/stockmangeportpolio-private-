import { CAPITAL_GAINS_DEDUCTION_KRW, CAPITAL_GAINS_TAX_RATE, DIVIDEND_TAX_RATE } from "../config/constants.js";
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

// 매매대금을 거래 통화 그대로(환산 없이) 반환한다. 예수금을 원화/외화 풀로
// 나눈 뒤로는, 어느 풀에서 얼마가 빠지고 들어오는지는 거래 통화 액면가로
// 정해진다 — 원화로 환산해서 섞어버리면 "외화 예수금"이라는 개념이 무너진다.
export function tradeAmountNative(trade) {
  return trade.quantity * trade.price;
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

// 매도가 일어날 때마다 그 매도 건의 실현손익(증권사의 "실현손익"과 동일한 개념)을
// 기록한다. replayHoldings와 같은 방식으로 로트를 재생하되, 매도로 사라지는 원가를
// 버리지 않고 "매도대금 - 그만큼 차감된 원가"로 남긴다. 세전 기준.
export function realizedTrades(ownerId) {
  const lots = new Map();
  const trades = state.trades
    .filter((trade) => !ownerId || trade.ownerId === ownerId)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  const realized = [];

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
      const costForeignRemoved = lot.costForeign * ratio;
      const costKrwRemoved = lot.costKrw * ratio;
      const avgPrice = sellQty ? costForeignRemoved / sellQty : 0;
      const avgFx = costForeignRemoved ? costKrwRemoved / costForeignRemoved : trade.fx;
      const proceedsForeign = sellQty * trade.price;
      const proceedsKrw = proceedsForeign * trade.fx;
      // 평가손익과 같은 방식으로 주가손익/환차손익을 나눠서 보여준다(매도 시점 기준으로 확정).
      const stockProfitKrw = sellQty * (trade.price - avgPrice) * trade.fx;
      const fxProfitKrw = lot.currency === "KRW" ? 0 : sellQty * avgPrice * (trade.fx - avgFx);

      realized.push({
        tradeId: trade.id,
        ownerId: trade.ownerId,
        ticker: trade.ticker,
        name: lot.name,
        type: lot.type,
        currency: lot.currency,
        date: trade.date,
        quantity: sellQty,
        sellPrice: trade.price,
        sellFx: trade.fx,
        avgPrice,
        avgFx,
        proceedsForeign,
        costForeign: costForeignRemoved,
        profitForeign: proceedsForeign - costForeignRemoved,
        proceedsKrw,
        costKrw: costKrwRemoved,
        profitKrw: stockProfitKrw + fxProfitKrw,
        stockProfitKrw,
        fxProfitKrw
      });

      lot.quantity -= sellQty;
      lot.costForeign -= costForeignRemoved;
      lot.costKrw -= costKrwRemoved;
    }

    if (lot.quantity > 0.00000001) lots.set(key, lot);
    else lots.delete(key);
  }

  return realized.sort((a, b) => b.date.localeCompare(a.date));
}

// 실현손익 목록을 기간(from~to, YYYY-MM-DD, 포함)으로 좁히고 총계를 낸다.
// 원화 총계는 통화 무관 전부 합산, 외화 총계는 USD 매도분만 액면가로 따로 낸다
// (원화/외화 둘 다 표기해달라는 요청 — 예수금 분리와 같은 방식).
export function realizedSummary(ownerId, { from, to } = {}) {
  const items = realizedTrades(ownerId).filter(
    (r) => (!from || r.date >= from) && (!to || r.date <= to)
  );
  const totalKrw = items.reduce((sum, r) => sum + r.profitKrw, 0);
  const totalUsd = items
    .filter((r) => r.currency === "USD")
    .reduce((sum, r) => sum + r.profitForeign, 0);
  return { items, totalKrw, totalUsd, count: items.length };
}

// 해외주식 양도소득세 예상치. 22%(지방세 포함), 1인당 연 250만원 기본공제,
// 순손실이면 세금 0(이월공제는 계산하지 않는다 — 단순 예상치 목적).
// ownerId가 없으면(전체) 투자자별로 각자 공제를 적용한 뒤 합산한다.
export function estimatedCapitalGainsTax(ownerId, year) {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const ownerIds = ownerId ? [ownerId] : state.investors.map((investor) => investor.id);

  let totalGain = 0;
  let totalTax = 0;
  for (const id of ownerIds) {
    const gain = realizedTrades(id)
      .filter((r) => r.currency === "USD" && r.date >= yearStart && r.date <= yearEnd)
      .reduce((sum, r) => sum + r.profitKrw, 0);
    totalGain += gain;
    totalTax += Math.max(0, gain - CAPITAL_GAINS_DEDUCTION_KRW) * CAPITAL_GAINS_TAX_RATE;
  }
  return { year, gain: totalGain, tax: totalTax };
}

// 입출금 기록엔 currency 필드가 없을 수 있다(과거 데이터, 또는 원화 입출금은
// 굳이 표시 안 함) — 그 경우 원화로 취급한다.
function flowCurrency(flow) {
  return flow.currency || "KRW";
}

export function netCashflowByCurrency(ownerId, currency) {
  return state.cashflows
    .filter((flow) => (!ownerId || flow.ownerId === ownerId) && flowCurrency(flow) === currency)
    .reduce((sum, flow) => sum + (flow.type === "deposit" ? flow.amount : -flow.amount), 0);
}

export function netCashflowKrw(ownerId) {
  return netCashflowByCurrency(ownerId, "KRW");
}

export function netCashflowUsd(ownerId) {
  return netCashflowByCurrency(ownerId, "USD");
}

// 원화 환산 총 입출금(투자원금·수익률 계산용). 외화 입출금은 현재 환율로 환산한다.
export function netCashflow(ownerId) {
  return netCashflowKrw(ownerId) + netCashflowUsd(ownerId) * currentUsdKrw();
}

// 예수금을 원화 풀/외화 풀로 나눠서 계산한다. 원화 매매는 원화 풀을,
// 외화(USD) 매매는 외화 풀을 액면가 그대로 드나든다 — 매수 시점 환율로
// 환산해 하나로 섞지 않는다(외화로 산 건 외화로 판다).
export function cashBalanceByCurrency(ownerId, currency) {
  const principal = netCashflowByCurrency(ownerId, currency);
  const tradeCash = state.trades
    .filter((trade) => (!ownerId || trade.ownerId === ownerId) && trade.currency === currency)
    .reduce((sum, trade) => sum + (trade.side === "buy" ? -tradeAmountNative(trade) : tradeAmountNative(trade)), 0);
  return principal + tradeCash;
}

export function cashBalanceKrw(ownerId) {
  return cashBalanceByCurrency(ownerId, "KRW");
}

export function cashBalanceUsd(ownerId) {
  return cashBalanceByCurrency(ownerId, "USD");
}

// 원화 환산 총 예수금(평가금액 계산용). 외화 예수금은 현재 환율로 환산한다.
export function cashBalance(ownerId) {
  return cashBalanceKrw(ownerId) + cashBalanceUsd(ownerId) * currentUsdKrw();
}

export function expectedDividend(ownerId) {
  return replayHoldings(ownerId).reduce((sum, holding) => sum + holding.annualDividend, 0);
}

export function summarize(ownerId) {
  const holdings = replayHoldings(ownerId);
  const principal = netCashflow(ownerId);
  const cashKrw = cashBalanceKrw(ownerId);
  const cashUsd = cashBalanceUsd(ownerId);
  const cash = cashKrw + cashUsd * currentUsdKrw();
  const holdingsValue = holdings.reduce((sum, holding) => sum + holding.valueKrw, 0);
  const totalValue = holdingsValue + cash;
  const profit = totalValue - principal;
  const dividend = expectedDividend(ownerId);
  const tax = dividend * DIVIDEND_TAX_RATE;
  return {
    holdings,
    principal,
    cash,
    cashKrw,
    cashUsd,
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
