from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.accounts.models import User
from apps.events.models import Event, EventStatus, EventSubmission


class EventFeatureTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            "eventer@example.com",
            "EventPass!123",
            first_name="Event",
            last_name="User",
            email_verified=True,
        )
        self.admin = User.objects.create_superuser("admin-events@example.com", "AdminPass!123")
        now = timezone.now()
        self.event = Event.objects.create(
            title="Neighborhood Potluck",
            description="Bring a dish and meet your neighbors.",
            location="Community Center",
            start_at=now + timedelta(days=7),
            end_at=now + timedelta(days=7, hours=2),
            approved=True,
            creator=self.user,
            approver=self.admin,
            approved_date=now,
        )

    def test_events_api_returns_approved_events(self) -> None:
        response = self.client.get("/api/events")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body["events"]), 1)
        self.assertEqual(body["events"][0]["title"], "Neighborhood Potluck")

    def test_public_views_render_and_feed_includes_events(self) -> None:
        self.assertEqual(self.client.get(reverse("events:home")).status_code, 200)
        self.assertEqual(self.client.get(reverse("events:calendar")).status_code, 200)
        feed = self.client.get(reverse("events:feed"))
        self.assertEqual(feed.status_code, 200)
        self.assertEqual(feed.headers["Content-Type"], "text/calendar; charset=utf-8")
        self.assertIn("Neighborhood Potluck", feed.content.decode())

    def test_event_submission_creates_pending_submission(self) -> None:
        self.client.force_login(self.user)
        with patch("apps.events.views.dispatch_event") as mocked_dispatch:
            response = self.client.post(
                reverse("events:submit"),
                {
                    "title": "Community Cleanup",
                    "description": "Help clean the park.",
                    "location": "Riverside Park",
                    "start_at": (timezone.now() + timedelta(days=10)).strftime("%Y-%m-%dT%H:%M"),
                    "end_at": (timezone.now() + timedelta(days=10, hours=2)).strftime(
                        "%Y-%m-%dT%H:%M"
                    ),
                    "url": "https://example.com/cleanup",
                },
            )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("events:home"))
        submission = EventSubmission.objects.get(title="Community Cleanup")
        self.assertEqual(submission.status, EventStatus.PENDING)
        mocked_dispatch.assert_called_once()
        self.assertEqual(mocked_dispatch.call_args.args[0], "event.submitted")

    def test_calendar_detail_redirects_to_canonical_slug(self) -> None:
        response = self.client.get(reverse("events:event_detail_short", args=[self.event.pk]))
        self.assertEqual(response.status_code, 302)
        self.assertIn(self.event.slug, response.headers["Location"])
