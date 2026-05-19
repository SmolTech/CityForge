from __future__ import annotations

import secrets
from datetime import timedelta
from hashlib import sha256

from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.core.cache import cache
from django.core.mail import send_mail
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from .forms import ForgotPasswordForm, LoginForm, RegisterForm, ResetPasswordForm
from .models import PasswordResetToken, User

TOKEN_TTL_HOURS = 1
EMAIL_VERIFICATION_TTL_HOURS = 48
PASSWORD_RESET_LIMIT = 5
PASSWORD_RESET_WINDOW_SECONDS = 3600
CAPTCHA_SESSION_KEY_PREFIX = "accounts_captcha"


def _client_ip(request: HttpRequest) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _reset_rate_key(request: HttpRequest, email: str) -> str:
    ip = _client_ip(request) or "unknown"
    digest = sha256(f"{ip}:{email}".encode()).hexdigest()
    return f"password-reset:{digest}"


def _allow_password_reset_request(request: HttpRequest, email: str) -> bool:
    key = _reset_rate_key(request, email)
    count = cache.get(key, 0)
    if count >= PASSWORD_RESET_LIMIT:
        return False
    cache.set(key, count + 1, PASSWORD_RESET_WINDOW_SECONDS)
    return True


def _captcha_session_keys(scope: str) -> tuple[str, str]:
    return (
        f"{CAPTCHA_SESSION_KEY_PREFIX}:{scope}:prompt",
        f"{CAPTCHA_SESSION_KEY_PREFIX}:{scope}:answer",
    )


def _ensure_captcha(request: HttpRequest, scope: str) -> tuple[str, str]:
    prompt_key, answer_key = _captcha_session_keys(scope)
    prompt = request.session.get(prompt_key)
    answer = request.session.get(answer_key)
    if prompt and answer:
        return prompt, answer
    left = secrets.randbelow(9) + 1
    right = secrets.randbelow(9) + 1
    prompt = f"What is {left} + {right}?"
    answer = str(left + right)
    request.session[prompt_key] = prompt
    request.session[answer_key] = answer
    request.session.modified = True
    return prompt, answer


def _captcha_kwargs(request: HttpRequest, scope: str) -> dict[str, str]:
    prompt, answer = _ensure_captcha(request, scope)
    return {"captcha_prompt": prompt, "captcha_expected": answer}


@require_http_methods(["GET", "POST"])
def register(request: HttpRequest) -> HttpResponse:
    if request.user.is_authenticated:
        return redirect("directory:home")
    if request.method == "POST":
        form = RegisterForm(request.POST, **_captcha_kwargs(request, "register"))
        if form.is_valid():
            user: User = form.save(commit=False)
            user.registration_ip_address = _client_ip(request)
            user.email_verification_token = secrets.token_urlsafe(32)
            user.email_verification_sent_at = timezone.now()
            user.save()
            _send_verification_email(request, user)
            messages.success(
                request,
                "Account created. Check your email to verify your address.",
            )
            login(request, user)
            return redirect("directory:home")
    else:
        form = RegisterForm(**_captcha_kwargs(request, "register"))
    return render(request, "accounts/register.html", {"form": form})


@require_http_methods(["GET", "POST"])
def login_view(request: HttpRequest) -> HttpResponse:
    if request.user.is_authenticated:
        return redirect("directory:home")
    if request.method == "POST":
        form = LoginForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data["email"].lower().strip()
            password = form.cleaned_data["password"]
            user = authenticate(request, username=email, password=password)
            if user is None:
                messages.error(request, "Invalid email or password.")
            elif not user.is_active:
                messages.error(request, "This account is disabled.")
            else:
                login(request, user)
                next_url = request.GET.get("next") or reverse("directory:home")
                return redirect(next_url)
    else:
        form = LoginForm()
    return render(request, "accounts/login.html", {"form": form})


@require_http_methods(["POST"])
def logout_view(request: HttpRequest) -> HttpResponse:
    logout(request)
    messages.info(request, "You have been logged out.")
    return redirect("directory:home")


@require_http_methods(["GET", "POST"])
def forgot_password(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        form = ForgotPasswordForm(request.POST, **_captcha_kwargs(request, "forgot_password"))
        if form.is_valid():
            email = form.cleaned_data["email"].lower().strip()
            user = User.objects.filter(email__iexact=email).first()
            if user is not None and _allow_password_reset_request(request, email):
                token = PasswordResetToken.objects.create(
                    user=user,
                    token=secrets.token_urlsafe(32),
                    expires_at=timezone.now() + timedelta(hours=TOKEN_TTL_HOURS),
                )
                _send_password_reset_email(request, user, token)
            messages.success(
                request,
                "If an account exists for that email, a reset link has been sent.",
            )
            return redirect("accounts:login")
    else:
        form = ForgotPasswordForm(**_captcha_kwargs(request, "forgot_password"))
    return render(request, "accounts/forgot_password.html", {"form": form})


@require_http_methods(["GET", "POST"])
def reset_password(request: HttpRequest, token: str) -> HttpResponse:
    prt = get_object_or_404(PasswordResetToken, token=token)
    if not prt.is_valid():
        messages.error(request, "This reset link is invalid or has expired.")
        return redirect("accounts:forgot_password")

    if request.method == "POST":
        form = ResetPasswordForm(request.POST, **_captcha_kwargs(request, "reset_password"))
        if form.is_valid():
            user = prt.user
            # ResetPasswordForm.clean() invokes validate_password() before this.
            password = form.cleaned_data["password1"]
            user.set_password(  # nosemgrep: python.django.security.audit.unvalidated-password.unvalidated-password
                password
            )
            user.save(update_fields=["password"])
            prt.used = True
            prt.used_at = timezone.now()
            prt.save(update_fields=["used", "used_at"])
            messages.success(request, "Password updated. You can now log in.")
            return redirect("accounts:login")
    else:
        form = ResetPasswordForm(**_captcha_kwargs(request, "reset_password"))
    return render(
        request,
        "accounts/reset_password.html",
        {"form": form, "token": token},
    )


@require_http_methods(["GET"])
def verify_email(request: HttpRequest, token: str) -> HttpResponse:
    user = User.objects.filter(email_verification_token=token).first()
    if not user:
        messages.error(request, "Verification link is invalid.")
        return redirect("directory:home")
    sent_at = user.email_verification_sent_at
    if sent_at is None or sent_at < timezone.now() - timedelta(hours=EMAIL_VERIFICATION_TTL_HOURS):
        user.email_verification_token = None
        user.save(update_fields=["email_verification_token"])
        messages.error(request, "Verification link has expired. Please request a new one.")
        return redirect("directory:home")
    user.email_verified = True
    user.email_verification_token = None
    user.save(update_fields=["email_verified", "email_verification_token"])
    messages.success(request, "Email verified. Thank you!")
    return redirect("directory:home")


@login_required
@require_http_methods(["POST"])
def resend_verification(request: HttpRequest) -> HttpResponse:
    user = request.user
    if user.email_verified:
        messages.info(request, "Your email is already verified.")
    else:
        user.email_verification_token = secrets.token_urlsafe(32)
        user.email_verification_sent_at = timezone.now()
        user.save(update_fields=["email_verification_token", "email_verification_sent_at"])
        _send_verification_email(request, user)
        messages.success(request, "Verification email re-sent.")
    return redirect("directory:home")


def _send_verification_email(request: HttpRequest, user: User) -> None:
    link = request.build_absolute_uri(
        reverse("accounts:verify_email", args=[user.email_verification_token])
    )
    body = render_to_string(
        "emails/verify_email.txt",
        {"user": user, "link": link, "site_name": "CityForge"},
    )
    send_mail(
        subject="Verify your email",
        message=body,
        from_email=None,
        recipient_list=[user.email],
        fail_silently=True,
    )


def _send_password_reset_email(request: HttpRequest, user: User, prt: PasswordResetToken) -> None:
    link = request.build_absolute_uri(reverse("accounts:reset_password", args=[prt.token]))
    body = render_to_string(
        "emails/password_reset.txt",
        {
            "user": user,
            "link": link,
            "ttl_hours": TOKEN_TTL_HOURS,
            "site_name": "CityForge",
        },
    )
    send_mail(
        subject="Reset your password",
        message=body,
        from_email=None,
        recipient_list=[user.email],
        fail_silently=True,
    )
