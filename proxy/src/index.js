const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    if (url.pathname === "/quote") return quote(url, env);
    if (url.pathname === "/fxrate") return fxrate();

    return json({ error: "not_found" }, 404);
  }
};

async function quote(url, env) {
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
      "Cache-Control": "public, max-age=60"
    }
  });
}

async function fxrate() {
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

function json(payload, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store"
    }
  });
}
