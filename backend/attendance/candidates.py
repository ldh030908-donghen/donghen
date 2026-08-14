"""확인대상: 아직 정식 탐지 규칙(rules.py의 R1~R7)은 아니지만 사람이 눈으로 검토해볼 만한 후보 패턴.

여기서 사람이 검토해보고 계속 필요하다고 판단되면, rules.py에 정식 규칙(R8, ...)으로 승격시킨다.
반환 스키마는 rules.py와 동일하게 맞춰서 프론트엔드 테이블/상세 렌더링을 그대로 재사용할 수 있게 한다.
"""

from __future__ import annotations

import re

import pandas as pd

from . import columns as C
from .org import DIVISION_COL

IDENTITY_COLS = [C.COL_EMP_ID, DIVISION_COL, C.COL_DEPT, C.COL_NAME, C.COL_RANK]
_AGG_IDENTITY_COLS = [DIVISION_COL, C.COL_DEPT, C.COL_NAME, C.COL_RANK]

_HOUR_LEAVE_TOKEN = re.compile(r"\d+\s*시간\s*연차")

CANDIDATES_META = [
    {
        "candidate_code": "C1_DUPLICATE_LEAVE",
        "case_name": "중복근태 사용 의심",
        "description": (
            "하루(근태 한 칸)에 '1시간 연차', '3시간 연차'처럼 시간연차 표기가 2건 이상 같이 들어간 경우. "
            "정식 탐지 규칙은 아니며, 검토 후 필요하면 R8 등으로 규칙에 편입할 수 있다."
        ),
    },
]


def _empty_result() -> pd.DataFrame:
    return pd.DataFrame(columns=IDENTITY_COLS + ["rule_code", "case_name", "detail", "occurrence_count"])


def candidate1_duplicate_hour_leave(df: pd.DataFrame) -> pd.DataFrame:
    """근태 한 칸 안에 'N시간 연차' 패턴이 2건 이상 동시에 들어간 날을 찾는다."""
    d = df.copy()
    matches = d[C.COL_ATTENDANCE].fillna("").apply(_HOUR_LEAVE_TOKEN.findall)
    d = d[matches.apply(len) >= 2].copy()
    if d.empty:
        return _empty_result()
    d["_matches"] = matches[d.index]
    d["_detail_line"] = d.apply(
        lambda r: f"{r[C.COL_DATE]} 근태 '{r[C.COL_ATTENDANCE]}' 내 시간연차 {len(r['_matches'])}건 동시 사용",
        axis=1,
    )

    agg = (
        d.groupby(C.COL_EMP_ID)
        .agg(
            occurrence_count=(C.COL_DATE, "count"),
            detail=("_detail_line", lambda s: "; ".join(s)),
            **{c: (c, "first") for c in _AGG_IDENTITY_COLS},
        )
        .reset_index()
    )
    agg["rule_code"] = "C1_DUPLICATE_LEAVE"
    agg["case_name"] = "중복근태 사용 의심"
    return agg[IDENTITY_COLS + ["rule_code", "case_name", "detail", "occurrence_count"]]


def run_all_candidates(df: pd.DataFrame) -> pd.DataFrame:
    results = [candidate1_duplicate_hour_leave(df)]
    return pd.concat(results, ignore_index=True)
