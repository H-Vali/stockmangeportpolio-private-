# AssetPilot Quote Proxy

Cloudflare Workers용 얇은 서버리스 프록시입니다. GitHub Pages 앱은 계속 정적으로 유지하고, API 키가 필요한 Finnhub 호출과 서버 측 HTML 파싱이 필요한 환율 호출만 이 Worker가 담당합니다.

이 Worker는 시세/환율 프록시뿐 아니라, 공동 운용 상태(포트폴리오 전체)를 **여러 PC에서 공유**하기 위한 저장소 역할도 합니다. 상태는 Cloudflare KV에 통째로 저장되고, 앱은 부팅 시 서버 상태를 정본으로 불러온 뒤 변경분을 다시 서버에 올립니다.

## 환경변수 / 시크릿

- `FINNHUB_API_KEY` (secret): Finnhub API key
  - `wrangler secret put FINNHUB_API_KEY`
- `SYNC_TOKEN` (secret): 상태 동기화 인증 토큰. 아무나 데이터를 읽고 쓰지 못하게 막습니다.
  - `wrangler secret put SYNC_TOKEN` (원하는 긴 랜덤 문자열 입력)

## KV 네임스페이스 (상태 저장소)

최초 1회 생성 후, 출력된 id를 `wrangler.toml`의 `[[kv_namespaces]] id`에 넣습니다.

```
wrangler kv namespace create ASSET_STATE
```

## 엔드포인트

- `GET /quote?symbol=SCHD`: Finnhub `/quote` 응답 중계, `Cache-Control: max-age=60`
- `GET /fxrate`: USD/KRW 환율 응답, `Cache-Control: max-age=7200`
- `GET /state`: 저장된 공동 운용 상태를 `{ "state": <object|null>, "rev": <number> }` 로 반환. `Authorization: Bearer <SYNC_TOKEN>` 필요.
- `PUT /state`: 본문(JSON 상태 객체)을 KV에 저장. `Authorization: Bearer <SYNC_TOKEN>` 필요. 최대 약 4MB.
  성공 시 `{ "ok": true, "rev": <number>, "savedAt": ... }`.

### 동시 편집 보호 (rev)

`PUT /state` 에 `X-Expected-Rev` 헤더를 실으면 낙관적 잠금이 걸립니다. 서버가 보관한
`rev` 와 값이 다르면 **409 `{ "error": "revision_conflict", "rev": <서버 rev> }`** 를 반환하고
저장하지 않습니다. 헤더를 생략하면 검사를 건너뛰므로 구버전 클라이언트도 그대로 동작합니다.

이 장치가 없던 시절에는 두 사람이 비슷한 시각에 입력하면 나중 요청이 앞사람 입력을
통째로 지웠습니다(last-write-wins). 앱은 409 를 받으면 자동 업로드를 멈추고
사용자에게 새로고침을 안내하며, 그동안 로컬 데이터는 보존합니다.

`rev` 는 KV 값의 메타데이터에 저장되므로 별도 키가 필요하지 않습니다.

## 프론트 연결 방법

배포된 Worker URL과 토큰을 앱에 알려주면 자동으로 동기화됩니다. 코드 수정 없이, 배포된 Pages URL에 파라미터를 한 번 붙여 접속하면 됩니다(각 PC에서 최초 1회):

```
https://h-vali.github.io/stockmangeportpolio-private-/?proxy=https://YOUR-WORKER.workers.dev&synckey=YOUR_SYNC_TOKEN
```

- `proxy`: Worker 주소 → `localStorage`(assetpilot-proxy-base-url)에 저장, 시세/환율/상태 API에 공통 사용
- `synckey`: `SYNC_TOKEN` 과 동일한 값 → `localStorage`(assetpilot-sync-token)에 저장

둘 다 설정된 PC에서만 서버 동기화가 켜지고, 없으면 기존처럼 로컬(localStorage) 전용으로 동작합니다.
