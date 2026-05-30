from django.conf import settings
from django.http import JsonResponse
from django.views.static import serve

from apps.core.db_monitoring import get_database_health


def health(_request):
    database = get_database_health()
    status = "ok" if database["healthy"] else "error"
    return JsonResponse({"status": status}, status=200 if database["healthy"] else 503)


def media_file(request, path: str):
    """Serve user-uploaded media. Only intended for development (DEBUG=True).

    In production, configure your reverse proxy or CDN to serve MEDIA_ROOT
    directly and avoid routing media requests through Django.
    """
    return serve(request, path, document_root=str(settings.MEDIA_ROOT))
