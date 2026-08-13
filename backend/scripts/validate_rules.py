"""5종 규칙 검증 스크립트: 실제 더미 데이터에 규칙을 돌려서 건수/샘플을 눈으로 확인.

실행: python3 backend/scripts/validate_rules.py
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pandas as pd

from attendance.load import load_raw
from attendance import rules

XLSX_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "26.06월_유연근무 현황관리_더미.xlsx"
)

pd.set_option("display.max_colwidth", 80)
pd.set_option("display.width", 160)


def main() -> None:
    print("데이터 로딩 중...")
    df = load_raw(XLSX_PATH)
    print(f"로드 완료: {len(df)}행\n")

    print("=" * 80)
    print("규칙 1: 월 최대근로시간 초과 (기준 시트 미제공 -> 임시로 226h 단일 기준 테스트)")
    print("=" * 80)
    r1 = rules.rule1_monthly_max_hours(df, threshold_lookup=226.0, metric="both")
    print(f"특이건 인원 수: {len(r1)}")
    print(r1.head(10).to_string(index=False))
    print()

    print("=" * 80)
    print("규칙 2: 입문-변경시작 시간 괴리 (1시간 이상)")
    print("=" * 80)
    r2 = rules.rule2_checkin_changed_start_gap(df)
    print(f"특이건 인원 수: {len(r2)}")
    print(r2.head(10).to_string(index=False))
    print()

    print("=" * 80)
    print("규칙 3: 제외시간 과다 사용 (본사 30h / 현장 50h / 15회)")
    print("=" * 80)
    r3 = rules.rule3_excessive_exclude_time(df)
    print(f"특이건 인원 수: {len(r3)}")
    print(r3.head(10).to_string(index=False))
    print()

    print("=" * 80)
    print("규칙 4: 코어타임 미준수 + 시간연차 미사용")
    print("=" * 80)
    r4 = rules.rule4_core_time_violation_without_hour_leave(df)
    print(f"특이건 인원 수: {len(r4)}")
    print(r4.head(10).to_string(index=False))
    print()

    print("=" * 80)
    print("규칙 5: 월말 제외시간 일괄 입력 의심")
    print("=" * 80)
    r5 = rules.rule5_month_end_exclude_bulk_pattern(df)
    print(f"특이건 인원 수: {len(r5)}")
    print(r5.head(10).to_string(index=False))
    print()

    print("=" * 80)
    print("전체 요약")
    print("=" * 80)
    for name, r in [("R1", r1), ("R2", r2), ("R3", r3), ("R4", r4), ("R5", r5)]:
        print(f"{name}: {len(r)}명")


if __name__ == "__main__":
    main()
