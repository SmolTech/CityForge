from django.urls import path

from . import views

urlpatterns = [
    path("", views.events_home, name="home"),
    path("feed.ics", views.event_feed, name="feed"),
    path("submit/", views.event_submit, name="submit"),
    path("my/submissions/", views.my_event_submissions, name="my_submissions"),
    path("submissions/<int:pk>/", views.event_submission_detail, name="event_submission_detail"),
    path("<int:pk>/<slug:slug>/", views.event_detail, name="event_detail"),
    path("<int:pk>/", views.event_detail, name="event_detail_short"),
]
