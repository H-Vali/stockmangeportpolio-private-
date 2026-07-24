import { ASSET_DICTIONARY } from "../config/catalog.js";
import { state } from "../state/store.js";

export function normalizeAssetSearch(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// 로컬 자산 사전 + 이미 보유/등록된 종목을 합친 검색용 목록.
// 티커/종목명 입력 시 자동완성에 쓰인다.
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
