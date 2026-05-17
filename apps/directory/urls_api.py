from django.urls import path

from . import views

urlpatterns = [
    path("", views.api_cards, name="cards_api"),
]
