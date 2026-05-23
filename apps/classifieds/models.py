from django.conf import settings
from django.db import models
from django.utils import timezone


class HelpWantedPostStatus(models.TextChoices):
    OPEN = "open", "Open"
    CLOSED = "closed", "Closed"


class HelpWantedReportStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"


class HelpWantedPost(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField()
    category = models.CharField(max_length=50)
    status = models.CharField(
        max_length=20, choices=HelpWantedPostStatus.choices, default=HelpWantedPostStatus.OPEN
    )
    location = models.CharField(max_length=255, blank=True, null=True)
    budget = models.CharField(max_length=100, blank=True, null=True)
    contact_preference = models.CharField(max_length=50, blank=True, null=True)
    report_count = models.IntegerField(default=0)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        db_column="created_by",
        related_name="help_wanted_posts",
    )
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "help_wanted_posts"
        ordering = ["-created_date"]

    def __str__(self) -> str:
        return self.title


class HelpWantedComment(models.Model):
    post = models.ForeignKey(
        HelpWantedPost,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    content = models.TextField()
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name="replies",
    )
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        db_column="created_by",
        related_name="help_wanted_comments",
    )
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "help_wanted_comments"

    def __str__(self) -> str:
        return f"Comment on {self.post}"


class HelpWantedReport(models.Model):
    post = models.ForeignKey(HelpWantedPost, on_delete=models.CASCADE, related_name="reports")
    reason = models.CharField(max_length=50)
    details = models.TextField(blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=HelpWantedReportStatus.choices,
        default=HelpWantedReportStatus.PENDING,
    )
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        db_column="reported_by",
        related_name="help_wanted_reports",
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        db_column="reviewed_by",
        related_name="reviewed_help_wanted_reports",
    )
    created_date = models.DateTimeField(default=timezone.now)
    reviewed_date = models.DateTimeField(blank=True, null=True)
    resolution_notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "help_wanted_reports"

    def __str__(self) -> str:
        return f"Report for {self.post}"
