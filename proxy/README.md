# AssetPilot Quote Proxy

Cloudflare Workers용 얇은 서버리스 프록시입니다. GitHub Pages 앱은 계속 정적으로 유지하고, API 키가 필요한 Finnhub 호출과 서버 측 HTML 파싱이 필요한 환율 호출만 이 Worker가 담당합니다.

## 환경변수

- `FINNHUB_API_KEY`: Finnhub API key

## 엔드포인트

- `GET /quote?symbol=SCHD`: Finnhub `/quote` 응답 중계, `Cache-Control: max-age=60`
- `GET /fxrate`: USD/KRW 환율 응답, `Cache-Control: max-age=7200`

배포 후 `app.js`의 `PROXY_BASE_URL`에 Worker URL을 입력하면 프론트 자동 연동이 활성화됩니다.
