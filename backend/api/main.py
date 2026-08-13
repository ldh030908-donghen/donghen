"""근태 특이건 분석 / 근무시간 현황 조회 API 서버.

실행: cd backend && uvicorn api.main:app --reload --port 8000
"""

from __future__ import annotations

import io
import os
import sys
import uuid
from typing import Optional

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from attendance import columns as C
from attendance import rules
from attendance.hours_summary import query_avg_hours, summarize_worktime
from attendance.load import load_monthly_max_hours_threshold, load_raw
from attendance.org import load_division_map

app = FastAPI(title="근태 특이건 분석 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 세션(job) 별 로드된 데이터를 메모리에 보관하는 초간단 저장소.
# 실제 운영에서는 DB/파일 캐시로 교체 필요 — 지금은 프로토타입 단계라 in-memory로 충분.
_SESSIONS: "dict[str, dict]" = {}

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


class UploadResponse(BaseModel):
    session_id: str
    row_count: int
    employee_count: int
    steps: list


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/upload", response_model=UploadResponse)
async def upload_raw(file: UploadFile = File(...)):
    content = await file.read()
    try:
        df = load_raw(io.BytesIO(content))
    except Exception as exc:  # noqa: BLE001 - 사용자에게 원인 그대로 전달
        raise HTTPException(status_code=400, detail=f"파일을 읽는 중 오류: {exc}") from exc

    session_id = str(uuid.uuid4())
    _SESSIONS[session_id] = {"df": df, "division_map": None, "threshold_lookup": None}

    return UploadResponse(
        session_id=session_id,
        row_count=len(df),
        employee_count=int(df[C.COL_EMP_ID].nunique()),
        steps=ANALYSIS_STEPS,
    )


def _get_session(session_id: str) -> dict:
    session = _SESSIONS.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다. 먼저 업로드해주세요.")
    return session


@app.get("/api/anomalies")
def get_anomalies(session_id: str):
    session = _get_session(session_id)
    df = session["df"]
    result = rules.run_all_rules(df, rule1_threshold_lookup=session.get("threshold_lookup"))
    result = result.fillna("")
    return {
        "total": len(result),
        "affected_employees": int(result[C.COL_EMP_ID].nunique()) if len(result) else 0,
        "by_rule": result["rule_code"].value_counts().to_dict() if len(result) else {},
        "items": result.to_dict(orient="records"),
    }


@app.get("/api/hours-summary")
def get_hours_summary(
    session_id: str,
    group_level: str = "division",
    period_kind: str = "month",
    metric: str = "worktime",
):
    session = _get_session(session_id)
    df = session["df"]
    try:
        result = summarize_worktime(
            df,
            group_level=group_level,
            period_kind=period_kind,
            metric=metric,
            division_map=session.get("division_map"),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"items": result.to_dict(orient="records")}


@app.get("/api/hours-query")
def get_hours_query(
    session_id: str,
    period_kind: str,
    period_value: str,
    division: Optional[str] = None,
    department: Optional[str] = None,
    employee_id: Optional[str] = None,
    metric: str = "worktime",
):
    session = _get_session(session_id)
    df = session["df"]
    result = query_avg_hours(
        df,
        period_kind=period_kind,
        period_value=period_value,
        division=division,
        department=department,
        employee_id=employee_id,
        metric=metric,
        division_map=session.get("division_map"),
    )
    return result


@app.post("/api/threshold-sheet")
async def upload_threshold_sheet(session_id: str, file: UploadFile = File(...)):
    session = _get_session(session_id)
    content = await file.read()
    try:
        lookup = load_monthly_max_hours_threshold(io.BytesIO(content), base_df=session["df"])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    session["threshold_lookup"] = lookup
    return {"mapped_employees": len(lookup)}


@app.post("/api/division-map")
async def upload_division_map(session_id: str, file: UploadFile = File(...)):
    session = _get_session(session_id)
    content = await file.read()
    try:
        division_map = load_division_map(io.BytesIO(content))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    session["division_map"] = division_map
    return {"mapped_departments": len(division_map)}
