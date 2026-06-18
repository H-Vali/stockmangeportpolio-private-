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

## 로컬 실행

별도 빌드 과정 없이 `index.html`을 브라우저에서 열면 됩니다.

## GitHub Pages

이 repo의 `Settings > Pages`에서 Source를 `GitHub Actions`로 설정하면, `main` 브랜치 push 후 public preview가 생성됩니다.
