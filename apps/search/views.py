from __future__ import annotations

from django.conf import settings
from django.core.paginator import Paginator
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render

try:
    from opensearchpy import OpenSearch
except ImportError:  # pragma: no cover
    OpenSearch = None


def _client():
    if OpenSearch is None:
        return None
    scheme = "https" if settings.OPENSEARCH_USE_HTTPS else "http"
    return OpenSearch(
        hosts=[
            {
                "host": settings.OPENSEARCH_HOST,
                "port": settings.OPENSEARCH_PORT,
                "scheme": scheme,
            }
        ],
        use_ssl=settings.OPENSEARCH_USE_HTTPS,
        verify_certs=not settings.DEBUG,
        ssl_show_warn=False,
    )


def search(request: HttpRequest) -> HttpResponse:
    query = (request.GET.get("q") or "").strip()
    page_num = max(int(request.GET.get("page") or 1), 1)
    page_size = min(max(int(request.GET.get("size") or 20), 1), 100)

    if not query:
        return render(request, "search/search.html", {"query": "", "results": None})

    client = _client()
    index = f"{settings.OPENSEARCH_NAMESPACE}-resources"
    results: list[dict] = []
    total = 0
    error: str | None = None

    if client is None:
        error = "Search is not configured (opensearch client unavailable)."
    else:
        try:
            response = client.search(
                index=index,
                body={
                    "query": {
                        "multi_match": {
                            "query": query,
                            "fields": ["title^3", "description^2", "content", "category"],
                            "type": "best_fields",
                            "fuzziness": "AUTO",
                        }
                    },
                    "highlight": {
                        "fields": {
                            "title": {},
                            "description": {},
                            "content": {"fragment_size": 300, "number_of_fragments": 3},
                        }
                    },
                    "from": (page_num - 1) * page_size,
                    "size": page_size,
                },
            )
            hits = response.get("hits", {})
            total_obj = hits.get("total", 0)
            total = total_obj.get("value", 0) if isinstance(total_obj, dict) else total_obj
            for hit in hits.get("hits", []):
                src = hit.get("_source", {})
                content = src.get("content") or ""
                excerpt = (content[:800] + "…") if len(content) > 800 else content
                results.append(
                    {
                        "title": src.get("title") or "",
                        "description": src.get("page_description") or src.get("description") or "",
                        "excerpt": excerpt,
                        "url": src.get("page_url") or src.get("url") or "",
                        "domain": src.get("domain") or "",
                        "category": src.get("category") or "",
                        "score": hit.get("_score") or 0,
                        "highlight": hit.get("highlight") or {},
                    }
                )
        except Exception as exc:  # pragma: no cover - network failure
            error = f"Search backend unavailable: {exc}"

    total_pages = max((total + page_size - 1) // page_size, 1)
    return render(
        request,
        "search/search.html",
        {
            "query": query,
            "results": results,
            "total": total,
            "page": page_num,
            "size": page_size,
            "total_pages": total_pages,
            "has_prev": page_num > 1,
            "has_next": page_num < total_pages,
            "error": error,
        },
    )
