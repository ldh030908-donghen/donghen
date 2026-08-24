"""조직 계층(사업부 <-> 부서명) 매핑을 읽어온다.

원본 RAW 데이터에는 부서명(및 당시부서)만 있고 그 상위 '사업부' 컬럼이 없다.
사용자가 추후 제공할 조직도 시트(부서명 -> 사업부 매핑)를 유연하게 읽어들인다.
"""

from __future__ import annotations

import pandas as pd

from . import columns as C
from .sheet_utils import find_key_column

DIVISION_COL = "사업부"

# RAW 시트 자체에 사업부명 컬럼이 포함된 경우(=조직도 파일 없이도 바로 사업부를 알 수 있는 경우) 탐지용 후보 헤더명.
RAW_DIVISION_HEADER_CANDIDATES = ["사업부명", DIVISION_COL, "사업부문", "사업본부", "본부"]


def find_raw_division_column(columns: "list[str]") -> "str | None":
    return find_key_column(list(columns), RAW_DIVISION_HEADER_CANDIDATES)


def load_division_map(path: str) -> "dict[str, str]":
    """조직도 시트를 {부서명: 사업부} dict로 변환.

    기대 컬럼: 부서명(또는 당시부서) + 사업부(또는 본부/사업부문).
    """
    ref = pd.read_excel(path, dtype=str)
    ref.columns = [str(c).strip() for c in ref.columns]

    dept_col = find_key_column(list(ref.columns), [C.COL_DEPT, "부서명", C.COL_CUR_DEPT, "당시부서"])
    div_col = find_key_column(list(ref.columns), [DIVISION_COL, "본부", "사업부문", "사업본부"])
    if dept_col is None or div_col is None:
        raise ValueError(
            "조직도 시트에서 '부서명'과 '사업부' 컬럼을 찾지 못했습니다. "
            f"실제 컬럼: {list(ref.columns)}"
        )
    return dict(
        zip(
            ref[dept_col].astype(str).str.strip(),
            ref[div_col].astype(str).str.strip(),
        )
    )


def attach_division(df: pd.DataFrame, division_map: "dict[str, str] | None") -> pd.DataFrame:
    """df에 사업부 컬럼을 붙인다.

    우선순위: (1) RAW 시트에 사업부명 컬럼이 이미 있으면 그대로 사용 (2) 업로드된 조직도
    매핑이 있으면 부서명 -> 사업부로 변환 (3) 둘 다 없으면 부서명을 그대로 사업부로 대체(임시).
    """
    d = df.copy()
    raw_div_col = find_raw_division_column(d.columns)
    if raw_div_col is not None:
        values = d[raw_div_col].astype(str).str.strip()
        d[DIVISION_COL] = values.where(values.ne("") & values.ne("nan"), d[C.COL_DEPT])
    elif division_map:
        d[DIVISION_COL] = d[C.COL_DEPT].map(division_map).fillna("(미매핑)")
    else:
        d[DIVISION_COL] = d[C.COL_DEPT]
    return d
