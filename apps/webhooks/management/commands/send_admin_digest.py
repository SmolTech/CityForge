from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from typing import Any

from django.core.management.base import BaseCommand
from django.db.models import Count

from apps.accounts.models import User
from apps.classifieds.models import HelpWantedPost, HelpWantedPostStatus
from apps.directory.models import Card, CardSubmission, CardSubmissionStatus, Review
from apps.forums.models import ForumThread
from apps.resources.models import ResourceItem
from apps.webhooks.service import dispatch_event


class Command(BaseCommand):
    help = "Send daily admin digest to configured webhook endpoints."

    def handle(self, *args: Any, **options: Any) -> None:
        if os.getenv("WEBHOOKS_ENABLED", "false").lower() not in {"1", "true", "yes", "on"}:
            self.stdout.write(
                self.style.WARNING("WEBHOOKS_ENABLED is false; skipping webhook digest.")
            )
            return

        now = datetime.now(UTC)
        since = now - timedelta(days=1)
        stats = {
            "total_users": User.objects.count(),
            "total_cards": Card.objects.count(),
            "approved_cards": Card.objects.filter(approved=True).count(),
            "pending_submissions": CardSubmission.objects.filter(
                status=CardSubmissionStatus.PENDING
            ).count(),
            "reviews_24h": Review.objects.filter(created_date__gte=since).count(),
            "new_forum_threads_24h": ForumThread.objects.filter(created_date__gte=since).count(),
            "open_help_posts": HelpWantedPost.objects.filter(
                status=HelpWantedPostStatus.OPEN
            ).count(),
            "active_resources": ResourceItem.objects.filter(is_active=True).count(),
            "new_users_24h": User.objects.filter(created_date__gte=since).count(),
        }

        top_pending = list(
            CardSubmission.objects.filter(status=CardSubmissionStatus.PENDING)
            .values("submitter_id")
            .annotate(total=Count("id"))
            .order_by("-total")[:5]
        )

        payload = {
            "timestamp": now.isoformat(),
            "environment": os.getenv("DEPLOY_ENV", "production"),
            "stats": stats,
            "top_pending_submitters": top_pending,
            "site_url": os.getenv("SITE_URL", ""),
        }

        _event, deliveries = dispatch_event(
            "admin.digest.daily",
            payload,
            environment=os.getenv("DEPLOY_ENV", "production"),
            source_info="send_admin_digest",
        )
        self.stdout.write(
            self.style.SUCCESS(f"Admin digest dispatched to {deliveries} endpoint(s).")
        )
