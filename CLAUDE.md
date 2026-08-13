# 근태 특이건 분석 대시보드

## 2026-08-13 세션 기록

- 근태 특이건 분석 대시보드 1차 완성: 규칙 7종 탐지, 사업부/부서/개인 드릴다운, 월별 추이 차트, 화이트&블루 디자인 적용
- 원본 업로드 파일은 저장하지 않고 파생 데이터만 SQLite(`backend/data/attendance.db`)에 월별 누적 (사번+일자 upsert)
- 미완료: 월 최대근로시간 기준시트(R1) 미연동(배관만 완성), 사업부 매핑 파일 없음(현재 부서명=사업부로 대체), 실사용 배포 보류(Vercel/Render 계정 준비 안 됨), 로그인 인증 없음
- GitHub(`origin/main`, `git@github.com:ldh030908-donghen/donghen.git`) 최신 커밋까지 push 완료
- 알려진 리스크: 로컬 dev 서버 + Cloudflare Quick Tunnel로만 외부 접근 가능한 임시 상태, 작업 PC 종료 시 링크 소실
