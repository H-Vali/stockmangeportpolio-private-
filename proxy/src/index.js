const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Expected-Rev"
};

// 상태 저장 크기 상한(약 4MB). KV 값 한도(25MB)보다 보수적으로 잡음.
const MAX_STATE_BYTES = 4_000_000;
const STATE_KEY = "state";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    if (url.pathname === "/quote") return quote(url, env);
    if (url.pathname === "/fxrate") return fxrate();
    if (url.pathname === "/state") return stateRoute(request, env);

    return json({ error: "not_found" }, 404);
  }
};

// 공동 운용 상태(포트폴리오 전체)를 KV에 통째로 저장/조회하는 엔드포인트.
//
// GET  /state -> { state: <object|null>, rev: <number> }
// PUT  /state -> 본문(JSON 상태 객체)을 저장. Bearer 토큰 필요.
//                X-Expected-Rev 헤더를 주면 낙관적 잠금이 걸린다. 서버가 보관한
//                rev 와 다르면 409 를 반환하고 저장하지 않는다. 헤더가 없으면
//                검사를 건너뛴다(최초 업로드 및 구버전 클라이언트 호환).
//
// rev 를 두는 이유: 예전에는 PUT 이 무조건 덮어써서, 두 사람이 비슷한 시각에
// 입력하면 나중 요청이 앞사람 입력을 통째로 지웠다.
async function stateRoute(request, env) {
  if (!env.SYNC_TOKEN) return json({ error: "sync_not_configured" }, 500);
  if (!env.ASSET_STATE) return json({ error: "kv_not_bound" }, 500);

  const auth = request.headers.get("Authorization") || "";
  if (auth !== `Bearer ${env.SYNC_TOKEN}`) return json({ error: "unauthorized" }, 401);

  if (request.method === "GET") {
    const stored = await env.ASSET_STATE.getWithMetadata(STATE_KEY);
    let parsed = null;
    if (stored?.value) {
      try { parsed = JSON.parse(stored.value); } catch { parsed = null; }
    }
    return json({ state: parsed, rev: Number(stored?.metadata?.rev) || 0 }, 200);
  }

  if (request.method === "PUT") {
    const body = await request.text();
    if (body.length > MAX_STATE_BYTES) return json({ error: "too_large" }, 413);
    try { JSON.parse(body); } catch { return json({ error: "invalid_json" }, 400); }

    const stored = await env.ASSET_STATE.getWithMetadata(STATE_KEY);
    const currentRev = Number(stored?.metadata?.rev) || 0;
    const expectedRaw = request.headers.get("X-Expected-Rev");

    if (expectedRaw !== null && Number(expectedRaw) !== currentRev) {
      return json({ error: "revision_conflict", rev: currentRev }, 409);
    }

    const nextRev = currentRev + 1;
    const savedAt = new Date().toISOString();
    await env.ASSET_STATE.put(STATE_KEY, body, { metadata: { rev: nextRev, savedAt } });
    return json({ ok: true, rev: nextRev, savedAt }, 200);
  }

  return json({ error: "method_not_allowed" }, 405);
}

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
      // 성공 응답만 클라이언트 쪽에 캐시시킨다. Finnhub 요청 한도 초과(429) 같은
      // 일시적 실패까지 60초씩 캐시하면, 한도가 풀린 뒤에도 Cloudflare 엣지가
      // 낡은 실패 응답을 계속 돌려줘 문제가 실제보다 오래 지속되는 것처럼 보인다.
      "Cache-Control": response.ok ? "public, max-age=60" : "no-store"
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
