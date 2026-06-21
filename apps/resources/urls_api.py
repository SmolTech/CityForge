from django.urls import path

from . import views

urlpatterns = [
    path("categories", views.api_categories, name="resource_categories_api"),
    path("categories/", views.api_categories, name="resource_categories_api_slash"),
    path("items", views.api_items, name="resource_items_api"),
    path("items/", views.api_items, name="resource_items_api_slash"),
    path("quick-access", views.api_quick_access, name="quick_access_api"),
    path("quick-access/", views.api_quick_access, name="quick_access_api_slash"),
]
