from django.conf import settings
from django.http import JsonResponse
from django.views.static import serve

from apps.core.db_monitoring import get_database_health


def health(_request):
    database = get_database_health()
    status = "ok" if database["healthy"] else "error"
    return JsonResponse(
        {"status": status, "database": database}, status=200 if database["healthy"] else 503
    )


def media_file(request, path: str):
    return serve(request, path, document_root=settings.MEDIA_ROOT)
