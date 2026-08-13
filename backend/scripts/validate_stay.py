"""N열(체류시간) 계산 로직 검증 스크립트.

실행: python3 backend/scripts/validate_stay.py
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pandas as pd

from attendance.columns import COL_CHECKIN, COL_CHECKOUT, COL_EMP_ID, COL_DATE
from attendance.compute import compute_stay_minutes, minutes_to_hhmm

XLSX_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "26.06월_유연근무 현황관리_더미.xlsx"
)


def load_raw() -> pd.DataFrame:
    return pd.read_excel(XLSX_PATH, sheet_name="RAW", dtype=str, engine="openpyxl")


def main() -> None:
    df = load_raw()

    df["stay_minutes"] = [
        compute_stay_minutes(ci, co)
        for ci, co in zip(df[COL_CHECKIN], df[COL_CHECKOUT])
    ]
    df["stay_hhmm"] = df["stay_minutes"].apply(minutes_to_hhmm)
    df["is_rollover"] = df.apply(
        lambda r: (
            pd.notna(r[COL_CHECKIN])
            and pd.notna(r[COL_CHECKOUT])
            and str(r[COL_CHECKOUT]).strip() != ""
            and str(r[COL_CHECKIN]).strip() != ""
            and str(r[COL_CHECKOUT]) < str(r[COL_CHECKIN])
        ),
        axis=1,
    )

    total = len(df)
    both_present = df[COL_CHECKIN].notna() & df[COL_CHECKOUT].notna()
    both_present &= (df[COL_CHECKIN].str.strip() != "") & (df[COL_CHECKOUT].str.strip() != "")
    null_stay = df["stay_minutes"].isna().sum()
    rollover_count = df["is_rollover"].sum()

    print(f"총 행수: {total}")
    print(f"입/출문 둘 다 있음: {both_present.sum()}")
    print(f"체류시간 null(둘 중 하나 이상 결측): {null_stay}")
    print(f"자정 롤오버 케이스 수: {rollover_count}")
    print()

    print("=== 자정 롤오버 샘플 10건 (입문 > 출문 문자열이지만 실제로는 익일 출문) ===")
    sample = df[df["is_rollover"]][
        [COL_EMP_ID, COL_DATE, COL_CHECKIN, COL_CHECKOUT, "stay_hhmm"]
    ].head(10)
    print(sample.to_string(index=False))
    print()

    print("=== 일반 케이스 샘플 10건 (당일 내 입출문) ===")
    normal = df[both_present & ~df["is_rollover"]][
        [COL_EMP_ID, COL_DATE, COL_CHECKIN, COL_CHECKOUT, "stay_hhmm"]
    ].head(10)
    print(normal.to_string(index=False))
    print()

    print("=== 결측 케이스 샘플 5건 (입/출문 중 하나 이상 비어 체류시간 null) ===")
    missing = df[~both_present][
        [COL_EMP_ID, COL_DATE, COL_CHECKIN, COL_CHECKOUT, "stay_hhmm"]
    ].head(5)
    print(missing.to_string(index=False))
    print()

    print("=== 체류시간(분) 분포 요약 ===")
    print(df["stay_minutes"].describe())

    # 이상치 점검: 체류시간이 음수이거나 20시간(1200분) 초과하는 케이스
    extreme = df[(df["stay_minutes"] > 1200)]
    print(f"\n체류시간 20시간 초과 케이스: {len(extreme)}건")
    if len(extreme) > 0:
        print(
            extreme[[COL_EMP_ID, COL_DATE, COL_CHECKIN, COL_CHECKOUT, "stay_hhmm"]]
            .head(10)
            .to_string(index=False)
        )


if __name__ == "__main__":
    main()
