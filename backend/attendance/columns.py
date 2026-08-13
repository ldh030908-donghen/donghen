"""원본 RAW 시트의 실제 컬럼 매핑 (2026.06월 더미 파일 기준으로 검증됨)."""

# 원본 헤더 그대로 사용 (엑셀 헤더 텍스트와 1:1 일치해야 함)
COL_NAME = "성명"
COL_EMP_ID = "사번"
COL_DEPT = "부서명"
COL_RANK = "직급"
COL_DATE = "일자"  # 'YYYYMMDD' 문자열
COL_DOW = "요일"
COL_SCHEDULE_TYPE = "근무스케쥴타입"
COL_WORKGROUP = "근무조"  # 예: '선택근무제(본사)', '선택근무제(현장)', '시차출근제' 등
COL_WORKTYPE = "근무형태"  # 예: '선택근무제', '휴일', '7시 출근(기본)' 등
COL_CUR_DEPT = "당시부서"
COL_WORKTIME = "근무시간"  # K열, 이미 계산된 실근로시간 = (변경후종료-변경후시작)-제외시간
COL_CHECKIN = "입문"  # L열, 'HH:MM' 문자열
COL_CHECKOUT = "출문"  # M열, 'HH:MM' 문자열
COL_STAY = "★체류시간"  # N열, 원본은 빈 값 -> 우리가 계산
COL_WORK_START = "근무시작"  # O열
COL_WORK_END = "근무종료"  # P열
COL_CHANGED_START = "변경후시작"  # Q열
COL_CHANGED_END = "변경후종료"  # R열
COL_ATTENDANCE = "근태"  # S열, 예: '출장', '외근', '연차', '1시간 연차' 등
COL_EXCLUDE = "제외시간"  # T열
COL_OVERTIME = "연장근무시간"  # U열
COL_NIGHT = "심야근무시간"  # V열
COL_HOLIDAY_WORK = "휴일근무시간"  # W열

# HQ(본사) 선택근무제 여부 판별에 쓰이는 근무조 값
WORKGROUP_HQ_FLEX = "선택근무제(본사)"
WORKGROUP_FIELD_FLEX = "선택근무제(현장)"

CORE_TIME_START_MIN = 10 * 60  # 10:00
CORE_TIME_END_MIN = 15 * 60  # 15:00
