from __future__ import annotations

from unittest.mock import patch

from django.http import HttpResponse
from django.test import TestCase
from django.urls import reverse

from apps.accounts.models import User
from apps.directory.models import Card, CardSubmission, CardSubmissionStatus, Review, Tag
from apps.resources.models import ResourceConfig


class CmsAccessTests(TestCase):
    def setUp(self) -> None:
        self.admin = User.objects.create_superuser("admin@example.com", "AdminPass!123")
        self.staff = User.objects.create_user(
            "staff@example.com",
            "StaffPass!123",
            first_name="Staff",
            last_name="User",
            role=User.Role.SUPPORT,
            is_staff=True,
        )
        self.user = User.objects.create_user(
            "user@example.com",
            "UserPass!123",
            first_name="User",
            last_name="Member",
        )

    def test_dashboard_permissions(self) -> None:
        response = self.client.get(reverse("cms:dashboard"))
        self.assertEqual(response.status_code, 302)

        self.client.force_login(self.user)
        forbidden = self.client.get(reverse("cms:dashboard"))
        self.assertEqual(forbidden.status_code, 403)

        self.client.force_login(self.staff)
        with patch("apps.cms.views.render", return_value=HttpResponse("ok")):
            allowed = self.client.get(reverse("cms:dashboard"))
        self.assertEqual(allowed.status_code, 200)

    def test_site_settings_update_persists_config(self) -> None:
        self.client.force_login(self.admin)
        response = self.client.post(
            reverse("cms:site_settings"),
            {"site_name": "CityForge Test", "site_tagline": "Better together"},
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("cms:site_settings"))
        self.assertEqual(ResourceConfig.objects.get(key="site_name").value, "CityForge Test")


class CmsMutationTests(TestCase):
    def setUp(self) -> None:
        self.admin = User.objects.create_superuser("admin2@example.com", "AdminPass!123")
        self.other_admin = User.objects.create_superuser("admin3@example.com", "AdminPass!123")
        self.member = User.objects.create_user(
            "member@example.com",
            "MemberPass!123",
            first_name="Member",
            last_name="User",
        )
        self.card = Card.objects.create(name="Managed Card", approved=True, creator=self.member)
        self.review = Review.objects.create(card=self.card, user=self.member, rating=4)
        self.submission = CardSubmission.objects.create(
            name="Pending Business",
            submitter=self.member,
            status=CardSubmissionStatus.PENDING,
            tags_text="coffee, bakery",
        )

    def test_user_toggle_active_protects_self(self) -> None:
        self.client.force_login(self.admin)
        response = self.client.post(reverse("cms:user_toggle_active", args=[self.admin.pk]))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("cms:users_list"))
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_user_set_role_updates_target_role(self) -> None:
        self.client.force_login(self.admin)
        response = self.client.post(
            reverse("cms:user_set_role", args=[self.member.pk]),
            {"role": User.Role.SUPPORT},
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("cms:users_list"))
        self.member.refresh_from_db()
        self.assertEqual(self.member.role, User.Role.SUPPORT)
        self.assertTrue(self.member.is_staff)

    def test_submission_approve_creates_card_and_tags(self) -> None:
        self.client.force_login(self.admin)
        response = self.client.post(reverse("cms:submission_approve", args=[self.submission.pk]))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("cms:submissions_list"))
        self.submission.refresh_from_db()
        self.assertEqual(self.submission.status, CardSubmissionStatus.APPROVED)
        self.assertIsNotNone(self.submission.card)
        self.assertTrue(Tag.objects.filter(name="coffee").exists())

    def test_submission_reject_marks_reviewed(self) -> None:
        self.client.force_login(self.admin)
        response = self.client.post(
            reverse("cms:submission_reject", args=[self.submission.pk]),
            {"review_notes": "Needs more detail"},
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("cms:submissions_list"))
        self.submission.refresh_from_db()
        self.assertEqual(self.submission.status, CardSubmissionStatus.REJECTED)
        self.assertEqual(self.submission.reviewer_id, self.admin.pk)

    def test_review_toggle_hidden(self) -> None:
        self.client.force_login(self.admin)
        response = self.client.post(reverse("cms:review_toggle_hidden", args=[self.review.pk]))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("cms:reviews_list"))
        self.review.refresh_from_db()
        self.assertTrue(self.review.hidden)
