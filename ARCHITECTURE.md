# 구조

빌드 도구 없이 브라우저가 그대로 실행하는 ES 모듈 구성입니다. 번들러도, 트랜스파일도 없습니다.
`index.html` 은 `src/app/main.js` 하나만 `<script type="module">` 로 읽고, 나머지는 import 로 이어집니다.

## 계층

의존 방향은 **아래에서 위로만** 흐릅니다. 위 계층이 아래를 부르고, 아래는 위를 모릅니다.

```
app/          부팅 순서만 정하는 진입점 (main.js, bootstrap.js)
  ↓
ui/           DOM. 화면 그리기, 이벤트 등록, 폼 처리
  ↓
net/          외부 API. 시세·환율·심볼 조회, 폴링 스케줄
  ↓
domain/       순수 계산. 원장 재생, 요약, 배당, 자산배분
  ↓
state/        영속 상태. 저장소, 스키마, 검증, 마이그레이션, 동기화
  ↓
core/         공용 유틸. 포맷, 시간, HTTP, 로거
  ↓
config/       상수와 정적 사전 (아무것도 import 하지 않는 leaf)
```

한 가지 예외가 있습니다. `domain/actions.js` 처럼 "사용자 행동" 을 처리하는 코드는
계산을 끝낸 뒤 `render()` 와 `showToast()` 를 부르므로 ui 를 역참조합니다.
ES 모듈은 함수 선언끼리의 순환 참조를 문제없이 다루므로 동작에는 지장이 없지만,
**새 계산 로직을 넣을 때는 `domain/portfolio.js` 처럼 ui 를 모르는 파일에 두세요.**
그래야 테스트에서 DOM 없이 부를 수 있습니다.

## 디렉터리

| 경로 | 역할 |
|---|---|
| `src/config/constants.js` | 저장소 키, 스키마 버전, 세율, 기본 환율, 폴링 간격 등 상수 |
| `src/config/catalog.js` | 종목 사전, 코인 심볼 매핑, 배당 지급월, 지수 모니터 목록 |
| `src/core/format.js` | Intl 포매터와 금액·비율·수량 표기 |
| `src/core/time.js` | KST 기준 날짜 계산, 환율 갱신 시간대 판정 |
| `src/core/http.js` | 타임아웃·재시도가 붙은 `fetchJson`, `HttpError` |
| `src/core/logger.js` | 레벨 로거 + 최근 200건 링 버퍼 |
| `src/state/persistence.js` | 저장소 어댑터. localStorage 가 막히면 메모리로 폴백 |
| `src/state/schema.js` | `seedState`, 정규화, 원장 초기화 |
| `src/state/validate.js` | 가져오기/서버 응답 스키마 검증 |
| `src/state/migrate.js` | 버전별 변환 등록소 |
| `src/state/store.js` | `state` 단일 보관소, `setState`, `subscribe`, 저장, 스냅샷 |
| `src/state/sync.js` | Pages Functions `/state` 동기화. rev 기반 충돌 감지 |
| `src/domain/portfolio.js` | 원장 재생, 예수금, 요약, 유형별 배분, 물타기 미리보기 |
| `src/domain/dividend.js` | 배당 표 계산, 지급 주기 |
| `src/domain/allocation.js` | 도넛 차트용 슬라이스 |
| `src/domain/actions.js` | 투자자 추가/수정, 거래 등록/수정/삭제 |
| `src/net/crypto.js` | 빗썸 폴링 + Binance WebSocket 실시간 |
| `src/net/stocks.js` | 프록시 경유 미국주식·지수 시세 |
| `src/net/fx.js` | USD/KRW 환율 (프록시 → frankfurter → er-api) |
| `src/net/symbols.js` | 미국 종목 심볼 DB 지연 로딩 |
| `src/net/scheduler.js` | 폴링 타이머 |
| `src/ui/render/*` | 화면별 렌더 |
| `src/ui/forms/*` | 폼 초기화와 입력 처리 |
| `src/ui/events.js` | DOM 이벤트 등록 (import 만으로 실행되는 부수효과 모듈) |
| `src/ui/uistate.js` | 저장하지 않는 화면 상태 |

## 상태를 다루는 규칙

`state` 는 `state/store.js` 가 소유합니다. import 한 바인딩은 읽기 전용이라
다른 모듈에서 `state = ...` 로 바꿀 수 없습니다.

- **일부만 고칠 때**: `state.trades.push(...)` 처럼 직접 변형한 뒤 `saveState()`
- **통째로 갈아끼울 때**: `setState(next)` 를 쓰고 `saveState()`

`saveState()` 는 호출될 때마다 `rev` 를 1 올리고 `updatedAt` 을 찍습니다.
이 값이 동시 편집 충돌 감지의 근거입니다.

## 환율 두 가지

헷갈리기 쉬운 지점이라 규칙을 못박아 둡니다. 앱은 환율을 **두 개** 들고 있고 역할이 다릅니다.

| | 저장 위치 | 역할 | 갱신 |
|---|---|---|---|
| 매입시점 환율 | `trade.fx` → 재생 시 `avgFx` | 환차손익의 기준점 | **절대 덮어쓰지 않음** |
| 현재 평가 환율 | `asset.currentFx` | 지금 평가금액을 원화로 환산 | 항상 최신 환율 |

`avgFx` 는 외화 원가 가중평균입니다. 여러 번 나눠 사자면 매입 환율이 섞이므로
단순 평균이 아니라 `(외화원가 × 그때 환율)의 합 / 외화원가의 합` 으로 계산합니다.

```
환차손익 = 수량 × 평단(외화) × (현재 평가 환율 − 매입시점 평균환율)
주가손익 = 수량 × (현재가 − 평단) × 현재 평가 환율
총손익  = 주가손익 + 환차손익
```

현재 평가 환율 동기화는 `syncUsdAssetFx()`(`state/store.js`) 한 곳에서만 합니다.
호출 지점은 환율 갱신(`net/fx.js`), 거래 등록·수정(`domain/actions.js`) 두 군데입니다.

**코인은 제외합니다.** 코인은 USDT/KRW 로 환산해야 해서 빗썸 시세 경로가 `currentFx` 를
따로 관리합니다. USD/KRW 로 덮어쓰면 코인 평가액이 틀어집니다.

> 과거 결함: 동기화 코드가 `refreshFxRate()` 의 조기 return **뒤에** 있어서, 환율을
> 받아온 뒤에 등록한 USD 종목이 입력 폼에 적힌 환율에 묶였습니다. 평가금액뿐 아니라
> 환차손익까지 과소 계상됐습니다(실측 1,478.4 대신 1,400 사용). 지금은 동기화가
> throttle 앞에 있어 조회를 건너뛰어도 자산 환율은 맞춰집니다. `tests/fx.test.js` 로 고정.

## 동시 편집 (rev)

이전에는 저장할 때마다 상태 전체를 무조건 `PUT` 해서, 두 기기가 비슷한 시각에
입력하면 나중에 저장한 쪽이 앞사람 입력을 통째로 지웠습니다.

지금은 `functions/state.js` 가 KV 메타데이터에 `rev` 를 함께 보관합니다.

1. `GET /state` → `{ state, rev }`. 클라이언트가 이 `rev` 를 기억합니다.
2. `PUT /state` 에 `X-Expected-Rev` 헤더로 그 값을 실어 보냅니다.
3. 서버 `rev` 가 그 사이 올라갔으면 **409 를 반환하고 저장하지 않습니다.**
4. 클라이언트는 자동 푸시를 멈추고 사용자에게 알립니다. 로컬 데이터는 보존됩니다.

헤더가 없으면 검사를 건너뛰므로 구버전 클라이언트도 계속 동작합니다.

## 확인 명령

```bash
npm run check
```

`lint:modules` 는 번들러 없이 import 그래프를 정적 검사합니다. 잡아내는 것:

- 존재하지 않는 파일을 가리키는 import
- 대상이 export 하지 않는 이름을 가져오는 import
- 두 모듈이 같은 이름을 export
- import 한 바인딩에 재할당 (런타임 TypeError가 되는 코드)
- 쓰이지 않는 import (불필요한 모듈 간 결합)

이어서 `node --test` 로 도메인·스키마·기반 계층 단위 테스트를 돌립니다.

## 로컬 실행

```bash
npm run dev
```

`http://localhost:4173` 에서 열립니다. ES 모듈은 `file://` 로 열면 CORS 때문에
import 가 막히므로, 이제 `index.html` 을 더블클릭하는 방식은 동작하지 않습니다.
배포는 여전히 빌드 없는 정적 호스팅 그대로입니다.

## 브라우저 점검 시 주의: `?rafshim=1`

`render()` 는 `requestAnimationFrame` 으로 디바운스되어 있고, 금액 표기(`setMoneyElement`)도
rAF 기반 카운트업 애니메이션을 씁니다. 브라우저가 **화면에 보이지 않는 탭에서는 rAF 를 아예
발화시키지 않기** 때문에, 자동화 도구로 백그라운드 탭을 열어 검사하면 상태는 정상적으로
바뀌는데 DOM 만 그대로인 것처럼 보입니다.

개발 서버에 한해 우회 수단을 두었습니다.

```
http://localhost:4173/?rafshim=1
```

`requestAnimationFrame` 을 `setTimeout` 으로 갈아끼운 `<script>` 를 `</head>` 앞에 주입합니다.
**개발 서버에서만** 동작하며 배포 산출물에는 들어가지 않습니다.

같은 이유로, 백그라운드 탭에 오래 둔 실제 사용자 화면도 포그라운드로 돌아올 때까지
숫자가 갱신되지 않습니다. 데이터는 정상이며 복귀 시 곧바로 다시 그려집니다.

## 진단

브라우저 콘솔에서 최근 로그를 확인할 수 있습니다.

```js
assetpilotLogs()
```

`window.onerror` 와 `unhandledrejection` 도 이 버퍼로 들어가므로, 화면이 비어 있을 때
무엇이 언제 실패했는지 바로 볼 수 있습니다.

## 분해의 흔적

- **`app.js`** — 분해 전 원본(3,898줄)은 삭제했습니다. 내용을 봐야 할 일이 생기면
  커밋 `8e754ee` 에 그대로 남아 있습니다.
  ```bash
  git show 8e754ee:app.js
  ```
- **`tools/split-app.mjs`** — 위 분해를 수행한 1회성 코드모드입니다. 입력이던
  `app.js` 가 없어졌으므로 이제 실행되지 않습니다. **"어떤 기준으로 어느 모듈에
  나눴는가"의 기록**으로만 둡니다. `BREAKPOINTS` 표를 보면 원본의 어느 줄이 어느
  파일로 갔는지 추적할 수 있습니다.
