from __future__ import annotations

from unittest.mock import patch

from django.http import HttpResponse
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.accounts.models import User
from apps.cms.views import _modification_comparison_rows
from apps.directory.models import (
    Card,
    CardModification,
    CardSubmission,
    CardSubmissionStatus,
    Review,
    Tag,
)
from apps.events.models import Event, EventStatus, EventSubmission
from apps.resources.models import ResourceConfig
from apps.webhooks.models import WebhookEndpoint


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
            {
                "site_name": "CityForge Test",
                "site_tagline": "Better together",
                "mattermost_webhook_url": "https://mattermost.example/hooks/abc",
                "mattermost_webhook_enabled": "on",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("cms:site_settings"))
        self.assertEqual(ResourceConfig.objects.get(key="site_name").value, "CityForge Test")
        endpoint = WebhookEndpoint.objects.get(name="Mattermost Admin Digest")
        self.assertEqual(endpoint.url, "https://mattermost.example/hooks/abc")
        self.assertTrue(endpoint.enabled)
        self.assertEqual(endpoint.events, '["*"]')

    def test_site_settings_disables_webhook_when_url_removed(self) -> None:
        WebhookEndpoint.objects.create(
            name="Mattermost Admin Digest",
            url="https://mattermost.example/hooks/abc",
            events='["*"]',
            format="mattermost",
            enabled=True,
        )
        self.client.force_login(self.admin)
        response = self.client.post(
            reverse("cms:site_settings"),
            {"site_name": "CityForge Test", "site_tagline": "Better together"},
        )
        self.assertEqual(response.status_code, 302)
        endpoint = WebhookEndpoint.objects.get(name="Mattermost Admin Digest")
        self.assertFalse(endpoint.enabled)

    def test_dashboard_shows_pending_events(self) -> None:
        EventSubmission.objects.create(
            title="Community Picnic",
            description="A casual get-together in the park.",
            location="Central Park",
            start_at=timezone.now(),
            submitter=self.user,
            status=EventStatus.PENDING,
        )
        self.client.force_login(self.staff)
        with patch("apps.cms.views.render", return_value=HttpResponse("ok")) as mocked_render:
            response = self.client.get(reverse("cms:dashboard"))
        self.assertEqual(response.status_code, 200)
        context = mocked_render.call_args.args[2]
        self.assertEqual(context["stats"]["pending_events"], 1)


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
        self.modification = CardModification.objects.create(
            card=self.card,
            name="Managed Card Updated",
            description="Updated by user",
            website_url="https://updated.example",
            phone_number="555-0100",
            email="updated@example.com",
            address="10 Update St",
            contact_name="New Contact",
            tags_text="coffee,updated",
            submitter=self.member,
            status=CardSubmissionStatus.PENDING,
        )
        self.event_submission = EventSubmission.objects.create(
            title="Community Picnic",
            description="A casual get-together in the park.",
            location="Central Park",
            start_at=timezone.now(),
            end_at=timezone.now(),
            url="https://example.com/picnic",
            submitter=self.member,
            status=EventStatus.PENDING,
        )

    @patch("apps.cms.views.dispatch_event")
    def test_user_toggle_active_protects_self(self, mocked_dispatch) -> None:
        self.client.force_login(self.admin)
        response = self.client.post(reverse("cms:user_toggle_active", args=[self.admin.pk]))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("cms:users_list"))
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)
        mocked_dispatch.assert_not_called()

    @patch("apps.cms.views.dispatch_event")
    def test_user_set_role_updates_target_role(self, mocked_dispatch) -> None:
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
        mocked_dispatch.assert_called_once()
        self.assertEqual(mocked_dispatch.call_args.args[0], "user.role_changed")

    @patch("apps.cms.views.dispatch_event")
    def test_submission_approve_creates_card_and_tags(self, mocked_dispatch) -> None:
        self.client.force_login(self.admin)
        response = self.client.post(reverse("cms:submission_approve", args=[self.submission.pk]))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("cms:submissions_list"))
        self.submission.refresh_from_db()
        self.assertEqual(self.submission.status, CardSubmissionStatus.APPROVED)
        self.assertIsNotNone(self.submission.card)
        assert self.submission.card is not None
        self.assertTrue(Tag.objects.filter(name="coffee").exists())
        mocked_dispatch.assert_called_once()
        self.assertEqual(mocked_dispatch.call_args.args[0], "submission.approved")
        payload = mocked_dispatch.call_args.args[1]
        self.assertIn("approved submission", payload["change_text"])
        self.assertIn(str(self.submission.card.id), payload["content_url"])

    @patch("apps.cms.views.dispatch_event")
    def test_submission_reject_marks_reviewed(self, mocked_dispatch) -> None:
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
        mocked_dispatch.assert_called_once()
        self.assertEqual(mocked_dispatch.call_args.args[0], "submission.rejected")
        payload = mocked_dispatch.call_args.args[1]
        self.assertIn("rejected submission", payload["change_text"])
        self.assertIn(str(self.submission.id), payload["content_url"])

    @patch("apps.cms.views.dispatch_event")
    def test_review_toggle_hidden(self, mocked_dispatch) -> None:
        self.client.force_login(self.admin)
        response = self.client.post(reverse("cms:review_toggle_hidden", args=[self.review.pk]))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("cms:reviews_list"))
        self.review.refresh_from_db()
        self.assertTrue(self.review.hidden)
        mocked_dispatch.assert_called_once()
        self.assertEqual(mocked_dispatch.call_args.args[0], "review.visibility_toggled")

    @patch("apps.cms.views.dispatch_event")
    def test_modification_approve_updates_card(self, mocked_dispatch) -> None:
        self.client.force_login(self.admin)
        response = self.client.post(
            reverse("cms:modification_approve", args=[self.modification.pk]),
            {"review_notes": "Looks good"},
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("cms:modifications_list"))
        self.modification.refresh_from_db()
        self.card.refresh_from_db()
        self.assertEqual(self.modification.status, CardSubmissionStatus.APPROVED)
        self.assertEqual(self.card.name, "Managed Card Updated")
        self.assertTrue(Tag.objects.filter(name="updated").exists())
        mocked_dispatch.assert_called_once()
        self.assertEqual(mocked_dispatch.call_args.args[0], "modification.approved")
        payload = mocked_dispatch.call_args.args[1]
        self.assertIn("changed_fields", payload)
        self.assertTrue(payload["changed_fields"])
        field_names = {item["field"] for item in payload["changed_fields"]}
        self.assertNotIn("Address override URL", field_names)
        name_change = next(item for item in payload["changed_fields"] if item["field"] == "Name")
        self.assertEqual(name_change["old_value"], "Managed Card")
        self.assertEqual(name_change["new_value"], "Managed Card Updated")

    @patch("apps.cms.views.dispatch_event")
    def test_modification_reject_marks_reviewed(self, mocked_dispatch) -> None:
        self.client.force_login(self.admin)
        response = self.client.post(
            reverse("cms:modification_reject", args=[self.modification.pk]),
            {"review_notes": "Insufficient evidence"},
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("cms:modifications_list"))
        self.modification.refresh_from_db()
        self.assertEqual(self.modification.status, CardSubmissionStatus.REJECTED)
        self.assertEqual(self.modification.reviewer_id, self.admin.pk)
        mocked_dispatch.assert_called_once()
        self.assertEqual(mocked_dispatch.call_args.args[0], "modification.rejected")

    @patch("apps.cms.views.dispatch_event")
    def test_event_submission_approve_creates_event(self, mocked_dispatch) -> None:
        self.client.force_login(self.admin)
        response = self.client.post(
            reverse("cms:event_submission_approve", args=[self.event_submission.pk]),
            {"review_notes": "Looks good"},
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("cms:event_submissions_list"))
        self.event_submission.refresh_from_db()
        self.assertEqual(self.event_submission.status, EventStatus.APPROVED)
        self.assertIsNotNone(self.event_submission.event)
        self.assertTrue(Event.objects.filter(title="Community Picnic", approved=True).exists())
        mocked_dispatch.assert_called_once()
        self.assertEqual(mocked_dispatch.call_args.args[0], "event.approved")

    @patch("apps.cms.views.dispatch_event")
    def test_event_submission_reject_marks_reviewed(self, mocked_dispatch) -> None:
        self.client.force_login(self.admin)
        response = self.client.post(
            reverse("cms:event_submission_reject", args=[self.event_submission.pk]),
            {"review_notes": "Not enough details"},
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("cms:event_submissions_list"))
        self.event_submission.refresh_from_db()
        self.assertEqual(self.event_submission.status, EventStatus.REJECTED)
        mocked_dispatch.assert_called_once()
        self.assertEqual(mocked_dispatch.call_args.args[0], "event.rejected")

    def test_modification_detail_highlights_changed_fields(self) -> None:
        self.client.force_login(self.admin)
        captured_context: dict = {}

        def fake_render(_request, _template, context):
            captured_context.update(context)
            return HttpResponse("ok")

        with patch("apps.cms.views.render", side_effect=fake_render):
            response = self.client.get(
                reverse("cms:modification_detail", args=[self.modification.pk])
            )

        self.assertEqual(response.status_code, 200)
        self.assertGreater(captured_context["changed_count"], 0)
        changed_rows = [row for row in captured_context["comparison_rows"] if row["changed"]]
        self.assertTrue(changed_rows)
        names = [row for row in captured_context["comparison_rows"] if row["label"] == "Name"]
        self.assertEqual(names[0]["current_value"], "Managed Card")
        self.assertEqual(names[0]["proposed_value"], "Managed Card Updated")

    def test_modification_diff_ignores_whitespace_only_description_changes(self) -> None:
        self.card.description = "Updated by user"
        self.card.save(update_fields=["description"])
        whitespace_mod = CardModification.objects.create(
            card=self.card,
            name=self.card.name,
            description="  Updated   by\nuser  ",
            website_url=self.card.website_url,
            phone_number=self.card.phone_number,
            email=self.card.email,
            address=self.card.address,
            contact_name=self.card.contact_name,
            tags_text="",
            submitter=self.member,
            status=CardSubmissionStatus.PENDING,
        )
        rows = _modification_comparison_rows(whitespace_mod)
        description_rows = [row for row in rows if row["label"] == "Description"]
        self.assertFalse(description_rows[0]["changed"])

    def test_modification_diff_ignores_equivalent_tag_order_and_url_slash(self) -> None:
        self.card.website_url = "https://example.com"
        self.card.save(update_fields=["website_url"])
        coffee = Tag.objects.create(name="coffee-tag")
        bakery = Tag.objects.create(name="bakery-tag")
        self.card.tags.add(coffee, bakery)

        equivalent_mod = CardModification.objects.create(
            card=self.card,
            name=self.card.name,
            description=self.card.description,
            website_url="https://example.com/",
            phone_number=self.card.phone_number,
            email=self.card.email,
            address=self.card.address,
            contact_name=self.card.contact_name,
            tags_text="bakery-tag, coffee-tag",
            submitter=self.member,
            status=CardSubmissionStatus.PENDING,
        )
        rows = _modification_comparison_rows(equivalent_mod)
        website_rows = [row for row in rows if row["label"] == "Website"]
        tags_rows = [row for row in rows if row["label"] == "Tags"]
        self.assertFalse(website_rows[0]["changed"])
        self.assertFalse(tags_rows[0]["changed"])
