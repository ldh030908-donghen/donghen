"""근태 특이건 탐지 규칙 (2-1. 사용자 정의 규칙 5종).

각 rule_* 함수는 원본 raw 레벨 DataFrame(load.load_raw 결과)을 받아
근태 특이건 리스트를 반환한다. 반환 컬럼은 최종 결과 테이블 스펙에 맞춘다:
사번 / 부서명 / 성명 / 직급 / 특이사례케이스 / rule_code / detail / occurrence_count
"""

from __future__ import annotations

import pandas as pd

from . import columns as C

IDENTITY_COLS = [C.COL_EMP_ID, C.COL_DEPT, C.COL_NAME, C.COL_RANK]

# 시간연차류 근태 값 패턴 (규칙 4에서 사용)
HOUR_LEAVE_PATTERN = r"^\d+시간\s*연차$"


def _empty_result() -> pd.DataFrame:
    return pd.DataFrame(
        columns=IDENTITY_COLS + ["rule_code", "case_name", "detail", "occurrence_count"]
    )


def rule1_monthly_max_hours(
    df: pd.DataFrame,
    threshold_lookup: "dict[str, float] | float | None" = None,
    metric: str = "both",
) -> pd.DataFrame:
    """규칙 1: 월 최대근로시간 초과.

    threshold_lookup:
      - None: 기준 시트 미제공 상태 -> 빈 결과 반환 (설계만 노출, 실제 판정은 보류)
      - float: 전 인원 동일 기준(시간)
      - dict[사번 -> 기준시간]: 인원/부서/근무형태별 기준을 담은 참조표
        (추후 사용자가 제공할 "월별 최대근로시간" 시트를 로드해서 이 dict로 변환해 넘기면 됨)
    metric: "worktime"(K열 실근로시간 합계) | "stay"(N열 체류시간 합계) | "both"(둘 다 계산, 사용자 확정사항)
    """
    if threshold_lookup is None:
        return _empty_result()

    monthly = (
        df.groupby(C.COL_EMP_ID)
        .agg(
            worktime_hours=("worktime_minutes", "sum"),
            stay_hours=("stay_minutes", "sum"),
            **{c: (c, "first") for c in [C.COL_DEPT, C.COL_NAME, C.COL_RANK]},
        )
        .reset_index()
    )
    monthly["worktime_hours"] /= 60
    monthly["stay_hours"] /= 60

    def get_threshold(emp_id: str) -> float | None:
        if isinstance(threshold_lookup, dict):
            return threshold_lookup.get(emp_id)
        return threshold_lookup

    monthly["threshold_hours"] = monthly[C.COL_EMP_ID].apply(get_threshold)
    monthly = monthly.dropna(subset=["threshold_hours"])

    rows = []
    for _, r in monthly.iterrows():
        over_worktime = metric in ("worktime", "both") and r["worktime_hours"] > r["threshold_hours"]
        over_stay = metric in ("stay", "both") and r["stay_hours"] > r["threshold_hours"]
        if not (over_worktime or over_stay):
            continue
        detail_parts = [f"기준 {r['threshold_hours']:.1f}h"]
        if over_worktime:
            detail_parts.append(f"실근로시간(K열) {r['worktime_hours']:.1f}h 초과")
        if over_stay:
            detail_parts.append(f"체류시간(N열) {r['stay_hours']:.1f}h 초과")
        rows.append(
            {
                C.COL_EMP_ID: r[C.COL_EMP_ID],
                C.COL_DEPT: r[C.COL_DEPT],
                C.COL_NAME: r[C.COL_NAME],
                C.COL_RANK: r[C.COL_RANK],
                "rule_code": "R1_MONTHLY_MAX",
                "case_name": "월 최대근로시간 초과",
                "detail": " / ".join(detail_parts),
                "occurrence_count": 1,
            }
        )
    return pd.DataFrame(rows) if rows else _empty_result()


def rule2_checkin_changed_start_gap(df: pd.DataFrame, gap_threshold_minutes: int = 60) -> pd.DataFrame:
    """규칙 2: 입문(L) - 변경후시작(Q) 시간 괴리 1시간 이상."""
    d = df.copy()
    d = d[d["checkin_minutes"].notna() & d["changed_start_minutes"].notna()]
    d["gap"] = (d["checkin_minutes"] - d["changed_start_minutes"]).abs()
    flagged = d[d["gap"] >= gap_threshold_minutes]
    if flagged.empty:
        return _empty_result()

    agg = (
        flagged.groupby(C.COL_EMP_ID)
        .agg(
            occurrence_count=(C.COL_DATE, "count"),
            max_gap=("gap", "max"),
            dates=(C.COL_DATE, lambda s: ", ".join(sorted(s)[:5])),
            **{c: (c, "first") for c in [C.COL_DEPT, C.COL_NAME, C.COL_RANK]},
        )
        .reset_index()
    )
    agg["rule_code"] = "R2_CHECKIN_GAP"
    agg["case_name"] = "입문-변경시작 시간 괴리(1시간 이상)"
    agg["detail"] = agg.apply(
        lambda r: f"{r['occurrence_count']}회, 최대 {int(r['max_gap'])}분 차이 (예: {r['dates']})",
        axis=1,
    )
    return agg[IDENTITY_COLS + ["rule_code", "case_name", "detail", "occurrence_count"]]


def rule3_excessive_exclude_time(
    df: pd.DataFrame,
    hq_hour_threshold: float = 30.0,
    field_hour_threshold: float = 50.0,
    hq_daily_normal_minutes: float = 60.0,
    field_daily_normal_minutes: float = 120.0,
    count_threshold: int = 15,
) -> pd.DataFrame:
    """규칙 3: 제외시간(T열) 과다 사용.

    - 시간 기준: 선택근무제(본사) 월 누적 30h 초과 / 선택근무제(현장) 월 누적 50h 초과
      (그 외 근무조는 기준 미정 -> 대상에서 제외)
    - 횟수 기준: '그날 제외시간이 정상치(본사 1h/현장 2h)를 초과한 날'이 월 15회 이상.
      (단순히 제외시간이 입력된 날 수로 보면 매일 점심시간 1시간 공제 때문에
      대상자의 96%가 걸려 변별력이 없어, 정상치 초과 여부로 기준을 바꿈)
    - 시간 기준 또는 횟수 기준 중 하나라도 충족하면 특이건 (OR 조건)
    """
    d = df[df["is_hq_flex"] | df["is_field_flex"]].copy()
    d["daily_normal_minutes"] = d["is_hq_flex"].map(
        {True: hq_daily_normal_minutes, False: field_daily_normal_minutes}
    )
    d["is_excess_day"] = d["exclude_minutes"] > d["daily_normal_minutes"]

    agg = (
        d.groupby(C.COL_EMP_ID)
        .agg(
            exclude_hours=("exclude_minutes", lambda s: s.sum() / 60),
            excess_days=("is_excess_day", "sum"),
            is_hq_flex=("is_hq_flex", "first"),
            **{c: (c, "first") for c in [C.COL_DEPT, C.COL_NAME, C.COL_RANK]},
        )
        .reset_index()
    )
    agg["hour_threshold"] = agg["is_hq_flex"].map({True: hq_hour_threshold, False: field_hour_threshold})
    over_hours = agg["exclude_hours"] > agg["hour_threshold"]
    over_count = agg["excess_days"] >= count_threshold
    flagged = agg[over_hours | over_count].copy()
    if flagged.empty:
        return _empty_result()

    flagged["rule_code"] = "R3_EXCLUDE_EXCESS"
    flagged["case_name"] = "제외시간 과다 사용"

    def make_detail(r):
        parts = []
        group_label = "본사" if r["is_hq_flex"] else "현장"
        if r["exclude_hours"] > r["hour_threshold"]:
            parts.append(f"월 누적 {r['exclude_hours']:.1f}h (기준 {group_label} {r['hour_threshold']:.0f}h 초과)")
        if r["excess_days"] >= count_threshold:
            parts.append(f"정상치 초과일 {int(r['excess_days'])}회 (기준 {count_threshold}회 이상)")
        return " / ".join(parts)

    flagged["detail"] = flagged.apply(make_detail, axis=1)
    flagged["occurrence_count"] = flagged["excess_days"].astype(int)
    return flagged[IDENTITY_COLS + ["rule_code", "case_name", "detail", "occurrence_count"]]


def rule4_core_time_violation_without_hour_leave(df: pd.DataFrame) -> pd.DataFrame:
    """규칙 4: 코어타임(10~15시) 미준수 + 시간연차 미사용 (선택근무제(본사) 대상).

    - 대상: 근무조 == '선택근무제(본사)', 근무형태 == '선택근무제'(휴일 제외), 입/출문 기록 존재.
    - 코어타임 미준수: 입문 > 10:00 또는 출문 < 15:00.
    - 그 날 근태(S열)에 'N시간 연차' 패턴이 없으면 미차감으로 간주 -> 특이건.
    """
    d = df[
        df["is_hq_flex"]
        & (df[C.COL_WORKTYPE] == "선택근무제")
        & df["checkin_minutes"].notna()
        & df["checkout_minutes"].notna()
    ].copy()

    late_in = d["checkin_minutes"] > C.CORE_TIME_START_MIN
    early_out = d["checkout_minutes"] < C.CORE_TIME_END_MIN
    d = d[late_in | early_out]

    used_hour_leave = d[C.COL_ATTENDANCE].str.match(HOUR_LEAVE_PATTERN)
    flagged = d[~used_hour_leave].copy()
    if flagged.empty:
        return _empty_result()

    def violation_desc(r):
        if r["checkin_minutes"] > C.CORE_TIME_START_MIN:
            return f"입문 {r[C.COL_CHECKIN]}(10시 이후)"
        return f"출문 {r[C.COL_CHECKOUT]}(15시 이전)"

    flagged["violation"] = flagged.apply(violation_desc, axis=1)

    agg = (
        flagged.groupby(C.COL_EMP_ID)
        .agg(
            occurrence_count=(C.COL_DATE, "count"),
            examples=("violation", lambda s: "; ".join(s.head(3))),
            **{c: (c, "first") for c in [C.COL_DEPT, C.COL_NAME, C.COL_RANK]},
        )
        .reset_index()
    )
    agg["rule_code"] = "R4_CORE_TIME"
    agg["case_name"] = "코어타임 미준수 + 시간연차 미사용"
    agg["detail"] = agg.apply(
        lambda r: f"{r['occurrence_count']}일 미준수, 시간연차 미차감 (예: {r['examples']})", axis=1
    )
    return agg[IDENTITY_COLS + ["rule_code", "case_name", "detail", "occurrence_count"]]


def rule5_month_end_exclude_bulk_pattern(
    df: pd.DataFrame,
    last_n_days: int = 3,
    round_minute_multiple: int = 60,
    min_flag_minutes: int = 120,
    atypical_tolerance_minutes: int = 30,
) -> pd.DataFrame:
    """규칙 5: 월말 제외시간 일괄 입력 패턴.

    - 각 인원의 그 달 마지막 last_n_days 영업일(제외시간이 기록된 날 기준) 중,
      평소(그 인원의 월 중 최빈 제외시간, 0 제외) 대비 atypical_tolerance_minutes 이상 차이나면서
      정각 배수(예: 정확히 1시간/2시간/3시간)인 큰 값(min_flag_minutes 이상)이 들어간 경우 특이건.
      (단순 불일치가 아니라 일정 오차 이상 벌어진 경우만 잡아 자연스러운 변동과 구분)
    """
    d = df[df["exclude_minutes"] > 0].copy()
    if d.empty:
        return _empty_result()

    all_dates = sorted(d[C.COL_DATE].unique())
    last_dates = set(all_dates[-last_n_days:])

    rows = []
    for emp_id, g in d.groupby(C.COL_EMP_ID):
        mode_series = g[g["exclude_minutes"] > 0]["exclude_minutes"].mode()
        typical = mode_series.iloc[0] if not mode_series.empty else None
        month_end_rows = g[g[C.COL_DATE].isin(last_dates)]
        for _, r in month_end_rows.iterrows():
            val = r["exclude_minutes"]
            is_round = val % round_minute_multiple == 0
            is_large = val >= min_flag_minutes
            is_atypical = typical is None or abs(val - typical) > atypical_tolerance_minutes
            if is_round and is_large and is_atypical:
                rows.append(
                    {
                        C.COL_EMP_ID: emp_id,
                        C.COL_DEPT: r[C.COL_DEPT],
                        C.COL_NAME: r[C.COL_NAME],
                        C.COL_RANK: r[C.COL_RANK],
                        "rule_code": "R5_MONTHEND_EXCLUDE",
                        "case_name": "월말 제외시간 일괄 입력 의심",
                        "detail": (
                            f"{r[C.COL_DATE]} 제외시간 {val/60:.1f}h "
                            f"(평소 {typical/60:.1f}h와 다름)" if typical else f"{r[C.COL_DATE]} 제외시간 {val/60:.1f}h"
                        ),
                        "occurrence_count": 1,
                    }
                )
    if not rows:
        return _empty_result()

    out = pd.DataFrame(rows)
    agg = (
        out.groupby(C.COL_EMP_ID)
        .agg(
            occurrence_count=("occurrence_count", "sum"),
            detail=("detail", lambda s: "; ".join(s)),
            **{c: (c, "first") for c in [C.COL_DEPT, C.COL_NAME, C.COL_RANK]},
        )
        .reset_index()
    )
    agg["rule_code"] = "R5_MONTHEND_EXCLUDE"
    agg["case_name"] = "월말 제외시간 일괄 입력 의심"
    return agg[IDENTITY_COLS + ["rule_code", "case_name", "detail", "occurrence_count"]]


def rule6_badge_data_integrity(df: pd.DataFrame, min_occurrences: int = 3) -> pd.DataFrame:
    """추가 규칙: 데이터 정합성 오류 — 입/출문 중 한쪽만 기록된 날이 반복되는 인원.

    - 근태(S열)가 비어 있는(정상 근무일로 신고된) 날인데 입문 또는 출문 중 하나만 있는 경우만 대상으로 함
      (출장/외근/연차처럼 근태 사유가 있는 날은 배지 미기록이 정상이므로 제외).
    - 월 min_occurrences회 이상 반복되는 인원만 특이건으로 본다(1회성은 단순 실수일 가능성이 커서 제외).
    """
    d = df[df[C.COL_ATTENDANCE].str.strip() == ""].copy()
    ci_blank = d["checkin_minutes"].isna()
    co_blank = d["checkout_minutes"].isna()
    d = d[ci_blank ^ co_blank]  # 정확히 한쪽만 결측
    if d.empty:
        return _empty_result()

    d["issue"] = d.apply(
        lambda r: "출문 기록 누락" if pd.isna(r["checkout_minutes"]) else "입문 기록 누락", axis=1
    )

    agg = (
        d.groupby(C.COL_EMP_ID)
        .agg(
            occurrence_count=(C.COL_DATE, "count"),
            dates=(C.COL_DATE, lambda s: ", ".join(sorted(s)[:5])),
            issues=("issue", lambda s: ", ".join(sorted(set(s)))),
            **{c: (c, "first") for c in [C.COL_DEPT, C.COL_NAME, C.COL_RANK]},
        )
        .reset_index()
    )
    agg = agg[agg["occurrence_count"] >= min_occurrences]
    if agg.empty:
        return _empty_result()

    agg["rule_code"] = "R6_BADGE_INTEGRITY"
    agg["case_name"] = "데이터 정합성 오류(입/출문 편측 누락 반복)"
    agg["detail"] = agg.apply(
        lambda r: f"{r['issues']} {r['occurrence_count']}회 (예: {r['dates']})", axis=1
    )
    return agg[IDENTITY_COLS + ["rule_code", "case_name", "detail", "occurrence_count"]]


def rule7_consecutive_long_stay(
    df: pd.DataFrame, daily_threshold_minutes: int = 720, consecutive_days: int = 3
) -> pd.DataFrame:
    """추가 규칙: 연속 장시간 근무 — N일 연속으로 체류시간이 daily_threshold_minutes(기본 12시간) 이상.

    - 캘린더 날짜 기준 진짜 연속만 인정한다: 결측(배지 없음)이거나 임계값 미만인 날,
      또는 데이터 자체가 아예 없는 날짜가 하루라도 끼면 연속이 끊긴 것으로 처리한다.
    """
    d = df.copy()
    d["_date_dt"] = pd.to_datetime(d[C.COL_DATE], format="%Y%m%d")
    d["is_long"] = d["stay_minutes"].fillna(0) >= daily_threshold_minutes

    rows = []
    for emp_id, g in d.sort_values("_date_dt").groupby(C.COL_EMP_ID):
        g = g.reset_index(drop=True)
        dates = g["_date_dt"].tolist()
        long_flags = g["is_long"].tolist()
        run_start = None
        run_len = 0

        def flush(end_idx: int) -> None:
            if run_len >= consecutive_days:
                rows.append((emp_id, g, run_start, end_idx, run_len))

        for i, is_long in enumerate(long_flags):
            calendar_gap = i > 0 and (dates[i] - dates[i - 1]).days != 1
            if calendar_gap:
                flush(i - 1)
                run_len = 0
            if is_long:
                if run_len == 0:
                    run_start = i
                run_len += 1
            else:
                flush(i - 1)
                run_len = 0
        flush(len(long_flags) - 1)

    if not rows:
        return _empty_result()

    out_rows = []
    for emp_id, g, start_idx, end_idx, run_len in rows:
        sub = g.iloc[start_idx : end_idx + 1]
        r0 = sub.iloc[0]
        out_rows.append(
            {
                C.COL_EMP_ID: emp_id,
                C.COL_DEPT: r0[C.COL_DEPT],
                C.COL_NAME: r0[C.COL_NAME],
                C.COL_RANK: r0[C.COL_RANK],
                "rule_code": "R7_CONSECUTIVE_LONG_STAY",
                "case_name": "연속 장시간 근무",
                "detail": (
                    f"{sub.iloc[0][C.COL_DATE]}~{sub.iloc[-1][C.COL_DATE]} "
                    f"{run_len}일 연속 {daily_threshold_minutes/60:.0f}시간 이상 체류"
                ),
                "occurrence_count": run_len,
            }
        )

    out = pd.DataFrame(out_rows)
    agg = (
        out.sort_values("occurrence_count", ascending=False)
        .groupby(C.COL_EMP_ID)
        .agg(
            occurrence_count=("occurrence_count", "max"),
            detail=("detail", lambda s: "; ".join(s)),
            **{c: (c, "first") for c in [C.COL_DEPT, C.COL_NAME, C.COL_RANK]},
            rule_code=("rule_code", "first"),
            case_name=("case_name", "first"),
        )
        .reset_index()
    )
    return agg[IDENTITY_COLS + ["rule_code", "case_name", "detail", "occurrence_count"]]


def run_all_rules(df: pd.DataFrame, rule1_threshold_lookup=None) -> pd.DataFrame:
    results = [
        rule1_monthly_max_hours(df, threshold_lookup=rule1_threshold_lookup),
        rule2_checkin_changed_start_gap(df),
        rule3_excessive_exclude_time(df),
        rule4_core_time_violation_without_hour_leave(df),
        rule5_month_end_exclude_bulk_pattern(df),
        rule6_badge_data_integrity(df),
        rule7_consecutive_long_stay(df),
    ]
    return pd.concat(results, ignore_index=True)
