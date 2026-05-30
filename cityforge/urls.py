import re

from django.conf import settings
from django.contrib.staticfiles.storage import staticfiles_storage
from django.urls import include, path, re_path
from django.views.generic.base import RedirectView
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from apps.core import views as core_views
from apps.directory import views as directory_views
from apps.events import views as events_views

urlpatterns = [
    path(
        "favicon.ico",
        RedirectView.as_view(url=staticfiles_storage.url("favicon.ico"), permanent=True),
        name="favicon",
    ),
    # OpenAPI Schema & Documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/swagger/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/docs/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    # Health & API endpoints
    path("api/health", core_views.health, name="health"),
    path("api/auth/", include(("apps.accounts.urls_api", "accounts_api"))),
    path("api/cards", include(("apps.directory.urls_api", "directory_api"))),
    path("api/cards/search/", directory_views.api_opensearch, name="cards_search"),
    path("api/tags", directory_views.api_tags, name="tags_api"),
    path("api/tags/", directory_views.api_tags, name="tags_api_slash"),
    path("api/events", include(("apps.events.urls_api", "events_api"))),
    path(
        "api/cards/<int:pk>/suggest-edit",
        directory_views.api_suggest_edit,
        name="card_suggest_edit",
    ),
    path(
        "api/cards/<int:pk>/suggest-edit/",
        directory_views.api_suggest_edit,
        name="card_suggest_edit_slash",
    ),
    path("api/submissions", directory_views.api_submissions, name="submissions_api"),
    path("api/submissions/", directory_views.api_submissions, name="submissions_api_slash"),
    path("events/feed.ics", events_views.event_feed, name="events_feed_ics"),
    path("events/", include(("apps.events.urls", "events"), namespace="events")),
    path("", include(("apps.directory.urls", "directory"), namespace="directory")),
    path("accounts/", include(("apps.accounts.urls", "accounts"), namespace="accounts")),
    path("search/", include(("apps.search.urls", "search"), namespace="search")),
    path("manage/", include(("apps.cms.urls", "cms"), namespace="cms")),
]

# WARNING: In production, configure your reverse proxy or CDN to serve
# MEDIA_ROOT directly. Do not rely on Django's development file server.
media_prefix = settings.MEDIA_URL.lstrip("/").rstrip("/")
if media_prefix:
    urlpatterns += [
        re_path(rf"^{re.escape(media_prefix)}/(?P<path>.*)$", core_views.media_file, name="media"),
    ]
