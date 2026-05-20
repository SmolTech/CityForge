from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path

from apps.directory import views as directory_views
from apps.core import views as core_views

urlpatterns = [
    path("api/health", core_views.health, name="health"),
    path("api/cards", include(("apps.directory.urls_api", "directory_api"))),
    path("api/cards/search/", directory_views.api_opensearch, name="cards_search"),
    path("", include(("apps.directory.urls", "directory"), namespace="directory")),
    path("accounts/", include(("apps.accounts.urls", "accounts"), namespace="accounts")),
    path("search/", include(("apps.search.urls", "search"), namespace="search")),
    path("manage/", include(("apps.cms.urls", "cms"), namespace="cms")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
