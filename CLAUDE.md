# 근태 특이건 분석 대시보드

## 작업 방식 (사용자 지시, 2026-08-24)

- 사용자가 "수정하고 깃허브에 올려줘" 식으로 요청하면, 코드 수정 후 별도 확인 없이 git add/commit/push까지 알아서 진행한다.
- push 전에 `git status`/`git diff`로 의도한 변경만 올라가는지는 계속 확인한다 (원본 데이터, 비밀값 등 실수로 포함되지 않게).

## 2026-08-24 세션 기록

- 사내망 접속 링크가 localhost:3000이라 다른 PC에서 안 열리는 문제 해결: `frontend/next.config.ts`의 `allowedDevOrigins`에 있던 예전 IP(10.10.7.11)를 현재 PC의 실제 LAN IP(10.115.107.238)로 갱신
- 프론트(`next dev --webpack`, 0.0.0.0:3000)/백엔드(`uvicorn`, 0.0.0.0:8000) 모두 재시작해서 새 설정 반영 확인, 사내망 다른 PC(10.115.107.95)에서 실제 접속되는 것 확인
- 주의: 이 PC의 LAN IP는 Wi-Fi 재연결 시 바뀔 수 있음 — 접속 안 되면 `ipconfig`으로 IP 재확인 후 `allowedDevOrigins` 갱신 필요
- Windows 방화벽 인바운드 규칙(3000/8000 포트)은 권한 문제로 미확인 상태 — 사내망에서 접속 안 되면 관리자 권한으로 확인 필요

## 2026-08-13 세션 기록

- 근태 특이건 분석 대시보드 1차 완성: 규칙 7종 탐지, 사업부/부서/개인 드릴다운, 월별 추이 차트, 화이트&블루 디자인 적용
- 원본 업로드 파일은 저장하지 않고 파생 데이터만 SQLite(`backend/data/attendance.db`)에 월별 누적 (사번+일자 upsert)
- 미완료: 월 최대근로시간 기준시트(R1) 미연동(배관만 완성), 사업부 매핑 파일 없음(현재 부서명=사업부로 대체), 실사용 배포 보류(Vercel/Render 계정 준비 안 됨), 로그인 인증 없음
- GitHub(`origin/main`, `git@github.com:ldh030908-donghen/donghen.git`) 최신 커밋까지 push 완료
- 알려진 리스크: 로컬 dev 서버 + Cloudflare Quick Tunnel로만 외부 접근 가능한 임시 상태, 작업 PC 종료 시 링크 소실
