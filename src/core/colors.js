import { allocationColors, TICKER_COLOR_PALETTE } from "../config/constants.js";

// 같은 티커는 항상 같은 색으로 — 문자열 해시로 팔레트 인덱스를 고정한다.
export function tickerColor(ticker) {
  const str = String(ticker || "");
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return TICKER_COLOR_PALETTE[hash % TICKER_COLOR_PALETTE.length];
}

// 자산 분류(주식/ETF/코인/채권) 색상 — 대시보드 배분 도넛과 동일한 팔레트를 재사용해
// 화면이 달라도 "이 색 = 이 분류"라는 인식이 유지되게 한다.
export function assetTypeColor(type) {
  return allocationColors[type] || TICKER_COLOR_PALETTE[0];
}

// 투자자별 구분 색상. 투자자 목록은 화면마다 매번 다시 나열되는 닫힌 집합이라,
// 티커처럼 해시로 흩뿌리지 않고 목록 순서대로 고정 배정해 충돌 없이 안정적으로 보이게 한다.
export function investorColor(ownerId, investors) {
  const index = (investors || []).findIndex((inv) => inv.id === ownerId);
  return TICKER_COLOR_PALETTE[(index >= 0 ? index : 0) % TICKER_COLOR_PALETTE.length];
}
