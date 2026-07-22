# 배포 (Cloudflare, 무료)

혼자 여러 대의 PC에서 쓰는 것이 목표입니다. 내보내기/가져오기 없이, 접속만 하면
같은 데이터가 보이게 만듭니다.

구성은 두 조각입니다.

```
Cloudflare Pages   정적 웹앱 (index.html, src/, styles.css)
        │
        │  fetch
        ▼
Cloudflare Worker  /state  ← 원장 저장소 (KV)
                   /quote  ← 미국주식 시세 (Finnhub)
                   /fxrate ← USD/KRW 환율
```

코인 시세와 환율 폴백은 브라우저가 공개 API를 직접 부르므로 Worker 없이도 됩니다.
Worker가 필요한 이유는 **① 여러 PC 간 데이터 공유** 와 **② Finnhub API 키 숨기기** 입니다.

---

## 0. 준비

- Cloudflare 계정 (무료)
- GitHub 저장소 (이미 있음)
- Finnhub 무료 API 키 — 미국주식 시세를 쓸 경우에만 (https://finnhub.io)

아래 **방법 A(대시보드 Git 연동)** 로 하면 로컬 설치는 필요 없습니다.
**방법 B(로컬 CLI)** 를 쓸 때만 Node 20 이상과 wrangler가 필요합니다.

---

## 1. Worker 배포 (원장 저장소 + 시세 프록시)

방법이 두 가지입니다. **A(대시보드 Git 연동)** 를 권합니다 — push할 때마다 자동
배포되고, 로컬에 wrangler를 설치하지 않아도 됩니다.

### 1-1. KV 네임스페이스 생성 (두 방법 공통, 가장 먼저)

대시보드: **Storage & Databases → KV → Create namespace**, 이름 `ASSET_STATE`

또는 CLI:

```bash
wrangler kv namespace create ASSET_STATE
```

나온 32자리 ID를 `proxy/wrangler.toml` 에 넣고 **커밋·push 합니다.**

```toml
[[kv_namespaces]]
binding = "ASSET_STATE"
id = "여기에_실제_ID"
```

이 ID는 비밀값이 아니라 커밋해도 됩니다. 이걸 빼먹으면 배포는 성공해도
`/state` 가 `{"error":"kv_not_bound"}` 를 돌려줍니다.

### 1-2. SYNC_TOKEN 만들어 보관 (두 방법 공통)

**본인만 아는 긴 무작위 문자열**입니다. 이 토큰이 곧 데이터 접근 권한이므로
추측 가능한 값을 쓰면 안 됩니다.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

비밀번호 관리자에 저장하세요. **각 PC를 연결할 때 필요하고, 잃어버리면 새로
만들어 모든 PC를 재연결해야 합니다.**

---

### 방법 A — 대시보드 Git 연동 (Workers Builds)

**Workers & Pages → Create → Import a repository** 로 저장소를 연결합니다.

| 화면 항목 | 값 |
|---|---|
| 빌드 명령 | (비움 — 빌드 과정이 없습니다) |
| 배포 명령 | `npx wrangler deploy` |
| 프로덕션 이외 분기에 대한 빌드 | 꺼도 됩니다 (혼자 쓰면 미리보기 불필요) |
| **고급 설정 → 경로** | **`/proxy`** |
| 고급 설정 → API 토큰 | `새 토큰 생성` 그대로 |
| 고급 설정 → 토큰 이름 | 아무 이름 (예: `assetpilot-deploy`) |
| 고급 설정 → 변수 이름/값 | **비움** (아래 설명) |

**경로를 `/proxy` 로 바꾸는 것이 핵심입니다.** `wrangler.toml` 이 저장소 루트가
아니라 `proxy/` 에 있어서, 기본값 `/` 로 두면 설정 파일을 못 찾고 실패합니다.

> **고급 설정의 "변수 이름/변수 값" 에 SYNC_TOKEN 을 넣지 마세요.**
> 이 칸은 **빌드 중에만** 쓰이는 변수라 런타임의 `env.SYNC_TOKEN` 으로 읽히지
> 않습니다. 여기에 넣으면 배포는 되는데 `/state` 가 계속 500을 반환합니다.
> 런타임 시크릿은 1-3에서 따로 등록합니다.

### 방법 B — 로컬 CLI

```bash
npm install -g wrangler
wrangler login
cd proxy
wrangler secret put SYNC_TOKEN
wrangler secret put FINNHUB_API_KEY   # 미국주식 시세를 쓸 때만
wrangler deploy
```

이 경우 1-3은 이미 끝난 것이므로 건너뜁니다.

---

### 1-3. 런타임 시크릿 등록 (방법 A를 썼다면 배포 후에)

**Worker → Settings → Variables and Secrets → Add**

| Type | Name | Value |
|---|---|---|
| **Secret** | `SYNC_TOKEN` | 1-2에서 만든 문자열 |
| **Secret** | `FINNHUB_API_KEY` | Finnhub 무료 키 (생략 가능) |

Type을 반드시 **Secret** 으로 고르세요(Text 아님). 저장하면 새 버전이 자동
배포됩니다. 시크릿은 이후 `wrangler deploy` 가 다시 돌아도 지워지지 않으므로
한 번만 등록하면 됩니다.

`FINNHUB_API_KEY` 는 미국주식 시세를 안 쓸 거면 건너뛰어도 됩니다.
그 경우 `/quote` 만 500을 반환하고 코인·환율·원장은 정상 동작합니다.

### 1-4. 동작 확인 — 여기를 통과할 때까지 다음 단계로 가지 마세요

배포된 주소는 `wrangler.toml` 의 `name` 을 따릅니다.

```
https://<name>.<계정 서브도메인>.workers.dev
```

> **`name` 은 대시보드에 만들어진 Worker 서비스 이름과 반드시 같아야 합니다.**
> 다르면 wrangler 가 그 이름의 Worker 를 새로 만들어 배포합니다. 대시보드에서
> 등록한 시크릿은 원래 서비스에 남아 있으므로, 새로 만들어진 쪽은 시크릿이 없어
> `/state` 가 `sync_not_configured` (500) 를 반환합니다. 빌드도 배포도 성공으로
> 표시되기 때문에 원인을 찾기 어렵습니다.

**토큰 없이 먼저 확인하세요.** 인증 헤더를 빼고 호출하면 설정 상태가 그대로
드러나므로, 이 출력은 공유해도 안전합니다.

```bash
curl -i https://<name>.<계정 서브도메인>.workers.dev/state
```

| 응답 | 의미 |
|---|---|
| `401 {"error":"unauthorized"}` | ✅ SYNC_TOKEN·KV 둘 다 정상. 인증만 거부된 상태 |
| `500 {"error":"sync_not_configured"}` | 시크릿 미인식 (이름 불일치 가능성) |
| `500 {"error":"kv_not_bound"}` | KV 바인딩 누락 (배포 경로 `/proxy` 확인) |
| `404 {"error":"not_found"}` | 다른 스크립트가 배포됨 |
| **`302` → `...cloudflareaccess.com/cdn-cgi/access/login/...`** | **Cloudflare Access 가 앞단을 막고 있음 (아래 참고)** |

### Cloudflare Access 는 반드시 꺼야 합니다

Worker 생성 과정에서 Access(Zero Trust) 보호가 켜지는 경우가 있습니다. 그러면
모든 요청이 로그인 페이지로 302 되고 **Worker 코드가 아예 실행되지 않습니다.**
JSON 대신 HTML 이 돌아오므로 앱에서는 동기화·시세가 통째로 실패합니다.

브라우저로 열면 로그인 후 정상으로 보이지만, 앱의 `fetch()` 는 다릅니다.

- 다른 출처(Pages)에서 부르는 요청에는 Access 세션 쿠키가 실리지 않습니다.
- 이 Worker 는 `Access-Control-Allow-Origin: *` 를 쓰는데, 이는 쿠키를 실어
  보내는 요청(credentials)과 함께 쓸 수 없습니다.
- CORS preflight(`OPTIONS`)도 Access 에 막혀 `403` 이 됩니다.

**끄는 법** — Zero Trust 대시보드 → **Access → Applications** 에서 도메인이
`<name>.<계정>.workers.dev` 인 애플리케이션을 찾아 **삭제**합니다.
(정책을 Bypass / Everyone 으로 바꿔도 되지만, 이 엔드포인트는 자체 Bearer 토큰
인증이 있으므로 삭제가 깔끔합니다.)

Worker 쪽 **Settings → Domains & Routes** 에도 Access 보호 스위치가 있으면 끕니다.

Access 를 끈 뒤 `/state` 는 여전히 `SYNC_TOKEN` 없이는 접근할 수 없습니다.
`/quote` 와 `/fxrate` 는 공개가 되는데, 남이 Finnhub 무료 할당량을 대신 쓰는 게
신경 쓰이면 `proxy/src/index.js` 의 `Access-Control-Allow-Origin` 을 `*` 대신
본인 Pages 주소로 좁히면 됩니다.

401 을 확인한 뒤 토큰을 넣어 최종 확인합니다.

```bash
curl -H "Authorization: Bearer <SYNC_TOKEN>" https://<name>.<계정 서브도메인>.workers.dev/state
```

| 응답 | 의미 |
|---|---|
| `{"state":null,"rev":0}` | 정상. 아직 데이터가 없는 빈 상태 |
| `{"error":"unauthorized"}` | 토큰 불일치 — 1-3의 값과 curl 의 값 확인 |
| `{"error":"sync_not_configured"}` | `SYNC_TOKEN` 미등록 — 1-3 누락 |
| `{"error":"kv_not_bound"}` | KV ID 미반영 — 1-1 누락 (커밋·push 했는지 확인) |
| 빌드 실패 | 고급 설정 **경로**가 `/proxy` 인지 확인 |

---

## 2. Pages 배포 (웹앱)

빌드 과정이 없으므로 저장소를 그대로 올리면 됩니다.

**Cloudflare 대시보드 → Workers & Pages → Create → Pages → Connect to Git**

| 항목 | 값 |
|---|---|
| Framework preset | None |
| Build command | (비움) |
| Build output directory | `/` |

`main` 브랜치에 push할 때마다 자동 배포됩니다.
`https://<프로젝트>.pages.dev` 주소가 나옵니다.

> 이미 GitHub Pages 워크플로우(`.github/workflows/pages.yml`)가 있습니다. 둘 다
> 둬도 충돌하지 않지만, Cloudflare로 옮긴다면 GitHub Pages 쪽은 꺼두는 편이
> 헷갈리지 않습니다. 저장소가 공개 상태라면 Pages 주소도 공개된다는 점만 유의하세요.
> (데이터는 코드에 없고 Worker 뒤에 있으므로 노출되지 않습니다.)

---

## 3. 각 PC에서 최초 1회 연결

접속할 PC마다 **딱 한 번** 아래 주소로 들어갑니다.

```
https://<프로젝트>.pages.dev/?proxy=https://<name>.<계정 서브도메인>.workers.dev&synckey=<SYNC_TOKEN>
```

Worker 주소는 1-4에서 확인한 값을 그대로 씁니다.

앱이 두 값을 `localStorage` 에 저장합니다. 이후로는 그냥
`https://<프로젝트>.pages.dev` 로 들어가면 됩니다.

부팅할 때마다 서버 상태를 불러오고, 원장을 고치면 자동으로 올라갑니다.
**내보내기/가져오기는 더 이상 필요 없습니다.**

### 주소창에 토큰이 남는 문제

`?synckey=` 로 한 번 접속하면 브라우저 방문 기록에 토큰이 남습니다. 혼자 쓰는
개인 PC라면 큰 문제가 아니지만, 신경 쓰인다면 연결 직후 그 기록만 지우거나
개인정보 보호 모드에서 연결하지 말고 평소 창에서 연결한 뒤 기록을 정리하세요.
공용 PC에서는 연결하지 마세요.

---

## 무료 한도

Cloudflare 무료 플랜 기준입니다. 한도는 바뀔 수 있으니 실제 값은 대시보드에서
확인하세요.

| 항목 | 무료 한도 | 이 앱의 사용량 |
|---|---|---|
| Pages 요청 | 사실상 무제한 | 문제 없음 |
| Pages 빌드 | 월 500회 | push 횟수만큼 |
| Worker 요청 | 일 100,000회 | 아래 참고 |
| KV 읽기 | 일 100,000회 | 페이지 열 때 1회 |
| **KV 쓰기** | **일 1,000회** | **아래 참고 — 가장 빡빡한 항목** |
| KV 저장 용량 | 1GB | 원장 JSON 수백 KB |

### KV 쓰기가 병목입니다

**이 부분 때문에 코드를 고쳤습니다.** 원래는 시세 폴링(60초)이 돌 때마다 상태
전체를 서버에 썼습니다. 탭 하나만 켜둬도 하루 1,440회 — 무료 쓰기 한도를
17시간 만에 태웁니다. PC 두 대를 동시에 켜두면 절반으로 줄어듭니다.

지금은 **사람이 입력한 원장이 바뀔 때만** 서버에 씁니다.

- 서버로 올림: 투자자 추가/수정/삭제, 입출금, 매수/매도 등록·수정·삭제, 백업 가져오기
- 로컬에만 저장: 시세 갱신, 환율 갱신, 일별 스냅샷, 화면 전환

시세는 각 기기가 알아서 다시 받아오고, 스냅샷은 원장에서 다시 계산되므로
공유할 필요가 없습니다. 하루에 거래를 50번 입력해도 50회 쓰기입니다.

Worker 요청도 같이 줄었지만, `/quote` 는 보유 종목 수 × 폴링 횟수만큼 나갑니다.
종목이 20개면 하루 `20 × 1,440 = 28,800`회로 무료 한도(10만) 안에는 들어오지만
여유가 많지는 않습니다. 종목이 늘거나 탭을 여러 개 켜두면 폴링 주기를 늘리세요
(`src/net/scheduler.js` 의 `60000`).

### Finnhub 요청 한도 (Cloudflare 무료 한도와는 별개)

`/quote`(미국주식·지수)는 Cloudflare 자체가 아니라 **Finnhub 무료 플랜 한도
(분당 60회)** 에 먼저 걸립니다. 초과해도 과금되지 않고 `429`로 거부만 됩니다.

지수 11개 + 보유 미국주식을 60초마다 순차 호출하므로 탭 1개 기준 분당
11~14회 정도로 원래 여유가 있습니다. 문제는 **"여러 PC에서 동시 접속"이 이
앱의 정상 사용 패턴이라는 점** — 탭을 여러 개 열어두면 그 수만큼 곱해집니다.

두 가지로 대응해 뒀습니다.

- **보이는 탭만 갱신** (`src/net/scheduler.js`) — 백그라운드 탭은 폴링을
  멈춥니다. 여러 PC/탭을 동시에 열어둬도 실제로 갱신 요청을 보내는 건 지금
  보고 있는 탭 하나뿐입니다. 다시 보게 되면 즉시 최신 시세로 갱신합니다.
- **연속 실패 시 자동 백오프** (`src/net/stocks.js`) — 429가 나면 다음 몇 번의
  폴링 주기(최대 3분)를 건너뛰어 한도가 풀릴 시간을 줍니다. 성공하면 즉시
  원래 주기로 복귀합니다.

코인 시세(빗썸·바이낸스·CoinGecko)는 이 한도와 완전히 무관합니다. Worker를
거치지 않고 브라우저에서 직접 호출하므로, 더 빠르게 갱신해도 Cloudflare
쪽 비용·한도에는 영향이 없습니다(`src/net/crypto.js`).

---

## 동시 편집

PC 두 대에서 같은 원장을 고치면 나중에 저장한 쪽이 앞사람 입력을 지우는 문제가
있었습니다. 지금은 Worker가 개정 번호(`rev`)를 들고 있어서, 다른 기기가 먼저
저장했으면 **409를 반환하고 저장을 거부**합니다. 앱은 자동 업로드를 멈추고
알림을 띄우며 로컬 데이터는 그대로 둡니다. 새로고침하면 서버 데이터를 받아옵니다.

혼자 쓸 때도 의미가 있습니다 — 집 PC에서 입력하고 회사 PC 탭이 열려 있는 채로
방치됐다가 뒤늦게 저장되는 사고를 막습니다.

---

## 나중에 여러 사람이 쓰게 될 때

지금 구조는 **토큰 하나 = 전체 데이터 접근**입니다. 혼자 쓸 때는 충분하지만,
각자 로그인해서 본인 자산만 보게 하려면 계정·세션·데이터 분리가 필요합니다.
KV의 단일 `state` 키를 사용자별로 쪼개야 하므로 D1(무료 SQL) 전환이 자연스럽습니다.
그때 `state/persistence.js` 와 `state/sync.js` 가 교체 지점입니다.

---

## 문제가 생기면

브라우저 콘솔에서:

```js
assetpilotLogs()
```

최근 200건의 로그가 나옵니다. 동기화 실패, 시세 조회 실패, 저장소 오류가 모두
여기 남습니다. `window.onerror` 도 이 버퍼로 들어갑니다.

| 증상 | 확인할 것 |
|---|---|
| 동기화·시세가 전부 실패, 응답이 JSON 이 아니라 HTML | **Cloudflare Access 가 켜져 있음.** 1-4 참고 |
| 다른 PC에 데이터가 안 보임 | `?proxy=` `&synckey=` 로 연결했는지, 토큰이 정확한지 |
| "저장 실패 (401)" | `SYNC_TOKEN` 과 `synckey` 값이 다름 |
| "저장 실패 (500)" | KV 네임스페이스 id가 `wrangler.toml` 에 안 들어감, 또는 시크릿이 다른 이름의 Worker 에 등록됨 |
| 미국주식 시세만 안 붙음 | `FINNHUB_API_KEY` 미등록 (다른 기능은 정상) — `curl .../quote?symbol=AAPL` 이 `missing_finnhub_key` 를 반환하면 이 경우 |
| 미국주식 시세가 간헐적으로 안 붙음, `curl` 하면 `429 Too Many Requests` (nginx) | **Finnhub 무료 요청 한도(분당 60회) 초과.** 키 문제가 아니라 요청이 너무 많은 것. 앱이 자체적으로 대응하므로(아래) 보통 몇 분 안에 저절로 회복된다 |
| 충돌 알림이 뜸 | 다른 기기가 먼저 저장함. 새로고침 |

Worker 상태는 토큰 없이도 한 줄로 진단할 수 있습니다.

```bash
curl -i https://<name>.<계정>.workers.dev/state
```

`302 → cloudflareaccess.com` 이면 Access, `500` 이면 설정 누락,
`401` 이면 정상입니다.
