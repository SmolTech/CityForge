from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify


class Tag(models.Model):
    name = models.CharField(max_length=500, unique=True)
    created_date = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "tags"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Card(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    website_url = models.CharField(max_length=255, blank=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    email = models.CharField(max_length=100, blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    address_override_url = models.CharField(max_length=500, blank=True, null=True)
    contact_name = models.CharField(max_length=100, blank=True, null=True)
    featured = models.BooleanField(default=False)
    image_url = models.CharField(max_length=255, blank=True, null=True)

    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="created_cards",
        on_delete=models.SET_NULL,
        blank=True, null=True,
        db_column="created_by",
    )
    approved = models.BooleanField(default=False)
    approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="approved_cards",
        on_delete=models.SET_NULL,
        blank=True, null=True,
        db_column="approved_by",
    )
    approved_date = models.DateTimeField(blank=True, null=True)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(auto_now=True)

    tags = models.ManyToManyField(Tag, through="CardTag", related_name="cards")

    class Meta:
        db_table = "cards"
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["approved"]),
            models.Index(fields=["created_date"]),
            models.Index(fields=["approved", "created_date"]),
        ]
        ordering = ["-featured", "name"]

    def __str__(self) -> str:
        return self.name

    @property
    def slug(self) -> str:
        return slugify(self.name)

    def average_rating(self) -> float | None:
        ratings = list(
            self.reviews.filter(hidden=False).values_list("rating", flat=True)
        )
        if not ratings:
            return None
        return sum(ratings) / len(ratings)

    def review_count(self) -> int:
        return self.reviews.filter(hidden=False).count()


class CardTag(models.Model):
    card = models.ForeignKey(Card, on_delete=models.CASCADE, db_column="card_id")
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, db_column="tag_id")

    class Meta:
        db_table = "card_tags"
        unique_together = (("card", "tag"),)
        indexes = [models.Index(fields=["tag"])]


class CardSubmissionStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"


class CardSubmission(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    website_url = models.CharField(max_length=255, blank=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    email = models.CharField(max_length=100, blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    address_override_url = models.CharField(max_length=500, blank=True, null=True)
    contact_name = models.CharField(max_length=100, blank=True, null=True)
    image_url = models.CharField(max_length=255, blank=True, null=True)
    tags_text = models.TextField(blank=True, null=True)

    status = models.CharField(
        max_length=20,
        choices=CardSubmissionStatus.choices,
        default=CardSubmissionStatus.PENDING,
    )
    submitter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="card_submissions",
        on_delete=models.CASCADE,
        db_column="submitted_by",
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="reviewed_submissions",
        on_delete=models.SET_NULL,
        blank=True, null=True,
        db_column="reviewed_by",
    )
    review_notes = models.TextField(blank=True, null=True)
    card = models.ForeignKey(
        Card, on_delete=models.SET_NULL, blank=True, null=True,
        related_name="submissions",
    )
    created_date = models.DateTimeField(default=timezone.now)
    reviewed_date = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "card_submissions"
        ordering = ["-created_date"]


class CardModification(models.Model):
    card = models.ForeignKey(Card, on_delete=models.CASCADE, related_name="modifications")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    website_url = models.CharField(max_length=255, blank=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    email = models.CharField(max_length=100, blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    address_override_url = models.CharField(max_length=500, blank=True, null=True)
    contact_name = models.CharField(max_length=100, blank=True, null=True)
    image_url = models.CharField(max_length=255, blank=True, null=True)
    tags_text = models.TextField(blank=True, null=True)

    status = models.CharField(
        max_length=20, choices=CardSubmissionStatus.choices,
        default=CardSubmissionStatus.PENDING,
    )
    submitter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="card_modifications",
        on_delete=models.CASCADE,
        db_column="submitted_by",
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="reviewed_modifications",
        on_delete=models.SET_NULL,
        blank=True, null=True,
        db_column="reviewed_by",
    )
    review_notes = models.TextField(blank=True, null=True)
    created_date = models.DateTimeField(default=timezone.now)
    reviewed_date = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "card_modifications"
        ordering = ["-created_date"]


class Review(models.Model):
    card = models.ForeignKey(Card, on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews"
    )
    rating = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=200, blank=True, null=True)
    comment = models.TextField(blank=True, null=True)
    reported = models.BooleanField(default=False)
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="reported_reviews",
        on_delete=models.SET_NULL,
        blank=True, null=True,
        db_column="reported_by",
    )
    reported_date = models.DateTimeField(blank=True, null=True)
    reported_reason = models.TextField(blank=True, null=True)
    hidden = models.BooleanField(default=False)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "reviews"
        indexes = [
            models.Index(fields=["card"]),
            models.Index(fields=["user"]),
            models.Index(fields=["hidden"]),
            models.Index(fields=["reported"]),
            models.Index(fields=["created_date"]),
        ]
        ordering = ["-created_date"]
