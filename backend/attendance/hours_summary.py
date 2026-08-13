"""근무시간 현황 조회: 사업부/부서/개인 x 주/월/분기/반기/연 단위 집계.

'26년 2분기 기준 OO사업부 근무시간 평균은?' 같은 질의에 답하기 위한 집계 엔진.

평균의 정의(중요, 문서화해서 사용자 확인 필요):
- avg_hours_per_employee_total: 그 기간 전체 동안 인원 1인당 누적 근로시간 합
- avg_hours_per_employee_per_month: 위 값을 기간의 개월수로 나눈 '1인당 월평균 근로시간'
  (분기/반기/연처럼 기간이 다른 값들을 서로 비교 가능하게 만들기 위한 정규화 지표.
  '근무시간 평균'을 물었을 때 기본으로 보여줄 값은 이쪽으로 가정했음 — 실제 원하시는
  정의와 다르면 조정 필요)
"""

from __future__ import annotations

import pandas as pd

from . import columns as C
from .org import DIVISION_COL, attach_division
from .periods import PERIOD_COL, add_period_columns

METRIC_COL = {"worktime": "worktime_minutes", "stay": "stay_minutes"}

GROUP_LEVEL_COLS = {
    "division": [DIVISION_COL],
    "department": [DIVISION_COL, C.COL_DEPT],
    "employee": [DIVISION_COL, C.COL_DEPT, C.COL_EMP_ID, C.COL_NAME, C.COL_RANK],
}


def _prepare(df: pd.DataFrame, division_map: "dict[str, str] | None") -> pd.DataFrame:
    d = add_period_columns(df)
    # DB에서 읽은 데이터는 업로드 시점에 이미 사업부가 붙어있으므로 재계산하지 않는다.
    # division_map을 명시적으로 넘긴 경우(재매핑 요청)에만 다시 붙인다.
    if DIVISION_COL not in d.columns or division_map is not None:
        d = attach_division(d, division_map)
    return d


def summarize_worktime(
    df: pd.DataFrame,
    group_level: str = "division",
    period_kind: str = "quarter",
    metric: str = "worktime",
    division_map: "dict[str, str] | None" = None,
) -> pd.DataFrame:
    """group_level x period_kind 조합으로 근무시간 현황 테이블을 만든다.

    group_level: "division" | "department" | "employee"
    period_kind: "week" | "month" | "quarter" | "half" | "year"
    metric: "worktime"(K열 실근로시간) | "stay"(N열 체류시간)
    """
    if group_level not in GROUP_LEVEL_COLS:
        raise ValueError(f"알 수 없는 group_level: {group_level}")
    if period_kind not in PERIOD_COL:
        raise ValueError(f"알 수 없는 period_kind: {period_kind}")
    if metric not in METRIC_COL:
        raise ValueError(f"알 수 없는 metric: {metric}")

    d = _prepare(df, division_map)
    period_col = PERIOD_COL[period_kind]
    metric_col = METRIC_COL[metric]
    group_cols = GROUP_LEVEL_COLS[group_level]

    # 1단계: 인원 x 기간 단위로 먼저 합산 (인원별 누적치를 정확히 세기 위함).
    # 개월수는 '데이터에 실제로 존재하는 달 수'로 세서, 분기/반기/연 일부만 데이터가
    # 있는 경우(예: 이번 더미처럼 1개월치뿐)에도 월평균이 왜곡되지 않게 한다.
    per_person_period = (
        d.groupby(group_cols + [C.COL_EMP_ID, period_col])
        .agg(
            person_period_minutes=(metric_col, "sum"),
            months_present=("period_month", "nunique"),
        )
        .reset_index()
    )

    # 2단계: 그룹 x 기간 단위로 인원들을 모아 평균/합계를 낸다
    agg = (
        per_person_period.groupby(group_cols + [period_col])
        .agg(
            employee_count=(C.COL_EMP_ID, "nunique"),
            total_minutes=("person_period_minutes", "sum"),
            avg_minutes_per_employee=("person_period_minutes", "mean"),
            avg_months_present=("months_present", "mean"),
        )
        .reset_index()
        .rename(columns={period_col: "period"})
    )

    agg["total_hours"] = agg["total_minutes"] / 60
    agg["avg_hours_per_employee_total"] = agg["avg_minutes_per_employee"] / 60
    agg["avg_hours_per_employee_per_month"] = (
        agg["avg_hours_per_employee_total"] / agg["avg_months_present"]
    )
    agg["period_kind"] = period_kind
    agg["metric"] = metric

    out_cols = group_cols + [
        "period",
        "period_kind",
        "metric",
        "employee_count",
        "total_hours",
        "avg_hours_per_employee_total",
        "avg_hours_per_employee_per_month",
    ]
    return agg[out_cols].sort_values(["period"] + group_cols).reset_index(drop=True)


def query_avg_hours(
    df: pd.DataFrame,
    period_kind: str,
    period_value: str,
    division: "str | None" = None,
    department: "str | None" = None,
    employee_id: "str | None" = None,
    metric: str = "worktime",
    division_map: "dict[str, str] | None" = None,
) -> dict:
    """자연어 질의 하나에 대응하는 단건 조회.

    예) query_avg_hours(df, "quarter", "2026-Q2", division="OO사업부")
        -> {'period': '2026-Q2', 'division': 'OO사업부', 'employee_count': ..,
            'avg_hours_per_employee_per_month': .., ...}
    """
    d = _prepare(df, division_map)
    period_col = PERIOD_COL[period_kind]
    metric_col = METRIC_COL[metric]

    d = d[d[period_col] == period_value]
    if division is not None:
        d = d[d[DIVISION_COL] == division]
    if department is not None:
        d = d[d[C.COL_DEPT] == department]
    if employee_id is not None:
        d = d[d[C.COL_EMP_ID] == employee_id]

    if d.empty:
        return {
            "period": period_value,
            "division": division,
            "department": department,
            "employee_id": employee_id,
            "employee_count": 0,
            "total_hours": 0.0,
            "avg_hours_per_employee_total": None,
            "avg_hours_per_employee_per_month": None,
        }

    per_person = d.groupby(C.COL_EMP_ID)[metric_col].sum() / 60  # 인원별 그 기간 누적시간(h)
    months_present = d["period_month"].nunique()  # 실제로 데이터가 존재하는 달 수

    return {
        "period": period_value,
        "division": division,
        "department": department,
        "employee_id": employee_id,
        "metric": metric,
        "employee_count": int(per_person.shape[0]),
        "total_hours": float(per_person.sum()),
        "avg_hours_per_employee_total": float(per_person.mean()),
        "avg_hours_per_employee_per_month": float(per_person.mean() / months_present),
        "months_present": int(months_present),
    }
