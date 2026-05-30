from __future__ import annotations

import json
import os
import socket
from datetime import timedelta
from typing import Any
from urllib.parse import urlparse

import requests
from django.utils import timezone

from .models import WebhookDelivery, WebhookDeliveryStatus, WebhookEndpoint, WebhookEvent

DEFAULT_MAX_RETRIES = 3


# Private/internal IP ranges that should be blocked for webhook URLs.
_BLOCKED_NETWORKS = [
    "127.",
    "10.",
    "172.16.",
    "172.17.",
    "172.18.",
    "172.19.",
    "172.20.",
    "172.21.",
    "172.22.",
    "172.23.",
    "172.24.",
    "172.25.",
    "172.26.",
    "172.27.",
    "172.28.",
    "172.29.",
    "172.30.",
    "172.31.",
    "192.168.",
    "169.254.",
    "0.",
    "::1",
    "fc00:",
    "fe80:",
]


def _is_safe_webhook_url(url: str) -> bool:
    """Prevent SSRF by rejecting internal URLs and non-HTTPS endpoints."""
    parsed = urlparse(url)
    if parsed.scheme != "https":
        return False
    hostname = parsed.hostname or ""
    try:
        # Resolve hostname to check for internal IPs.
        resolved = socket.getaddrinfo(hostname, None)[0][4][0]
        if any(resolved.startswith(net) for net in _BLOCKED_NETWORKS):
            return False
    except socket.gaierror:
        pass
    if any(hostname.startswith(net) for net in _BLOCKED_NETWORKS):
        return False
    return True


def _parse_json(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def _endpoint_supports_event(endpoint: WebhookEndpoint, event_type: str) -> bool:
    events = _parse_json(endpoint.events, [])
    if not isinstance(events, list):
        return False
    return "*" in events or event_type in events


def _delivery_max_retries(endpoint: WebhookEndpoint) -> int:
    policy = _parse_json(endpoint.retry_policy, {})
    if isinstance(policy, dict):
        raw = policy.get("max_retries", policy.get("maxRetries", DEFAULT_MAX_RETRIES))
        try:
            return max(0, int(raw))
        except (TypeError, ValueError):
            return DEFAULT_MAX_RETRIES
    return DEFAULT_MAX_RETRIES


def _delivery_headers(endpoint: WebhookEndpoint) -> dict[str, str]:
    headers: dict[str, str] = {"Content-Type": "application/json"}
    custom_headers = _parse_json(endpoint.headers, {})
    if isinstance(custom_headers, dict):
        for key, value in custom_headers.items():
            if isinstance(key, str) and isinstance(value, str):
                headers[key] = value
    if endpoint.secret:
        headers.setdefault("X-Webhook-Secret", endpoint.secret)
    return headers


def _format_mattermost_payload(event_type: str, data: dict[str, Any]) -> dict[str, Any]:
    timestamp = data.get("timestamp") or timezone.now().isoformat()
    environment = data.get("environment", "production")
    stats = data.get("stats", {})
    if not isinstance(stats, dict):
        stats = {}

    if event_type == "admin.digest.daily":
        summary_lines = [
            f"- **{key.replace('_', ' ').title()}**: {value}" for key, value in stats.items()
        ]
        summary = "\n".join(summary_lines) if summary_lines else "- No metrics reported"
        return {
            "text": f":cityscape: **CityForge Admin Digest** (`{environment}`)",
            "attachments": [
                {
                    "color": "#3D8CFF",
                    "title": event_type,
                    "text": f"**Generated:** {timestamp}\n\n{summary}",
                }
            ],
        }

    change_text = str(data.get("change_text") or "").strip() or "No change details provided."
    content_url = str(data.get("content_url") or "").strip()
    title = str(data.get("content_title") or data.get("title") or event_type)
    details = [f"**Change:** {change_text}"]
    if content_url:
        details.append(f"**Content URL:** [Open item]({content_url})")

    changed_fields = data.get("changed_fields")
    changed_lines: list[str] = []
    if isinstance(changed_fields, list):
        for item in changed_fields:
            if not isinstance(item, dict):
                continue
            field = str(item.get("field") or "").strip()
            if not field:
                continue
            old_value = str(item.get("old_value") or "").strip() or "—"
            new_value = str(item.get("new_value") or "").strip() or "—"
            changed_lines.append(f"- **{field}**: {old_value} → {new_value}")
    if changed_lines:
        details.append("**Changed content:**\n" + "\n".join(changed_lines))

    summary_lines = [
        f"- **{key.replace('_', ' ').title()}**: {value}" for key, value in stats.items()
    ]
    if summary_lines:
        details.append("**Additional details:**\n" + "\n".join(summary_lines))

    return {
        "text": f":bell: **CityForge Event** (`{environment}`)",
        "attachments": [
            {
                "color": "#2ECC71",
                "title": f"{title} ({event_type})",
                "text": f"**Generated:** {timestamp}\n\n" + "\n\n".join(details),
            }
        ],
    }


def _event_payload(
    endpoint: WebhookEndpoint, event_type: str, data: dict[str, Any]
) -> dict[str, Any]:
    if endpoint.format == "mattermost":
        return _format_mattermost_payload(event_type, data)
    return {"event_type": event_type, "data": data}


def dispatch_event(
    event_type: str,
    data: dict[str, Any],
    *,
    environment: str | None = None,
    source_info: str = "management-command",
) -> tuple[WebhookEvent, int]:
    event = WebhookEvent.objects.create(
        type=event_type,
        data=json.dumps(data),
        timestamp=timezone.now(),
        environment=environment or os.getenv("DEPLOY_ENV", "production"),
        source_info=source_info,
    )

    deliveries = 0
    endpoints = WebhookEndpoint.objects.filter(enabled=True).order_by("created_at")
    for endpoint in endpoints:
        if not _endpoint_supports_event(endpoint, event_type):
            continue

        max_retries = _delivery_max_retries(endpoint)
        delivery = WebhookDelivery.objects.create(
            webhook_endpoint=endpoint,
            event=event,
            event_type=event_type,
            status=WebhookDeliveryStatus.PENDING,
            max_retries=max_retries,
        )
        deliveries += 1

        if not _is_safe_webhook_url(endpoint.url):
            delivery.status = WebhookDeliveryStatus.FAILED
            delivery.attempt = 1
            delivery.last_attempt_at = timezone.now()
            delivery.error_message = "Webhook URL is not allowed (must use HTTPS and not resolve to an internal address)."
            delivery.save()
            continue

        try:
            response = requests.post(
                endpoint.url,
                json=_event_payload(endpoint, event_type, data),
                headers=_delivery_headers(endpoint),
                timeout=endpoint.timeout_seconds or 30,
            )
            delivery.status = (
                WebhookDeliveryStatus.SENT
                if 200 <= response.status_code < 300
                else WebhookDeliveryStatus.FAILED
            )
            delivery.attempt = 1
            delivery.last_attempt_at = timezone.now()
            delivery.response_status = response.status_code
            delivery.response_headers = json.dumps(dict(response.headers))
            delivery.response_body = response.text[:4000]
            if delivery.status == WebhookDeliveryStatus.FAILED and max_retries > 1:
                delivery.next_retry_at = timezone.now() + timedelta(minutes=5)
        except requests.RequestException as exc:
            delivery.status = WebhookDeliveryStatus.FAILED
            delivery.attempt = 1
            delivery.last_attempt_at = timezone.now()
            delivery.error_message = str(exc)
            if max_retries > 1:
                delivery.next_retry_at = timezone.now() + timedelta(minutes=5)
        delivery.save()

    return event, deliveries
