from django.urls import path

from . import views

urlpatterns = [
    path("", views.api_events, name="events_api"),
]

