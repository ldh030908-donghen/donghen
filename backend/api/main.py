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
from datetime import date
from typing import Optional
from urllib.parse import quote

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

load_dotenv()  # backend/.env 또는 프로젝트 루트 .env에서 ANTHROPIC_API_KEY 등을 읽는다.

from attendance import candidates
from attendance import chat
from attendance import columns as C
from attendance import db
from attendance import news
from attendance import rules
from attendance.hours_summary import query_avg_hours, summarize_worktime
from attendance.load import load_monthly_max_hours_threshold, load_raw
from attendance.org import DIVISION_COL, attach_division, load_division_map
from attendance.periods import PERIOD_COL, add_period_columns

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

# 규칙1(월 최대근로시간) 기준시간표: 사용자가 별도로 업로드하지 않은 달을 위한 보완 수단.
# 서버 재시작 시 초기화됨.
_rule1_threshold_lookup: "dict[str, float] | None" = None
_rule1_version = 0

# 선택근무제(한국, 근로기준법 기준) 2026년 월별 최대근로시간(h). 선택근무제(본사/현장) 대상자에게만 적용.
RULE1_FLEX_MONTHLY_MAX_HOURS: "dict[str, float]" = {
    "2026-01": 230.17,
    "2026-02": 208.00,
    "2026-03": 230.17,
    "2026-04": 222.51,
    "2026-05": 230.17,
    "2026-06": 222.51,
    "2026-07": 230.17,
    "2026-08": 230.17,
    "2026-09": 222.51,
    "2026-10": 230.17,
    "2026-11": 222.51,
    "2026-12": 230.17,
}

# 월별 규칙 계산 결과 캐시. 데이터/기준시간표가 바뀌기 전까지는 재계산하지 않는다
# (21만행 규칙 7종 계산은 수 초가 걸려서, 매 요청마다 다시 돌리면 동시 요청 시 크게 느려짐).
# 여러 달을 한 번에 훑는 개인별 히스토리 조회도 있어서, 달마다 하나씩만 남기지 않고
# data_version/rule1_version이 바뀔 때만 통째로 비우고 그 전까진 달별로 계속 쌓아둔다.
_anomalies_cache: "dict[str, pd.DataFrame]" = {}
_anomalies_cache_version: "tuple | None" = None


def _rule1_lookup_for_month(month_df: pd.DataFrame, month: str) -> "dict[str, float] | None":
    """그 달의 R1 기준시간 lookup을 만든다.

    선택근무제(본사/현장) 대상자는 공식 월별 한도(RULE1_FLEX_MONTHLY_MAX_HOURS)를 우선 적용하고,
    그 외 인원/그 표에 없는 달은 관리자가 업로드한 기준시간표(_rule1_threshold_lookup)로 보완한다.
    """
    lookup: "dict[str, float]" = dict(_rule1_threshold_lookup) if _rule1_threshold_lookup else {}
    official_hours = RULE1_FLEX_MONTHLY_MAX_HOURS.get(month)
    if official_hours is not None and not month_df.empty:
        flex_mask = month_df["is_hq_flex"] | month_df["is_field_flex"]
        for emp_id in month_df.loc[flex_mask, C.COL_EMP_ID].unique():
            lookup[emp_id] = official_hours
    return lookup or None


def _compute_month_anomalies(month: str) -> pd.DataFrame:
    global _anomalies_cache_version
    version = (db.data_version(), _rule1_version)
    if version != _anomalies_cache_version:
        _anomalies_cache.clear()
        _anomalies_cache_version = version
    if month not in _anomalies_cache:
        month_df = _load_filtered(month)
        threshold_lookup = _rule1_lookup_for_month(month_df, month)
        _anomalies_cache[month] = rules.run_all_rules(month_df, rule1_threshold_lookup=threshold_lookup)
    return _anomalies_cache[month]


# 확인대상(정식 규칙 R1~R7이 아닌 후보 패턴)용 캐시. 별도 카테고리라 anomaly 캐시와 분리해서 관리한다.
_candidates_cache: "dict[str, pd.DataFrame]" = {}
_candidates_cache_version: "int | None" = None


def _compute_month_candidates(month: str) -> pd.DataFrame:
    global _candidates_cache_version
    version = db.data_version()
    if version != _candidates_cache_version:
        _candidates_cache.clear()
        _candidates_cache_version = version
    if month not in _candidates_cache:
        month_df = _load_filtered(month)
        _candidates_cache[month] = candidates.run_all_candidates(month_df)
    return _candidates_cache[month]


def _attach_case_status(result: pd.DataFrame, month: str) -> pd.DataFrame:
    """result(그 달 특이건/확인대상 결과)에 사람이 처리한 상태(확인/조치완료/오탐)를 붙인다.

    기록이 없으면(아직 아무도 확인 안 함) status는 빈 문자열("미확인")로 채운다.
    """
    if result.empty:
        result = result.copy()
        result["status"] = []
        result["note"] = []
        return result
    statuses = db.get_case_statuses(month)
    d = result.merge(statuses[["사번", "rule_code", "status", "note"]], on=[C.COL_EMP_ID, "rule_code"], how="left")
    d["status"] = d["status"].fillna("")
    d["note"] = d["note"].fillna("")
    return d


class CaseStatusUpdate(BaseModel):
    emp_id: str
    rule_code: str
    month: str
    status: Optional[str] = None  # None(또는 생략) = 미확인으로 되돌리기
    note: Optional[str] = None


@app.post("/api/case-status")
def post_case_status(body: CaseStatusUpdate):
    try:
        db.set_case_status(body.emp_id, body.rule_code, body.month, body.status, body.note)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


RULES_META = [
    {"rule_code": "R1_MONTHLY_MAX", "case_name": "월 최대근로시간 초과", "description": "월 누적 근로시간(체류시간/실근로시간)이 기준시간을 초과한 인원. 선택근무제 대상자는 2026년 한국 법정 월별 한도를 자동 적용."},
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


# --- 챗봇(/api/chat)이 호출하는 조회 함수. HTTP를 거치지 않고 내부 로직을 직접 재사용한다. ---


_HOURS_SORT_COLS = {"avg_hours_per_employee_per_month", "total_hours", "employee_count", "avg_hours_per_employee_total"}


def _chat_get_hours_summary(
    group_level: str,
    period_kind: str,
    period_value: Optional[str] = None,
    metric: str = "worktime",
    division: Optional[str] = None,
    department: Optional[str] = None,
    top_n: Optional[int] = None,
    sort_by: str = "avg_hours_per_employee_per_month",
) -> dict:
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
        return {"error": str(exc)}
    if period_value:
        result = result[result["period"] == period_value]
    if sort_by not in _HOURS_SORT_COLS:
        sort_by = "avg_hours_per_employee_per_month"
    result = result.sort_values(sort_by, ascending=False)
    if top_n:
        result = result.head(int(top_n))
    items = result.to_dict(orient="records")
    return {"items": items[:200], "total_rows": len(items)}


def _chat_get_anomalies(
    month: Optional[str] = None,
    division: Optional[str] = None,
    department: Optional[str] = None,
    emp_id: Optional[str] = None,
    rule_code: Optional[str] = None,
    top_n: Optional[int] = None,
) -> dict:
    df = db.load_all_records()
    if df.empty:
        return {"items": [], "total": 0}
    months = _available_months(df)
    target_month = month or months[-1]
    result = _compute_month_anomalies(target_month)
    if division:
        result = result[result[DIVISION_COL] == division]
    if department:
        result = result[result[C.COL_DEPT] == department]
    if emp_id:
        result = result[result[C.COL_EMP_ID] == emp_id]
    if rule_code:
        result = result[result["rule_code"] == rule_code]
    result = result.fillna("").sort_values("occurrence_count", ascending=False)
    by_rule = result["rule_code"].value_counts().to_dict() if len(result) else {}
    affected = int(result[C.COL_EMP_ID].nunique()) if len(result) else 0
    total = len(result)
    if top_n:
        result = result.head(int(top_n))
    items = result.to_dict(orient="records")
    return {
        "month": target_month,
        "total": total,
        "affected_employees": affected,
        "by_rule": by_rule,
        "items": items[:200],
    }


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

    result = _attach_case_status(result, target_month).fillna("")
    return {
        "month": target_month,
        "total": len(result),
        "affected_employees": int(result[C.COL_EMP_ID].nunique()) if len(result) else 0,
        "by_rule": result["rule_code"].value_counts().to_dict() if len(result) else {},
        "items": result.to_dict(orient="records"),
    }


@app.get("/api/anomalies/trend")
def get_anomalies_trend(
    year: Optional[str] = None,
    division: Optional[str] = None,
    department: Optional[str] = None,
):
    """월별 특이건 추이. division/department를 주면 그 범위(하위 트리)로만 집계한다."""
    df = db.load_all_records()
    if df.empty:
        return {"items": []}
    months = _available_months(df)
    if year:
        months = [m for m in months if m.startswith(year)]
    items = []
    for m in months:
        result = _compute_month_anomalies(m)
        if division:
            result = result[result[DIVISION_COL] == division]
        if department:
            result = result[result[C.COL_DEPT] == department]
        items.append(
            {
                "month": m,
                "total": len(result),
                "affected_employees": int(result[C.COL_EMP_ID].nunique()) if len(result) else 0,
            }
        )
    return {"items": items}


@app.get("/api/hours-trend")
def get_hours_trend(
    year: Optional[str] = None,
    metric: str = "worktime",
    division: Optional[str] = None,
    department: Optional[str] = None,
    work_group: Optional[str] = None,
):
    """월별 근무시간 추이. division/department/work_group을 주면 그 범위(하위 트리)로만 집계한다."""
    df = db.load_all_records()
    if df.empty:
        return {"items": []}
    if work_group:
        df = df[df[C.COL_WORKGROUP] == work_group]
    months = _available_months(df)
    if year:
        months = [m for m in months if m.startswith(year)]
    items = []
    for m in months:
        r = query_avg_hours(
            df, period_kind="month", period_value=m, division=division, department=department, metric=metric
        )
        items.append(
            {
                "month": m,
                "avg_hours_per_employee_per_month": r["avg_hours_per_employee_per_month"],
                "employee_count": r["employee_count"],
            }
        )
    return {"items": items}


@app.get("/api/anomalies/top-people")
def get_anomalies_top_people(
    month: Optional[str] = None,
    division: Optional[str] = None,
    department: Optional[str] = None,
    limit: int = 5,
):
    """근태 특이건 상위 인원 배너용: 발생 건수(occurrence_count 합) 기준 상위 N명."""
    df = db.load_all_records()
    if df.empty:
        return {"items": [], "month": None}
    months = _available_months(df)
    target_month = month or months[-1]
    result = _compute_month_anomalies(target_month)
    if division:
        result = result[result[DIVISION_COL] == division]
    if department:
        result = result[result[C.COL_DEPT] == department]
    if result.empty:
        return {"items": [], "month": target_month}

    agg = (
        result.groupby(C.COL_EMP_ID)
        .agg(
            total_occurrences=("occurrence_count", "sum"),
            rule_count=("rule_code", "nunique"),
            **{c: (c, "first") for c in [DIVISION_COL, C.COL_DEPT, C.COL_NAME, C.COL_RANK]},
        )
        .reset_index()
        .sort_values("total_occurrences", ascending=False)
        .head(limit)
    )
    return {"month": target_month, "items": agg.to_dict(orient="records")}


@app.get("/api/hours-summary/top-people")
def get_hours_summary_top_people(
    period_kind: str = "month",
    period_value: Optional[str] = None,
    metric: str = "worktime",
    division: Optional[str] = None,
    department: Optional[str] = None,
    work_group: Optional[str] = None,
    limit: int = 5,
):
    """근무시간 과다자 배너용: 1인당 월평균(또는 선택 지표) 기준 상위 N명."""
    df = db.load_all_records()
    if df.empty:
        return {"items": [], "period": None}
    if division:
        df = df[df[DIVISION_COL] == division]
    if department:
        df = df[df[C.COL_DEPT] == department]
    if work_group:
        df = df[df[C.COL_WORKGROUP] == work_group]

    target_period = period_value
    if not target_period and period_kind == "month":
        target_period = _available_months(df)[-1] if not df.empty else None

    try:
        result = summarize_worktime(df, group_level="employee", period_kind=period_kind, metric=metric)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if target_period:
        result = result[result["period"] == target_period]
    result = result.sort_values("avg_hours_per_employee_per_month", ascending=False).head(limit)
    return {"period": target_period, "items": result.to_dict(orient="records")}


@app.get("/api/rules/meta")
def get_rules_meta():
    return {"rules": RULES_META}


@app.get("/api/candidates/meta")
def get_candidates_meta():
    return {"candidates": candidates.CANDIDATES_META}


@app.get("/api/candidates")
def get_candidates(
    month: Optional[str] = None,
    division: Optional[str] = None,
    department: Optional[str] = None,
    emp_id: Optional[str] = None,
):
    """확인대상: 정식 탐지 규칙(R1~R7)은 아니지만 검토해볼 만한 후보 패턴 목록."""
    df = db.load_all_records()
    if df.empty:
        return {"total": 0, "affected_employees": 0, "by_rule": {}, "items": [], "month": None}

    months = _available_months(df)
    target_month = month or months[-1]
    result = _compute_month_candidates(target_month)

    if division:
        result = result[result[DIVISION_COL] == division]
    if department:
        result = result[result[C.COL_DEPT] == department]
    if emp_id:
        result = result[result[C.COL_EMP_ID] == emp_id]

    result = _attach_case_status(result, target_month).fillna("")
    return {
        "month": target_month,
        "total": len(result),
        "affected_employees": int(result[C.COL_EMP_ID].nunique()) if len(result) else 0,
        "by_rule": result["rule_code"].value_counts().to_dict() if len(result) else {},
        "items": result.to_dict(orient="records"),
    }


@app.get("/api/highlights")
def get_highlights(month: Optional[str] = None, limit: int = 8):
    """세부 확인 필요 배너용: 확인대상(정식 규칙 R1~R7 제외) 결과 중 발생 횟수 상위 N건만 모아 보여준다."""
    df = db.load_all_records()
    if df.empty:
        return {"month": None, "items": []}

    months = _available_months(df)
    target_month = month or months[-1]

    cand = _compute_month_candidates(target_month)
    if cand.empty:
        return {"month": target_month, "items": []}

    top = cand.sort_values("occurrence_count", ascending=False).head(limit).fillna("")
    return {"month": target_month, "items": top.to_dict(orient="records")}


@app.get("/api/hr-news")
def get_hr_news():
    return news.fetch_hr_news()


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


@app.get("/api/org/workgroups")
def get_workgroups():
    """근무제(근무조) 필터 드롭다운용: 보유 데이터에 실제로 존재하는 근무조 목록."""
    df = db.load_all_records()
    if df.empty:
        return {"workgroups": []}
    return {"workgroups": sorted(df[C.COL_WORKGROUP].dropna().unique().tolist())}


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


@app.get("/api/employee-timeline")
def get_employee_timeline(emp_id: str):
    """개인별 히스토리 탭: 한 사람의 전체 보유 기간 특이건/확인대상 이력 + 월별 근무시간 추이."""
    df = db.load_all_records()
    if df.empty:
        return {"emp_id": emp_id, "profile": None, "items": [], "hours_trend": []}

    person_rows = df[df[C.COL_EMP_ID] == emp_id]
    if person_rows.empty:
        return {"emp_id": emp_id, "profile": None, "items": [], "hours_trend": []}

    latest_row = person_rows.sort_values(C.COL_DATE).iloc[-1]
    profile = {
        C.COL_EMP_ID: emp_id,
        DIVISION_COL: latest_row[DIVISION_COL],
        C.COL_DEPT: latest_row[C.COL_DEPT],
        C.COL_NAME: latest_row[C.COL_NAME],
        C.COL_RANK: latest_row[C.COL_RANK],
    }

    months = _available_months(df)
    frames = []
    for m in months:
        a = _compute_month_anomalies(m)
        a = a[a[C.COL_EMP_ID] == emp_id]
        if not a.empty:
            a = a.copy()
            a["month"] = m
            a["source"] = "rule"
            frames.append(a)
        cand_m = _compute_month_candidates(m)
        cand_m = cand_m[cand_m[C.COL_EMP_ID] == emp_id]
        if not cand_m.empty:
            cand_m = cand_m.copy()
            cand_m["month"] = m
            cand_m["source"] = "candidate"
            frames.append(cand_m)

    if frames:
        combined = pd.concat(frames, ignore_index=True)
        statuses = db.get_case_statuses()
        combined = combined.merge(
            statuses[["사번", "rule_code", "month", "status", "note"]],
            on=[C.COL_EMP_ID, "rule_code", "month"],
            how="left",
        )
        combined["status"] = combined["status"].fillna("")
        combined["note"] = combined["note"].fillna("")
        combined = combined.sort_values(["month", "occurrence_count"], ascending=[False, False]).fillna("")
        items = combined.to_dict(orient="records")
    else:
        items = []

    hours_trend = []
    for m in months:
        r = query_avg_hours(df, period_kind="month", period_value=m, employee_id=emp_id, metric="worktime")
        if r["employee_count"]:
            hours_trend.append({"month": m, "hours": r["avg_hours_per_employee_total"]})

    return {"emp_id": emp_id, "profile": profile, "items": items, "hours_trend": hours_trend}


@app.get("/api/hours-summary")
def get_hours_summary(
    group_level: str = "division",
    period_kind: str = "month",
    period_value: Optional[str] = None,
    metric: str = "worktime",
    division: Optional[str] = None,
    department: Optional[str] = None,
    work_group: Optional[str] = None,
):
    df = db.load_all_records()
    if df.empty:
        return {"items": []}
    if division:
        df = df[df[DIVISION_COL] == division]
    if department:
        df = df[df[C.COL_DEPT] == department]
    if work_group:
        df = df[df[C.COL_WORKGROUP] == work_group]
    try:
        result = summarize_worktime(df, group_level=group_level, period_kind=period_kind, metric=metric)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if period_value:
        result = result[result["period"] == period_value]
    return {"items": result.to_dict(orient="records")}


@app.get("/api/periods")
def get_periods(period_kind: str = "month"):
    """조회 시점 드롭다운용: 보유 데이터에 실제로 존재하는 기간값 목록(오름차순)."""
    if period_kind not in PERIOD_COL:
        raise HTTPException(status_code=400, detail=f"알 수 없는 period_kind: {period_kind}")
    df = db.load_all_records()
    if df.empty:
        return {"periods": []}
    d = add_period_columns(df)
    col = PERIOD_COL[period_kind]
    return {"periods": sorted(d[col].dropna().unique().tolist())}


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


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
    result: Optional[dict] = None
    export: Optional[dict] = None
    steps: list = []
    reference: Optional[str] = None


@app.post("/api/chat", response_model=ChatResponse)
def post_chat(req: ChatRequest):
    df = db.load_all_records()
    has_data = not df.empty
    months = _available_months(df) if has_data else []
    context = {
        "today": date.today().isoformat(),
        "has_data": has_data,
        "available_months": months,
        "latest_month": months[-1] if months else None,
        "divisions": sorted(df[DIVISION_COL].dropna().unique().tolist()) if has_data else [],
        # 부서 목록이 너무 길면 프롬프트가 비대해지므로 상한을 둔다.
        "departments": sorted(df[C.COL_DEPT].dropna().unique().tolist())[:80] if has_data else [],
        "rules_meta": RULES_META,
    }
    result = chat.run_chat(
        message=req.message,
        history=[m.model_dump() for m in req.history],
        context=context,
        get_hours_summary_fn=_chat_get_hours_summary,
        get_anomalies_fn=_chat_get_anomalies,
    )
    return result


@app.get("/api/export")
def export_data(
    kind: str,
    month: Optional[str] = None,
    division: Optional[str] = None,
    department: Optional[str] = None,
    emp_id: Optional[str] = None,
    rule_code: Optional[str] = None,
    group_level: str = "division",
    period_kind: str = "month",
    metric: str = "worktime",
):
    """챗봇 응답 또는 조회 화면에 나온 목록을 xlsx로 내려받는다."""
    df = db.load_all_records()
    if df.empty:
        raise HTTPException(status_code=404, detail="업로드된 데이터가 없습니다.")

    if kind == "anomalies":
        months = _available_months(df)
        target_month = month or months[-1]
        result = _compute_month_anomalies(target_month)
        if division:
            result = result[result[DIVISION_COL] == division]
        if department:
            result = result[result[C.COL_DEPT] == department]
        if emp_id:
            result = result[result[C.COL_EMP_ID] == emp_id]
        if rule_code:
            result = result[result["rule_code"] == rule_code]
        export_df = result.fillna("")
        filename = f"근태특이건_{target_month}.xlsx"
    elif kind == "hours_summary":
        d = df
        if division:
            d = d[d[DIVISION_COL] == division]
        if department:
            d = d[d[C.COL_DEPT] == department]
        try:
            export_df = summarize_worktime(d, group_level=group_level, period_kind=period_kind, metric=metric)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        filename = f"근무시간현황_{group_level}_{period_kind}.xlsx"
    else:
        raise HTTPException(status_code=400, detail=f"알 수 없는 export kind: {kind}")

    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        export_df.to_excel(writer, index=False, sheet_name="Sheet1")
    buf.seek(0)
    ascii_fallback = f"export_{kind}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{ascii_fallback}"; '
                f"filename*=UTF-8''{quote(filename)}"
            )
        },
    )
