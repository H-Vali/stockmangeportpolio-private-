import { CORS_HEADERS, json } from "./_lib.js";

// GET /quote?symbol=SCHD -> Finnhub /quote 응답 중계
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") || "").trim().toUpperCase();
  if (!symbol) return json({ error: "symbol_required" }, 400);
  if (!env.FINNHUB_API_KEY) return json({ error: "missing_finnhub_key" }, 500);

  const upstream = new URL("https://finnhub.io/api/v1/quote");
  upstream.searchParams.set("symbol", symbol);
  upstream.searchParams.set("token", env.FINNHUB_API_KEY);

  const response = await fetch(upstream, {
    headers: { "Accept": "application/json" },
    cf: { cacheTtl: 60, cacheEverything: true }
  });
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      // 성공 응답만 캐시한다. Finnhub 요청 한도 초과(429) 같은 일시적 실패까지
      // 60초씩 캐시하면, 한도가 풀린 뒤에도 낡은 실패 응답이 계속 나간다.
      "Cache-Control": response.ok ? "public, max-age=60" : "no-store"
    }
  });
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}
