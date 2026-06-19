const STORAGE_KEY = "assetpilot-ledger-state-v2";
const LEGACY_STORAGE_KEY = "assetpilot-ledger-state-v1";
const SCHEMA_VERSION = 2;
const DIVIDEND_TAX_RATE = 0.15;
const DEFAULT_USDKRW = 1380;
const PROXY_BASE_URL = "";
const COINGECKO_IDS = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  LINK: "chainlink"
};
const DIVIDEND_MONTHS = {
  SCHD: [3, 6, 9, 12],
  O: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  "360750": [1, 4, 7, 10],
  KR3Y: [3, 6, 9, 12]
};
const colors = ["#7c5cfc", "#8d6dff", "#9d7bff", "#ae91ff", "#bfa8ff", "#d1c2ff"];
const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

const seedState = {
  schemaVersion: SCHEMA_VERSION,
  selectedView: "dashboard",
  selectedInvestorId: "kim",
  pendingDeleteInvestorId: null,
  displayCurrency: "KRW",
  fx: {
    usdkrw: DEFAULT_USDKRW,
    mode: "auto",
    manualUsdkrw: DEFAULT_USDKRW,
    source: "manual",
    updatedAt: null
  },
  market: {
    lastUpdatedAt: null,
    failedAt: null,
    lastSuccessAt: null,
    error: null
  },
  snapshots: [],
  investors: [
    { id: "kim", name: "김지훈", initials: "김" },
    { id: "lee", name: "이서연", initials: "이" }
  ],
  assetCatalog: {
    SCHD: { ticker: "SCHD", name: "SCHD", type: "주식", currency: "USD", currentPrice: 29.5, currentFx: DEFAULT_USDKRW, annualDividend: 9881 },
    O: { ticker: "O", name: "Realty Income", type: "주식", currency: "USD", currentPrice: 58, currentFx: DEFAULT_USDKRW, annualDividend: 8200 },
    BTC: { ticker: "BTC", name: "Bitcoin", type: "코인", currency: "USD", currentPrice: 38000, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    ETH: { ticker: "ETH", name: "Ethereum", type: "코인", currency: "USD", currentPrice: 2391, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    "360750": { ticker: "360750", name: "TIGER 미국S&P500", type: "ETF", currency: "KRW", currentPrice: 19640, currentFx: 1, annualDividend: 4600 },
    KR3Y: { ticker: "KR3Y", name: "국고채 3년", type: "채권", currency: "KRW", currentPrice: 100400, currentFx: 1, annualDividend: 36000 }
  },
  marketIndicators: [
    { symbol: "BTC", domestic: 52000000, globalKrw: 50420000, updatedAt: null },
    { symbol: "ETH", domestic: 3300000, globalKrw: 3244000, updatedAt: null }
  ],
  cashflows: [
    { id: crypto.randomUUID(), ownerId: "kim", date: "2026-06-01", type: "deposit", amount: 3000000, memo: "초기 입금" },
    { id: crypto.randomUUID(), ownerId: "lee", date: "2026-06-01", type: "deposit", amount: 3400000, memo: "초기 입금" }
  ],
  trades: [
    { id: crypto.randomUUID(), ownerId: "kim", date: "2026-06-03", side: "buy", ticker: "SCHD", name: "SCHD", type: "주식", currency: "USD", quantity: 20, price: 25, fx: 1360 },
    { id: crypto.randomUUID(), ownerId: "kim", date: "2026-06-04", side: "buy", ticker: "O", name: "Realty Income", type: "주식", currency: "USD", quantity: 15, price: 54, fx: 1370 },
    { id: crypto.randomUUID(), ownerId: "kim", date: "2026-06-08", side: "buy", ticker: "BTC", name: "Bitcoin", type: "코인", currency: "USD", quantity: 0.005, price: 29000, fx: DEFAULT_USDKRW },
    { id: crypto.randomUUID(), ownerId: "lee", date: "2026-06-05", side: "buy", ticker: "360750", name: "TIGER 미국S&P500", type: "ETF", currency: "KRW", quantity: 58, price: 17250, fx: 1 },
    { id: crypto.randomUUID(), ownerId: "lee", date: "2026-06-10", side: "buy", ticker: "ETH", name: "Ethereum", type: "코인", currency: "USD", quantity: 0.42, price: 2094, fx: DEFAULT_USDKRW },
    { id: crypto.randomUUID(), ownerId: "lee", date: "2026-06-12", side: "buy", ticker: "KR3Y", name: "국고채 3년", type: "채권", currency: "KRW", quantity: 12, price: 101000, fx: 1 }
  ]
};

let state = loadState();
const requestedView = new URLSearchParams(window.location.search).get("view");
if (["dashboard", "investor", "dividend", "calendar"].includes(requestedView)) {
  state.selectedView = requestedView;
}
let pendingImportState = null;
let importRollbackState = null;
let toastTimer = null;
let pollingTimer = null;
let fxTimer = null;
let dividendDetailOpen = false;

const formatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0
});

const numberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 4
});

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function normalizeState(input) {
  const base = structuredClone(seedState);
  const parsed = input && typeof input === "object" ? input : {};
  return {
    ...base,
    ...parsed,
    schemaVersion: parsed.schemaVersion || 1,
    fx: { ...base.fx, ...(parsed.fx || {}) },
    market: { ...base.market, ...(parsed.market || {}) },
    snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
    investors: parsed.investors,
    assetCatalog: parsed.assetCatalog || base.assetCatalog,
    marketIndicators: Array.isArray(parsed.marketIndicators) ? parsed.marketIndicators : base.marketIndicators,
    cashflows: parsed.cashflows,
    trades: parsed.trades
  };
}

function validateImportState(candidate) {
  const errors = [];
  const isArray = (key) => {
    if (!Array.isArray(candidate?.[key])) errors.push(`${key} 배열이 없습니다.`);
  };
  isArray("investors");
  isArray("trades");
  isArray("cashflows");

  if (errors.length) return errors;

  candidate.investors.forEach((investor, index) => {
    if (typeof investor.id !== "string" || typeof investor.name !== "string") {
      errors.push(`investors[${index}] 필수 필드가 올바르지 않습니다.`);
    }
  });
  candidate.cashflows.forEach((flow, index) => {
    if (typeof flow.ownerId !== "string" || !["deposit", "withdraw"].includes(flow.type) || typeof flow.amount !== "number") {
      errors.push(`cashflows[${index}] 필수 필드가 올바르지 않습니다.`);
    }
  });
  candidate.trades.forEach((trade, index) => {
    if (
      typeof trade.ownerId !== "string" ||
      !["buy", "sell"].includes(trade.side) ||
      typeof trade.ticker !== "string" ||
      typeof trade.quantity !== "number" ||
      typeof trade.price !== "number" ||
      typeof trade.fx !== "number"
    ) {
      errors.push(`trades[${index}] 필수 필드가 올바르지 않습니다.`);
    }
  });

  return errors;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return structuredClone(seedState);
  try {
    const parsed = JSON.parse(raw);
    const errors = validateImportState(parsed);
    if (errors.length) return structuredClone(seedState);
    return normalizeState(parsed);
  } catch {
    return structuredClone(seedState);
  }
}

function exportableState() {
  return {
    ...state,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString()
  };
}

function saveState(options = {}) {
  state.schemaVersion = SCHEMA_VERSION;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (options.snapshot !== false) recordSnapshot();
}

function money(value) {
  return formatter.format(Math.round(value || 0));
}

function pct(value) {
  return `${numberFormatter.format(value || 0)}%`;
}

function qty(value) {
  return numberFormatter.format(value || 0);
}

function signedMoney(value) {
  return `${value >= 0 ? "+" : ""}${money(value)}`;
}

function currentUsdKrw() {
  return state.fx.mode === "manual" ? Number(state.fx.manualUsdkrw || DEFAULT_USDKRW) : Number(state.fx.usdkrw || DEFAULT_USDKRW);
}

function formatClock(value) {
  if (!value) return "대기 중";
  return new Date(value).toLocaleTimeString("ko-KR", { hour12: false });
}

function formatMinutesAgo(value) {
  if (!value) return "갱신 전";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  return `${minutes}분 전 기준`;
}

function showToast(message, variant = "info") {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.toggle("negative", variant === "error");
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function investorById(id) {
  return state.investors.find((investor) => investor.id === id) || state.investors[0];
}

function makeInvestor(name) {
  const clean = name.trim();
  return {
    id: `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: clean,
    initials: clean.slice(0, 1).toUpperCase()
  };
}

function tradeAmountKrw(trade) {
  return trade.quantity * trade.price * trade.fx;
}

function getAsset(ticker, fallback = {}) {
  return state.assetCatalog[ticker] || {
    ticker,
    name: fallback.name || ticker,
    type: fallback.type || "주식",
    currency: fallback.currency || "USD",
    currentPrice: fallback.price || 0,
    currentFx: fallback.fx || currentUsdKrw(),
    annualDividend: 0
  };
}

function ensureAssetFromTrade(trade) {
  const existing = state.assetCatalog[trade.ticker];
  state.assetCatalog[trade.ticker] = {
    ticker: trade.ticker,
    name: trade.name || existing?.name || trade.ticker,
    type: trade.type || existing?.type || "주식",
    currency: trade.currency || existing?.currency || "USD",
    currentPrice: existing?.currentPrice ?? trade.price,
    currentFx: existing?.currentFx ?? trade.fx,
    annualDividend: existing?.annualDividend ?? 0
  };
}

function replayHoldings(ownerId) {
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
      annualDividend: asset.annualDividend || 0
    };
  });
}

function netCashflow(ownerId) {
  return state.cashflows
    .filter((flow) => !ownerId || flow.ownerId === ownerId)
    .reduce((sum, flow) => sum + (flow.type === "deposit" ? flow.amount : -flow.amount), 0);
}

function cashBalance(ownerId) {
  const principal = netCashflow(ownerId);
  const tradeCash = state.trades
    .filter((trade) => !ownerId || trade.ownerId === ownerId)
    .reduce((sum, trade) => sum + (trade.side === "buy" ? -tradeAmountKrw(trade) : tradeAmountKrw(trade)), 0);
  return principal + tradeCash;
}

function expectedDividend(ownerId) {
  return replayHoldings(ownerId).reduce((sum, holding) => sum + holding.annualDividend, 0);
}

function summarize(ownerId) {
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

function groupedByType(ownerId) {
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

function recordSnapshot() {
  const today = new Date().toISOString().slice(0, 10);
  const totalValue = summarize().totalValue;
  const next = (state.snapshots || []).filter((item) => item.date !== today);
  next.push({ date: today, totalValue });
  next.sort((a, b) => a.date.localeCompare(b.date));
  state.snapshots = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function visibleOwnerId() {
  return state.selectedView === "investor" ? state.selectedInvestorId : null;
}

function renderView() {
  document.querySelectorAll(".view-panel").forEach((panel) => panel.classList.remove("active-view"));
  const view = document.querySelector(`#${state.selectedView}View`) ? state.selectedView : "dashboard";
  document.querySelector(`#${view}View`).classList.add("active-view");
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  const scope = view === "investor" ? investorById(state.selectedInvestorId).name : "All Investors";
  document.querySelector("#holdingsScope").textContent = scope;
  document.querySelector("#transactionsScope").textContent = scope;
  document.querySelector("#ledgerWorkspace").classList.toggle("hidden", !["dashboard", "investor"].includes(view));
}

function renderDashboard() {
  const summary = summarize();
  const totalProfit = document.querySelector("#totalProfit");
  document.querySelector("#totalValue").textContent = money(summary.totalValue);
  document.querySelector("#totalPrincipal").textContent = money(summary.principal);
  totalProfit.textContent = signedMoney(summary.profit);
  totalProfit.className = summary.profit >= 0 ? "positive" : "negative";
  document.querySelector("#profitRate").textContent = `수익률 ${summary.returnRate >= 0 ? "+" : ""}${pct(summary.returnRate)}`;
  document.querySelector("#totalDividend").textContent = `총배당 ${money(summary.dividend)}`;
  document.querySelector("#cashAmount").textContent = money(summary.cash);
  document.querySelector("#cashRatio").textContent = `평가금액 포함 · ${pct(summary.totalValue ? (summary.cash / summary.totalValue) * 100 : 0)}`;
}

function renderAllocation() {
  const groups = groupedByType();
  const total = Math.max(summarize().totalValue, 1);
  let cursor = 0;
  const segments = groups.map((group, index) => {
    const value = Math.max(group.value, 0);
    const start = cursor;
    const end = cursor + (value / total) * 100;
    cursor = end;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  });
  document.querySelector("#allocationDonut").style.background = `conic-gradient(${segments.join(", ") || `${colors[0]} 0 100%`})`;

  const legend = document.querySelector("#allocationLegend");
  legend.innerHTML = "";
  groups.forEach((group, index) => {
    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `
      <span><i class="swatch" style="background:${colors[index % colors.length]}"></i>${group.type}</span>
      <strong class="${group.value < 0 ? "negative" : ""}">${pct(group.actual)}</strong>
    `;
    legend.appendChild(row);
  });
}

function renderMarket() {
  const list = document.querySelector("#marketList");
  list.innerHTML = "";
  state.marketIndicators.forEach((item) => {
    const premium = item.globalKrw ? ((item.domestic / item.globalKrw) - 1) * 100 : 0;
    const row = document.createElement("div");
    row.className = "market-card";
    row.innerHTML = `
      <div><strong>${item.symbol}</strong><small>국내 ${money(item.domestic)} · 해외환산 ${money(item.globalKrw)}</small></div>
      <span class="${premium >= 0 ? "positive" : "negative"}">${premium >= 0 ? "+" : ""}${pct(premium)}</span>
    `;
    list.appendChild(row);
  });
}

function renderInvestorComparison() {
  const list = document.querySelector("#investorComparison");
  list.innerHTML = "";
  const total = summarize().totalValue || 1;
  state.investors.forEach((investor) => {
    const summary = summarize(investor.id);
    const share = (summary.totalValue / total) * 100;
    const row = document.createElement("div");
    row.className = "investor-card";
    row.innerHTML = `
      <div class="avatar">${investor.initials}</div>
      <div><strong>${investor.name}</strong><small>지분 ${pct(share)} · ${summary.holdings.length}개 종목</small></div>
      <span class="${summary.profit >= 0 ? "positive" : "negative"}">${signedMoney(summary.profit)}</span>
    `;
    list.appendChild(row);
  });
}

function renderInvestorTabs() {
  const tabs = document.querySelector("#investorTabs");
  tabs.innerHTML = "";
  state.investors.forEach((investor) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `investor-chip ${investor.id === state.selectedInvestorId ? "active" : ""}`;
    button.dataset.investorId = investor.id;
    button.innerHTML = `<span>${investor.initials}</span>${investor.name}`;
    tabs.appendChild(button);
  });
}

function renderInvestorSheet() {
  const investor = investorById(state.selectedInvestorId);
  const summary = summarize(investor.id);
  document.querySelector("#selectedInvestorLabel").textContent = `${investor.name}님의 평가금액`;
  document.querySelector("#investorValue").textContent = money(summary.totalValue);
  document.querySelector("#investorProfit").textContent = signedMoney(summary.profit);
  document.querySelector("#investorProfit").className = summary.profit >= 0 ? "positive" : "negative";
  document.querySelector("#investorReturn").textContent = `수익률 ${summary.returnRate >= 0 ? "+" : ""}${pct(summary.returnRate)}`;
  document.querySelector("#investorHoldingsCount").textContent = `${summary.holdings.length}개 종목`;
  document.querySelector("#investorPrincipal").textContent = money(summary.principal);
  document.querySelector("#investorTax").textContent = money(summary.tax);
  document.querySelector("#investorDividend").textContent = money(summary.dividend);
  document.querySelector("#investorDividendAfterTax").textContent = `세후 ${money(summary.dividendAfterTax)}`;
  document.querySelector("#investorCash").textContent = money(summary.cash);
  document.querySelector("#deleteInvestorButton").disabled = state.investors.length <= 1;
  renderDeleteConfirm();
  renderCashflows();
  renderTradePreview();
}

function renderHoldings() {
  const body = document.querySelector("#holdingsTable");
  body.innerHTML = "";
  for (const item of replayHoldings(visibleOwnerId())) {
    const owner = investorById(item.ownerId);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="asset-name"><strong>${item.ticker}</strong><small>${item.name}</small></span></td>
      <td><span class="owner-label">${owner.name}</span></td>
      <td><span class="pill">${item.type}</span></td>
      <td>${qty(item.quantity)}</td>
      <td>${money(item.avgPrice * item.avgFx)}<small class="subtext">${item.currency} ${numberFormatter.format(item.avgPrice)} · FX ${numberFormatter.format(item.avgFx)}</small></td>
      <td>${money(item.currentPrice * item.currentFx)}<small class="subtext">${item.currency} ${numberFormatter.format(item.currentPrice)} · FX ${numberFormatter.format(item.currentFx)}</small></td>
      <td>${money(item.valueKrw)}</td>
      <td class="${item.profit >= 0 ? "positive" : "negative"}">${signedMoney(item.profit)}<small class="subtext">주가 ${signedMoney(item.stockProfit)} · 환 ${signedMoney(item.fxProfit)}</small></td>
    `;
    body.appendChild(row);
  }
}

function visibleTransactions() {
  const ownerId = visibleOwnerId();
  return [
    ...state.cashflows.map((flow) => ({ ...flow, kind: "cashflow" })),
    ...state.trades.map((trade) => ({ ...trade, kind: "trade" }))
  ]
    .filter((item) => !ownerId || item.ownerId === ownerId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function renderTransactions() {
  const body = document.querySelector("#transactionsTable");
  body.innerHTML = "";
  visibleTransactions().forEach((item) => {
    const owner = investorById(item.ownerId);
    const isCashflow = item.kind === "cashflow";
    const label = isCashflow ? (item.type === "deposit" ? "입금" : "출금") : (item.side === "buy" ? "매수" : "매도");
    const asset = isCashflow ? "예수금" : item.ticker;
    const amount = isCashflow ? item.amount : tradeAmountKrw(item);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.date}</td>
      <td>${owner.name}</td>
      <td><span class="pill">${label}</span></td>
      <td>${asset}</td>
      <td>${money(amount)}</td>
    `;
    body.appendChild(row);
  });
}

function renderCashflows() {
  const list = document.querySelector("#cashflowList");
  list.innerHTML = "";
  state.cashflows
    .filter((flow) => flow.ownerId === state.selectedInvestorId)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .forEach((flow) => {
      const row = document.createElement("div");
      row.className = "cashflow-row";
      row.innerHTML = `
        <span>${flow.date}</span>
        <strong class="${flow.type === "deposit" ? "positive" : "negative"}">${flow.type === "deposit" ? "입금" : "출금"} ${money(flow.amount)}</strong>
      `;
      list.appendChild(row);
    });
}

function renderTrend() {
  const area = document.querySelector("#trendArea");
  const snapshots = state.snapshots || [];
  if (snapshots.length < 2) {
    area.innerHTML = `<div class="empty-state">데이터가 쌓이면 추이가 표시됩니다.</div>`;
    return;
  }
  const width = 760;
  const height = 220;
  const pad = 18;
  const values = snapshots.map((item) => item.totalValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const points = snapshots.map((item, index) => {
    const x = pad + (index / Math.max(snapshots.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - ((item.totalValue - min) / span) * (height - pad * 2);
    return `${x},${y}`;
  });
  area.innerHTML = `
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="총자산 추이">
      <polyline points="${points.join(" ")}" fill="none" stroke="#9d7bff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
      ${points.map((point) => `<circle cx="${point.split(",")[0]}" cy="${point.split(",")[1]}" r="4" fill="#f3f3f7"></circle>`).join("")}
      <text x="${pad}" y="${height - 2}" fill="#8e8e9c" font-size="12">${snapshots[0].date}</text>
      <text x="${width - pad}" y="${height - 2}" fill="#8e8e9c" font-size="12" text-anchor="end">${snapshots.at(-1).date}</text>
      <text x="${pad}" y="14" fill="#8e8e9c" font-size="12">${money(max)}</text>
    </svg>
  `;
}

function renderFx() {
  document.querySelector("#fxRateLabel").textContent = numberFormatter.format(currentUsdKrw());
  const source = state.fx.source === "hana" ? "하나은행 기준" : state.fx.source === "fallback" ? "환율 API 기준(폴백)" : "수동 기준";
  document.querySelector("#fxSourceLabel").textContent = `${source}${state.fx.updatedAt ? ` · ${formatClock(state.fx.updatedAt)} 갱신` : ""}`;
  document.querySelector("#manualFxToggle").checked = state.fx.mode === "manual";
  document.querySelector("#manualFxInput").value = state.fx.manualUsdkrw || currentUsdKrw();
  document.querySelector("#manualFxInput").disabled = state.fx.mode !== "manual";
}

function renderMarketStatus() {
  const label = document.querySelector("#marketStatus");
  if (state.market.error) {
    label.textContent = `시세 갱신 실패 · ${formatMinutesAgo(state.market.lastSuccessAt)}`;
    label.classList.add("negative");
  } else {
    label.textContent = `마지막 갱신: ${formatClock(state.market.lastUpdatedAt)}`;
    label.classList.remove("negative");
  }
}

function populateOwnerSelects() {
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

function updateAssetFieldsFromTicker(ticker) {
  const asset = state.assetCatalog[ticker.trim().toUpperCase()];
  if (!asset) return;
  const form = document.querySelector("#tradeForm");
  form.elements.name.value = asset.name;
  form.elements.type.value = asset.type;
  form.elements.currency.value = asset.currency;
  form.elements.currentPrice.value = asset.currentPrice;
  form.elements.currentFx.value = asset.currentFx;
}

function tradePreviewData() {
  const form = document.querySelector("#tradeForm");
  const ownerId = form.elements.ownerId.value;
  const side = form.elements.side.value;
  const ticker = form.elements.ticker.value.trim().toUpperCase();
  const quantity = Number(form.elements.quantity.value) || 0;
  const price = Number(form.elements.price.value) || 0;
  const fx = Number(form.elements.fx.value) || 1;
  const before = replayHoldings(ownerId).find((holding) => holding.ticker === ticker);
  const buyForeign = quantity * price;
  const buyKrw = buyForeign * fx;

  if (!ticker || !quantity || !price) {
    return { before, text: "종목, 수량, 체결가를 입력하면 물타기 결과가 표시됩니다." };
  }

  if (side === "sell") {
    return { before, text: `예상 매도대금 ${money(buyKrw)} · 보유수량 ${qty(before?.quantity || 0)}` };
  }

  const prevQty = before?.quantity || 0;
  const prevForeign = before?.costForeign || 0;
  const prevKrw = before?.costKrw || 0;
  const newQty = prevQty + quantity;
  const newForeign = prevForeign + buyForeign;
  const newKrw = prevKrw + buyKrw;
  const newAvgPrice = newQty ? newForeign / newQty : 0;
  const newAvgFx = newForeign ? newKrw / newForeign : fx;
  const asset = getAsset(ticker, { price, fx, currency: form.elements.currency.value });
  const currentFx = asset.currency === "KRW" ? 1 : Number(form.elements.currentFx.value || asset.currentFx || fx);
  const currentPrice = Number(form.elements.currentPrice.value || asset.currentPrice || price);
  const expectedValue = newQty * currentPrice * currentFx;
  const expectedProfit = expectedValue - newKrw;
  return {
    before,
    text: `매수 후 수량 ${qty(newQty)} · 새 평단 ${money(newAvgPrice * newAvgFx)} · 평균환율 ${qty(newAvgFx)} · 예상손익 ${signedMoney(expectedProfit)}`
  };
}

function renderTradePreview() {
  const preview = document.querySelector("#tradePreview");
  if (!preview) return;
  preview.textContent = tradePreviewData().text;
}

function canWithdraw(ownerId, amount) {
  return cashBalance(ownerId) >= amount;
}

function dividendScenario() {
  const form = document.querySelector("#dividendSimForm");
  const ticker = form.elements.ticker.value.trim().toUpperCase() || "CUSTOM";
  const quantity = Number(form.elements.quantity.value) || 0;
  const price = Number(form.elements.price.value) || 0;
  const currency = form.elements.currency.value;
  const fx = currency === "KRW" ? 1 : Number(form.elements.fx.value) || currentUsdKrw();
  const annualYield = (Number(form.elements.yield.value) || 0) / 100;
  const frequency = Number(form.elements.frequency.value) || 12;
  const years = Math.min(30, Math.max(1, Number(form.elements.years.value) || 10));
  const growthRate = (Number(form.elements.growth.value) || 0) / 100;
  const drip = form.elements.drip.checked;
  const priceKrw = price * fx;
  const principal = quantity * priceKrw;
  const annualBeforeTax = principal * annualYield;
  const annualBeforeTaxNative = quantity * price * annualYield;

  return {
    ticker,
    quantity,
    price,
    currency,
    fx,
    annualYield,
    frequency,
    years,
    growthRate,
    drip,
    priceKrw,
    principal,
    annualBeforeTax,
    annualBeforeTaxNative
  };
}

function dividendRows(scenario) {
  let quantity = scenario.quantity;
  const rows = [];
  let cumulativeAfterTax = 0;
  for (let year = 1; year <= scenario.years; year += 1) {
    const valueKrw = quantity * scenario.priceKrw;
    const beforeTax = valueKrw * scenario.annualYield * Math.pow(1 + scenario.growthRate, year - 1);
    const afterTax = beforeTax * (1 - DIVIDEND_TAX_RATE);
    const addedQuantity = scenario.drip && scenario.priceKrw > 0 ? afterTax / scenario.priceKrw : 0;
    if (scenario.drip) {
      quantity += addedQuantity;
    }
    cumulativeAfterTax += afterTax;
    rows.push({ year, valueKrw, beforeTax, afterTax, cumulativeAfterTax, addedQuantity, endingQuantity: quantity });
  }
  return rows;
}

function renderDividendSimulation() {
  const form = document.querySelector("#dividendSimForm");
  if (!form) return;
  if (!form.elements.fx.dataset.touched) {
    form.elements.fx.value = numberFormatter.format(currentUsdKrw()).replace(/,/g, "");
  }
  const scenario = dividendScenario();
  const rows = dividendRows(scenario);
  const first = rows[0] || { beforeTax: 0, afterTax: 0, cumulativeAfterTax: 0, addedQuantity: 0, endingQuantity: scenario.quantity };
  const last = rows.at(-1) || first;
  const periodAfterTax = first.afterTax / scenario.frequency;
  const totalReturnOnCost = scenario.principal ? (last.cumulativeAfterTax / scenario.principal) * 100 : 0;
  const monthlyAfterTax = first.afterTax / 12;
  const nativeSymbol = scenario.currency === "USD" ? "$" : "₩";
  const basisText = `${qty(scenario.quantity)}주 × ${nativeSymbol}${numberFormatter.format(scenario.price)} × ${numberFormatter.format(scenario.fx)}`;
  const afterTaxYield = scenario.annualYield * (1 - DIVIDEND_TAX_RATE) * 100;
  const growthText = `성장률 ${pct(scenario.growthRate * 100)} 가정`;

  document.querySelector("#dividendSummaryCards").innerHTML = `
    <div class="sim-result-main">
      <div>
        <p class="eyebrow">예상 연 배당 · 세후</p>
        <strong>${money(first.afterTax)}</strong>
      </div>
      <span>월 평균 <b>${money(monthlyAfterTax)}</b></span>
      <span>세전 <b>${nativeSymbol}${numberFormatter.format(scenario.annualBeforeTaxNative)}</b> (${money(first.beforeTax)})</span>
    </div>
    <div class="sim-result-sub">
      <div>
        <p class="eyebrow">현재 투자원금</p>
        <strong>${money(scenario.principal)}</strong>
        <small>${basisText}</small>
      </div>
      <div>
        <p class="eyebrow">현재 배당수익률</p>
        <strong class="positive">${pct(scenario.annualYield * 100)}</strong>
        <small>세후 환산 ${pct(afterTaxYield)}</small>
      </div>
      <div>
        <p class="eyebrow">${scenario.years}년 누적 · 세후</p>
        <strong>${money(last.cumulativeAfterTax)}</strong>
        <small>${growthText}</small>
      </div>
    </div>
  `;

  renderTargetDividend(scenario);

  const max = Math.max(...rows.map((row) => row.afterTax), 1);
  const width = 760;
  const height = 240;
  const barWidth = Math.max(8, (width - 48) / rows.length - 6);
  document.querySelector("#dividendChartTitle").textContent = `연도별 예상 배당 · 세후 (DRIP ${scenario.drip ? "on" : "off"} 적용)`;
  document.querySelector("#dividendChart").innerHTML = `
    <svg class="dividend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="배당 시뮬레이션">
      ${rows.map((row, index) => {
        const x = 24 + index * ((width - 48) / rows.length);
        const barHeight = (row.afterTax / max) * (height - 44);
        const y = height - 24 - barHeight;
        return `
          <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="5" fill="#7c5cfc"></rect>
          <text x="${x + barWidth / 2}" y="${height - 5}" fill="#8e8e9c" font-size="11" text-anchor="middle">${row.year}년</text>
        `;
      }).join("")}
      <text x="24" y="14" fill="#8e8e9c" font-size="12">${money(max)}</text>
    </svg>
  `;

  document.querySelector("#dividendScenarioPanel").innerHTML = `
    <div class="scenario-block"><span>시뮬레이션 종목</span><strong>${scenario.ticker}</strong></div>
    <div class="scenario-block"><span>보유 수량</span><strong>${qty(scenario.quantity)}주</strong></div>
    <div class="scenario-block"><span>세후 배당수익률</span><strong>${pct(scenario.annualYield * (1 - DIVIDEND_TAX_RATE) * 100)}</strong></div>
    <div class="scenario-block"><span>누적 배당 / 원금</span><strong>${pct(totalReturnOnCost)}</strong></div>
    <div class="scenario-block"><span>DRIP 후 예상 수량</span><strong>${qty(last.endingQuantity)}주</strong></div>
  `;

  document.querySelector("#dividendDetailTableWrap").classList.toggle("hidden", !dividendDetailOpen);
  document.querySelector("#toggleDividendDetail").textContent = dividendDetailOpen ? "표 숨기기" : "표로 보기";
  document.querySelector("#dividendTable").innerHTML = rows.map((row) => `
    <tr>
      <td>${row.year}년차</td>
      <td>${money(row.valueKrw)}</td>
      <td>${money(row.beforeTax)}</td>
      <td>${money(row.afterTax)}</td>
      <td>${money(row.cumulativeAfterTax)}</td>
      <td>${qty(row.addedQuantity)}</td>
    </tr>
  `).join("");
}

function renderTargetDividend(scenario) {
  const targetInput = document.querySelector("#targetMonthlyDividend");
  const target = Number(targetInput.value) || 0;
  const effectiveYield = scenario.annualYield * (1 - DIVIDEND_TAX_RATE);
  const results = document.querySelector("#targetDividendResults");
  if (!effectiveYield || scenario.priceKrw <= 0) {
    results.innerHTML = `<div class="target-message">배당수익률과 현재가를 입력하면 계산됩니다.</div>`;
    return;
  }
  const requiredAnnualAfterTax = target * 12;
  const requiredPrincipal = requiredAnnualAfterTax / effectiveYield;
  const requiredQuantity = requiredPrincipal / scenario.priceKrw;
  const additionalQuantity = requiredQuantity - scenario.quantity;
  const message = additionalQuantity > 0
    ? `현재 보유수량 대비 추가 매수 ${qty(additionalQuantity)}주 필요`
    : "이미 목표 초과 달성";
  results.innerHTML = `
    <div class="target-result-card">
      <span>필요 투자금액</span>
      <strong>${money(requiredPrincipal)}</strong>
    </div>
    <div class="target-result-card">
      <span>필요 보유수량</span>
      <strong>${qty(requiredQuantity)}주</strong>
    </div>
    <div class="target-message">${message}</div>
  `;
}

function renderDividendCalendar() {
  const ownerId = document.querySelector("#calendarTargetSelect").value || null;
  const holdings = replayHoldings(ownerId).filter((holding) => holding.annualDividend > 0);
  const grid = document.querySelector("#dividendCalendar");
  grid.innerHTML = "";
  monthNames.forEach((monthName, monthIndex) => {
    const month = monthIndex + 1;
    const items = holdings
      .filter((holding) => (DIVIDEND_MONTHS[holding.ticker] || [3, 6, 9, 12]).includes(month))
      .map((holding) => {
        const months = DIVIDEND_MONTHS[holding.ticker] || [3, 6, 9, 12];
        const afterTax = (holding.annualDividend / months.length) * (1 - DIVIDEND_TAX_RATE);
        return `<div class="calendar-item"><strong>${holding.ticker}</strong><span>${money(afterTax)}</span></div>`;
      })
      .join("");
    const card = document.createElement("article");
    card.className = "month-card";
    card.innerHTML = `<h3>${monthName}</h3><div class="month-items">${items || `<span class="subtext">예정 배당 없음</span>`}</div>`;
    grid.appendChild(card);
  });
}

function render() {
  renderView();
  renderDashboard();
  renderAllocation();
  renderMarket();
  renderInvestorComparison();
  renderInvestorTabs();
  renderInvestorSheet();
  renderHoldings();
  renderTransactions();
  renderTrend();
  renderFx();
  renderMarketStatus();
  populateOwnerSelects();
  renderDividendSimulation();
  renderDividendCalendar();
  document.querySelector("#undoImportButton").classList.toggle("hidden", !importRollbackState);
}

function openDialog(dialog) {
  if (typeof dialog.showModal === "function") dialog.showModal();
}

async function updateCoinQuotes() {
  const coinHoldings = replayHoldings().filter((holding) => holding.type === "코인");
  const symbols = [...new Set(coinHoldings.map((holding) => holding.ticker.toUpperCase()))];
  if (!symbols.length) return;
  const coingeckoIds = symbols.map((symbol) => COINGECKO_IDS[symbol]).filter(Boolean);
  const overseas = {};

  if (coingeckoIds.length) {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoIds.join(",")}&vs_currencies=usd`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("CoinGecko 시세를 가져오지 못했습니다.");
    const data = await response.json();
    symbols.forEach((symbol) => {
      const id = COINGECKO_IDS[symbol];
      if (data[id]?.usd) overseas[symbol] = data[id].usd;
    });
  }

  for (const symbol of symbols) {
    const bithumbResponse = await fetch(`https://api.bithumb.com/public/ticker/${symbol}_KRW`);
    if (!bithumbResponse.ok) throw new Error("빗썸 시세를 가져오지 못했습니다.");
    const bithumb = await bithumbResponse.json();
    const domestic = Number(bithumb?.data?.closing_price);
    const globalUsd = overseas[symbol];
    const asset = state.assetCatalog[symbol];
    if (asset && globalUsd) {
      asset.currentPrice = globalUsd;
      asset.currentFx = currentUsdKrw();
    }
    if (domestic && globalUsd) {
      const globalKrw = globalUsd * currentUsdKrw();
      const next = { symbol, domestic, globalKrw, updatedAt: new Date().toISOString() };
      const index = state.marketIndicators.findIndex((item) => item.symbol === symbol);
      if (index >= 0) state.marketIndicators[index] = next;
      else state.marketIndicators.push(next);
    }
  }
}

async function updateStockQuotes() {
  if (!PROXY_BASE_URL) return;
  const holdings = replayHoldings().filter((holding) => holding.type === "주식" && holding.currency === "USD");
  const symbols = [...new Set(holdings.map((holding) => holding.ticker))];
  for (const symbol of symbols) {
    const response = await fetch(`${PROXY_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}`);
    if (!response.ok) throw new Error("미국주식 시세를 가져오지 못했습니다.");
    const quote = await response.json();
    if (quote.c && state.assetCatalog[symbol]) {
      state.assetCatalog[symbol].currentPrice = Number(quote.c);
      state.assetCatalog[symbol].currentFx = currentUsdKrw();
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function refreshQuotes() {
  try {
    await updateCoinQuotes();
    await updateStockQuotes();
    state.market = {
      lastUpdatedAt: new Date().toISOString(),
      lastSuccessAt: new Date().toISOString(),
      failedAt: null,
      error: null
    };
    saveState({ snapshot: true });
    render();
  } catch (error) {
    state.market.failedAt = new Date().toISOString();
    state.market.error = error.message;
    saveState({ snapshot: false });
    renderMarketStatus();
  }
}

async function refreshFxRate() {
  if (state.fx.mode === "manual" || !PROXY_BASE_URL) return;
  try {
    const response = await fetch(`${PROXY_BASE_URL}/fxrate`);
    if (!response.ok) throw new Error("환율을 가져오지 못했습니다.");
    const data = await response.json();
    const usdkrw = Number(data.usdkrw);
    if (!usdkrw) throw new Error("환율 응답이 올바르지 않습니다.");
    state.fx.usdkrw = usdkrw;
    state.fx.source = data.source || "fallback";
    state.fx.updatedAt = data.updatedAt || new Date().toISOString();
    Object.values(state.assetCatalog).forEach((asset) => {
      if (asset.currency === "USD") asset.currentFx = usdkrw;
    });
    saveState({ snapshot: true });
    render();
  } catch {
    state.fx.source = "manual";
    renderFx();
  }
}

function startPolling() {
  refreshFxRate();
  refreshQuotes();
  clearInterval(pollingTimer);
  clearInterval(fxTimer);
  pollingTimer = setInterval(refreshQuotes, 60000);
  fxTimer = setInterval(refreshFxRate, 60 * 60 * 1000);
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    state.selectedView = button.dataset.view;
    saveState({ snapshot: false });
    render();
  });
});

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
  const investor = makeInvestor(input.value);
  state.investors.push(investor);
  state.selectedInvestorId = investor.id;
  state.selectedView = "investor";
  input.value = "";
  saveState();
  render();
});

document.querySelector("#deleteInvestorButton").addEventListener("click", () => {
  if (state.investors.length <= 1) return;
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

function renderDeleteConfirm() {
  document.querySelector("#deleteConfirm").classList.toggle("show", state.pendingDeleteInvestorId === state.selectedInvestorId);
}

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
  const form = document.querySelector("#tradeForm");
  form.reset();
  form.elements.date.valueAsDate = new Date();
  form.elements.fx.value = currentUsdKrw();
  form.elements.currentFx.value = currentUsdKrw();
  populateOwnerSelects();
  renderTradePreview();
  openDialog(document.querySelector("#tradeDialog"));
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
  const ownerId = form.elements.ownerId.value;
  const side = form.elements.side.value;
  const ticker = form.elements.ticker.value.trim().toUpperCase();
  const quantity = Number(form.elements.quantity.value) || 0;
  const price = Number(form.elements.price.value) || 0;
  const fx = Number(form.elements.fx.value) || 1;
  const currentPrice = Number(form.elements.currentPrice.value) || price;
  const currentFx = form.elements.currency.value === "KRW" ? 1 : Number(form.elements.currentFx.value) || fx;
  const amount = quantity * price * fx;
  const existing = replayHoldings(ownerId).find((holding) => holding.ticker === ticker);

  if (side === "buy" && cashBalance(ownerId) < amount) {
    form.elements.quantity.setCustomValidity("매수금액이 예수금을 초과합니다.");
    form.reportValidity();
    form.elements.quantity.setCustomValidity("");
    return;
  }
  if (side === "sell" && (!existing || existing.quantity < quantity)) {
    form.elements.quantity.setCustomValidity("매도수량이 보유수량을 초과합니다.");
    form.reportValidity();
    form.elements.quantity.setCustomValidity("");
    return;
  }

  const trade = {
    id: crypto.randomUUID(),
    ownerId,
    date: form.elements.date.value,
    side,
    ticker,
    name: form.elements.name.value.trim() || ticker,
    type: form.elements.type.value,
    currency: form.elements.currency.value,
    quantity,
    price,
    fx,
    memo: form.elements.memo.value.trim()
  };
  ensureAssetFromTrade({ ...trade, price: currentPrice, fx: currentFx });
  state.assetCatalog[ticker].currentPrice = currentPrice;
  state.assetCatalog[ticker].currentFx = currentFx;
  state.trades.push(trade);
  saveState();
  render();
  form.closest("dialog").close();
});

document.querySelector("#seedButton").addEventListener("click", () => {
  state = structuredClone(seedState);
  saveState();
  render();
  showToast("데모 데이터를 초기화했습니다.");
});

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
    pendingImportState = normalizeState(parsed);
    openDialog(document.querySelector("#confirmImportDialog"));
  } catch {
    showToast("JSON 파일을 읽을 수 없습니다.", "error");
  } finally {
    event.target.value = "";
  }
});

document.querySelector("#confirmImportButton").addEventListener("click", () => {
  if (!pendingImportState) return;
  importRollbackState = structuredClone(state);
  state = pendingImportState;
  state.schemaVersion = SCHEMA_VERSION;
  pendingImportState = null;
  saveState();
  render();
  document.querySelector("#confirmImportDialog").close();
  showToast(`${dateFormatter.format(new Date())} 백업을 불러왔습니다.`);
});

document.querySelector("#undoImportButton").addEventListener("click", () => {
  if (!importRollbackState) return;
  state = importRollbackState;
  importRollbackState = null;
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
  if (state.fx.mode === "manual") {
    Object.values(state.assetCatalog).forEach((asset) => {
      if (asset.currency === "USD") asset.currentFx = value;
    });
  }
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
  dividendDetailOpen = !dividendDetailOpen;
  renderDividendSimulation();
});
document.querySelector("#targetMonthlyDividend").addEventListener("input", renderDividendSimulation);
document.querySelector("#calendarTargetSelect").addEventListener("change", renderDividendCalendar);

document.querySelector("#cashflowForm").elements.date.valueAsDate = new Date();
recordSnapshot();
render();
startPolling();
