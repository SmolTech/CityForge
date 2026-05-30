from __future__ import annotations

import json
from datetime import timedelta
from io import BytesIO
from tempfile import TemporaryDirectory
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from PIL import Image

from apps.accounts.models import PasswordResetToken, TokenBlacklist, User
from apps.directory.models import (
    Card,
    CardModification,
    CardSubmission,
    CardSubmissionStatus,
    CardTag,
    Review,
    Tag,
)
from apps.events.models import Event, EventStatus, EventSubmission
from apps.resources.models import ResourceItem

pytestmark = pytest.mark.e2e


def _uploaded_png() -> SimpleUploadedFile:
    image = BytesIO()
    Image.new("RGB", (1, 1), "white").save(image, format="PNG")
    return SimpleUploadedFile("journey.png", image.getvalue(), content_type="image/png")


def _set_captcha(client, scope: str, answer: str = "7") -> str:
    session = client.session
    session[f"accounts_captcha:{scope}:prompt"] = "What is 3 + 4?"
    session[f"accounts_captcha:{scope}:answer"] = answer
    session.save()
    return answer


def _auth_header(token: str) -> dict[str, str]:
    return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


class AccountsAndAuthE2ETests(TestCase):
    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_web_registration_login_and_password_reset_journey(self) -> None:
        register_answer = _set_captcha(self.client, "register")
        with patch("apps.accounts.views._send_verification_email"):
            register = self.client.post(
                reverse("accounts:register"),
                {
                    "email": "newmember@example.com",
                    "first_name": "New",
                    "last_name": "Member",
                    "password1": "InitialPass!123",
                    "password2": "InitialPass!123",
                    "captcha_answer": register_answer,
                },
            )
        self.assertEqual(register.status_code, 302)
        self.assertEqual(register.headers["Location"], reverse("directory:home"))
        user = User.objects.get(email="newmember@example.com")

        logout = self.client.post(reverse("accounts:logout"))
        self.assertEqual(logout.status_code, 302)

        # Email verification is now required before login.
        verify = self.client.get(
            reverse("accounts:verify_email", args=[user.email_verification_token])
        )
        self.assertEqual(verify.status_code, 302)
        user.refresh_from_db()
        self.assertTrue(user.email_verified)

        login = self.client.post(
            reverse("accounts:login"),
            {"email": user.email, "password": "InitialPass!123"},
        )
        self.assertEqual(login.status_code, 302)
        self.assertEqual(login.headers["Location"], reverse("directory:home"))

        forgot_answer = _set_captcha(self.client, "forgot_password")
        with patch("apps.accounts.views._send_password_reset_email"):
            forgot = self.client.post(
                reverse("accounts:forgot_password"),
                {"email": user.email, "captcha_answer": forgot_answer},
            )
        self.assertEqual(forgot.status_code, 302)
        token = PasswordResetToken.objects.get(user=user)

        reset_answer = _set_captcha(self.client, "reset_password")
        reset = self.client.post(
            reverse("accounts:reset_password", args=[token.token]),
            {
                "password1": "NewerPass!456",
                "password2": "NewerPass!456",
                "captcha_answer": reset_answer,
            },
        )
        self.assertEqual(reset.status_code, 302)
        self.assertEqual(reset.headers["Location"], reverse("accounts:login"))

        relogin = self.client.post(
            reverse("accounts:login"),
            {"email": user.email, "password": "NewerPass!456"},
        )
        self.assertEqual(relogin.status_code, 302)
        self.assertEqual(relogin.headers["Location"], reverse("directory:home"))

    def test_web_email_verification_and_resend_journey(self) -> None:
        user = User.objects.create_user(
            "verifyme@example.com",
            "VerifyPass!123",
            first_name="Verify",
            last_name="User",
            email_verified=False,
        )
        user.email_verification_token = "verify-token"
        user.email_verification_sent_at = timezone.now() - timedelta(minutes=5)
        user.save(update_fields=["email_verification_token", "email_verification_sent_at"])

        verify = self.client.get(reverse("accounts:verify_email", args=["verify-token"]))
        self.assertEqual(verify.status_code, 302)
        user.refresh_from_db()
        self.assertTrue(user.email_verified)
        self.assertIsNone(user.email_verification_token)

        user.email_verified = False
        user.save(update_fields=["email_verified"])
        self.client.force_login(user)
        with patch("apps.accounts.views._send_verification_email"):
            resend = self.client.post(reverse("accounts:resend_verification"))
        self.assertEqual(resend.status_code, 302)
        user.refresh_from_db()
        self.assertIsNotNone(user.email_verification_token)
        self.assertIsNotNone(user.email_verification_sent_at)

    def test_mobile_auth_lifecycle_journey(self) -> None:
        user = User.objects.create_user(
            "mobile-e2e@example.com",
            "MobilePass!123",
            first_name="Mobile",
            last_name="Tester",
            email_verified=True,
        )
        login = self.client.post(
            "/api/auth/login",
            data=json.dumps({"email": user.email, "password": "MobilePass!123"}),
            content_type="application/json",
        )
        self.assertEqual(login.status_code, 200)
        token = login.json()["access_token"]

        me = self.client.get("/api/auth/me", **_auth_header(token))
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["email"], user.email)

        with patch("apps.accounts.views._send_verification_email"):
            update_email = self.client.put(
                "/api/auth/update-email",
                data=json.dumps({"email": "mobile-updated@example.com"}),
                content_type="application/json",
                **_auth_header(token),
            )
        self.assertEqual(update_email.status_code, 200)
        user.refresh_from_db()
        self.assertEqual(user.email, "mobile-updated@example.com")
        self.assertFalse(user.email_verified)

        blocked_login = self.client.post(
            "/api/auth/login",
            data=json.dumps({"email": user.email, "password": "MobilePass!123"}),
            content_type="application/json",
        )
        self.assertEqual(blocked_login.status_code, 403)

        user.email_verified = True
        user.save(update_fields=["email_verified"])

        relogin = self.client.post(
            "/api/auth/login",
            data=json.dumps({"email": user.email, "password": "MobilePass!123"}),
            content_type="application/json",
        )
        self.assertEqual(relogin.status_code, 200)
        active_token = relogin.json()["access_token"]

        update_password = self.client.put(
            "/api/auth/update-password",
            data=json.dumps(
                {"current_password": "MobilePass!123", "new_password": "MobilePass!456"}
            ),
            content_type="application/json",
            **_auth_header(active_token),
        )
        self.assertEqual(update_password.status_code, 200)

        old_password_login = self.client.post(
            "/api/auth/login",
            data=json.dumps({"email": user.email, "password": "MobilePass!123"}),
            content_type="application/json",
        )
        self.assertEqual(old_password_login.status_code, 401)

        new_password_login = self.client.post(
            "/api/auth/login",
            data=json.dumps({"email": user.email, "password": "MobilePass!456"}),
            content_type="application/json",
        )
        self.assertEqual(new_password_login.status_code, 200)
        logout_token = new_password_login.json()["access_token"]

        logout = self.client.post("/api/auth/logout", **_auth_header(logout_token))
        self.assertEqual(logout.status_code, 200)
        self.assertEqual(TokenBlacklist.objects.count(), 1)

        me_after_logout = self.client.get("/api/auth/me", **_auth_header(logout_token))
        self.assertEqual(me_after_logout.status_code, 401)


class DirectoryAndCmsE2ETests(TestCase):
    def setUp(self) -> None:
        self.member = User.objects.create_user(
            "member-e2e@example.com",
            "MemberPass!123",
            first_name="Member",
            last_name="User",
            email_verified=True,
        )
        self.admin = User.objects.create_superuser("admin-e2e@example.com", "AdminPass!123")
        self.tag = Tag.objects.create(name="coffee")
        self.card = Card.objects.create(name="Roaster One", approved=True, creator=self.member)
        CardTag.objects.create(card=self.card, tag=self.tag)

    @override_settings(MEDIA_URL="/media/")
    def test_directory_submission_api_and_cms_moderation_journey(self) -> None:
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                self.client.force_login(self.member)
                submit = self.client.post(
                    reverse("directory:card_submit"),
                    {
                        "name": "Journey Cafe",
                        "description": "Primary submission",
                        "tags_text": "coffee,local",
                        "image": _uploaded_png(),
                    },
                )
                self.assertEqual(submit.status_code, 302)
                submission = CardSubmission.objects.get(name="Journey Cafe")
                self.assertEqual(submission.status, CardSubmissionStatus.PENDING)

                uploaded = self.client.get(submission.image_url)
                self.assertEqual(uploaded.status_code, 200)
                self.assertEqual(uploaded.headers["Content-Type"], "image/png")

                api_submission = self.client.post(
                    "/api/submissions",
                    data=json.dumps(
                        {
                            "name": "Journey Cafe API",
                            "description": "API submission",
                            "websiteUrl": "https://journey.example",
                            "tagsText": "coffee,api",
                        }
                    ),
                    content_type="application/json",
                )
                self.assertEqual(api_submission.status_code, 201)

                suggest_edit = self.client.post(
                    f"/api/cards/{self.card.pk}/suggest-edit",
                    data=json.dumps(
                        {
                            "name": "Roaster One Updated",
                            "description": "Updated by API",
                            "websiteUrl": "https://roaster.example",
                            "phoneNumber": "555-0200",
                            "email": "hello@roaster.example",
                            "address": "100 Roast Way",
                            "contactName": "Sam",
                            "tagsText": "coffee,updated",
                        }
                    ),
                    content_type="application/json",
                )
                self.assertEqual(suggest_edit.status_code, 201)
                modification = CardModification.objects.get(card=self.card, submitter=self.member)
                self.assertEqual(modification.status, CardSubmissionStatus.PENDING)

                history = self.client.get("/api/submissions")
                self.assertEqual(history.status_code, 200)
                kinds = {item["kind"] for item in history.json()}
                self.assertEqual(kinds, {"submission", "modification"})

                self.client.force_login(self.admin)
                approve_submission = self.client.post(
                    reverse("cms:submission_approve", args=[submission.pk])
                )
                self.assertEqual(approve_submission.status_code, 302)
                submission.refresh_from_db()
                self.assertEqual(submission.status, CardSubmissionStatus.APPROVED)

                approve_modification = self.client.post(
                    reverse("cms:modification_approve", args=[modification.pk]),
                    {"review_notes": "Looks good"},
                )
                self.assertEqual(approve_modification.status_code, 302)
                modification.refresh_from_db()
                self.card.refresh_from_db()
                self.assertEqual(modification.status, CardSubmissionStatus.APPROVED)
                self.assertEqual(self.card.name, "Roaster One Updated")

    def test_cms_management_journey(self) -> None:
        review = Review.objects.create(card=self.card, user=self.member, rating=4, reported=True)
        staff_target = User.objects.create_user(
            "target-e2e@example.com",
            "TargetPass!123",
            first_name="Target",
            last_name="Member",
        )
        removable_tag = Tag.objects.create(name="remove-me")

        self.client.force_login(self.admin)
        self.assertEqual(self.client.get(reverse("cms:dashboard")).status_code, 200)
        self.assertEqual(self.client.get(reverse("cms:users_list")).status_code, 200)
        self.assertEqual(self.client.get(reverse("cms:cards_list")).status_code, 200)
        self.assertEqual(self.client.get(reverse("cms:reviews_list")).status_code, 200)
        self.assertEqual(self.client.get(reverse("cms:tags_list")).status_code, 200)

        set_role = self.client.post(
            reverse("cms:user_set_role", args=[staff_target.pk]),
            {"role": User.Role.SUPPORT},
        )
        self.assertEqual(set_role.status_code, 302)
        staff_target.refresh_from_db()
        self.assertEqual(staff_target.role, User.Role.SUPPORT)
        self.assertTrue(staff_target.is_staff)

        toggle_active = self.client.post(reverse("cms:user_toggle_active", args=[staff_target.pk]))
        self.assertEqual(toggle_active.status_code, 302)
        staff_target.refresh_from_db()
        self.assertFalse(staff_target.is_active)

        toggle_review = self.client.post(reverse("cms:review_toggle_hidden", args=[review.pk]))
        self.assertEqual(toggle_review.status_code, 302)
        review.refresh_from_db()
        self.assertTrue(review.hidden)

        delete_tag = self.client.post(reverse("cms:tag_delete", args=[removable_tag.pk]))
        self.assertEqual(delete_tag.status_code, 302)
        self.assertFalse(Tag.objects.filter(pk=removable_tag.pk).exists())


class EventsAndSearchE2ETests(TestCase):
    def setUp(self) -> None:
        self.member = User.objects.create_user(
            "events-member@example.com",
            "MemberPass!123",
            first_name="Event",
            last_name="Member",
            email_verified=True,
        )
        self.admin = User.objects.create_superuser("events-admin@example.com", "AdminPass!123")
        self.event = Event.objects.create(
            title="Community Potluck",
            description="Bring a dish and meet neighbors.",
            location="Main Hall",
            start_at=timezone.now() + timedelta(days=5),
            end_at=timezone.now() + timedelta(days=5, hours=2),
            approved=True,
            creator=self.member,
            approver=self.admin,
            approved_date=timezone.now(),
        )

    def test_events_public_mobile_and_moderation_journey(self) -> None:
        home = self.client.get(reverse("events:home"))
        self.assertEqual(home.status_code, 200)
        self.assertContains(home, "Browse community events by month.")

        detail_redirect = self.client.get(
            reverse("events:event_detail_short", args=[self.event.pk])
        )
        self.assertEqual(detail_redirect.status_code, 302)
        self.assertIn(self.event.slug, detail_redirect.headers["Location"])

        events_api = self.client.get("/api/events")
        self.assertEqual(events_api.status_code, 200)
        self.assertEqual(events_api.json()["events"][0]["title"], self.event.title)

        feed = self.client.get(reverse("events:feed"))
        self.assertEqual(feed.status_code, 200)
        self.assertIn("BEGIN:VCALENDAR", feed.content.decode())
        self.assertIn(self.event.title, feed.content.decode())

        self.client.force_login(self.member)
        submit = self.client.post(
            reverse("events:submit"),
            {
                "title": "Cleanup Day",
                "description": "Park cleanup.",
                "location": "Riverside",
                "start_at": (timezone.now() + timedelta(days=8)).strftime("%Y-%m-%dT%H:%M"),
                "end_at": (timezone.now() + timedelta(days=8, hours=2)).strftime("%Y-%m-%dT%H:%M"),
                "url": "https://example.com/cleanup",
            },
        )
        self.assertEqual(submit.status_code, 302)
        submission = EventSubmission.objects.get(title="Cleanup Day")
        self.assertEqual(submission.status, EventStatus.PENDING)

        my_submissions = self.client.get(reverse("events:my_submissions"))
        self.assertEqual(my_submissions.status_code, 200)

        self.client.force_login(self.admin)
        approve = self.client.post(
            reverse("cms:event_submission_approve", args=[submission.pk]),
            {"review_notes": "Approved"},
        )
        self.assertEqual(approve.status_code, 302)
        submission.refresh_from_db()
        self.assertEqual(submission.status, EventStatus.APPROVED)
        self.assertIsNotNone(submission.event_id)

    def test_search_and_directory_api_journey(self) -> None:
        tag = Tag.objects.create(name="bakery")
        card = Card.objects.create(name="Bakery One", approved=True)
        CardTag.objects.create(card=card, tag=tag)
        ResourceItem.objects.create(
            title="Community Clinic",
            url="https://clinic.example",
            description="Free health services",
            category="Health",
            icon="hospital",
            is_active=True,
        )

        health = self.client.get("/api/health")
        self.assertEqual(health.status_code, 200)

        cards = self.client.get("/api/cards", {"tags": "bakery"})
        self.assertEqual(cards.status_code, 200)
        self.assertEqual(cards.json()["cards"][0]["name"], "Bakery One")

        with patch("apps.search.views._client", return_value=None):
            search_api = self.client.get("/api/cards/search/", {"q": "clinic"})
            self.assertEqual(search_api.status_code, 200)
            body = search_api.json()
            self.assertEqual(body["source"], "local")
            self.assertEqual(body["results"][0]["title"], "Community Clinic")

        search_page = self.client.get(reverse("search:search"))
        self.assertEqual(search_page.status_code, 200)
