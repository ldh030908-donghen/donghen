"""사내 GPT 게이트웨이(mlapi.run) 기반 챗봇: 자연어 질의를 근무시간/특이건 조회 도구 호출로 변환한다.

OpenAI 호환 Chat Completions API(함수 호출)를 사용한다. Anthropic이 아니라 사내 게이트웨이를
쓰기로 한 결정에 따라 openai SDK로 구현했다 (.env의 ML_API_KEY / GPT5_ENDPOINT / GPT5_MODEL_NAME).
노동법 질의에는 Tavily 웹검색(.env의 TAVILY_API_KEY)을 근거 자료로 사용한다.

호출부(api/main.py)가 실제 조회 로직(get_hours_summary_fn / get_anomalies_fn)과
현재 데이터 컨텍스트(context)를 주입해준다. 이 모듈은 게이트웨이와의 tool-call 왕복만
담당하고, DB나 규칙 계산에는 직접 접근하지 않는다.
"""

from __future__ import annotations

import json
import os
from typing import Callable

import requests
from openai import OpenAI

_MAX_TOOL_ITERATIONS = 8
_MAX_COMPLETION_TOKENS = 4096
_TAVILY_URL = "https://api.tavily.com/search"

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_hours_summary",
            "description": (
                "사업부/부서/개인 단위로 근무시간(실근로시간 또는 체류시간) 현황을 조회한다. "
                "period_value로 특정 시점(예: '2026-03')만 콕 집어 볼 수 있고, top_n을 주면 그 시점 기준 상위 N개만 "
                "정렬해서 돌려준다. '상위 5개 부서', '가장 많이 일한 사업부' 같은 랭킹 질문은 반드시 top_n을 사용해라 — "
                "직접 정렬하려 하지 말고 항상 이 파라미터로 서버가 정렬한 결과를 받아라."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "group_level": {
                        "type": "string",
                        "enum": ["division", "department", "employee"],
                        "description": "집계 단위: 사업부/부서/개인",
                    },
                    "period_kind": {
                        "type": "string",
                        "enum": ["week", "month", "quarter", "half", "year"],
                        "description": "집계 기간 단위",
                    },
                    "period_value": {
                        "type": "string",
                        "description": (
                            "특정 시점만 조회할 때 (period_kind에 맞는 형식). 월='2026-03', 분기='2026-Q1', "
                            "반기='2026-H1', 연='2026'. 생략하면 보유한 모든 기간을 다 반환한다."
                        ),
                    },
                    "metric": {
                        "type": "string",
                        "enum": ["worktime", "stay"],
                        "description": "worktime=실근로시간(K열), stay=체류시간(N열). 기본 worktime",
                    },
                    "division": {
                        "type": "string",
                        "description": "특정 사업부로 좁힐 때. 시스템 프롬프트에 제공된 정확한 사업부명을 사용",
                    },
                    "department": {"type": "string", "description": "특정 부서로 좁힐 때"},
                    "top_n": {
                        "type": "integer",
                        "description": "상위 N개만 받고 싶을 때 (sort_by 기준 내림차순 정렬 후 자름)",
                    },
                    "sort_by": {
                        "type": "string",
                        "enum": ["avg_hours_per_employee_per_month", "total_hours", "employee_count"],
                        "description": "top_n 정렬 기준. 기본은 1인당 월평균 근로시간",
                    },
                },
                "required": ["group_level", "period_kind"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_anomalies",
            "description": (
                "근태 특이건(이상 근태 패턴)을 조회한다. 월/사업부/부서/개인/규칙코드로 필터링 가능하고, "
                "top_n을 주면 발생 건수(occurrence_count) 기준 상위 N명만 정렬해서 돌려준다."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "month": {"type": "string", "description": "YYYY-MM. 생략하면 가장 최근 월(latest_month)"},
                    "division": {"type": "string"},
                    "department": {"type": "string"},
                    "emp_id": {"type": "string", "description": "특정 사번으로 좁힐 때"},
                    "rule_code": {
                        "type": "string",
                        "description": "특정 탐지 규칙 코드로 좁힐 때 (예: R1_MONTHLY_MAX). 시스템 프롬프트의 규칙 목록 참고",
                    },
                    "top_n": {"type": "integer", "description": "발생 건수 상위 N명만 받고 싶을 때"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_labor_law",
            "description": (
                "대한민국 노동법(근로기준법 등) 관련 질문에 답하기 위해 최신 법령/판례/실무 자료를 웹에서 검색한다. "
                "연장근로 한도, 연차, 휴게시간, 근태 특이건 대응 방법 등 회사 데이터가 아니라 '법적으로 어떻게 되는지'를 "
                "물어볼 때 사용한다. 검색 결과는 참고 자료일 뿐이니 답변에 '법률 자문이 아니라 참고용'이라는 점을 밝혀라."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "검색어 (한국어, 구체적으로)"},
                },
                "required": ["query"],
            },
        },
    },
]


def _build_system_prompt(context: dict) -> str:
    lines = [
        "너는 근태 특이건 분석 대시보드의 조회 비서다. 사용자의 자연어 질문을 도구 호출로 변환해 정확한 수치를 조회하고, "
        "그 결과를 근거로 간결한 한국어로 답한다.",
        "",
        "규칙:",
        "- 수치를 추측하거나 지어내지 말고, 항상 도구를 호출해서 얻은 결과만 근거로 답한다.",
        "- 사용자가 기간을 명시하지 않으면 최신 월(latest_month) 기준으로 조회한다.",
        "- 사업부/부서 이름은 아래 목록에 있는 정확한 문자열로만 도구에 전달한다.",
        "- '상위 N개/명' 같은 랭킹 질문은 top_n 파라미터로 서버가 정렬하게 하고, 직접 눈으로 정렬하지 마라.",
        "- '각 부서(팀)별로 보여줘'처럼 여러 그룹을 순차로 파고드는 질문은, 필요한 만큼 도구를 여러 번(그룹당 1회씩) "
        "나눠서 호출해도 된다. 한 번에 하나만 묻지 말고 필요한 호출을 다 끝낸 뒤 마지막에 종합해서 답하라.",
        "- 노동법/법적 근거를 묻는 질문에는 search_labor_law로 찾은 내용을 근거로 답하되, 이는 참고 정보이며 "
        "정식 법률 자문이 아니라는 점을 답변에 짧게 밝혀라.",
        "- 답변은 2~5문장으로 간결하게 작성한다. 상세 목록은 화면에 표로 별도 표시되니 나열하지 않는다.",
        "",
        f"오늘 날짜: {context['today']}",
        f"데이터 보유 여부: {'있음' if context['has_data'] else '없음 (아직 업로드된 데이터 없음)'}",
    ]
    if context["has_data"]:
        lines.append(f"보유 데이터 월: {', '.join(context['available_months'])}")
        lines.append(f"최신 월(latest_month): {context['latest_month']}")
        lines.append(f"사업부 목록: {', '.join(context['divisions']) or '(없음)'}")
        if context.get("departments"):
            lines.append(f"부서 목록: {', '.join(context['departments'])}")
    lines.append("")
    lines.append("탐지 규칙 목록 (rule_code: case_name — description):")
    for r in context["rules_meta"]:
        lines.append(f"- {r['rule_code']}: {r['case_name']} — {r['description']}")
    return "\n".join(lines)


def _client() -> "OpenAI | None":
    api_key = os.environ.get("ML_API_KEY")
    base_url = os.environ.get("GPT5_ENDPOINT")
    if not api_key or not base_url:
        return None
    return OpenAI(api_key=api_key, base_url=base_url)


def _search_labor_law(query: str) -> dict:
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        return {"error": "TAVILY_API_KEY가 설정되지 않아 검색할 수 없습니다."}
    try:
        resp = requests.post(
            _TAVILY_URL,
            json={
                "api_key": api_key,
                "query": query,
                "max_results": 5,
                "search_depth": "basic",
                "include_domains": ["law.go.kr", "moel.go.kr"],
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:  # noqa: BLE001
        return {"error": f"검색 실패: {exc}"}
    results = [
        {"title": r.get("title"), "url": r.get("url"), "content": (r.get("content") or "")[:600]}
        for r in data.get("results", [])[:5]
    ]
    # law.go.kr/moel.go.kr 로 좁혔을 때 결과가 없으면(사이트에 없는 주제일 수 있음) 제한 없이 재검색
    if not results:
        try:
            resp = requests.post(
                _TAVILY_URL,
                json={"api_key": api_key, "query": query, "max_results": 5, "search_depth": "basic"},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            results = [
                {"title": r.get("title"), "url": r.get("url"), "content": (r.get("content") or "")[:600]}
                for r in data.get("results", [])[:5]
            ]
        except Exception as exc:  # noqa: BLE001
            return {"error": f"검색 실패: {exc}"}
    return {"query": query, "results": results}


def _step_label(name: str, args: dict) -> str:
    if name == "get_hours_summary":
        scope = args.get("division") or args.get("department") or "전사"
        period = args.get("period_value") or f"전체 {args.get('period_kind', '')}"
        rank = f" · 상위 {args['top_n']}개" if args.get("top_n") else ""
        return f"근무시간 조회 — {scope} · {period}{rank}"
    if name == "get_anomalies":
        scope = args.get("division") or args.get("department") or "전사"
        month = args.get("month") or "최신월"
        rank = f" · 상위 {args['top_n']}명" if args.get("top_n") else ""
        return f"특이건 조회 — {scope} · {month}{rank}"
    if name == "search_labor_law":
        return f"노동법 자료 검색 — \"{args.get('query', '')}\""
    return f"{name} 호출"


def run_chat(
    message: str,
    history: "list[dict]",
    context: dict,
    get_hours_summary_fn: "Callable[..., dict]",
    get_anomalies_fn: "Callable[..., dict]",
) -> dict:
    """대화 한 턴을 처리한다.

    반환: {"reply": str, "result": {...} | None, "export": {"kind","params"} | None,
           "steps": [{"label": str}], "reference": str | None}
    """
    client = _client()
    if client is None:
        return {
            "reply": "챗봇을 사용하려면 서버에 ML_API_KEY / GPT5_ENDPOINT 환경변수가 설정되어야 합니다.",
            "result": None,
            "export": None,
            "steps": [],
            "reference": None,
        }

    model = os.environ.get("GPT5_MODEL_NAME", "openai/gpt-5-mini")
    system_prompt = _build_system_prompt(context)

    messages: list = [{"role": "system", "content": system_prompt}] + list(history) + [
        {"role": "user", "content": message}
    ]
    last_result: "dict | None" = None
    last_export: "dict | None" = None
    steps: "list[dict]" = []
    reference_periods: "list[str]" = []

    for _ in range(_MAX_TOOL_ITERATIONS):
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            max_completion_tokens=_MAX_COMPLETION_TOKENS,
        )
        choice = response.choices[0]
        msg = choice.message

        if not msg.tool_calls:
            reply = (msg.content or "").strip()
            reference = ", ".join(dict.fromkeys(reference_periods)) if reference_periods else None
            return {
                "reply": reply or "죄송합니다, 답변을 생성하지 못했습니다.",
                "result": last_result,
                "export": last_export,
                "steps": steps,
                "reference": reference,
            }

        messages.append(
            {
                "role": "assistant",
                "content": msg.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                    }
                    for tc in msg.tool_calls
                ],
            }
        )

        for tc in msg.tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            steps.append({"label": _step_label(name, args)})
            period_ref = args.get("period_value") or args.get("month")
            if period_ref:
                reference_periods.append(str(period_ref))
            try:
                if name == "get_hours_summary":
                    output = get_hours_summary_fn(**args)
                    last_export = {"kind": "hours_summary", "params": args}
                elif name == "get_anomalies":
                    output = get_anomalies_fn(**args)
                    last_export = {"kind": "anomalies", "params": args}
                elif name == "search_labor_law":
                    output = _search_labor_law(**args)
                else:
                    output = {"error": f"알 수 없는 도구: {name}"}
                last_result = {"kind": name, **output}
                content = json.dumps(output, ensure_ascii=False, default=str)[:20000]
            except Exception as exc:  # noqa: BLE001
                content = f"오류: {exc}"
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": content})

    reference = ", ".join(dict.fromkeys(reference_periods)) if reference_periods else None
    return {
        "reply": "요청이 너무 복잡해서 한 번에 처리하지 못했습니다. 조건을 조금 더 구체적으로 나눠서 질문해주세요.",
        "result": last_result,
        "export": last_export,
        "steps": steps,
        "reference": reference,
    }
