import { DEFAULT_MARKET_INDICATORS, DEFAULT_USDKRW, SCHEMA_VERSION } from "../config/constants.js";

export const seedState = {
  schemaVersion: SCHEMA_VERSION,
  selectedView: "dashboard",
  selectedInvestorId: null,
  pendingDeleteInvestorId: null,
  displayCurrency: "KRW",
  fx: {
    usdkrw: DEFAULT_USDKRW,
    mode: "auto",
    manualUsdkrw: DEFAULT_USDKRW,
    source: "manual",
    updatedAt: null,
    lastAutoFetchDate: null,
    lastAutoFetchSlot: null
  },
  market: {
    lastUpdatedAt: null,
    failedAt: null,
    lastSuccessAt: null,
    error: null
  },
  overseasPriceSource: "empty",
  cryptoQuoteFx: {
    rate: null,
    source: null,
    updatedAt: null
  },
  snapshots: [],
  investors: [],
  assetCatalog: {},
  indexQuotes: {},
  marketIndicators: DEFAULT_MARKET_INDICATORS,
  cashflows: [],
  trades: []
};


export function mergeMarketIndicators(input, defaults) {
  const map = new Map();
  defaults.forEach((item) => map.set(item.symbol, item));
  if (Array.isArray(input)) input.forEach((item) => map.set(item.symbol, item));
  return Array.from(map.values());
}

export function normalizeState(input) {
  const base = structuredClone(seedState);
  const parsed = input && typeof input === "object" ? input : {};
  return {
    ...base,
    ...parsed,
    schemaVersion: parsed.schemaVersion || 1,
    fx: { ...base.fx, ...(parsed.fx || {}) },
    market: { ...base.market, ...(parsed.market || {}) },
    overseasPriceSource: parsed.overseasPriceSource || base.overseasPriceSource,
    cryptoQuoteFx: { ...base.cryptoQuoteFx, ...(parsed.cryptoQuoteFx || {}) },
    snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
    indexQuotes: parsed.indexQuotes || {},
    investors: parsed.investors,
    assetCatalog: { ...base.assetCatalog, ...(parsed.assetCatalog || {}) },
    marketIndicators: mergeMarketIndicators(parsed.marketIndicators, base.marketIndicators),
    cashflows: parsed.cashflows,
    trades: parsed.trades
  };
}

export function clearPortfolioData(input) {
  const next = normalizeState(input);
  next.schemaVersion = SCHEMA_VERSION;
  next.selectedInvestorId = next.investors?.[0]?.id || null;
  next.pendingDeleteInvestorId = null;
  next.snapshots = [];
  next.cashflows = [];
  next.trades = [];
  return next;
}

export function isOverClearedState(input) {
  return (
    Array.isArray(input?.investors) &&
    input.investors.length === 0 &&
    Array.isArray(input?.cashflows) &&
    input.cashflows.length === 0 &&
    Array.isArray(input?.trades) &&
    input.trades.length === 0 &&
    Array.isArray(input?.marketIndicators) &&
    input.marketIndicators.length === 0
  );
}
