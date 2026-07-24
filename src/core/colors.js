import { TICKER_COLOR_PALETTE } from "../config/constants.js";

// 같은 티커는 항상 같은 색으로 — 문자열 해시로 팔레트 인덱스를 고정한다.
export function tickerColor(ticker) {
  const str = String(ticker || "");
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return TICKER_COLOR_PALETTE[hash % TICKER_COLOR_PALETTE.length];
}
