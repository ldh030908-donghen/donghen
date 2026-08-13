"""파생 근태 데이터의 영속 저장소 (SQLite).

정책: 업로드된 원본 xlsx는 저장하지 않는다. 파싱해서 나온 파생 컬럼만
사번+일자 단위로 upsert 저장하고, 같은 달을 다시 업로드하면 덮어쓴다.
이렇게 월별 raw data를 계속 업로드해도 누적된 파생 데이터만 쌓인다.
"""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager

import pandas as pd

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "attendance.db")

# 저장할 파생 컬럼 (load_raw + org.attach_division 결과에서 추출)
STORED_COLUMNS = [
    "사번", "부서명", "성명", "직급", "일자", "요일", "근무조", "근무형태",
    "입문", "출문", "변경후시작", "변경후종료", "근태",
    "stay_minutes", "checkin_minutes", "checkout_minutes",
    "changed_start_minutes", "changed_end_minutes",
    "worktime_minutes", "exclude_minutes", "overtime_minutes",
    "night_minutes", "holiday_work_minutes",
    "is_hq_flex", "is_field_flex", "사업부",
]

_SCHEMA = f"""
CREATE TABLE IF NOT EXISTS daily_records (
    사번 TEXT NOT NULL,
    부서명 TEXT,
    성명 TEXT,
    직급 TEXT,
    일자 TEXT NOT NULL,
    요일 TEXT,
    근무조 TEXT,
    근무형태 TEXT,
    입문 TEXT,
    출문 TEXT,
    변경후시작 TEXT,
    변경후종료 TEXT,
    근태 TEXT,
    stay_minutes REAL,
    checkin_minutes REAL,
    checkout_minutes REAL,
    changed_start_minutes REAL,
    changed_end_minutes REAL,
    worktime_minutes REAL,
    exclude_minutes REAL,
    overtime_minutes REAL,
    night_minutes REAL,
    holiday_work_minutes REAL,
    is_hq_flex INTEGER,
    is_field_flex INTEGER,
    사업부 TEXT,
    uploaded_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (사번, 일자)
);
CREATE INDEX IF NOT EXISTS idx_daily_records_date ON daily_records(일자);
CREATE INDEX IF NOT EXISTS idx_daily_records_dept ON daily_records(부서명);

CREATE TABLE IF NOT EXISTS upload_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    row_count INTEGER,
    employee_count INTEGER,
    min_date TEXT,
    max_date TEXT,
    uploaded_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS division_map (
    부서명 TEXT PRIMARY KEY,
    사업부 TEXT NOT NULL
);
"""


@contextmanager
def get_conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.executescript(_SCHEMA)
        yield conn
        conn.commit()
    finally:
        conn.close()


def upsert_daily_records(df: pd.DataFrame) -> None:
    """df(사업부 컬럼 포함, load_raw+attach_division 결과)를 daily_records에 upsert."""
    payload = df[STORED_COLUMNS].copy()
    payload["is_hq_flex"] = payload["is_hq_flex"].astype(int)
    payload["is_field_flex"] = payload["is_field_flex"].astype(int)

    cols = STORED_COLUMNS
    placeholders = ",".join(["?"] * len(cols))
    col_list = ",".join(cols)
    sql = f"INSERT OR REPLACE INTO daily_records ({col_list}) VALUES ({placeholders})"

    records = list(payload.itertuples(index=False, name=None))
    with get_conn() as conn:
        conn.executemany(sql, records)
    _touch()


def log_upload(filename: str, df: pd.DataFrame) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO upload_log (filename, row_count, employee_count, min_date, max_date) "
            "VALUES (?, ?, ?, ?, ?)",
            (
                filename,
                len(df),
                int(df["사번"].nunique()),
                str(df["일자"].min()),
                str(df["일자"].max()),
            ),
        )


def save_division_map(division_map: "dict[str, str]") -> None:
    with get_conn() as conn:
        conn.executemany(
            "INSERT OR REPLACE INTO division_map (부서명, 사업부) VALUES (?, ?)",
            list(division_map.items()),
        )
    _touch()


def load_division_map_from_db() -> "dict[str, str]":
    with get_conn() as conn:
        rows = conn.execute("SELECT 부서명, 사업부 FROM division_map").fetchall()
    return dict(rows)


# 매 요청마다 21만행+ 재조회/규칙 재계산을 하면 동시 요청 시 GIL 경합으로 수십 초씩 걸린다.
# 데이터가 바뀔 때(_touch)만 다시 읽도록 버전 스탬프 캐시를 둔다.
_cache: "dict[str, object]" = {"version": 0, "df": None, "df_version": -1}


def _touch() -> None:
    _cache["version"] = int(_cache["version"]) + 1


def data_version() -> int:
    """현재 데이터 버전. 업로드/조직매핑 변경 시마다 증가 — 상위 캐시 무효화용."""
    return int(_cache["version"])


def load_all_records() -> pd.DataFrame:
    if _cache["df_version"] != _cache["version"]:
        with get_conn() as conn:
            df = pd.read_sql_query("SELECT * FROM daily_records", conn)
        if not df.empty:
            df["is_hq_flex"] = df["is_hq_flex"].astype(bool)
            df["is_field_flex"] = df["is_field_flex"].astype(bool)
        _cache["df"] = df
        _cache["df_version"] = _cache["version"]
    return _cache["df"]  # 호출부에서 in-place로 컬럼을 새로 대입할 경우 반드시 .copy() 후 사용할 것


def has_any_data() -> bool:
    with get_conn() as conn:
        row = conn.execute("SELECT COUNT(*) FROM daily_records").fetchone()
    return bool(row and row[0] > 0)


def reset_all() -> None:
    """업로드된 파생 데이터를 전부 삭제한다 (조직도/기준시간표 매핑은 남겨둠)."""
    with get_conn() as conn:
        conn.execute("DELETE FROM daily_records")
        conn.execute("DELETE FROM upload_log")
    _touch()


def get_upload_history() -> pd.DataFrame:
    with get_conn() as conn:
        return pd.read_sql_query(
            "SELECT filename, row_count, employee_count, min_date, max_date, uploaded_at "
            "FROM upload_log ORDER BY uploaded_at DESC",
            conn,
        )
