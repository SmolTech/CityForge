from django.urls import path

from . import views

urlpatterns = [
    path("", views.api_cards, name="cards_api"),
    path("search/", views.api_opensearch, name="opensearch_api"),
    path("submissions", views.api_submissions, name="submissions_api"),
    path("submissions/", views.api_submissions, name="submissions_api_slash"),
    path("tags", views.api_tags, name="tags_api"),
    path("tags/", views.api_tags, name="tags_api_slash"),
    path("<int:pk>/suggest-edit", views.api_suggest_edit, name="suggest_edit_api"),
    path("<int:pk>/suggest-edit/", views.api_suggest_edit, name="suggest_edit_api_slash"),
]
