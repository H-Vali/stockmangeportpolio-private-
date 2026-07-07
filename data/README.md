# 미국 종목 DB (us-symbols.json)

티커 입력 시 종목명·분류(주식/ETF)를 자동으로 채우기 위한 미국 상장 종목 데이터입니다.

## 형식

배열-of-배열로 최소화되어 있습니다.

```json
[["AAPL","Apple Inc.",0],["SPY","State Street SPDR S&P 500 ETF Trust",1]]
```

- `[0]` 티커, `[1]` 종목명, `[2]` ETF 여부(0=개별주, 1=ETF)

앱은 첫 티커 조회 시 `./data/us-symbols.json`을 지연 로딩합니다(초기 렌더에 영향 없음).

## 출처 / 갱신

NASDAQ Trader 심볼 디렉터리(공개·무료, 매일 갱신):
`nasdaqlisted.txt` + `otherlisted.txt` (NYSE/NASDAQ/AMEX 전체, ETF 플래그 포함).

신규 상장 등을 반영하려면 재생성하세요(Node 18+):

```
node data/build-symbols.mjs
```
