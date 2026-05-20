from django.urls import path

from . import views

urlpatterns = [
    path("", views.api_cards, name="cards_api"),
    path("search/", views.api_opensearch, name="opensearch_api"),
]
