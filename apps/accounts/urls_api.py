from django.urls import path

from . import views

urlpatterns = [
    path("login", views.api_login, name="login"),
    path("login/", views.api_login, name="login_slash"),
    path("register", views.api_register, name="register"),
    path("register/", views.api_register, name="register_slash"),
    path("me", views.api_me, name="me"),
    path("me/", views.api_me, name="me_slash"),
    path("logout", views.api_logout, name="logout"),
    path("logout/", views.api_logout, name="logout_slash"),
    path("update-email", views.api_update_email, name="update_email"),
    path("update-email/", views.api_update_email, name="update_email_slash"),
    path("update-password", views.api_update_password, name="update_password"),
    path("update-password/", views.api_update_password, name="update_password_slash"),
]
