"""사용자가 추후 제공할 참조 시트(기준시간표, 조직도 등)를 유연하게 읽기 위한 공통 헬퍼.

컬럼명이 정확히 무엇일지 미리 알 수 없는 외부 시트를 다룰 때 재사용한다.
"""

from __future__ import annotations

import pandas as pd


def find_key_column(columns: "list[str]", candidates: "list[str]") -> "str | None":
    for cand in candidates:
        if cand in columns:
            return cand
    return None


def find_numeric_column_by_keywords(ref: pd.DataFrame, keywords: "list[str]") -> "str | None":
    """컬럼명에 keywords 중 하나가 포함되고, 실제로 숫자로 변환되는 값이 있는 첫 컬럼."""
    for col in ref.columns:
        if any(k in col for k in keywords):
            converted = pd.to_numeric(ref[col], errors="coerce")
            if converted.notna().any():
                return col
    return None
