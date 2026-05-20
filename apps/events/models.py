from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify


class EventStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"


class Event(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    location = models.CharField(max_length=255, blank=True, null=True)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField(blank=True, null=True)
    url = models.CharField(max_length=500, blank=True, null=True)
    all_day = models.BooleanField(default=False)

    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="created_events",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        db_column="created_by",
    )
    approved = models.BooleanField(default=False)
    approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="approved_events",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        db_column="approved_by",
    )
    approved_date = models.DateTimeField(blank=True, null=True)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "events"
        ordering = ["start_at", "title"]
        indexes = [
            models.Index(fields=["approved", "start_at"]),
            models.Index(fields=["start_at"]),
        ]

    def __str__(self) -> str:
        return self.title

    @property
    def slug(self) -> str:
        return slugify(self.title)


class EventSubmission(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    location = models.CharField(max_length=255, blank=True, null=True)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField(blank=True, null=True)
    url = models.CharField(max_length=500, blank=True, null=True)
    all_day = models.BooleanField(default=False)

    status = models.CharField(
        max_length=20,
        choices=EventStatus.choices,
        default=EventStatus.PENDING,
    )
    submitter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="event_submissions",
        on_delete=models.CASCADE,
        db_column="submitted_by",
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="reviewed_event_submissions",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        db_column="reviewed_by",
    )
    review_notes = models.TextField(blank=True, null=True)
    event = models.ForeignKey(
        Event,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="submissions",
    )
    created_date = models.DateTimeField(default=timezone.now)
    reviewed_date = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "event_submissions"
        ordering = ["-created_date"]

    def __str__(self) -> str:
        return self.title

