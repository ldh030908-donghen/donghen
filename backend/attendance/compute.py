"""N열(체류시간) 계산 로직: 입문/출문 HH:MM 문자열 -> 체류시간(분).

자정 롤오버 처리: 출문 시각이 입문 시각보다 이르면(문자열 비교상 더 작으면)
익일로 넘어간 것으로 간주하고 24시간을 더한다.
예) 입문 23:00, 출문(익일) 01:30 -> 26:30 - 23:00 대신, (01:30 + 24:00) - 23:00 = 2:30
"""

from __future__ import annotations

import math
from typing import Optional


def parse_hhmm_to_minutes(value: object) -> Optional[int]:
    """'HH:MM' 문자열을 자정 기준 분(0~1439)으로 변환. 빈 값/이상값이면 None."""
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        hh, mm = s.split(":")
        h = int(hh)
        m = int(mm)
    except (ValueError, AttributeError):
        return None
    if not (0 <= h <= 47 and 0 <= m < 60):
        return None
    return h * 60 + m


def compute_stay_minutes(checkin: object, checkout: object) -> Optional[int]:
    """입문/출문(둘 다 'HH:MM' 문자열)로 체류시간(분)을 계산.

    - 둘 중 하나라도 비어 있으면 None (출장/휴가 등 배지 기록이 없는 날).
    - 출문 시각이 입문 시각보다 빠르면 자정을 넘긴 것으로 보고 +24시간 보정.
    """
    ci = parse_hhmm_to_minutes(checkin)
    co = parse_hhmm_to_minutes(checkout)
    if ci is None or co is None:
        return None
    if co < ci:
        co += 24 * 60
    return co - ci


def minutes_to_hhmm(total_minutes: Optional[int]) -> str:
    """분 단위 정수를 'H:MM' 형태 문자열로 표시 (검증용)."""
    if total_minutes is None or (isinstance(total_minutes, float) and math.isnan(total_minutes)):
        return ""
    h, m = divmod(int(total_minutes), 60)
    return f"{h}:{m:02d}"
