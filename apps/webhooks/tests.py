from __future__ import annotations

from unittest.mock import Mock, patch

from django.core.management import call_command
from django.test import TestCase, override_settings

from apps.accounts.models import User
from apps.directory.models import Card, CardSubmission, CardSubmissionStatus
from apps.webhooks.models import WebhookDelivery, WebhookEndpoint, WebhookEvent
from apps.webhooks.service import dispatch_event


class WebhookModelTests(TestCase):
    def test_string_representations(self) -> None:
        endpoint = WebhookEndpoint.objects.create(
            name="Main hook",
            url="https://hooks.example.com",
            events='["resource.updated"]',
        )
        event = WebhookEvent.objects.create(
            type="resource.updated",
            data='{"id":1}',
            timestamp="2025-01-01T00:00:00Z",
            environment="test",
            source_info="unit-test",
        )
        delivery = WebhookDelivery.objects.create(
            webhook_endpoint=endpoint,
            event=event,
            event_type="resource.updated",
            status="pending",
            max_retries=3,
        )
        self.assertEqual(str(endpoint), "Main hook")
        self.assertEqual(str(event), "resource.updated")
        self.assertIn("resource.updated", str(delivery))


class WebhookDispatchTests(TestCase):
    @patch("apps.webhooks.service.requests.post")
    def test_dispatch_sends_mattermost_payload_and_records_delivery(
        self, mocked_post: Mock
    ) -> None:
        mocked_response = Mock(status_code=200, text="ok", headers={"X-Test": "1"})
        mocked_post.return_value = mocked_response

        endpoint = WebhookEndpoint.objects.create(
            name="Mattermost",
            url="https://mattermost.example/hooks/abc",
            events='["admin.digest.daily"]',
            format="mattermost",
        )
        event, deliveries = dispatch_event(
            "admin.digest.daily",
            {"timestamp": "2026-01-01T00:00:00Z", "stats": {"total_users": 5}},
            environment="test",
            source_info="unit-test",
        )

        self.assertEqual(deliveries, 1)
        delivery = WebhookDelivery.objects.get(webhook_endpoint=endpoint, event=event)
        self.assertEqual(delivery.status, "sent")
        self.assertEqual(delivery.response_status, 200)
        self.assertEqual(delivery.attempt, 1)
        payload = mocked_post.call_args.kwargs["json"]
        self.assertIn("CityForge Admin Digest", payload["text"])

    @patch("apps.webhooks.service.requests.post")
    def test_dispatch_skips_unsubscribed_endpoints(self, mocked_post: Mock) -> None:
        WebhookEndpoint.objects.create(
            name="Other event",
            url="https://mattermost.example/hooks/xyz",
            events='["other.event"]',
            format="mattermost",
        )
        _event, deliveries = dispatch_event(
            "admin.digest.daily",
            {"stats": {"total_users": 1}},
            environment="test",
            source_info="unit-test",
        )
        self.assertEqual(deliveries, 0)
        mocked_post.assert_not_called()

    @patch("apps.webhooks.service.requests.post")
    def test_dispatch_formats_runtime_event_with_change_text_and_url(
        self, mocked_post: Mock
    ) -> None:
        mocked_response = Mock(status_code=200, text="ok", headers={"X-Test": "1"})
        mocked_post.return_value = mocked_response

        WebhookEndpoint.objects.create(
            name="Mattermost",
            url="https://mattermost.example/hooks/runtime",
            events='["submission.approved"]',
            format="mattermost",
        )
        dispatch_event(
            "submission.approved",
            {
                "change_text": "admin approved submission.",
                "content_url": "https://cityforge.example/business/1/my-business/",
                "content_title": "My Business",
            },
            environment="test",
            source_info="unit-test",
        )

        payload = mocked_post.call_args.kwargs["json"]
        attachment = payload["attachments"][0]
        self.assertIn("Change", attachment["text"])
        self.assertIn("admin approved submission.", attachment["text"])
        self.assertIn("Open item", attachment["text"])
        self.assertIn("submission.approved", attachment["title"])

    @patch("apps.webhooks.service.requests.post")
    def test_dispatch_formats_runtime_event_with_changed_fields_only(
        self, mocked_post: Mock
    ) -> None:
        mocked_response = Mock(status_code=200, text="ok", headers={"X-Test": "1"})
        mocked_post.return_value = mocked_response

        WebhookEndpoint.objects.create(
            name="Mattermost",
            url="https://mattermost.example/hooks/runtime-fields",
            events='["modification.approved"]',
            format="mattermost",
        )
        dispatch_event(
            "modification.approved",
            {
                "change_text": "admin approved 2 change(s).",
                "changed_fields": [
                    {
                        "field": "Description",
                        "old_value": "Old content",
                        "new_value": "Updated content",
                    },
                    {"field": "Phone", "old_value": "555-0000", "new_value": "555-0100"},
                ],
                "content_url": "https://cityforge.example/business/1/my-business/",
                "content_title": "My Business",
            },
            environment="test",
            source_info="unit-test",
        )

        payload = mocked_post.call_args.kwargs["json"]
        attachment = payload["attachments"][0]
        self.assertIn("Changed content", attachment["text"])
        self.assertIn("Description", attachment["text"])
        self.assertIn("Phone", attachment["text"])
        self.assertIn("Old content → Updated content", attachment["text"])


class AdminDigestCommandTests(TestCase):
    @override_settings(ALLOWED_HOSTS=["testserver"])
    @patch("apps.webhooks.management.commands.send_admin_digest.dispatch_event")
    def test_command_dispatches_digest_when_enabled(self, mocked_dispatch: Mock) -> None:
        User.objects.create_user(
            email="user@example.com",
            password="Password123!",
            first_name="A",
            last_name="User",
        )
        Card.objects.create(name="Approved Card", approved=True)
        submitter = User.objects.create_user(
            email="submitter@example.com",
            password="Password123!",
            first_name="B",
            last_name="User",
        )
        CardSubmission.objects.create(
            name="Pending Card",
            submitter=submitter,
            status=CardSubmissionStatus.PENDING,
        )

        mocked_dispatch.return_value = (Mock(), 1)
        with patch.dict("os.environ", {"WEBHOOKS_ENABLED": "true"}, clear=False):
            call_command("send_admin_digest")

        mocked_dispatch.assert_called_once()
        args, kwargs = mocked_dispatch.call_args
        self.assertEqual(args[0], "admin.digest.daily")
        self.assertIn("stats", args[1])
        self.assertEqual(args[1]["stats"]["total_users"], 2)
        self.assertEqual(args[1]["stats"]["approved_cards"], 1)

    @patch("apps.webhooks.management.commands.send_admin_digest.dispatch_event")
    def test_command_skips_when_disabled(self, mocked_dispatch: Mock) -> None:
        with patch.dict("os.environ", {"WEBHOOKS_ENABLED": "false"}, clear=False):
            call_command("send_admin_digest")
        mocked_dispatch.assert_not_called()
