"""일자(YYYYMMDD)로부터 주/월/분기/반기/연 단위 기간 라벨을 파생시킨다."""

from __future__ import annotations

import pandas as pd

from . import columns as C

# 외부에서 쓰는 기간 종류 이름 -> 내부 컬럼명
PERIOD_COL = {
    "week": "period_week",
    "month": "period_month",
    "quarter": "period_quarter",
    "half": "period_half",
    "year": "period_year",
}


def add_period_columns(df: pd.DataFrame, date_col: str = C.COL_DATE) -> pd.DataFrame:
    """period_week / period_month / period_quarter / period_half / period_year 컬럼을 추가.

    날짜 파싱 + isocalendar()가 대용량 df에서는 꽤 걸리는 연산이라, 이미 컬럼이 붙어있으면
    (db.load_all_records()가 로드 시점에 한 번 붙여둔 경우 등) 그대로 재사용하고 다시 계산하지 않는다.
    """
    if all(col in df.columns for col in PERIOD_COL.values()):
        return df
    d = df.copy()
    dt = pd.to_datetime(d[date_col], format="%Y%m%d")
    iso = dt.dt.isocalendar()

    d["period_year"] = dt.dt.year.astype(str)
    d["period_month"] = dt.dt.year.astype(str) + "-" + dt.dt.month.astype(str).str.zfill(2)
    d["period_quarter"] = dt.dt.year.astype(str) + "-Q" + dt.dt.quarter.astype(str)
    d["period_half"] = dt.dt.year.astype(str) + "-H" + (((dt.dt.month - 1) // 6) + 1).astype(str)
    d["period_week"] = iso["year"].astype(str) + "-W" + iso["week"].astype(str).str.zfill(2)

    return d
