const STORAGE_KEY = "assetpilot-ledger-state-v2";
const LEGACY_STORAGE_KEY = "assetpilot-ledger-state-v1";
const SCHEMA_VERSION = 2;
const DIVIDEND_TAX_RATE = 0.15;
const DEFAULT_USDKRW = 1380;
const DEFAULT_PROXY_BASE_URL = "";
const PROXY_STORAGE_KEY = "assetpilot-proxy-base-url";
const ALLOCATION_RATIOS_KEY = "assetpilot-allocation-ratios-v1";
const COINGECKO_IDS = {
  BTC: "bitcoin",
  ETH: "ethereum",
  BNB: "binancecoin",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  LINK: "chainlink"
};
const CRYPTO_LOGOS = {
  BTC: "https://cdn.simpleicons.org/bitcoin/f7931a",
  ETH: "https://cdn.simpleicons.org/ethereum/627eea",
  SOL: "https://cdn.simpleicons.org/solana/9945ff",
  BNB: "https://cdn.simpleicons.org/binance/f3ba2f",
  XRP: "https://cdn.simpleicons.org/xrp/f3f3f7"
};
const DIVIDEND_MONTHS = {
  SCHD: [3, 6, 9, 12],
  O: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  "360750": [1, 4, 7, 10],
  KR3Y: [3, 6, 9, 12]
};
const INDEX_MONITOR_LIST = [
  { ticker: "QQQ", label: "나스닥", group: "ETF", logoText: "Q" },
  { ticker: "SPY", label: "S&P500", group: "ETF", logoText: "S&P" },
  { ticker: "IWM", label: "러셀2000", group: "ETF", logoText: "R2K" },
  { ticker: "SOXX", label: "필라델피아 반도체", group: "ETF", logoText: "SOX" },
  { ticker: "AAPL", label: "Apple", group: "M7", logo: "https://cdn.simpleicons.org/apple/f3f3f7" },
  { ticker: "MSFT", label: "Microsoft", group: "M7", logo: "https://cdn.simpleicons.org/microsoft/f3f3f7" },
  { ticker: "GOOGL", label: "Alphabet", group: "M7", logo: "https://cdn.simpleicons.org/google/f3f3f7" },
  { ticker: "AMZN", label: "Amazon", group: "M7", logo: "https://cdn.simpleicons.org/amazon/f3f3f7" },
  { ticker: "NVDA", label: "NVIDIA", group: "M7", logo: "https://cdn.simpleicons.org/nvidia/f3f3f7" },
  { ticker: "META", label: "Meta", group: "M7", logo: "https://cdn.simpleicons.org/meta/f3f3f7" },
  { ticker: "TSLA", label: "Tesla", group: "M7", logo: "https://cdn.simpleicons.org/tesla/f3f3f7" }
];
const allocationColors = {
  코인: "#7C5CFC",
  주식: "#B69CFF",
  ETF: "#3BB5A6",
  채권: "#E8B339",
  예수금: "#5A5A68"
};
const ALLOCATION_ORDER = ["주식", "ETF", "코인", "채권", "예수금"];
const fallbackColors = ["#7c5cfc", "#b69cff", "#3bb5a6", "#e8b339", "#5a5a68"];
const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
let previousAllocationRatios = loadAllocationRatios();
let realtimeDemoInterval = null;
const ENABLE_AUTO_REALTIME_DEMO = true;
let previousRealtimeValues = {
  market: {},
  investors: {},
  index: {}
};
let holdingsTypeFilter = null;

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
    KR3Y: { ticker: "KR3Y", name: "국고채 3년", type: "채권", currency: "KRW", currentPrice: 100400, currentFx: 1, annualDividend: 36000 },
    XRP: { ticker: "XRP", name: "XRP", type: "코인", currency: "USD", currentPrice: 2.44, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    QQQ: { ticker: "QQQ", name: "Invesco QQQ Trust", type: "주식", currency: "USD", currentPrice: 740.62, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    SPY: { ticker: "SPY", name: "SPDR S&P 500 ETF", type: "주식", currency: "USD", currentPrice: 746.74, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    IWM: { ticker: "IWM", name: "iShares Russell 2000 ETF", type: "주식", currency: "USD", currentPrice: 295.59, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    SOXX: { ticker: "SOXX", name: "iShares Semiconductor ETF", type: "주식", currency: "USD", currentPrice: 639.45, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    AAPL: { ticker: "AAPL", name: "Apple", type: "주식", currency: "USD", currentPrice: 298.01, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    MSFT: { ticker: "MSFT", name: "Microsoft", type: "주식", currency: "USD", currentPrice: 379.4, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    GOOGL: { ticker: "GOOGL", name: "Alphabet", type: "주식", currency: "USD", currentPrice: 368.03, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    AMZN: { ticker: "AMZN", name: "Amazon", type: "주식", currency: "USD", currentPrice: 244.39, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    NVDA: { ticker: "NVDA", name: "NVIDIA", type: "주식", currency: "USD", currentPrice: 210.69, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    META: { ticker: "META", name: "Meta", type: "주식", currency: "USD", currentPrice: 577.22, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    TSLA: { ticker: "TSLA", name: "Tesla", type: "주식", currency: "USD", currentPrice: 400.49, currentFx: DEFAULT_USDKRW, annualDividend: 0 }
  },
  indexQuotes: {},
  marketIndicators: [
    { symbol: "BTC", domestic: 52000000, globalKrw: 50420000, updatedAt: null },
    { symbol: "ETH", domestic: 3300000, globalKrw: 3244000, updatedAt: null },
    { symbol: "SOL", domestic: 224000, globalKrw: 216800, updatedAt: null },
    { symbol: "BNB", domestic: 978000, globalKrw: 951000, updatedAt: null },
    { symbol: "XRP", domestic: 3500, globalKrw: 3370, updatedAt: null }
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
const requestedProxy = new URLSearchParams(window.location.search).get("proxy");
if (requestedProxy) {
  localStorage.setItem(PROXY_STORAGE_KEY, requestedProxy.replace(/\/$/, ""));
}
if (["dashboard", "investor", "dividend", "calendar"].includes(requestedView)) {
  state.selectedView = requestedView;
}
let pendingImportState = null;
let importRollbackState = null;
let toastTimer = null;
let pollingTimer = null;
let fxTimer = null;
let dividendDetailOpen = false;
let ledgerExpanded = false;

const formatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const numberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 4
});

const fxFormatter = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const percentFormatter = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3
});

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function mergeMarketIndicators(input, defaults) {
  const map = new Map();
  defaults.forEach((item) => map.set(item.symbol, item));
  if (Array.isArray(input)) input.forEach((item) => map.set(item.symbol, item));
  return Array.from(map.values());
}

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
    indexQuotes: parsed.indexQuotes || {},
    investors: parsed.investors,
    assetCatalog: { ...base.assetCatalog, ...(parsed.assetCatalog || {}) },
    marketIndicators: mergeMarketIndicators(parsed.marketIndicators, base.marketIndicators),
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

function loadAllocationRatios() {
  try {
    return JSON.parse(localStorage.getItem(ALLOCATION_RATIOS_KEY) || "{}") || {};
  } catch (error) {
    return {};
  }
}

function money(value) {
  return formatter.format(Math.round(value || 0));
}

function moneyParts(value) {
  return {
    symbol: "KRW",
    amount: new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(Math.round(value || 0))
  };
}

function setMoneyElement(selector, value) {
  const element = document.querySelector(selector);
  const parts = moneyParts(value);
  element.innerHTML = `<span class="currency-prefix">${parts.symbol}</span>${parts.amount}`;
}

function pct(value) {
  return `${percentFormatter.format(value || 0)}%`;
}

function qty(value) {
  return numberFormatter.format(value || 0);
}

function signedMoney(value) {
  return `${value >= 0 ? "+" : ""}${money(value)}`;
}

function signedUsd(value) {
  return `${value >= 0 ? "+" : "-"}${usdFormatter.format(Math.abs(value || 0))}`;
}

function markRealtimeChange(card, diff, formatter = signedMoney) {
  if (!card || !Number.isFinite(diff) || Math.abs(diff) < 0.000001) return;
  const direction = diff >= 0 ? "up" : "down";
  card.classList.remove("realtime-flash-up", "realtime-flash-down");
  void card.offsetWidth;
  card.classList.add(direction === "up" ? "realtime-flash-up" : "realtime-flash-down");
  card.querySelector(".metric-change-badge")?.remove();
  const badge = document.createElement("b");
  badge.className = `metric-change-badge ${direction === "up" ? "positive" : "negative"}`;
  badge.textContent = `${formatter(diff)} ${direction === "up" ? "▲" : "▼"}`;
  const slot = card.querySelector(".metric-badge-slot");
  if (slot) slot.appendChild(badge);
  else {
    const title = card.querySelector("strong");
    if (title) title.appendChild(badge);
    else card.appendChild(badge);
  }
  setTimeout(() => {
    badge.remove();
    card.classList.remove("realtime-flash-up", "realtime-flash-down");
  }, 1800);
}

function signedPercentChange(value) {
  return `${value >= 0 ? "+" : ""}${pct(value)}`;
}

function renderMetricTitle(label) {
  return `<strong class="metric-title"><span>${label}</span><i class="metric-badge-slot" aria-hidden="true"></i></strong>`;
}

function renderCryptoLogo(symbol) {
  const logo = CRYPTO_LOGOS[symbol];
  const text = symbol.slice(0, 3);
  return logo
    ? `<i class="stock-logo-frame crypto-logo-frame"><img src="${logo}" alt="" loading="lazy" onerror="this.remove()" /><b>${text}</b></i>`
    : `<i class="stock-logo-frame stock-logo-text crypto-logo-frame"><b>${text}</b></i>`;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function nudgeValue(value, percent, minimum = 0) {
  return Math.max(minimum, value * (1 + percent / 100));
}

function triggerDashboardChangeDemo(options = {}) {
  const silent = Boolean(options.silent);
  const now = new Date().toISOString();
  state.marketIndicators = mergeMarketIndicators(state.marketIndicators, seedState.marketIndicators).map((item) => {
    const domesticMove = randomBetween(-0.42, 0.58);
    const globalMove = randomBetween(-0.34, 0.46);
    return {
      ...item,
      domestic: Math.round(nudgeValue(item.domestic, domesticMove, 1)),
      globalKrw: Math.round(nudgeValue(item.globalKrw, globalMove, 1)),
      updatedAt: now
    };
  });

  replayHoldings().forEach((holding) => {
    const asset = state.assetCatalog[holding.ticker];
    if (asset?.currentPrice) {
      asset.currentPrice = Number(nudgeValue(asset.currentPrice, randomBetween(-0.36, 0.44), 0.0001).toFixed(asset.currency === "KRW" ? 0 : 2));
    }
  });

  state.indexQuotes = state.indexQuotes || {};
  INDEX_MONITOR_LIST.forEach((idx) => {
    const asset = state.assetCatalog[idx.ticker];
    if (!asset) return;
    const existing = state.indexQuotes[idx.ticker];
    const move = randomBetween(-0.58, 0.72);
    const basePrice = Number(existing?.price || asset.currentPrice || 1);
    const nextPrice = Number(nudgeValue(basePrice, move, 0.0001).toFixed(2));
    asset.currentPrice = nextPrice;
    state.indexQuotes[idx.ticker] = {
      price: nextPrice,
      changePercent: Math.max(-7.5, Math.min(7.5, Number(((existing?.changePercent || 0) + move).toFixed(2)))),
      updatedAt: now
    };
  });

  state.marketIndicators.forEach((item) => {
    const asset = state.assetCatalog[item.symbol];
    if (asset && item.globalKrw) {
      asset.currentPrice = Number((item.globalKrw / currentUsdKrw()).toFixed(2));
      asset.currentFx = currentUsdKrw();
    }
  });

  render();
  if (!silent) showToast("실시간 변동 효과 테스트 중입니다. 실제 데이터는 저장되지 않습니다.");
}

function startRealtimeDemoLoop() {
  if (!ENABLE_AUTO_REALTIME_DEMO) return;
  clearInterval(realtimeDemoInterval);
  realtimeDemoInterval = setInterval(() => {
    if (state.selectedView === "dashboard") triggerDashboardChangeDemo({ silent: true });
  }, 3000);
}

function currentUsdKrw() {
  return state.fx.mode === "manual" ? Number(state.fx.manualUsdkrw || DEFAULT_USDKRW) : Number(state.fx.usdkrw || DEFAULT_USDKRW);
}

function proxyBaseUrl() {
  return (localStorage.getItem(PROXY_STORAGE_KEY) || DEFAULT_PROXY_BASE_URL).replace(/\/$/, "");
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

function addInvestorByName(name, options = {}) {
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
  const ledgerWorkspace = document.querySelector("#ledgerWorkspace");
  ledgerWorkspace.classList.toggle("hidden", !["dashboard", "investor"].includes(view));
  ledgerWorkspace.classList.toggle("collapsed-ledger", !ledgerExpanded);
}

function renderDashboard() {
  const summary = summarize();
  const totalProfit = document.querySelector("#totalProfit");
  setMoneyElement("#totalValue", summary.totalValue);
  setMoneyElement("#totalPrincipal", summary.principal);
  totalProfit.textContent = signedMoney(summary.profit);
  totalProfit.className = summary.profit >= 0 ? "positive" : "negative";
  document.querySelector("#profitRate").textContent = `수익률 ${summary.returnRate >= 0 ? "+" : ""}${pct(summary.returnRate)}`;
  document.querySelector("#totalDividend").textContent = `총배당 ${money(summary.dividend)}`;
  setMoneyElement("#cashAmount", summary.cash);
  document.querySelector("#cashRatio").textContent = `평가금액 포함 · ${pct(summary.totalValue ? (summary.cash / summary.totalValue) * 100 : 0)}`;
}

function renderAllocation() {
  const ownerId = visibleOwnerId();
  const holdings = replayHoldings(ownerId);
  const summary = summarize(ownerId);
  const totalValue = summary.totalValue;
  const totals = {};

  holdings.forEach((item) => {
    totals[item.type] = (totals[item.type] || 0) + item.valueKrw;
  });
  if (summary.cash > 0) totals["예수금"] = summary.cash;

  const slices = ALLOCATION_ORDER
    .filter((key) => totals[key] > 0)
    .map((key) => ({
      key,
      amount: totals[key],
      pct: totalValue > 0 ? (totals[key] / totalValue) * 100 : 0,
      color: allocationColors[key] || fallbackColors[0]
    }));

  renderAllocationDonut(slices, totalValue);
  renderAllocationLegend(slices);
  renderAllocationInvestorBreakdown();
  wireAllocationInteractions(slices, totalValue);
}

function renderAllocationDonut(slices, totalValue) {
  const svg = document.querySelector("#allocationDonut");
  if (!svg) return;
  const r = 40;
  const circumference = 2 * Math.PI * r;
  let cursor = 0;
  const segmentsSvg = slices
    .map((slice) => {
      const length = (slice.pct / 100) * circumference;
      const dasharray = `${length.toFixed(2)} ${(circumference - length).toFixed(2)}`;
      const rotate = -90 + (cursor / 100) * 360;
      cursor += slice.pct;
      return `<circle class="donut-seg" data-key="${slice.key}" data-amt="${Math.round(slice.amount)}" data-pct="${slice.pct.toFixed(3)}" stroke="${slice.color}" cx="50" cy="50" r="${r}" fill="none" stroke-width="16" stroke-dasharray="${dasharray}" transform="rotate(${rotate.toFixed(2)} 50 50)"></circle>`;
    })
    .join("");
  svg.innerHTML = `<circle cx="50" cy="50" r="${r}" fill="none" stroke="#1C1C25" stroke-width="16"></circle>${segmentsSvg}`;

  const centerAmt = document.querySelector("#allocationCenterAmt");
  const centerPct = document.querySelector("#allocationCenterPct");
  const centerLabel = document.querySelector("#allocationCenterLabel");
  if (centerLabel) centerLabel.textContent = "전체";
  if (centerPct) centerPct.textContent = totalValue > 0 ? "100.0%" : "0.0%";
  if (centerAmt) centerAmt.textContent = money(totalValue);
}

function renderAllocationLegend(slices) {
  const legend = document.querySelector("#allocationLegend");
  if (!legend) return;
  legend.innerHTML = slices
    .map((slice) => `
      <div class="leg-row" data-key="${slice.key}">
        <span class="leg-label">
          <i class="swatch" style="background:${slice.color}"></i>${slice.key}
        </span>
        <span class="leg-value">${slice.pct.toFixed(3)}%</span>
      </div>
    `)
    .join("");
}

function renderAllocationInvestorBreakdown() {
  const container = document.querySelector("#allocationInvestorBreakdown");
  if (!container) return;
  container.innerHTML = state.investors
    .map((investor) => {
      const myHoldings = replayHoldings(investor.id);
      const mySummary = summarize(investor.id);
      const myTotals = {};
      myHoldings.forEach((item) => {
        myTotals[item.type] = (myTotals[item.type] || 0) + item.valueKrw;
      });
      if (mySummary.cash > 0) myTotals["예수금"] = mySummary.cash;
      const segments = ALLOCATION_ORDER
        .filter((key) => myTotals[key] > 0)
        .map((key) => {
          const ratio = mySummary.totalValue > 0 ? (myTotals[key] / mySummary.totalValue) * 100 : 0;
          return `<div class="ibar-seg" style="width:${ratio.toFixed(2)}%;background:${allocationColors[key] || fallbackColors[0]}" title="${key} ${ratio.toFixed(1)}%"></div>`;
        })
        .join("");
      return `
        <div class="investor-bar-row">
          <div class="investor-bar-head"><span style="font-weight:600">${investor.name}</span><span class="muted">${money(mySummary.totalValue)}</span></div>
          <div class="investor-bar-track">${segments}</div>
        </div>
      `;
    })
    .join("");
}

function wireAllocationInteractions(slices, totalValue) {
  const segments = document.querySelectorAll("#allocationDonut .donut-seg");
  const rows = document.querySelectorAll("#allocationLegend .leg-row");
  const centerLabel = document.querySelector("#allocationCenterLabel");
  const centerPct = document.querySelector("#allocationCenterPct");
  const centerAmt = document.querySelector("#allocationCenterAmt");

  function setCenter(key) {
    if (!centerLabel || !centerPct || !centerAmt) return;
    if (!key) {
      centerLabel.textContent = "전체";
      centerPct.textContent = totalValue > 0 ? "100.0%" : "0.0%";
      centerAmt.textContent = money(totalValue);
      return;
    }
    const slice = slices.find((item) => item.key === key);
    if (!slice) return;
    centerLabel.textContent = slice.key;
    centerPct.textContent = `${slice.pct.toFixed(1)}%`;
    centerAmt.textContent = money(slice.amount);
  }

  function highlight(key) {
    segments.forEach((segment) => {
      const active = segment.dataset.key === key;
      segment.style.strokeWidth = active ? "19" : "16";
      segment.style.opacity = key && !active ? "0.35" : "1";
      segment.style.filter = active ? "drop-shadow(0 0 9px rgba(157, 123, 255, 0.36))" : "";
    });
    rows.forEach((row) => row.classList.toggle("hl", row.dataset.key === key));
    setCenter(key);
  }

  segments.forEach((segment) => {
    segment.addEventListener("mouseenter", () => highlight(segment.dataset.key));
    segment.addEventListener("mouseleave", () => highlight(null));
    segment.addEventListener("click", () => filterHoldingsByType(segment.dataset.key));
  });
  rows.forEach((row) => {
    row.addEventListener("mouseenter", () => highlight(row.dataset.key));
    row.addEventListener("mouseleave", () => highlight(null));
    row.addEventListener("click", () => filterHoldingsByType(row.dataset.key));
  });
}

function filterHoldingsByType(type) {
  const table = document.querySelector("#holdingsTable");
  if (!table) return;
  holdingsTypeFilter = type;
  ledgerExpanded = true;
  renderView();
  table.querySelectorAll("tr").forEach((row) => {
    if (row.dataset.type) row.style.display = row.dataset.type === type ? "" : "none";
  });
  const banner = document.querySelector("#holdingsFilterBanner");
  if (banner) {
    banner.classList.add("active");
    const label = banner.querySelector("#holdingsFilterLabel");
    if (label) label.textContent = `${type} 종목만 표시 중`;
  }
  document.querySelector("#holdings")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearHoldingsFilter() {
  holdingsTypeFilter = null;
  const table = document.querySelector("#holdingsTable");
  if (table) {
    table.querySelectorAll("tr").forEach((row) => {
      row.style.display = "";
    });
  }
  const banner = document.querySelector("#holdingsFilterBanner");
  if (banner) banner.classList.remove("active");
}

function renderMarket() {
  const list = document.querySelector("#marketList");
  list.innerHTML = "";
  const nextValues = {};
  state.marketIndicators.forEach((item) => {
    const premium = item.globalKrw ? ((item.domestic / item.globalKrw) - 1) * 100 : 0;
    nextValues[item.symbol] = premium;
    const row = document.createElement("div");
    row.className = "market-card";
    row.innerHTML = `
      <div class="market-title-row">
        ${renderCryptoLogo(item.symbol)}
        <div>${renderMetricTitle(item.symbol)}<small>국내 ${money(item.domestic)} · 해외환산 ${money(item.globalKrw)}</small></div>
      </div>
      <span class="${premium >= 0 ? "positive" : "negative"}">${premium >= 0 ? "+" : ""}${pct(premium)}</span>
    `;
    list.appendChild(row);
    const previous = previousRealtimeValues.market[item.symbol];
    if (typeof previous === "number") markRealtimeChange(row, premium - previous, signedPercentChange);
  });
  previousRealtimeValues.market = nextValues;
}

function renderIndexMonitor() {
  const list = document.querySelector("#indexMonitorList");
  if (!list) return;
  const connected = Boolean(proxyBaseUrl());
  const nextValues = {};
  const snapshots = INDEX_MONITOR_LIST.map((idx) => {
    const asset = state.assetCatalog[idx.ticker];
    const quote = (state.indexQuotes || {})[idx.ticker];
    const price = quote ? quote.price : (asset ? asset.currentPrice : 0);
    const hasQuote = Boolean(quote);
    const change = hasQuote ? quote.changePercent : 0;
    nextValues[idx.ticker] = change;
    const glow = change > 0 ? "positive-glow" : change < 0 ? "negative-glow" : "neutral-glow";
    const changeClass = change > 0 ? "positive" : change < 0 ? "negative" : "neutral-text";
    const status = quote ? `실시간 · ${formatClock(quote.updatedAt)}` : (connected ? "갱신 대기" : "프록시 연결 대기");
    const changeLabel = hasQuote ? `${change > 0 ? "+" : ""}${change.toFixed(2)}%` : "—";
    const logoText = idx.logoText || idx.ticker.slice(0, 2);
    const logo = idx.logo
      ? `<i class="stock-logo-frame"><img src="${idx.logo}" alt="" loading="lazy" onerror="this.remove()" /><b>${logoText}</b></i>`
      : `<i class="stock-logo-frame stock-logo-text"><b>${logoText}</b></i>`;
    return { ...idx, price, change, glow, changeClass, status, changeLabel, logo };
  });
  const cardMarkup = (idx) => `
      <div class="market-card index-card stock-index-card ${idx.group === "M7" ? "m7-index-card" : "etf-index-card"} ${idx.glow}" data-ticker="${idx.ticker}">
        ${idx.logo}
        <div>${renderMetricTitle(idx.label)}<small>${idx.group} · ${idx.ticker} · $${numberFormatter.format(idx.price)} · ${idx.status}</small></div>
        <span class="${idx.changeClass}">${idx.changeLabel}</span>
      </div>
    `;
  const track = list.querySelector(".index-track");
  const expectedCards = INDEX_MONITOR_LIST.length * 2;
  if (!track || list.querySelectorAll(".index-card").length !== expectedCards) {
    const cards = snapshots.map(cardMarkup).join("");
    list.innerHTML = `
      <div class="index-track">
        ${cards}
        <div class="index-clone" aria-hidden="true">${cards}</div>
      </div>
    `;
  } else {
    snapshots.forEach((idx) => {
      list.querySelectorAll(`.index-card[data-ticker="${idx.ticker}"]`).forEach((card) => {
        card.classList.remove("positive-glow", "negative-glow", "neutral-glow");
        card.classList.add(idx.glow);
        const detail = card.querySelector("small");
        const value = card.querySelector(":scope > span");
        if (detail) detail.textContent = `${idx.group} · ${idx.ticker} · $${numberFormatter.format(idx.price)} · ${idx.status}`;
        if (value) {
          value.className = idx.changeClass;
          value.textContent = idx.changeLabel;
        }
      });
    });
  }
  snapshots.forEach((idx) => {
    const previous = previousRealtimeValues.index[idx.ticker];
    if (typeof previous === "number") {
      list.querySelectorAll(`.index-track > .index-card[data-ticker="${idx.ticker}"]`).forEach((card) => {
        markRealtimeChange(card, nextValues[idx.ticker] - previous, (amount) => `${amount >= 0 ? "+" : ""}${amount.toFixed(2)}%`);
      });
    }
  });
  previousRealtimeValues.index = nextValues;
}

function renderInvestorComparison() {
  const list = document.querySelector("#investorComparison");
  list.innerHTML = "";
  const total = summarize().totalValue || 1;
  const nextValues = {};
  state.investors.forEach((investor) => {
    const summary = summarize(investor.id);
    nextValues[investor.id] = summary.profit;
    const share = (summary.totalValue / total) * 100;
    const row = document.createElement("div");
    row.className = "investor-card";
    row.innerHTML = `
      <div class="avatar">${investor.initials}</div>
      <div>${renderMetricTitle(investor.name)}<small>지분 ${pct(share)} · ${summary.holdings.length}개 종목</small></div>
      <span class="${summary.profit >= 0 ? "positive" : "negative"}">${signedMoney(summary.profit)}</span>
    `;
    list.appendChild(row);
    const previous = previousRealtimeValues.investors[investor.id];
    if (typeof previous === "number") markRealtimeChange(row, summary.profit - previous);
  });
  previousRealtimeValues.investors = nextValues;
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
    row.dataset.type = item.type;
    if (holdingsTypeFilter && item.type !== holdingsTypeFilter) row.style.display = "none";
    row.innerHTML = `
      <td><span class="asset-name"><strong>${item.ticker}</strong><small>${item.name}</small></span></td>
      <td><span class="owner-label">${owner.name}</span></td>
      <td><span class="pill">${item.type}</span></td>
      <td>${qty(item.quantity)}</td>
      <td>${money(item.avgPrice * item.avgFx)}<small class="subtext">${item.currency} ${numberFormatter.format(item.avgPrice)} · FX ${fxFormatter.format(item.avgFx)}</small></td>
      <td>${money(item.currentPrice * item.currentFx)}<small class="subtext">${item.currency} ${numberFormatter.format(item.currentPrice)} · FX ${fxFormatter.format(item.currentFx)}</small></td>
      <td>${money(item.valueKrw)}</td>
      <td class="${item.profit >= 0 ? "positive" : "negative"}">${signedMoney(item.profit)}<small class="subtext">주가 ${signedMoney(item.stockProfit)} · 환 ${signedMoney(item.fxProfit)}</small></td>
    `;
    body.appendChild(row);
  }
}

function renderHoldingsPreview() {
  const list = document.querySelector("#holdingsPreview");
  if (!list) return;
  const top = replayHoldings(visibleOwnerId()).slice().sort((a, b) => b.valueKrw - a.valueKrw).slice(0, 3);
  if (!top.length) {
    list.innerHTML = `<p class="empty-hint">보유 종목이 없습니다.</p>`;
    return;
  }
  list.innerHTML = top.map((item) => {
    const owner = investorById(item.ownerId);
    return `
      <div class="market-card">
        <div><strong>${item.ticker}</strong><small>${owner.name} · ${money(item.valueKrw)}</small></div>
        <span class="${item.profit >= 0 ? "positive" : "negative"}">${signedMoney(item.profit)}</span>
      </div>
    `;
  }).join("");
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

function renderLedgerPreview() {
  const list = document.querySelector("#ledgerPreview");
  if (!list) return;
  const top = visibleTransactions().slice(0, 3);
  if (!top.length) {
    list.innerHTML = `<p class="empty-hint">거래 내역이 없습니다.</p>`;
    return;
  }
  list.innerHTML = top.map((item) => {
    const owner = investorById(item.ownerId);
    const isCashflow = item.kind === "cashflow";
    const label = isCashflow ? (item.type === "deposit" ? "입금" : "출금") : (item.side === "buy" ? "매수" : "매도");
    const asset = isCashflow ? "예수금" : item.ticker;
    const amount = isCashflow ? item.amount : tradeAmountKrw(item);
    return `
      <div class="market-card">
        <div><strong>${item.date}</strong><small>${owner.name} · ${label} · ${asset}</small></div>
        <span>${money(amount)}</span>
      </div>
    `;
  }).join("");
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

function totalValueHistory() {
  const snapshots = (state.snapshots || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (!snapshots.length) {
    return [{ date: new Date().toISOString().slice(0, 10), totalValue: summarize().totalValue }];
  }
  return snapshots;
}

function chartPoints(history, width, height, pad) {
  const values = history.map((item) => item.totalValue);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const center = (rawMin + rawMax) / 2;
  const rawSpan = Math.max(rawMax - rawMin, 1);
  const minVisualSpan = Math.max(center * 0.01, rawSpan * 5, 1);
  const span = Math.max(rawSpan * 1.4, minVisualSpan);
  const min = center - span / 2;
  return history.map((item, index) => {
    const x = pad + (index / Math.max(history.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - ((item.totalValue - min) / span) * (height - pad * 2);
    return { x, y, item };
  });
}

function renderHeroSparkline() {
  const plot = document.querySelector("#heroSparklinePlot");
  const history = totalValueHistory();
  if (!plot) return;
  const width = 360;
  const height = 120;
  const pad = 12;
  const summary = summarize();
  const summaryClass = summary.profit >= 0 ? "positive-spark" : "negative-spark";
  const summaryBadge = `
    <g class="spark-summary ${summaryClass}" transform="translate(90 34)">
      <rect x="-76" y="-24" width="152" height="48" rx="12"></rect>
      <text class="spark-summary-rate" x="0" y="-5" text-anchor="middle">${summary.returnRate >= 0 ? "+" : ""}${pct(summary.returnRate)}</text>
      <text class="spark-summary-profit" x="0" y="15" text-anchor="middle">${signedMoney(summary.profit)} · ${signedUsd(summary.profit / currentUsdKrw())}</text>
    </g>
  `;
  const wavePaths = `
    <path class="spark-wave spark-wave-one" d="M${pad} 91 C46 76, 72 100, 104 86 S164 77, 201 91 S262 102, 303 84 S335 78, ${width - pad} 91"></path>
    <path class="spark-wave spark-wave-two" d="M${pad} 101 C38 111, 76 88, 119 99 S177 115, 219 95 S285 82, 319 99 S342 108, ${width - pad} 97"></path>
  `;
  if (history.length < 2) {
    plot.innerHTML = `
      <path d="M${pad} 78 L${width - pad} 78" fill="none" stroke="url(#spark)" stroke-width="4" stroke-linecap="round" opacity=".7" />
      ${wavePaths}
      <circle class="spark-last-dot" cx="${width - pad}" cy="78" r="7"></circle>
      ${summaryBadge}
    `;
    return;
  }
  const points = chartPoints(history, width, height, pad);
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const baseline = height - pad;
  const area = `${points[0].x},${baseline} ${line} ${points.at(-1).x},${baseline}`;
  const lastPoint = points.at(-1);
  plot.innerHTML = `
    <polygon class="spark-area" points="${area}" fill="url(#sparkFill)"></polygon>
    ${wavePaths}
    <polyline points="${line}" fill="none" stroke="url(#spark)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
    <circle class="spark-last-halo" cx="${lastPoint.x}" cy="${lastPoint.y}" r="11"></circle>
    <circle class="spark-last-dot" cx="${lastPoint.x}" cy="${lastPoint.y}" r="7"></circle>
    ${summaryBadge}
  `;
}

function renderTrend() {
  const area = document.querySelector("#trendArea");
  const snapshots = totalValueHistory();
  if (snapshots.length < 2) {
    area.innerHTML = `<div class="empty-state compact-empty">데이터가 쌓이면 추이가 표시됩니다.</div>`;
    document.querySelector("#trendHint").textContent = "";
    renderHeroSparkline();
    return;
  }
  const width = 760;
  const compact = snapshots.length < 7;
  const height = compact ? 110 : 220;
  const pad = 18;
  const values = snapshots.map((item) => item.totalValue);
  const max = Math.max(...values);
  const points = chartPoints(snapshots, width, height, pad);
  const pointString = points.map((point) => `${point.x},${point.y}`).join(" ");
  document.querySelector("#trendHint").textContent = compact ? `최근 ${snapshots.length}일 데이터 · 더 쌓이면 정확한 추이가 표시됩니다` : "";
  area.innerHTML = `
    <svg class="trend-svg ${compact ? "compact-trend" : ""}" viewBox="0 0 ${width} ${height}" role="img" aria-label="총자산 추이">
      <polyline points="${pointString}" fill="none" stroke="#9d7bff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
      ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#f3f3f7"></circle>`).join("")}
      <text x="${pad}" y="${height - 2}" fill="#8e8e9c" font-size="12">${snapshots[0].date}</text>
      <text x="${width - pad}" y="${height - 2}" fill="#8e8e9c" font-size="12" text-anchor="end">${snapshots.at(-1).date}</text>
      <text x="${pad}" y="14" fill="#8e8e9c" font-size="12">${money(max)}</text>
    </svg>
  `;
  renderHeroSparkline();
}

function renderFx() {
  document.querySelector("#fxRateLabel").textContent = fxFormatter.format(currentUsdKrw());
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
    form.elements.fx.value = fxFormatter.format(currentUsdKrw()).replace(/,/g, "");
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
  const basis = `현재 종목 단가(${scenario.currency === "USD" ? "$" : "₩"}${numberFormatter.format(scenario.price)})·환율(${numberFormatter.format(scenario.fx)})·배당수익률(${pct(scenario.annualYield * 100)}) 기준`;
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
    <div class="target-message">${basis} · ${message}</div>
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
  renderIndexMonitor();
  renderInvestorComparison();
  renderInvestorTabs();
  renderInvestorSheet();
  renderHoldings();
  renderHoldingsPreview();
  renderTransactions();
  renderLedgerPreview();
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
  const baseUrl = proxyBaseUrl();
  if (!baseUrl) return;
  const holdings = replayHoldings().filter((holding) => holding.type === "주식" && holding.currency === "USD");
  const symbols = [...new Set(holdings.map((holding) => holding.ticker))];
  for (const symbol of symbols) {
    const response = await fetch(`${baseUrl}/quote?symbol=${encodeURIComponent(symbol)}`);
    if (!response.ok) throw new Error("미국주식 시세를 가져오지 못했습니다.");
    const quote = await response.json();
    if (quote.c && state.assetCatalog[symbol]) {
      state.assetCatalog[symbol].currentPrice = Number(quote.c);
      state.assetCatalog[symbol].currentFx = currentUsdKrw();
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function updateIndexQuotes() {
  const baseUrl = proxyBaseUrl();
  if (!baseUrl) return;
  state.indexQuotes = state.indexQuotes || {};
  for (const idx of INDEX_MONITOR_LIST) {
    const response = await fetch(`${baseUrl}/quote?symbol=${encodeURIComponent(idx.ticker)}`);
    if (!response.ok) throw new Error("주요 지수 시세를 가져오지 못했습니다.");
    const quote = await response.json();
    const price = Number(quote.c || 0);
    const changePercent = Number(quote.dp || 0);
    if (price) {
      state.indexQuotes[idx.ticker] = { price, changePercent, updatedAt: new Date().toISOString() };
      if (state.assetCatalog[idx.ticker]) {
        state.assetCatalog[idx.ticker].currentPrice = price;
        state.assetCatalog[idx.ticker].currentFx = currentUsdKrw();
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function refreshQuotes() {
  try {
    await updateCoinQuotes();
    await updateStockQuotes();
    await updateIndexQuotes();
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
  const baseUrl = proxyBaseUrl();
  if (state.fx.mode === "manual" || !baseUrl) return;
  try {
    const response = await fetch(`${baseUrl}/fxrate`);
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

document.querySelectorAll("[data-expand-ledger]").forEach((link) => {
  link.addEventListener("click", () => {
    ledgerExpanded = true;
    renderView();
  });
});

document.querySelector("#collapseLedgerButton").addEventListener("click", () => {
  ledgerExpanded = false;
  renderView();
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

document.querySelector("#demoChangeButton").addEventListener("click", triggerDashboardChangeDemo);

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
startRealtimeDemoLoop();
