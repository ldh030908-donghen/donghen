"""근태 특이건 분석 / 근무시간 현황 조회 API 서버.

정책: 업로드된 원본 xlsx 파일은 저장하지 않는다. 파싱해서 나온 파생 데이터만
SQLite(daily_records)에 사번+일자 단위로 upsert하고, 매달 새 raw data를
업로드하면 그 달 데이터가 누적된다. 모든 조회 API는 이 누적 DB를 기준으로 동작하며
더 이상 업로드별 세션을 구분하지 않는다.

실행: cd backend && uvicorn api.main:app --reload --port 8000
"""

from __future__ import annotations

import io
import logging
import os
import sys
from typing import Optional

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from attendance import columns as C
from attendance import db
from attendance import rules
from attendance.hours_summary import query_avg_hours, summarize_worktime
from attendance.load import load_monthly_max_hours_threshold, load_raw
from attendance.org import DIVISION_COL, attach_division, load_division_map

logger = logging.getLogger("attendance-api")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="근태 특이건 분석 API")

app.add_middleware(
    CORSMiddleware,
    # 테스트 목적으로 사내망 접근 허용. 쿠키/인증정보를 쓰지 않으므로 와일드카드 오리진 + 자격증명 비허용 조합.
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 규칙1(월 최대근로시간) 기준시간표는 아직 실제 파일이 없어 메모리에만 보관.
# 서버 재시작 시 초기화됨 — 실제 파일이 오면 DB 테이블로 옮길 예정.
_rule1_threshold_lookup: "dict[str, float] | None" = None
_rule1_version = 0

# 월별 규칙 계산 결과 캐시. 데이터/기준시간표가 바뀌기 전까지는 재계산하지 않는다
# (21만행 규칙 7종 계산은 수 초가 걸려서, 매 요청마다 다시 돌리면 동시 요청 시 크게 느려짐).
_anomalies_cache: "dict[tuple, pd.DataFrame]" = {}


def _compute_month_anomalies(month: str) -> pd.DataFrame:
    key = (db.data_version(), _rule1_version, month)
    if key not in _anomalies_cache:
        _anomalies_cache.clear()
        month_df = _load_filtered(month)
        _anomalies_cache[key] = rules.run_all_rules(month_df, rule1_threshold_lookup=_rule1_threshold_lookup)
    return _anomalies_cache[key]

RULES_META = [
    {"rule_code": "R1_MONTHLY_MAX", "case_name": "월 최대근로시간 초과", "description": "월 누적 근로시간(체류시간/실근로시간)이 기준시간을 초과한 인원. 기준시간표 연동 대기 중."},
    {"rule_code": "R2_CHECKIN_GAP", "case_name": "입문-변경시작 시간 괴리", "description": "입문(배지) 시각과 변경후시작 시각의 차이가 1시간 이상인 경우."},
    {"rule_code": "R3_EXCLUDE_EXCESS", "case_name": "제외시간 과다 사용", "description": "월 누적 제외시간이 기준(본사 30h/현장 50h)을 초과하거나, 정상치(본사 1h/현장 2h)를 넘는 날이 월 15회 이상인 경우."},
    {"rule_code": "R4_CORE_TIME", "case_name": "코어타임 미준수 + 시간연차 미사용", "description": "선택근무제(본사) 대상자가 코어타임(10~15시) 내 부재가 있는데 시간연차를 사용하지 않은 경우."},
    {"rule_code": "R5_MONTHEND_EXCLUDE", "case_name": "월말 제외시간 일괄 입력 의심", "description": "월말 며칠 사이 평소와 다른 정각 단위의 큰 제외시간이 갑자기 입력된 경우."},
    {"rule_code": "R6_BADGE_INTEGRITY", "case_name": "데이터 정합성 오류", "description": "근태 사유 없이 입문/출문 중 한쪽 기록만 반복적으로 누락된 경우."},
    {"rule_code": "R7_CONSECUTIVE_LONG_STAY", "case_name": "연속 장시간 근무", "description": "체류시간 12시간 이상인 날이 캘린더 기준 3일 이상 연속된 경우."},
]


class UploadResponse(BaseModel):
    row_count: int
    employee_count: int
    min_date: str
    max_date: str
    total_row_count: int
    total_employee_count: int
    steps: list


ANALYSIS_STEPS = [
    {"id": "parse", "label": "원본 데이터 파싱"},
    {"id": "stay", "label": "체류시간(N열) 계산"},
    {"id": "rule1", "label": "월 최대근로시간 초과 탐지"},
    {"id": "rule2", "label": "입문-변경시작 시간 괴리 탐지"},
    {"id": "rule3", "label": "제외시간 과다 사용 탐지"},
    {"id": "rule4", "label": "코어타임 미준수 탐지"},
    {"id": "rule5", "label": "월말 제외시간 일괄 입력 탐지"},
    {"id": "rule6", "label": "데이터 정합성 오류 탐지"},
    {"id": "rule7", "label": "연속 장시간 근무 탐지"},
    {"id": "done", "label": "분석 완료"},
]


def _month_prefix(month: str) -> str:
    """'2026-06' -> '202606'."""
    return month.replace("-", "")


def _load_filtered(month: Optional[str] = None) -> pd.DataFrame:
    df = db.load_all_records()
    if df.empty:
        return df
    if month:
        df = df[df[C.COL_DATE].str.startswith(_month_prefix(month))]
    return df


def _available_months(df: "pd.DataFrame | None" = None) -> list[str]:
    if df is None:
        df = db.load_all_records()
    if df.empty:
        return []
    months = sorted({d[:4] + "-" + d[4:6] for d in df[C.COL_DATE].unique()})
    return months


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.delete("/api/reset")
def reset_data():
    """업로드된 근태 데이터를 전부 삭제 (재테스트용). 원본 파일은 애초에 저장 안 하니 지울 것도 없음."""
    db.reset_all()
    _anomalies_cache.clear()
    return {"status": "reset"}


@app.post("/api/upload", response_model=UploadResponse)
async def upload_raw(file: UploadFile = File(...)):
    content = await file.read()
    logger.info(
        "업로드 수신: filename=%r content_type=%r size=%d first16=%s",
        file.filename,
        file.content_type,
        len(content),
        content[:16].hex(),
    )
    try:
        # 원본 바이트는 이 함수 안에서만 살아있고, 파싱 후 파생 데이터만 남긴다. 디스크에 저장하지 않는다.
        parsed = load_raw(io.BytesIO(content))
    except Exception as exc:  # noqa: BLE001
        logger.exception("업로드 파싱 실패: filename=%r", file.filename)
        raise HTTPException(status_code=400, detail=f"파일을 읽는 중 오류: {exc}") from exc
    finally:
        del content

    division_map = db.load_division_map_from_db() or None
    parsed = attach_division(parsed, division_map)

    db.upsert_daily_records(parsed)
    db.log_upload(file.filename or "unknown.xlsx", parsed)

    row_count = len(parsed)
    employee_count = int(parsed[C.COL_EMP_ID].nunique())
    min_date = str(parsed[C.COL_DATE].min())
    max_date = str(parsed[C.COL_DATE].max())
    del parsed  # 원본 파싱 결과도 응답 후에는 유지하지 않음 (DB만 진실의 원천)

    total_df = db.load_all_records()

    return UploadResponse(
        row_count=row_count,
        employee_count=employee_count,
        min_date=min_date,
        max_date=max_date,
        total_row_count=len(total_df),
        total_employee_count=int(total_df[C.COL_EMP_ID].nunique()),
        steps=ANALYSIS_STEPS,
    )


@app.get("/api/overview")
def get_overview():
    df = db.load_all_records()
    if df.empty:
        return {"has_data": False}

    months = _available_months(df)
    latest_month = months[-1]
    latest_df = df[df[C.COL_DATE].str.startswith(_month_prefix(latest_month))]

    anomalies = _compute_month_anomalies(latest_month)
    hours = query_avg_hours(df, period_kind="month", period_value=latest_month, metric="worktime")

    return {
        "has_data": True,
        "available_months": months,
        "latest_month": latest_month,
        "employee_count": int(latest_df[C.COL_EMP_ID].nunique()),
        "total_employee_count": int(df[C.COL_EMP_ID].nunique()),
        "anomaly_total": len(anomalies),
        "anomaly_affected_employees": int(anomalies[C.COL_EMP_ID].nunique()) if len(anomalies) else 0,
        "avg_hours_per_employee_per_month": hours["avg_hours_per_employee_per_month"],
    }


@app.get("/api/months")
def get_months():
    return {"months": _available_months()}


@app.get("/api/anomalies")
def get_anomalies(
    month: Optional[str] = None,
    division: Optional[str] = None,
    department: Optional[str] = None,
    emp_id: Optional[str] = None,
):
    df = db.load_all_records()
    if df.empty:
        return {"total": 0, "affected_employees": 0, "by_rule": {}, "items": [], "month": None}

    months = _available_months(df)
    target_month = month or months[-1]
    result = _compute_month_anomalies(target_month)

    if division:
        result = result[result[DIVISION_COL] == division]
    if department:
        result = result[result[C.COL_DEPT] == department]
    if emp_id:
        result = result[result[C.COL_EMP_ID] == emp_id]

    result = result.fillna("")
    return {
        "month": target_month,
        "total": len(result),
        "affected_employees": int(result[C.COL_EMP_ID].nunique()) if len(result) else 0,
        "by_rule": result["rule_code"].value_counts().to_dict() if len(result) else {},
        "items": result.to_dict(orient="records"),
    }


@app.get("/api/anomalies/trend")
def get_anomalies_trend(year: Optional[str] = None):
    df = db.load_all_records()
    if df.empty:
        return {"items": []}
    months = _available_months(df)
    if year:
        months = [m for m in months if m.startswith(year)]
    items = []
    for m in months:
        result = _compute_month_anomalies(m)
        items.append(
            {
                "month": m,
                "total": len(result),
                "affected_employees": int(result[C.COL_EMP_ID].nunique()) if len(result) else 0,
            }
        )
    return {"items": items}


@app.get("/api/hours-trend")
def get_hours_trend(year: Optional[str] = None, metric: str = "worktime"):
    df = db.load_all_records()
    if df.empty:
        return {"items": []}
    months = _available_months(df)
    if year:
        months = [m for m in months if m.startswith(year)]
    items = []
    for m in months:
        r = query_avg_hours(df, period_kind="month", period_value=m, metric=metric)
        items.append(
            {
                "month": m,
                "avg_hours_per_employee_per_month": r["avg_hours_per_employee_per_month"],
                "employee_count": r["employee_count"],
            }
        )
    return {"items": items}


@app.get("/api/rules/meta")
def get_rules_meta():
    return {"rules": RULES_META}


@app.get("/api/org/divisions")
def get_divisions():
    df = db.load_all_records()
    if df.empty:
        return {"divisions": []}
    return {"divisions": sorted(df[DIVISION_COL].dropna().unique().tolist())}


@app.get("/api/org/departments")
def get_departments(division: Optional[str] = None):
    df = db.load_all_records()
    if df.empty:
        return {"departments": []}
    if division:
        df = df[df[DIVISION_COL] == division]
    return {"departments": sorted(df[C.COL_DEPT].dropna().unique().tolist())}


@app.get("/api/employees/search")
def search_employees(q: str):
    df = db.load_all_records()
    if df.empty or not q.strip():
        return {"items": []}
    q = q.strip()
    people = df[[C.COL_EMP_ID, DIVISION_COL, C.COL_DEPT, C.COL_NAME, C.COL_RANK]].drop_duplicates()
    matched = people[
        people[C.COL_EMP_ID].str.contains(q, case=False, na=False)
        | people[C.COL_NAME].str.contains(q, case=False, na=False)
    ]
    return {"items": matched.head(20).to_dict(orient="records")}


@app.get("/api/hours-summary")
def get_hours_summary(
    group_level: str = "division",
    period_kind: str = "month",
    metric: str = "worktime",
    division: Optional[str] = None,
    department: Optional[str] = None,
):
    df = db.load_all_records()
    if df.empty:
        return {"items": []}
    if division:
        df = df[df[DIVISION_COL] == division]
    if department:
        df = df[df[C.COL_DEPT] == department]
    try:
        result = summarize_worktime(df, group_level=group_level, period_kind=period_kind, metric=metric)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"items": result.to_dict(orient="records")}


@app.get("/api/hours-query")
def get_hours_query(
    period_kind: str,
    period_value: str,
    division: Optional[str] = None,
    department: Optional[str] = None,
    employee_id: Optional[str] = None,
    metric: str = "worktime",
):
    df = db.load_all_records()
    if df.empty:
        raise HTTPException(status_code=404, detail="업로드된 데이터가 없습니다.")
    result = query_avg_hours(
        df,
        period_kind=period_kind,
        period_value=period_value,
        division=division,
        department=department,
        employee_id=employee_id,
        metric=metric,
    )
    return result


@app.post("/api/threshold-sheet")
async def upload_threshold_sheet(file: UploadFile = File(...)):
    global _rule1_threshold_lookup, _rule1_version
    df = db.load_all_records()
    if df.empty:
        raise HTTPException(status_code=400, detail="근태 데이터를 먼저 업로드해주세요.")
    content = await file.read()
    try:
        lookup = load_monthly_max_hours_threshold(io.BytesIO(content), base_df=df)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    _rule1_threshold_lookup = lookup
    _rule1_version += 1
    return {"mapped_employees": len(lookup)}


@app.post("/api/division-map")
async def upload_division_map(file: UploadFile = File(...)):
    content = await file.read()
    try:
        division_map = load_division_map(io.BytesIO(content))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    db.save_division_map(division_map)

    # 이미 쌓인 데이터에도 새 매핑을 소급 반영
    df = db.load_all_records()
    if not df.empty:
        df[DIVISION_COL] = df[C.COL_DEPT].map(division_map).fillna(df[DIVISION_COL])
        db.upsert_daily_records(df)

    return {"mapped_departments": len(division_map)}
