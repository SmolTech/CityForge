from __future__ import annotations

import json
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user
from django.core.cache import cache
from django.http import HttpResponse
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from apps.accounts.models import PasswordResetToken, TokenBlacklist, User
from apps.accounts.views import (
    PASSWORD_RESET_LIMIT,
    _allow_password_reset_request,
    _client_ip,
    _reset_rate_key,
)


class AccountFlowTests(TestCase):
    def setUp(self) -> None:
        self.password = "S3curePass!123"
        self.user = User.objects.create_user(
            email="user@example.com",
            password=self.password,
            first_name="Test",
            last_name="User",
            email_verified=False,
        )

    def _captcha_answer(self, scope: str) -> str:
        return self.client.session[f"accounts_captcha:{scope}:answer"]

    def _set_captcha(self, scope: str, answer: str = "7") -> None:
        session = self.client.session
        session[f"accounts_captcha:{scope}:prompt"] = "What is 3 + 4?"
        session[f"accounts_captcha:{scope}:answer"] = answer
        session.save()

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_register_creates_user_and_logs_in(self) -> None:
        self._set_captcha("register")
        with (
            patch("apps.accounts.views._send_verification_email") as sender,
            patch("apps.accounts.views.dispatch_event") as mocked_dispatch,
        ):
            response = self.client.post(
                reverse("accounts:register"),
                {
                    "email": "newuser@example.com",
                    "first_name": "New",
                    "last_name": "User",
                    "password1": "AnotherS3curePass!",
                    "password2": "AnotherS3curePass!",
                    "captcha_answer": self._captcha_answer("register"),
                },
            )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("directory:home"))
        created = User.objects.get(email="newuser@example.com")
        self.assertTrue(created.email_verification_token)
        self.assertEqual(get_user(self.client).pk, created.pk)
        sender.assert_called_once()
        mocked_dispatch.assert_called_once()
        self.assertEqual(mocked_dispatch.call_args.args[0], "account.created")
        payload = mocked_dispatch.call_args.args[1]
        self.assertEqual(payload["user_email"], "newuser@example.com")
        self.assertIn("New account created", payload["change_text"])
        self.assertIn(reverse("cms:users_list"), payload["content_url"])

    def test_login_success_redirects_home(self) -> None:
        response = self.client.post(
            reverse("accounts:login"),
            {"email": self.user.email, "password": self.password},
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("directory:home"))

    def test_reset_password_flow_marks_token_used(self) -> None:
        token = PasswordResetToken.objects.create(
            user=self.user,
            token="reset-token",
            expires_at=timezone.now() + timedelta(hours=1),
        )
        self._set_captcha("reset_password")
        with patch("apps.accounts.views.dispatch_event") as mocked_dispatch:
            response = self.client.post(
                reverse("accounts:reset_password", args=[token.token]),
                {
                    "password1": "N3wPass!234",
                    "password2": "N3wPass!234",
                    "captcha_answer": self._captcha_answer("reset_password"),
                },
            )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("accounts:login"))
        token.refresh_from_db()
        self.user.refresh_from_db()
        self.assertTrue(token.used)
        self.assertTrue(self.user.check_password("N3wPass!234"))
        mocked_dispatch.assert_called_once()
        self.assertEqual(mocked_dispatch.call_args.args[0], "password_reset.completed")
        payload = mocked_dispatch.call_args.args[1]
        self.assertEqual(payload["user_email"], self.user.email)
        self.assertIn("Password reset completed", payload["change_text"])
        self.assertIn(reverse("cms:users_list"), payload["content_url"])

    def test_register_with_incorrect_captcha_is_rejected(self) -> None:
        self._set_captcha("register")
        with patch("apps.accounts.views.render", return_value=HttpResponse("bad captcha")):
            response = self.client.post(
                reverse("accounts:register"),
                {
                    "email": "badcaptcha@example.com",
                    "first_name": "Bad",
                    "last_name": "Captcha",
                    "password1": "AnotherS3curePass!",
                    "password2": "AnotherS3curePass!",
                    "captcha_answer": "wrong",
                },
            )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.filter(email="badcaptcha@example.com").exists())

    def test_verify_email_expired_token_clears_token(self) -> None:
        self.user.email_verification_token = "verify-token"
        self.user.email_verification_sent_at = timezone.now() - timedelta(hours=72)
        self.user.save(update_fields=["email_verification_token", "email_verification_sent_at"])
        response = self.client.get(reverse("accounts:verify_email", args=["verify-token"]))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("directory:home"))
        self.user.refresh_from_db()
        self.assertIsNone(self.user.email_verification_token)
        self.assertFalse(self.user.email_verified)

    def test_verify_email_success(self) -> None:
        self.user.email_verification_token = "verify-ok"
        self.user.email_verification_sent_at = timezone.now()
        self.user.save(update_fields=["email_verification_token", "email_verification_sent_at"])
        response = self.client.get(reverse("accounts:verify_email", args=["verify-ok"]))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("directory:home"))
        self.user.refresh_from_db()
        self.assertTrue(self.user.email_verified)
        self.assertIsNone(self.user.email_verification_token)

    def test_resend_verification_generates_new_token_for_unverified_user(self) -> None:
        self.client.force_login(self.user)
        old_token = self.user.email_verification_token
        with patch("apps.accounts.views._send_verification_email") as sender:
            response = self.client.post(reverse("accounts:resend_verification"))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("directory:home"))
        self.user.refresh_from_db()
        self.assertNotEqual(self.user.email_verification_token, old_token)
        self.assertIsNotNone(self.user.email_verification_sent_at)
        sender.assert_called_once()


class AccountHelperTests(TestCase):
    def _set_captcha(self, scope: str, answer: str = "7") -> None:
        session = self.client.session
        session[f"accounts_captcha:{scope}:prompt"] = "What is 3 + 4?"
        session[f"accounts_captcha:{scope}:answer"] = answer
        session.save()

    def test_client_ip_prefers_forwarded_for(self) -> None:
        from django.test import RequestFactory

        request = RequestFactory().get(
            "/",
            HTTP_X_FORWARDED_FOR="203.0.113.10,10.0.0.1",
            REMOTE_ADDR="127.0.0.1",
        )
        self.assertEqual(_client_ip(request), "203.0.113.10")

    def test_password_reset_rate_limit_respects_limit(self) -> None:
        cache.clear()
        from django.test import RequestFactory

        request = RequestFactory().get("/", REMOTE_ADDR="127.0.0.1")
        email = "limit@example.com"
        key = _reset_rate_key(request, email)
        self.assertIn("password-reset:", key)
        for _ in range(PASSWORD_RESET_LIMIT):
            self.assertTrue(_allow_password_reset_request(request, email))
        self.assertFalse(_allow_password_reset_request(request, email))

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_forgot_password_creates_token_for_known_user(self) -> None:
        user = User.objects.create_user(
            "forgot@example.com",
            "ForgotPass!123",
            first_name="Forgot",
            last_name="User",
        )
        self._set_captcha("forgot_password")
        with (
            patch("apps.accounts.views._send_password_reset_email") as sender,
            patch("apps.accounts.views.dispatch_event") as mocked_dispatch,
        ):
            response = self.client.post(
                reverse("accounts:forgot_password"),
                {
                    "email": user.email,
                    "captcha_answer": self.client.session[
                        "accounts_captcha:forgot_password:answer"
                    ],
                },
            )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("accounts:login"))
        self.assertEqual(PasswordResetToken.objects.filter(user=user).count(), 1)
        sender.assert_called_once()
        mocked_dispatch.assert_called_once()
        self.assertEqual(mocked_dispatch.call_args.args[0], "password_reset.requested")
        payload = mocked_dispatch.call_args.args[1]
        self.assertEqual(payload["user_email"], user.email)
        self.assertIn("Password reset requested", payload["change_text"])
        self.assertIn(reverse("cms:users_list"), payload["content_url"])

    def test_forgot_password_with_wrong_captcha_does_not_create_token(self) -> None:
        user = User.objects.create_user(
            "forgot-captcha@example.com",
            "ForgotPass!123",
            first_name="Forgot",
            last_name="User",
        )
        self._set_captcha("forgot_password")
        with patch("apps.accounts.views.render", return_value=HttpResponse("bad captcha")):
            response = self.client.post(
                reverse("accounts:forgot_password"),
                {"email": user.email, "captcha_answer": "nope"},
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(PasswordResetToken.objects.filter(user=user).count(), 0)

    def test_user_manager_and_role_properties(self) -> None:
        admin = User.objects.create_superuser("admin@example.com", "AdminPass!234")
        support = User.objects.create_user(
            "support@example.com",
            "SupportPass!234",
            first_name="Support",
            last_name="User",
            role=User.Role.SUPPORT,
        )
        self.assertTrue(admin.is_admin)
        self.assertTrue(support.is_support)
        self.assertFalse(support.is_admin)
        with self.assertRaises(ValueError):
            User.objects.create_user("", "x")

    def test_resend_verification_for_verified_user_keeps_state(self) -> None:
        verified = User.objects.create_user(
            "verified@example.com",
            "VerifiedPass!234",
            first_name="Verified",
            last_name="User",
            email_verified=True,
        )
        self.client.force_login(verified)
        with patch("apps.accounts.views._send_verification_email") as sender:
            response = self.client.post(reverse("accounts:resend_verification"))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("directory:home"))
        sender.assert_not_called()


class MobileAuthApiTests(TestCase):
    def setUp(self) -> None:
        self.password = "MobilePass!123"
        self.user = User.objects.create_user(
            email="mobile@example.com",
            password=self.password,
            first_name="Mobile",
            last_name="User",
            email_verified=True,
        )

    def _auth_header(self, token: str) -> dict[str, str]:
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def test_login_returns_access_token_and_user(self) -> None:
        response = self.client.post(
            "/api/auth/login",
            data=json.dumps({"email": self.user.email, "password": self.password}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("access_token", body)
        self.assertEqual(body["user"]["email"], self.user.email)

    def test_me_requires_bearer_token(self) -> None:
        response = self.client.get("/api/auth/me")
        self.assertEqual(response.status_code, 401)

    def test_me_returns_current_user(self) -> None:
        login_response = self.client.post(
            "/api/auth/login",
            data=json.dumps({"email": self.user.email, "password": self.password}),
            content_type="application/json",
        )
        token = login_response.json()["access_token"]

        response = self.client.get("/api/auth/me", **self._auth_header(token))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], self.user.email)

    def test_logout_blacklists_token(self) -> None:
        login_response = self.client.post(
            "/api/auth/login",
            data=json.dumps({"email": self.user.email, "password": self.password}),
            content_type="application/json",
        )
        token = login_response.json()["access_token"]

        response = self.client.post("/api/auth/logout", **self._auth_header(token))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(TokenBlacklist.objects.count(), 1)
        me_response = self.client.get("/api/auth/me", **self._auth_header(token))
        self.assertEqual(me_response.status_code, 401)

    def test_register_returns_access_token(self) -> None:
        response = self.client.post(
            "/api/auth/register",
            data=json.dumps(
                {
                    "email": "newmobile@example.com",
                    "password": "AnotherMobilePass!123",
                    "first_name": "New",
                    "last_name": "Mobile",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("access_token", body)
        self.assertEqual(body["user"]["email"], "newmobile@example.com")
