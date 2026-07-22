# 배포 (Cloudflare, 무료)

혼자 여러 대의 PC에서 쓰는 것이 목표입니다. 내보내기/가져오기 없이, 접속만 하면
같은 데이터가 보이게 만듭니다.

**프로젝트는 하나입니다.**

```
Cloudflare Pages   정적 웹앱(index.html, src/, styles.css)
        +
        └─ functions/   같은 오리진 API
             /state   ← 원장 저장소 (KV)
             /quote   ← 미국주식 시세 (Finnhub)
             /fxrate  ← USD/KRW 환율
```

프론트와 API가 같은 오리진이라 별도 프록시 URL을 앱에 알려줄 필요가 없습니다.
코인 시세와 환율 폴백은 브라우저가 공개 API를 직접 부르므로 Functions 없이도 됩니다.
Functions가 필요한 이유는 **① 여러 PC 간 데이터 공유** 와 **② Finnhub API 키 숨기기** 입니다.

---

## 0. 준비

- Cloudflare 계정 (무료)
- GitHub 저장소 (이미 있음)
- Finnhub 무료 API 키 — 미국주식 시세를 쓸 경우에만 (https://finnhub.io)

전부 대시보드에서 진행합니다. 로컬에 wrangler 설치나 CLI 배포가 필요 없습니다.

---

## 1. KV 네임스페이스 생성 (원장 저장소)

**Storage & Databases → KV → Create namespace**, 이름 `ASSET_STATE`.

나온 네임스페이스는 아래 3단계에서 Pages 프로젝트에 바인딩합니다. ID를 코드에
적어둘 필요는 없습니다(바인딩은 대시보드 설정이라 커밋 대상이 아닙니다).

## 2. SYNC_TOKEN 만들어 보관

**본인만 아는 긴 무작위 문자열**입니다. 이 토큰이 곧 데이터 접근 권한이므로
추측 가능한 값을 쓰면 안 됩니다.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

비밀번호 관리자에 저장하세요. **각 PC를 연결할 때 필요하고, 잃어버리면 새로
만들어 모든 PC를 재연결해야 합니다.**

## 3. Pages 프로젝트 생성 (웹앱 + Functions)

빌드 과정이 없으므로 저장소를 그대로 올리면 됩니다.

**Cloudflare 대시보드 → Workers & Pages → Create → Pages → Connect to Git** →
이 저장소(`H-Vali/stockmangeportpolio-private-`) 선택.

| 항목 | 값 |
|---|---|
| Framework preset | None |
| Build command | (비움) |
| Build output directory | `/` |

저장소 루트에 `functions/` 디렉터리가 있으면 Cloudflare Pages가 자동으로
Pages Functions로 배포합니다. 별도 설정이 필요 없습니다.

`main` 브랜치에 push할 때마다 자동 배포됩니다. `https://<프로젝트>.pages.dev`
주소가 나옵니다.

### 3-1. KV 바인딩

배포된 Pages 프로젝트 **Settings → Functions → KV namespace bindings → Add binding**.

| Variable name | KV namespace |
|---|---|
| `ASSET_STATE` | 1단계에서 만든 네임스페이스 |

**변수명이 정확히 `ASSET_STATE`여야 합니다.** `functions/state.js`가 이 이름으로
`env.ASSET_STATE`를 참조합니다. 다르면 `/state`가 `{"error":"kv_not_bound"}`를
돌려줍니다.

### 3-2. 런타임 시크릿 등록

같은 프로젝트 **Settings → Environment variables → Add variable**.

| Type | Name | Value |
|---|---|---|
| **Secret** | `SYNC_TOKEN` | 2단계에서 만든 문자열 |
| **Secret** | `FINNHUB_API_KEY` | Finnhub 무료 키 (생략 가능) |

**Production과 Preview 둘 다** 등록하세요(환경별로 따로 관리됩니다). Type을
반드시 **Secret**으로 고르세요(Text 아님). 저장하면 다음 배포부터 반영되므로,
등록 직후라면 **Deployments → 최신 배포 → Retry deployment**로 한 번 재배포하세요.

`FINNHUB_API_KEY`는 미국주식 시세를 안 쓸 거면 건너뛰어도 됩니다. 그 경우
`/quote`만 500을 반환하고 코인·환율·원장은 정상 동작합니다.

### 3-3. 동작 확인 — 여기를 통과할 때까지 다음 단계로 가지 마세요

**토큰 없이 먼저 확인하세요.** 인증 헤더를 빼고 호출하면 설정 상태가 그대로
드러나므로, 이 출력은 공유해도 안전합니다.

```bash
curl -i https://<프로젝트>.pages.dev/state
```

| 응답 | 의미 |
|---|---|
| `401 {"error":"unauthorized"}` | ✅ SYNC_TOKEN·KV 둘 다 정상. 인증만 거부된 상태 |
| `500 {"error":"sync_not_configured"}` | 시크릿 미인식 — 3-2 확인, 재배포했는지 확인 |
| `500 {"error":"kv_not_bound"}` | KV 바인딩 누락 또는 변수명 오타 — 3-1 확인 |
| `404` | `functions/` 디렉터리가 배포에 포함되지 않음 — Build output directory가 `/`인지 확인 |
| **`302` → `...cloudflareaccess.com/cdn-cgi/access/login/...`** | **Cloudflare Access가 앞단을 막고 있음** — Zero Trust 대시보드 → Access → Applications에서 이 Pages 도메인 애플리케이션을 찾아 삭제 |

401을 확인한 뒤 토큰을 넣어 최종 확인합니다.

```bash
curl -H "Authorization: Bearer <SYNC_TOKEN>" https://<프로젝트>.pages.dev/state
```

| 응답 | 의미 |
|---|---|
| `{"state":null,"rev":0}` | 정상. 아직 데이터가 없는 빈 상태 |
| `{"error":"unauthorized"}` | 토큰 불일치 — 3-2의 값과 curl의 값 확인 |

---

## 4. 각 PC에서 최초 1회 연결

배포된 Pages 주소로 접속한 뒤, 상단 **"동기화 설정"** 버튼을 눌러 `SYNC_TOKEN`과
동일한 값을 입력하고 저장하세요. 앱이 `localStorage`에 저장하고 이후 자동으로
사용합니다. 접속할 PC마다 **딱 한 번**만 하면 됩니다.

부팅할 때마다 서버 상태를 불러오고, 원장을 고치면 자동으로 올라갑니다.
**내보내기/가져오기는 더 이상 필요 없습니다.**

### (대안) URL 파라미터로 연결

앱 내 설정 대신 링크 하나로 넘겨주고 싶다면 하위호환으로 유지되는 방식도 있습니다.

```
https://<프로젝트>.pages.dev/?synckey=<SYNC_TOKEN>
```

`?synckey=`로 접속하면 브라우저 방문 기록에 토큰이 남습니다. 혼자 쓰는 개인
PC라면 큰 문제가 아니지만, 신경 쓰인다면 연결 직후 그 기록만 지우세요. 공용
PC에서는 이 방식을 쓰지 마세요.

---

## 무료 한도

Cloudflare 무료 플랜 기준입니다. 한도는 바뀔 수 있으니 실제 값은 대시보드에서
확인하세요.

| 항목 | 무료 한도 | 이 앱의 사용량 |
|---|---|---|
| Pages 요청 (정적 파일) | 사실상 무제한 | 문제 없음 |
| Pages 빌드 | 월 500회 | push 횟수만큼 |
| Pages Functions 요청 | 일 100,000회 | 아래 참고 |
| KV 읽기 | 일 100,000회 | 페이지 열 때 1회 |
| **KV 쓰기** | **일 1,000회** | **아래 참고 — 가장 빡빡한 항목** |
| KV 저장 용량 | 1GB | 원장 JSON 수백 KB |

### KV 쓰기가 병목입니다

**이 부분 때문에 코드를 고쳤습니다.** 원래는 시세 폴링(60초)이 돌 때마다 상태
전체를 서버에 썼습니다. 탭 하나만 켜둬도 하루 1,440회 — 무료 쓰기 한도를
17시간 만에 태웁니다.

지금은 **사람이 입력한 원장이 바뀔 때만** 서버에 씁니다.

- 서버로 올림: 투자자 추가/수정/삭제, 입출금, 매수/매도 등록·수정·삭제, 백업 가져오기
- 로컬에만 저장: 시세 갱신, 환율 갱신, 일별 스냅샷, 화면 전환

시세는 각 기기가 알아서 다시 받아오고, 스냅샷은 원장에서 다시 계산되므로
공유할 필요가 없습니다. 하루에 거래를 50번 입력해도 50회 쓰기입니다.

Functions 요청도 같이 줄었지만, `/quote`는 보유 종목 수 × 폴링 횟수만큼 나갑니다.
종목이 20개면 하루 `20 × 1,440 = 28,800`회로 무료 한도(10만) 안에는 들어오지만
여유가 많지는 않습니다. 종목이 늘거나 탭을 여러 개 켜두면 폴링 주기를 늘리세요
(`src/net/scheduler.js`의 `60000`).

### Finnhub 요청 한도 (Cloudflare 무료 한도와는 별개)

`/quote`(미국주식·지수)는 Cloudflare 자체가 아니라 **Finnhub 무료 플랜 한도
(분당 60회)**에 먼저 걸립니다. 초과해도 과금되지 않고 `429`로 거부만 됩니다.

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
- **실패 응답은 캐시하지 않음** (`functions/quote.js`) — 429를 60초씩 캐시해
  버리면 한도가 풀린 뒤에도 낡은 실패 응답이 계속 나갑니다. 성공 응답만 캐시합니다.

코인 시세(빗썸·바이낸스·CoinGecko)는 이 한도와 완전히 무관합니다. Functions를
거치지 않고 브라우저에서 직접 호출하므로, 더 빠르게 갱신해도 Cloudflare
쪽 비용·한도에는 영향이 없습니다(`src/net/crypto.js`).

---

## 동시 편집

PC 두 대에서 같은 원장을 고치면 나중에 저장한 쪽이 앞사람 입력을 지우는 문제가
있었습니다. 지금은 KV에 개정 번호(`rev`)를 메타데이터로 함께 저장해서, 다른
기기가 먼저 저장했으면 **409를 반환하고 저장을 거부**합니다. 앱은 자동 업로드를
멈추고 알림을 띄우며 로컬 데이터는 그대로 둡니다. 새로고침하면 서버 데이터를
받아옵니다.

혼자 쓸 때도 의미가 있습니다 — 집 PC에서 입력하고 회사 PC 탭이 열려 있는 채로
방치됐다가 뒤늦게 저장되는 사고를 막습니다.

---

## 나중에 여러 사람이 쓰게 될 때

지금 구조는 **토큰 하나 = 전체 데이터 접근**입니다. 혼자 쓸 때는 충분하지만,
각자 로그인해서 본인 자산만 보게 하려면 계정·세션·데이터 분리가 필요합니다.
KV의 단일 `state` 키를 사용자별로 쪼개야 하므로 D1(무료 SQL) 전환이 자연스럽습니다.
그때 `src/state/persistence.js`와 `src/state/sync.js`, `functions/state.js`가
교체 지점입니다.

---

## 문제가 생기면

브라우저 콘솔에서:

```js
assetpilotLogs()
```

최근 200건의 로그가 나옵니다. 동기화 실패, 시세 조회 실패, 저장소 오류가 모두
여기 남습니다. `window.onerror`도 이 버퍼로 들어갑니다.

| 증상 | 확인할 것 |
|---|---|
| 동기화·시세가 전부 실패, 응답이 JSON이 아니라 HTML | **Cloudflare Access가 켜져 있음.** 3-3 참고 |
| 다른 PC에 데이터가 안 보임 | 상단 "동기화 설정"에 토큰을 입력했는지, 값이 정확한지 |
| "저장 실패 (401)" | `SYNC_TOKEN`과 입력한 토큰이 다름 |
| "저장 실패 (500)" | KV 바인딩 변수명이 `ASSET_STATE`가 아니거나, 시크릿을 Preview/Production 중 한쪽에만 등록함 |
| 미국주식 시세만 안 붙음 | `FINNHUB_API_KEY` 미등록(다른 기능은 정상) — `curl .../quote?symbol=AAPL`이 `missing_finnhub_key`를 반환하면 이 경우 |
| 미국주식 시세가 간헐적으로 안 붙음, `curl`하면 `429 Too Many Requests` | **Finnhub 무료 요청 한도(분당 60회) 초과.** 키 문제가 아니라 요청이 너무 많은 것. 앱이 자체적으로 대응하므로 보통 몇 분 안에 저절로 회복된다 |
| 충돌 알림이 뜸 | 다른 기기가 먼저 저장함. 새로고침 |

Functions 상태는 토큰 없이도 한 줄로 진단할 수 있습니다.

```bash
curl -i https://<프로젝트>.pages.dev/state
```

`302 → cloudflareaccess.com`이면 Access, `500`이면 설정 누락, `401`이면 정상입니다.
