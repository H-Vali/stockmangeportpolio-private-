import { CORS_HEADERS, json } from "./_lib.js";

// GET /dividends?symbol=SCHD -> Polygon.io(massive.com) /v3/reference/dividends 응답 중계
// Finnhub(stock/dividend, stock/dividend2)와 Twelve Data(/dividends) 모두 유료 플랜으로
// 막혀 있어서 못 쓴다. Polygon은 무료 Basic 플랜에 Corporate Actions(배당 포함)가 들어있다.
// 배당은 시세와 달리 자주 안 바뀌므로 캐시를 길게(6시간) 둬서 호출을 아낀다.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") || "").trim().toUpperCase();
  if (!symbol) return json({ error: "symbol_required" }, 400);
  if (!env.POLYGON_API_KEY) return json({ error: "missing_polygon_key" }, 500);

  const upstream = new URL("https://api.polygon.io/v3/reference/dividends");
  upstream.searchParams.set("ticker", symbol);
  upstream.searchParams.set("limit", "100");
  upstream.searchParams.set("sort", "ex_dividend_date");
  upstream.searchParams.set("order", "desc");
  upstream.searchParams.set("apiKey", env.POLYGON_API_KEY);

  // cacheTtl+cacheEverything는 상태코드와 무관하게 캐시한다 — Polygon이 429(레이트리밋)를
  // 반환한 순간을 그대로 6시간 캐시해버려서, 그 티커는 한도가 풀린 뒤에도 계속 429만
  // 돌려받는 사고가 있었다(2026-07-24). cacheTtlByStatus로 성공 응답만 캐시하도록 수정.
  const response = await fetch(upstream, {
    headers: { "Accept": "application/json" },
    cf: { cacheTtlByStatus: { "200-299": 21600, "300-599": 0 } }
  });
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": response.ok ? "public, max-age=21600" : "no-store"
    }
  });
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}
