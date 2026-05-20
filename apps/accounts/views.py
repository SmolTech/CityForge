from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from urllib.parse import urlencode

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from apps.webhooks.service import dispatch_event

from .forms import ForgotPasswordForm, LoginForm, RegisterForm, ResetPasswordForm
from .models import PasswordResetToken, TokenBlacklist, User

TOKEN_TTL_HOURS = 1
EMAIL_VERIFICATION_TTL_HOURS = 48
PASSWORD_RESET_LIMIT = 5
PASSWORD_RESET_WINDOW_SECONDS = 3600
CAPTCHA_SESSION_KEY_PREFIX = "accounts_captcha"
MOBILE_AUTH_TOKEN_TTL = timedelta(days=7)


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


def _admin_users_url(request: HttpRequest, email: str) -> str:
    query = urlencode({"q": email})
    return request.build_absolute_uri(f"{reverse('cms:users_list')}?{query}")


def _serialize_user(user: User) -> dict[str, object]:
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.full_name,
        "role": user.role,
        "is_admin": user.is_admin,
        "is_supporter": user.is_support,
        "is_supporter_flag": user.is_support,
        "is_active": user.is_active,
        "created_date": user.created_date.isoformat(),
        "last_login": user.last_login.isoformat() if user.last_login else None,
    }


def _auth_token_signing_key() -> bytes:
    return settings.SECRET_KEY.encode()


def _encode_auth_token(payload: dict[str, object]) -> str:
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    body = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    signature = hmac.new(_auth_token_signing_key(), body.encode(), hashlib.sha256).hexdigest()
    return f"{body}.{signature}"


def _decode_auth_token(token: str) -> dict[str, object] | None:
    try:
        body, signature = token.split(".", 1)
    except ValueError:
        return None

    expected = hmac.new(_auth_token_signing_key(), body.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return None

    padding = "=" * (-len(body) % 4)
    try:
        payload = json.loads(base64.urlsafe_b64decode(f"{body}{padding}").decode())
    except (ValueError, json.JSONDecodeError):
        return None

    if not isinstance(payload, dict):
        return None
    return payload


def _issue_mobile_auth_token(user: User) -> str:
    now = timezone.now()
    payload = {
        "sub": user.id,
        "jti": secrets.token_urlsafe(16),
        "iat": int(now.timestamp()),
        "exp": int((now + MOBILE_AUTH_TOKEN_TTL).timestamp()),
    }
    return _encode_auth_token(payload)


def _mobile_user_from_request(request: HttpRequest) -> User | None:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header.removeprefix("Bearer ").strip()
    payload = _decode_auth_token(token)
    if not payload:
        return None

    jti = payload.get("jti")
    if not isinstance(jti, str):
        return None

    if TokenBlacklist.objects.filter(jti=jti).exists():
        return None

    exp = payload.get("exp")
    if not isinstance(exp, int) or exp <= int(timezone.now().timestamp()):
        return None

    user_id = payload.get("sub")
    if not isinstance(user_id, int):
        return None

    user = User.objects.filter(pk=user_id).first()
    if user is None or not user.is_active:
        return None
    return user


def _require_mobile_user(request: HttpRequest) -> User | JsonResponse:
    user = _mobile_user_from_request(request)
    if user is None:
        return JsonResponse({"detail": "Authentication required."}, status=401)
    return user


def _mobile_auth_response(user: User) -> JsonResponse:
    token = _issue_mobile_auth_token(user)
    return JsonResponse({"access_token": token, "user": _serialize_user(user)})


@require_http_methods(["POST"])
def api_login(request: HttpRequest) -> HttpResponse:
    try:
        payload = json.loads(request.body.decode() or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Request body must be valid JSON."}, status=400)

    email = str(payload.get("email") or "").strip().lower()
    password = str(payload.get("password") or "")
    if not email or not password:
        return JsonResponse({"detail": "Email and password are required."}, status=400)

    user = authenticate(request, username=email, password=password)
    if user is None:
        return JsonResponse({"detail": "Invalid email or password."}, status=401)
    if not user.is_active:
        return JsonResponse({"detail": "This account is disabled."}, status=403)
    if not user.email_verified:
        return JsonResponse({"detail": "Please verify your email before logging in."}, status=403)

    user.last_login = timezone.now()
    user.save(update_fields=["last_login"])
    return _mobile_auth_response(user)


@require_http_methods(["POST"])
def api_register(request: HttpRequest) -> HttpResponse:
    try:
        payload = json.loads(request.body.decode() or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Request body must be valid JSON."}, status=400)

    email = str(payload.get("email") or "").strip().lower()
    password = str(payload.get("password") or "")
    first_name = str(payload.get("first_name") or "").strip()
    last_name = str(payload.get("last_name") or "").strip()
    if not email or not password or not first_name or not last_name:
        return JsonResponse({"detail": "All fields are required."}, status=400)
    if User.objects.filter(email__iexact=email).exists():
        return JsonResponse({"detail": "A user with that email already exists."}, status=409)

    user = User.objects.create_user(
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        email_verified=True,
    )
    user.registration_ip_address = _client_ip(request)
    user.save(update_fields=["registration_ip_address"])
    return _mobile_auth_response(user)


def api_me(request: HttpRequest) -> HttpResponse:
    user = _mobile_user_from_request(request)
    if user is None:
        return JsonResponse({"detail": "Authentication required."}, status=401)
    return JsonResponse(_serialize_user(user))


@require_http_methods(["POST"])
def api_logout(request: HttpRequest) -> HttpResponse:
    user = _mobile_user_from_request(request)
    if user is None:
        return JsonResponse({"detail": "Authentication required."}, status=401)

    token = request.headers.get("authorization", "").removeprefix("Bearer ").strip()
    payload = _decode_auth_token(token)
    if isinstance(payload, dict):
        jti = payload.get("jti")
        exp = payload.get("exp")
        if isinstance(jti, str) and isinstance(exp, int):
            TokenBlacklist.objects.get_or_create(
                jti=jti,
                defaults={
                    "token_type": "access",
                    "user": user,
                    "revoked_at": timezone.now(),
                    "expires_at": datetime.fromtimestamp(exp, tz=UTC),
                },
            )
    return JsonResponse({"detail": "Logged out."})


@require_http_methods(["PUT"])
def api_update_email(request: HttpRequest) -> HttpResponse:
    user = _mobile_user_from_request(request)
    if user is None:
        return JsonResponse({"detail": "Authentication required."}, status=401)

    try:
        payload = json.loads(request.body.decode() or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Request body must be valid JSON."}, status=400)

    email = str(payload.get("email") or "").strip().lower()
    if not email:
        return JsonResponse({"detail": "Email is required."}, status=400)
    if User.objects.exclude(pk=user.pk).filter(email__iexact=email).exists():
        return JsonResponse({"detail": "A user with that email already exists."}, status=409)

    user.email = email
    user.email_verified = False
    user.email_verification_token = secrets.token_urlsafe(32)
    user.email_verification_sent_at = timezone.now()
    user.save(
        update_fields=[
            "email",
            "email_verified",
            "email_verification_token",
            "email_verification_sent_at",
        ]
    )
    _send_verification_email(request, user)
    return JsonResponse({"detail": "Email updated."})


@require_http_methods(["PUT"])
def api_update_password(request: HttpRequest) -> HttpResponse:
    user = _mobile_user_from_request(request)
    if user is None:
        return JsonResponse({"detail": "Authentication required."}, status=401)

    try:
        payload = json.loads(request.body.decode() or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Request body must be valid JSON."}, status=400)

    current_password = str(payload.get("current_password") or "")
    new_password = str(payload.get("new_password") or "")
    if not current_password or not new_password:
        return JsonResponse({"detail": "Current and new password are required."}, status=400)
    if not user.check_password(current_password):
        return JsonResponse({"detail": "Current password is incorrect."}, status=400)

    try:
        validate_password(new_password, user=user)
    except ValidationError as exc:
        return JsonResponse(
            {"detail": " ".join(exc.messages)},
            status=400,
        )

    user.set_password(new_password)
    user.save(update_fields=["password"])
    return JsonResponse({"detail": "Password updated."})


@require_http_methods(["GET", "POST"])
def register(request: HttpRequest) -> HttpResponse:
    if request.user.is_authenticated:
        return redirect("directory:home")
    if request.method == "POST":
        form = RegisterForm(request.POST, **_captcha_kwargs(request, "register"))
        if form.is_valid():
            user: User = form.save(commit=False)
            registration_ip = _client_ip(request)
            user.registration_ip_address = registration_ip
            user.email_verification_token = secrets.token_urlsafe(32)
            user.email_verification_sent_at = timezone.now()
            user.save()
            _send_verification_email(request, user)
            dispatch_event(
                "account.created",
                {
                    "user_id": user.id,
                    "user_email": user.email,
                    "user_name": user.full_name,
                    "role": user.role,
                    "email_verified": user.email_verified,
                    "registration_ip_address": registration_ip or "",
                    "change_text": f"New account created for {user.email}.",
                    "content_url": _admin_users_url(request, user.email),
                    "content_title": user.email,
                },
                source_info="accounts.register",
            )
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
                dispatch_event(
                    "password_reset.requested",
                    {
                        "user_id": user.id,
                        "user_email": user.email,
                        "request_ip_address": _client_ip(request) or "",
                        "expires_at": token.expires_at.isoformat(),
                        "change_text": f"Password reset requested for {user.email}.",
                        "content_url": _admin_users_url(request, user.email),
                        "content_title": user.email,
                    },
                    source_info="accounts.forgot_password",
                )
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
            dispatch_event(
                "password_reset.completed",
                {
                    "user_id": user.id,
                    "user_email": user.email,
                    "completed_at": prt.used_at.isoformat() if prt.used_at else "",
                    "change_text": f"Password reset completed for {user.email}.",
                    "content_url": _admin_users_url(request, user.email),
                    "content_title": user.email,
                },
                source_info="accounts.reset_password",
            )
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
