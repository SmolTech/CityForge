from django.conf import settings
from django.http import FileResponse, HttpRequest, HttpResponse, JsonResponse
from django.views.static import serve

from apps.core.db_monitoring import get_database_health
from apps.core.site_config import get_site_config
from apps.resources.models import QuickAccessItem, ResourceItem


def health(_request: HttpRequest) -> JsonResponse:
    database = get_database_health()
    status = "ok" if database["healthy"] else "error"
    return JsonResponse({"status": status}, status=200 if database["healthy"] else 503)


def api_site_config(request: HttpRequest) -> JsonResponse:
    """Return public site configuration and featured resources for mobile clients."""
    config = get_site_config()
    site_name = config.get("SITE_NAME", "CityForge")
    site_tagline = config.get("SITE_TAGLINE", "")

    quick_access = [
        {
            "id": item.id,
            "title": item.title,
            "subtitle": item.subtitle,
            "description": item.subtitle,
            "icon": item.icon,
            "url": item.identifier,
            "order": item.display_order,
        }
        for item in QuickAccessItem.objects.filter(is_active=True).order_by(
            "display_order", "title"
        )
    ]

    resource_items = [
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
        for item in ResourceItem.objects.filter(is_active=True).order_by("display_order", "title")
    ]

    return JsonResponse(
        {
            "site": {
                "title": site_name,
                "description": site_tagline,
                "copyright": f"© {site_name}",
            },
            "resources": {
                "title": "Resources",
                "description": "Community resources and services",
            },
            "quickAccess": quick_access,
            "resourceItems": resource_items,
            "footer": {"copyright": f"© {site_name}"},
            "pagination": {"defaultLimit": getattr(settings, "PAGINATION_DEFAULT_LIMIT", 24)},
        }
    )


def media_file(request: HttpRequest, path: str) -> HttpResponse | FileResponse:
    """Serve user-uploaded media. Only intended for development (DEBUG=True).

    In production the Kubernetes nginx sidecar serves MEDIA_ROOT directly
    from the shared PVC so media requests never hit Django.
    """
    if not settings.DEBUG:
        return HttpResponse("Not found.", status=404)
    return serve(request, path, document_root=str(settings.MEDIA_ROOT))
