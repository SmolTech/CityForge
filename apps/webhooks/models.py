import uuid

from django.db import models
from django.utils import timezone


def _cuid() -> str:
    return uuid.uuid4().hex


class WebhookEndpoint(models.Model):
    id = models.CharField(primary_key=True, max_length=32, default=_cuid, editable=False)
    name = models.CharField(max_length=255)
    url = models.CharField(max_length=500)
    secret = models.CharField(max_length=255, blank=True, null=True)
    enabled = models.BooleanField(default=True)
    events = models.TextField(help_text="JSON array of event types")
    headers = models.TextField(blank=True, null=True)
    retry_policy = models.TextField(blank=True, null=True)
    timeout_seconds = models.IntegerField(default=30)
    format = models.CharField(max_length=20, default="mattermost")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "webhook_endpoints"

    def __str__(self) -> str:
        return self.name


class WebhookEvent(models.Model):
    id = models.CharField(primary_key=True, max_length=32, default=_cuid, editable=False)
    type = models.CharField(max_length=100)
    data = models.TextField(help_text="JSON payload")
    timestamp = models.DateTimeField()
    environment = models.CharField(max_length=50)
    source_info = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "webhook_events"
        indexes = [models.Index(fields=["type", "timestamp"])]

    def __str__(self) -> str:
        return self.type


class WebhookDelivery(models.Model):
    id = models.CharField(primary_key=True, max_length=32, default=_cuid, editable=False)
    webhook_endpoint = models.ForeignKey(
        WebhookEndpoint, on_delete=models.CASCADE, related_name="deliveries",
    )
    event = models.ForeignKey(
        WebhookEvent, on_delete=models.CASCADE, related_name="deliveries",
    )
    event_type = models.CharField(max_length=100)
    status = models.CharField(max_length=20)
    attempt = models.IntegerField(default=0)
    max_retries = models.IntegerField()
    next_retry_at = models.DateTimeField(blank=True, null=True)
    last_attempt_at = models.DateTimeField(blank=True, null=True)
    response_status = models.IntegerField(blank=True, null=True)
    response_headers = models.TextField(blank=True, null=True)
    response_body = models.TextField(blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "webhook_deliveries"
        indexes = [
            models.Index(fields=["status", "next_retry_at"]),
            models.Index(fields=["webhook_endpoint", "created_at"]),
            models.Index(fields=["event_type", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.event_type} -> {self.webhook_endpoint}"
