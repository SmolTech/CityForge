import os

from flask import Blueprint, jsonify, request

from app import limiter, opensearch_client

bp = Blueprint("search", __name__)


@bp.route("/api/search", methods=["GET"])
@limiter.limit("60 per minute")
def search_resources():
    """Search the indexed resources using OpenSearch"""
    try:
        query = request.args.get("q", "").strip()
        if not query:
            return jsonify({"error": "Query parameter q is required"}), 400

        page = int(request.args.get("page", 1))
        size = int(request.args.get("size", 20))

        if page < 1:
            page = 1
        if size < 1 or size > 100:
            size = 20

        offset = (page - 1) * size

        namespace = os.getenv("NAMESPACE", "community")
        index_name = f"{namespace}-resources"

        search_body = {
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
                    "content": {"fragment_size": 150, "number_of_fragments": 2},
                }
            },
            "from": offset,
            "size": size,
        }

        response = opensearch_client.search(index=index_name, body=search_body)

        results = []
        for hit in response["hits"]["hits"]:
            source = hit["_source"]

            content_excerpt = ""
            if source.get("content"):
                content_text = source["content"]
                if len(content_text) > 400:
                    content_excerpt = content_text[:400] + "..."
                else:
                    content_excerpt = content_text

            display_description = source.get("page_description") or source.get("description", "")

            result = {
                "id": source["resource_id"],
                "title": source["title"],
                "description": display_description,
                "content_excerpt": content_excerpt,
                "url": source["url"],
                "page_url": source.get("page_url", source["url"]),
                "category": source["category"],
                "phone": source.get("phone", ""),
                "address": source.get("address", ""),
                "domain": source["domain"],
                "score": hit["_score"],
                "is_homepage": source.get("is_homepage", True),
            }

            if "highlight" in hit:
                result["highlights"] = hit["highlight"]

            results.append(result)

        total_hits = response["hits"]["total"]["value"]
        total_pages = (total_hits + size - 1) // size

        return jsonify(
            {
                "query": query,
                "total": total_hits,
                "page": page,
                "size": size,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1,
                "results": results,
            }
        )

    except Exception as e:
        return jsonify(
            {
                "query": query if "query" in locals() else "",
                "total": 0,
                "results": [],
                "error": str(e),
            }
        )
