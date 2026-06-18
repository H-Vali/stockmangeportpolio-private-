# AssetPilot

자산관리 포트폴리오를 빠르게 검토할 수 있는 정적 웹앱입니다.

## 현재 구현 범위

- 총 평가금액, 손익, 현금비중, 리밸런싱 필요 항목 요약
- 보유자산 등록 및 삭제
- 자산 분류별 배분 차트와 목표비중 대비 리밸런싱 가이드
- 계좌별 평가금액 요약
- 최근 거래 등록
- 브라우저 `localStorage` 저장 및 JSON 내보내기
- GitHub Pages public preview 배포 워크플로우

## 데이터 구조 메모

- `investors`: 투자자 목록
- `holdings.ownerId`: 보유 종목의 투자자 귀속
- `transactions.ownerId`: 거래의 투자자 귀속
- 통합 대시보드는 투자자별 데이터를 단순 합산
- 투자원금은 현금을 제외한 매수원가 합계
- 예수금은 현금 항목으로 별도 표시

## 로컬 실행

별도 빌드 과정 없이 `index.html`을 브라우저에서 열면 됩니다.

## GitHub Pages

이 repo의 `Settings > Pages`에서 Source를 `GitHub Actions`로 설정하면, `main` 브랜치 push 후 public preview가 생성됩니다.
