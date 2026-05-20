from django.conf import settings
from django.http import JsonResponse
from django.views.static import serve


def health(_request):
    return JsonResponse({"status": "ok"})


def media_file(request, path: str):
    return serve(request, path, document_root=settings.MEDIA_ROOT)
