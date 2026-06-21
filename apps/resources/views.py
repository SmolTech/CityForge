from __future__ import annotations

from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_http_methods

from apps.resources.models import QuickAccessItem, ResourceCategory, ResourceItem


@require_http_methods(["GET"])
def api_categories(request: HttpRequest) -> JsonResponse:
    """Return active resource category names, ordered for display."""
    categories = list(
        ResourceCategory.objects.values_list("name", flat=True).order_by("display_order", "name")
    )
    return JsonResponse(categories, safe=False)


@require_http_methods(["GET"])
def api_items(request: HttpRequest) -> JsonResponse:
    """Return active resource items, optionally filtered by category name."""
    qs = ResourceItem.objects.filter(is_active=True)
    category = (request.GET.get("category") or "").strip()
    if category:
        qs = qs.filter(category__iexact=category)

    items = [
        {
            "id": item.id,
            "title": item.title,
            "description": item.description,
            "url": item.url,
            "category": item.category,
            "category_id": item.category_obj_id,
            "display_order": item.display_order,
            "phone": item.phone,
            "address": item.address,
            "icon": item.icon,
        }
        for item in qs.order_by("display_order", "title")
    ]
    return JsonResponse(items, safe=False)


@require_http_methods(["GET"])
def api_quick_access(request: HttpRequest) -> JsonResponse:
    """Return active quick-access items, ordered for display."""
    items = [
        {
            "id": item.id,
            "title": item.title,
            "subtitle": item.subtitle,
            "description": item.subtitle,
            "phone": item.phone,
            "color": item.color,
            "icon": item.icon,
            "url": item.identifier,
            "order": item.display_order,
        }
        for item in QuickAccessItem.objects.filter(is_active=True).order_by(
            "display_order", "title"
        )
    ]
    return JsonResponse(items, safe=False)
