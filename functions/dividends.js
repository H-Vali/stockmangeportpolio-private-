import { CORS_HEADERS, json } from "./_lib.js";

// GET /dividends?symbol=SCHD -> Finnhub /stock/dividend2 응답 중계
// 배당은 시세와 달리 자주 안 바뀌므로 캐시를 길게(6시간) 둬서 Finnhub 호출을 아낀다.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") || "").trim().toUpperCase();
  if (!symbol) return json({ error: "symbol_required" }, 400);
  if (!env.FINNHUB_API_KEY) return json({ error: "missing_finnhub_key" }, 500);

  const now = new Date();
  const from = new Date(now);
  from.setUTCFullYear(from.getUTCFullYear() - 3);
  const to = new Date(now);
  to.setUTCFullYear(to.getUTCFullYear() + 1);

  const upstream = new URL("https://finnhub.io/api/v1/stock/dividend");
  upstream.searchParams.set("symbol", symbol);
  upstream.searchParams.set("from", from.toISOString().slice(0, 10));
  upstream.searchParams.set("to", to.toISOString().slice(0, 10));
  upstream.searchParams.set("token", env.FINNHUB_API_KEY);

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
