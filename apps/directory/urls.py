from django.urls import path

from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("business/<int:pk>/review/", views.submit_review, name="submit_review"),
    path("business/<int:pk>/update/", views.card_update_submit, name="card_update_submit"),
    path("business/<int:pk>/<slug:slug>/", views.card_detail, name="card_detail"),
    path("business/<int:pk>/", views.card_detail, name="card_detail_short"),
    path("submit/", views.card_submit, name="card_submit"),
    path("my/submissions/", views.my_submissions, name="my_submissions"),
]
