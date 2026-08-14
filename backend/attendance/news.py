"""근로시간/HR 관련 최신 뉴스 조회 (Tavily 뉴스 검색).

호출량을 아끼기 위해 프로세스 메모리에 TTL 캐시를 둔다 — 뉴스는 매 요청마다
새로 검색할 필요가 없다.
"""

from __future__ import annotations

import os
import time
from urllib.parse import urlparse

import requests

_TAVILY_URL = "https://api.tavily.com/search"
_QUERY = "근로시간 노동법 HR 인사 최신 뉴스"
_TTL_SECONDS = 1800  # 30분

_cache: "dict[str, object]" = {"fetched_at": 0.0, "items": []}


def fetch_hr_news(force: bool = False) -> dict:
    now = time.time()
    if not force and _cache["items"] and (now - float(_cache["fetched_at"])) < _TTL_SECONDS:
        return {"items": _cache["items"], "cached": True}

    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        return {"items": [], "error": "TAVILY_API_KEY가 설정되지 않았습니다."}

    try:
        resp = requests.post(
            _TAVILY_URL,
            json={
                "api_key": api_key,
                "query": _QUERY,
                "topic": "news",
                "days": 21,
                "max_results": 10,
                "search_depth": "basic",
                "country": "south korea",
                "exclude_domains": [
                    "instagram.com",
                    "facebook.com",
                    "tiktok.com",
                    "heykorean.com",
                    "ehredu.co.kr",
                    "linkareer.com",
                    "upable.co.kr",
                ],
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:  # noqa: BLE001
        # 실패해도 이전에 캐시된 결과가 있으면 그거라도 보여준다.
        if _cache["items"]:
            return {"items": _cache["items"], "cached": True, "error": str(exc)}
        return {"items": [], "error": str(exc)}

    items = []
    seen_domains: "dict[str, int]" = {}
    for r in data.get("results", []):
        title, url = r.get("title"), r.get("url")
        if not title or not url:
            continue
        parsed = urlparse(url)
        if len(parsed.path.strip("/")) <= 3:  # 홈페이지/카테고리 목록으로 보이는 링크는 제외
            continue
        domain = parsed.netloc
        if seen_domains.get(domain, 0) >= 2:  # 한 매체가 배너를 도배하지 않게
            continue
        seen_domains[domain] = seen_domains.get(domain, 0) + 1
        items.append(
            {"title": title, "url": url, "source": domain, "published_at": r.get("published_date")}
        )
        if len(items) >= 8:
            break

    if items:
        _cache["items"] = items
        _cache["fetched_at"] = now
        return {"items": items, "cached": False}
    # 검색 결과가 비면 기존 캐시 유지
    return {"items": _cache["items"], "cached": True}
