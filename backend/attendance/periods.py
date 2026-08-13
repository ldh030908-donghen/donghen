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
    """period_week / period_month / period_quarter / period_half / period_year 컬럼을 추가."""
    d = df.copy()
    dt = pd.to_datetime(d[date_col], format="%Y%m%d")
    iso = dt.dt.isocalendar()

    d["period_year"] = dt.dt.year.astype(str)
    d["period_month"] = dt.dt.year.astype(str) + "-" + dt.dt.month.astype(str).str.zfill(2)
    d["period_quarter"] = dt.dt.year.astype(str) + "-Q" + dt.dt.quarter.astype(str)
    d["period_half"] = dt.dt.year.astype(str) + "-H" + (((dt.dt.month - 1) // 6) + 1).astype(str)
    d["period_week"] = iso["year"].astype(str) + "-W" + iso["week"].astype(str).str.zfill(2)

    return d
