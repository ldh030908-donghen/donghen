"""RAW 시트를 읽어 분석에 필요한 파생 컬럼(분 단위 시각, 체류시간 등)을 추가한다."""

from __future__ import annotations

import re

import pandas as pd

from . import columns as C
from .compute import compute_stay_minutes, parse_hhmm_to_minutes
from .sheet_utils import find_key_column, find_numeric_column_by_keywords

_TIMEDELTA_STR_RE = re.compile(
    r"^(\d+) days? (\d+):(\d+):(\d+)(?:\.\d+)?$|^(\d+):(\d+):(\d+)(?:\.\d+)?$"
)


def parse_timedelta_str_to_minutes(value: object) -> float:
    """pandas가 dtype=str로 읽은 timedelta 컬럼('H:MM:SS[.ffffff]' 또는 'N days H:MM:SS[.ffffff]')을
    분으로 변환. 실근로시간처럼 시각 뺄셈으로 계산된 값은 마이크로초 잔차가 붙어
    'H:MM:SS.ffffff' 형태로 오는 경우가 대부분이라, 초 뒤 소수부는 있어도 없어도 매치되게 한다.
    """
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return 0.0
    s = str(value).strip()
    if not s or s.lower() == "nan":
        return 0.0
    m = _TIMEDELTA_STR_RE.match(s)
    if not m:
        return 0.0
    if m.group(1) is not None:
        days, h, mi, sec = m.group(1), m.group(2), m.group(3), m.group(4)
    else:
        days, h, mi, sec = "0", m.group(5), m.group(6), m.group(7)
    return int(days) * 1440 + int(h) * 60 + int(mi) + int(sec) / 60


_XLSX_MAGIC = b"PK\x03\x04"  # .xlsx/.xlsm은 zip 컨테이너라 항상 이 시그니처로 시작
_OLE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"  # 구버전 .xls(바이너리) 시그니처


def _check_xlsx_format(source) -> None:
    """openpyxl에 넘기기 전에 파일 포맷을 미리 확인해 이해하기 쉬운 오류를 낸다."""
    if isinstance(source, (str, )) or hasattr(source, "read") is False:
        with open(source, "rb") as f:
            head = f.read(32)
    else:
        pos = source.tell()
        head = source.read(32)
        source.seek(pos)

    if head.startswith(_OLE_MAGIC):
        raise ValueError(
            "이 파일은 구버전 엑셀(.xls) 형식입니다. 엑셀에서 열어 '.xlsx' 형식으로 다시 저장한 뒤 업로드해주세요."
        )
    if b"DRM" in head.upper() or head.startswith(b"<##"):
        raise ValueError(
            "이 파일은 사내 DRM(문서보안) 솔루션으로 암호화되어 있어 열 수 없습니다. "
            "DRM 클라이언트의 '보안 해제' 또는 '외부 반출' 기능으로 암호를 해제한 뒤 다시 업로드해주세요."
        )
    if not head.startswith(_XLSX_MAGIC):
        raise ValueError(
            "엑셀(.xlsx) 파일로 인식되지 않습니다. 파일이 손상되었거나 엑셀 파일이 아닐 수 있습니다."
        )


def load_raw(xlsx_path: str) -> pd.DataFrame:
    _check_xlsx_format(xlsx_path)
    df = pd.read_excel(xlsx_path, sheet_name="RAW", dtype=str, engine="openpyxl")

    df["stay_minutes"] = [
        compute_stay_minutes(ci, co)
        for ci, co in zip(df[C.COL_CHECKIN], df[C.COL_CHECKOUT])
    ]
    df["checkin_minutes"] = df[C.COL_CHECKIN].apply(parse_hhmm_to_minutes)
    df["checkout_minutes"] = df[C.COL_CHECKOUT].apply(parse_hhmm_to_minutes)
    df["changed_start_minutes"] = df[C.COL_CHANGED_START].apply(parse_hhmm_to_minutes)
    df["changed_end_minutes"] = df[C.COL_CHANGED_END].apply(parse_hhmm_to_minutes)

    df["worktime_minutes"] = df[C.COL_WORKTIME].apply(parse_timedelta_str_to_minutes)
    df["exclude_minutes"] = df[C.COL_EXCLUDE].apply(parse_timedelta_str_to_minutes)
    df["overtime_minutes"] = df[C.COL_OVERTIME].apply(parse_timedelta_str_to_minutes)
    df["night_minutes"] = df[C.COL_NIGHT].apply(parse_timedelta_str_to_minutes)
    df["holiday_work_minutes"] = df[C.COL_HOLIDAY_WORK].apply(parse_timedelta_str_to_minutes)

    df["is_hq_flex"] = df[C.COL_WORKGROUP] == C.WORKGROUP_HQ_FLEX
    df["is_field_flex"] = df[C.COL_WORKGROUP] == C.WORKGROUP_FIELD_FLEX

    df[C.COL_ATTENDANCE] = df[C.COL_ATTENDANCE].fillna("")

    return df


def load_monthly_max_hours_threshold(
    path: str, base_df: pd.DataFrame | None = None
) -> "dict[str, float]":
    """월 최대근로시간 기준 시트를 {사번: 기준시간(h)} dict로 변환.

    기대 포맷을 유연하게 처리한다:
    - '사번' 컬럼이 있으면 인원별 기준으로 직접 사용.
    - '사번' 없이 '근무조'/'근무형태' 같은 그룹 컬럼만 있으면, base_df(원본 RAW 로드 결과)의
      사번<->근무조 매핑을 이용해 그룹 기준을 인원별로 펼쳐서 반환.
    - 기준값 컬럼은 '기준'/'최대'/'한도'/'시간' 이 들어간 첫 숫자형 컬럼을 자동 탐지.
    """
    ref = pd.read_excel(path, dtype=str)
    ref.columns = [str(c).strip() for c in ref.columns]

    threshold_col = find_numeric_column_by_keywords(ref, ["기준", "최대", "한도", "시간"])
    if threshold_col is None:
        raise ValueError(
            f"기준시간으로 보이는 숫자형 컬럼을 찾지 못했습니다. 실제 컬럼: {list(ref.columns)}"
        )
    ref["_threshold_hours"] = pd.to_numeric(ref[threshold_col], errors="coerce")
    ref = ref.dropna(subset=["_threshold_hours"])

    emp_col = find_key_column(list(ref.columns), [C.COL_EMP_ID, "사번"])
    if emp_col is not None:
        return dict(zip(ref[emp_col].astype(str).str.strip(), ref["_threshold_hours"]))

    group_col = find_key_column(list(ref.columns), [C.COL_WORKGROUP, "근무조", C.COL_WORKTYPE, "근무형태"])
    if group_col is not None and base_df is not None and group_col in base_df.columns:
        group_to_threshold = dict(zip(ref[group_col], ref["_threshold_hours"]))
        emp_to_group = base_df.drop_duplicates(C.COL_EMP_ID).set_index(C.COL_EMP_ID)[group_col]
        return {
            emp_id: group_to_threshold[grp]
            for emp_id, grp in emp_to_group.items()
            if grp in group_to_threshold
        }

    raise ValueError(
        "기준시트에서 '사번' 또는 '근무조/근무형태' 키 컬럼을 찾지 못했습니다. "
        f"실제 컬럼: {list(ref.columns)}"
    )
