from __future__ import annotations

from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render

SEARCH_FIELDS = [
    "business_name^8",
    "title^7",
    "tags^6",
    "description^5",
    "page_description^4",
    "contact_name^3",
    "address^2",
    "content",
]
PHRASE_MATCH_FIELDS = [
    "business_name^10",
    "title^8",
    "tags^7",
    "description^4",
    "page_description^3",
]
FUZZY_SEARCH_FIELDS = [
    "business_name^6",
    "title^5",
    "tags^4",
    "description^3",
    "page_description^2",
]


try:
    from opensearchpy import OpenSearch
except ImportError:  # pragma: no cover
    OpenSearch = None  # type: ignore[misc,assignment]


def _client() -> OpenSearch | None:
    if OpenSearch is None:
        return None
    scheme = "https" if settings.OPENSEARCH_USE_HTTPS else "http"
    http_auth = None
    if settings.OPENSEARCH_USERNAME:
        http_auth = (settings.OPENSEARCH_USERNAME, settings.OPENSEARCH_PASSWORD)
    return OpenSearch(
        hosts=[
            {
                "host": settings.OPENSEARCH_HOST,
                "port": settings.OPENSEARCH_PORT,
                "scheme": scheme,
            }
        ],
        http_auth=http_auth,
        use_ssl=settings.OPENSEARCH_USE_HTTPS,
        verify_certs=not settings.DEBUG,
        ssl_show_warn=False,
    )


def _build_search_body(
    query: str, page_num: int, page_size: int, *, include_highlight: bool
) -> dict:
    fuzzy_prefix_length = _fuzzy_prefix_length(query)
    body = {
        "track_total_hits": True,
        "query": {
            "function_score": {
                "query": {
                    "bool": {
                        "should": [
                            {
                                "multi_match": {
                                    "query": query,
                                    "fields": PHRASE_MATCH_FIELDS,
                                    "type": "phrase",
                                    "slop": 1,
                                    "boost": 8,
                                }
                            },
                            {
                                "multi_match": {
                                    "query": query,
                                    "fields": SEARCH_FIELDS,
                                    "type": "cross_fields",
                                    "operator": "and",
                                    "boost": 4,
                                }
                            },
                            {
                                "multi_match": {
                                    "query": query,
                                    "fields": FUZZY_SEARCH_FIELDS,
                                    "type": "best_fields",
                                    "fuzziness": 1,
                                    "prefix_length": fuzzy_prefix_length,
                                    "max_expansions": 10,
                                    "boost": 0.35,
                                }
                            },
                        ],
                        "minimum_should_match": 1,
                    }
                },
                "functions": [
                    {"filter": {"term": {"is_homepage": True}}, "weight": 1.2},
                    {"filter": {"term": {"featured": True}}, "weight": 1.05},
                ],
                "score_mode": "sum",
                "boost_mode": "multiply",
            }
        },
        "collapse": {"field": "resource_id"},
        "aggs": {
            "resource_count": {
                "cardinality": {"field": "resource_id", "precision_threshold": 40000}
            }
        },
        "sort": [{"_score": "desc"}, {"is_homepage": "desc"}, {"indexed_at": "desc"}],
        "from": (page_num - 1) * page_size,
        "size": page_size,
    }
    if include_highlight:
        body["highlight"] = {
            "fields": {
                "business_name": {},
                "title": {},
                "description": {},
                "page_description": {},
                "content": {"fragment_size": 300, "number_of_fragments": 3},
            }
        }
    return body


def _fuzzy_prefix_length(query: str) -> int:
    longest_term = max((len(term) for term in query.split()), default=0)
    if longest_term >= 6:
        return 3
    if longest_term >= 4:
        return 2
    return 1


def _response_total(response: dict) -> int:
    resource_count = response.get("aggregations", {}).get("resource_count", {}).get("value")
    if isinstance(resource_count, int | float):
        return int(resource_count)
    hits: dict = response.get("hits", {})
    total_obj: dict | int = hits.get("total", 0)
    return int(total_obj.get("value", 0)) if isinstance(total_obj, dict) else int(total_obj)


def _parse_hit(hit: dict, *, excerpt_length: int) -> dict:
    src = hit.get("_source", {})
    content = src.get("content") or ""
    excerpt = (content[:excerpt_length] + "…") if len(content) > excerpt_length else content
    highlight = hit.get("highlight") or {}
    return {
        "title": src.get("title") or src.get("business_name") or "",
        "business_name": src.get("business_name") or "",
        "description": src.get("page_description") or src.get("description") or "",
        "excerpt": excerpt,
        "url": src.get("page_url") or src.get("url") or "",
        "domain": src.get("domain") or "",
        "category": src.get("category") or "",
        "score": hit.get("_score") or 0,
        "highlight": highlight,
    }


def _search_results(
    client: OpenSearch,
    query: str,
    page_num: int,
    page_size: int,
    *,
    include_highlight: bool,
    excerpt_length: int,
) -> tuple[list[dict], int]:
    index = f"{settings.OPENSEARCH_NAMESPACE}-resources"
    response = client.search(
        index=index,
        body=_build_search_body(query, page_num, page_size, include_highlight=include_highlight),
    )
    results = [
        _parse_hit(hit, excerpt_length=excerpt_length)
        for hit in response.get("hits", {}).get("hits", [])
    ]
    return results, _response_total(response)


def search(request: HttpRequest) -> HttpResponse:
    query = (request.GET.get("q") or "").strip()
    page_num = _safe_int(request.GET.get("page"), default=1, minimum=1, maximum=10000)
    page_size = _safe_int(request.GET.get("size"), default=20, minimum=1, maximum=100)

    if not query:
        return render(request, "search/search.html", {"query": "", "results": None})

    client = _client()
    results: list[dict] = []
    total = 0
    error: str | None = None

    if client is None:
        error = "Search is not configured (opensearch client unavailable)."
    else:
        try:
            results, total = _search_results(
                client,
                query,
                page_num,
                page_size,
                include_highlight=True,
                excerpt_length=800,
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


def _safe_int(value: str | None, *, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value or default)
    except (TypeError, ValueError):
        return default
    return min(max(parsed, minimum), maximum)
