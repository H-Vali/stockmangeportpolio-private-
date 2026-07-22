import { CORS_HEADERS, json } from "./_lib.js";

// 공동 운용 상태(포트폴리오 전체)를 KV에 통째로 저장/조회하는 엔드포인트.
//
// GET  /state -> { state: <object|null>, rev: <number> }
// PUT  /state -> 본문(JSON 상태 객체)을 저장. Bearer 토큰 필요.
//                X-Expected-Rev 헤더를 주면 낙관적 잠금이 걸린다. 서버가 보관한
//                rev 와 다르면 409 를 반환하고 저장하지 않는다. 헤더가 없으면
//                검사를 건너뛴다(최초 업로드 및 구버전 클라이언트 호환).
const MAX_STATE_BYTES = 4_000_000; // KV 값 한도(25MB)보다 보수적으로 잡음.
const STATE_KEY = "state";

function authorize(request, env) {
  if (!env.SYNC_TOKEN) return json({ error: "sync_not_configured" }, 500);
  if (!env.ASSET_STATE) return json({ error: "kv_not_bound" }, 500);
  const auth = request.headers.get("Authorization") || "";
  if (auth !== `Bearer ${env.SYNC_TOKEN}`) return json({ error: "unauthorized" }, 401);
  return null;
}

export async function onRequestGet({ request, env }) {
  const denied = authorize(request, env);
  if (denied) return denied;

  const stored = await env.ASSET_STATE.getWithMetadata(STATE_KEY);
  let parsed = null;
  if (stored?.value) {
    try { parsed = JSON.parse(stored.value); } catch { parsed = null; }
  }
  return json({ state: parsed, rev: Number(stored?.metadata?.rev) || 0 }, 200);
}

export async function onRequestPut({ request, env }) {
  const denied = authorize(request, env);
  if (denied) return denied;

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

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}
