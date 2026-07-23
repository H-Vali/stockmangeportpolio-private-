import { CORS_HEADERS, json } from "./_lib.js";

// GET /dividends?symbol=SCHD -> Twelve Data /dividends 응답 중계
// Finnhub는 배당 이력(stock/dividend, stock/dividend2)을 유료 플랜으로 옮겨서 못 쓴다.
// 배당은 시세와 달리 자주 안 바뀌므로 캐시를 길게(6시간) 둬서 호출을 아낀다.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") || "").trim().toUpperCase();
  if (!symbol) return json({ error: "symbol_required" }, 400);
  if (!env.TWELVEDATA_API_KEY) return json({ error: "missing_twelvedata_key" }, 500);

  const now = new Date();
  const from = new Date(now);
  from.setUTCFullYear(from.getUTCFullYear() - 3);
  const to = new Date(now);
  to.setUTCDate(to.getUTCDate() + 90);

  const upstream = new URL("https://api.twelvedata.com/dividends");
  upstream.searchParams.set("symbol", symbol);
  upstream.searchParams.set("start_date", from.toISOString().slice(0, 10));
  upstream.searchParams.set("end_date", to.toISOString().slice(0, 10));
  upstream.searchParams.set("apikey", env.TWELVEDATA_API_KEY);

  const response = await fetch(upstream, {
    headers: { "Accept": "application/json" },
    cf: { cacheTtl: 21600, cacheEverything: true }
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
