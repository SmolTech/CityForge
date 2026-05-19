from django.urls import path

from . import views

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("settings/", views.site_settings, name="site_settings"),
    path("users/", views.users_list, name="users_list"),
    path("users/<int:pk>/toggle-active/", views.user_toggle_active, name="user_toggle_active"),
    path("users/<int:pk>/set-role/", views.user_set_role, name="user_set_role"),
    path("cards/", views.cards_list, name="cards_list"),
    path("cards/<int:pk>/edit/", views.card_edit, name="card_edit"),
    path("cards/<int:pk>/delete/", views.card_delete, name="card_delete"),
    path("submissions/", views.submissions_list, name="submissions_list"),
    path("submissions/<int:pk>/", views.submission_detail, name="submission_detail"),
    path("submissions/<int:pk>/approve/", views.submission_approve, name="submission_approve"),
    path("submissions/<int:pk>/reject/", views.submission_reject, name="submission_reject"),
    path("modifications/", views.modifications_list, name="modifications_list"),
    path("modifications/<int:pk>/", views.modification_detail, name="modification_detail"),
    path(
        "modifications/<int:pk>/approve/",
        views.modification_approve,
        name="modification_approve",
    ),
    path(
        "modifications/<int:pk>/reject/",
        views.modification_reject,
        name="modification_reject",
    ),
    path("tags/", views.tags_list, name="tags_list"),
    path("tags/<int:pk>/delete/", views.tag_delete, name="tag_delete"),
    path("reviews/", views.reviews_list, name="reviews_list"),
    path(
        "reviews/<int:pk>/toggle-hidden/", views.review_toggle_hidden, name="review_toggle_hidden"
    ),
]
