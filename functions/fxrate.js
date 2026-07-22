import { CORS_HEADERS, json } from "./_lib.js";

// GET /fxrate -> USD/KRW 환율(하나은행 매매기준율, 실패 시 exchangerate.host 폴백)
export async function onRequestGet() {
  const now = new Date().toISOString();
  const hana = await fetchHanaRate().catch(() => null);
  if (hana) {
    return json({ usdkrw: hana, source: "hana", updatedAt: now }, 200, 7200);
  }

  const fallback = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=KRW", {
    headers: { "Accept": "application/json" },
    cf: { cacheTtl: 7200, cacheEverything: true }
  }).then((response) => response.json());

  const usdkrw = Number(fallback?.rates?.KRW);
  if (!usdkrw) return json({ error: "fxrate_unavailable" }, 502, 60);
  return json({ usdkrw, source: "fallback", updatedAt: now }, 200, 7200);
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

async function fetchHanaRate() {
  const response = await fetch("https://finance.naver.com/marketindex/exchangeDetail.naver?marketindexCd=FX_USDKRW", {
    headers: { "User-Agent": "Mozilla/5.0 AssetPilot" },
    cf: { cacheTtl: 7200, cacheEverything: true }
  });
  if (!response.ok) return null;
  const html = await response.text();
  const match = html.match(/<th>\s*매매기준율\s*<\/th>\s*<td[^>]*>\s*([0-9,.]+)/);
  if (!match) return null;
  return Number(match[1].replace(/,/g, ""));
}
