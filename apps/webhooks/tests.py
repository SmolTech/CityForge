from django.test import TestCase

from apps.webhooks.models import WebhookDelivery, WebhookEndpoint, WebhookEvent


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
