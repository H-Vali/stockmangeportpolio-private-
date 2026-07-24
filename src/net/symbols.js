import { assetLookupEntries, normalizeAssetSearch } from "../domain/asset-lookup.js";

export let usSymbols = null;
export let usSymbolTickerMap = null;
export let usSymbolsLoading = null;

export function loadUsSymbols() {
  if (usSymbols) return Promise.resolve(usSymbols);
  if (usSymbolsLoading) return usSymbolsLoading;
  usSymbolsLoading = fetch("./data/us-symbols.json")
    .then((response) => (response.ok ? response.json() : []))
    .then((rows) => {
      usSymbols = Array.isArray(rows) ? rows : [];
      usSymbolTickerMap = new Map(usSymbols.map((row) => [row[0], row]));
      return usSymbols;
    })
    .catch(() => {
      usSymbols = [];
      usSymbolTickerMap = new Map();
      return usSymbols;
    });
  return usSymbolsLoading;
}

export function symbolRowToAsset(row) {
  return { ticker: row[0], name: row[1], type: row[2] === 1 ? "ETF" : "주식", currency: "USD" };
}

export function usSymbolByTicker(ticker) {
  const row = usSymbolTickerMap && usSymbolTickerMap.get(String(ticker).trim().toUpperCase());
  return row ? symbolRowToAsset(row) : null;
}

export function usSymbolByName(query) {
  if (!usSymbols || query.length < 2) return null;
  const exact = usSymbols.find((row) => normalizeAssetSearch(row[1]) === query);
  if (exact) return symbolRowToAsset(exact);
  if (query.length >= 3) {
    const prefix = usSymbols.find((row) => normalizeAssetSearch(row[1]).startsWith(query));
    if (prefix) return symbolRowToAsset(prefix);
  }
  return null;
}

export function findAssetLookupMatch(value, mode) {
  const query = normalizeAssetSearch(value);
  if (!query) return null;
  const entries = assetLookupEntries();
  if (mode === "ticker") {
    const upper = value.trim().toUpperCase();
    return entries.find((asset) => asset.ticker === upper) || usSymbolByTicker(upper) || null;
  }
  return entries.find((asset) => normalizeAssetSearch(asset.name) === query)
    || (query.length >= 3 ? entries.find((asset) => normalizeAssetSearch(asset.name).startsWith(query)) : null)
    || usSymbolByName(query)
    || null;
}
