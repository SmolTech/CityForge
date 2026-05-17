from django.conf import settings
from django.db import models
from django.utils import timezone


class ForumCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    slug = models.CharField(max_length=120, unique=True)
    display_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        db_column="created_by", related_name="forum_categories",
    )
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "forum_categories"
        ordering = ["display_order", "name"]


class ForumCategoryRequest(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    justification = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, default="pending")
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        db_column="requested_by", related_name="forum_category_requests",
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        blank=True, null=True, db_column="reviewed_by",
        related_name="reviewed_forum_category_requests",
    )
    created_date = models.DateTimeField(default=timezone.now)
    reviewed_date = models.DateTimeField(blank=True, null=True)
    review_notes = models.TextField(blank=True, null=True)
    category = models.ForeignKey(
        ForumCategory, on_delete=models.SET_NULL, blank=True, null=True,
        related_name="requests",
    )

    class Meta:
        db_table = "forum_category_requests"
        indexes = [models.Index(fields=["status"])]


class ForumThread(models.Model):
    category = models.ForeignKey(
        ForumCategory, on_delete=models.CASCADE, related_name="threads",
    )
    title = models.CharField(max_length=255)
    slug = models.CharField(max_length=280)
    is_pinned = models.BooleanField(default=False)
    is_locked = models.BooleanField(default=False)
    report_count = models.IntegerField(default=0)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        db_column="created_by", related_name="forum_threads",
    )
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "forum_threads"
        ordering = ["-is_pinned", "-updated_date"]


class ForumPost(models.Model):
    thread = models.ForeignKey(
        ForumThread, on_delete=models.CASCADE, related_name="posts",
    )
    content = models.TextField()
    is_first_post = models.BooleanField(default=False)
    report_count = models.IntegerField(default=0)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        db_column="created_by", related_name="forum_posts",
    )
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(auto_now=True)
    editor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        blank=True, null=True, db_column="edited_by",
        related_name="edited_forum_posts",
    )
    edited_date = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "forum_posts"


class ForumReport(models.Model):
    thread = models.ForeignKey(ForumThread, on_delete=models.CASCADE, related_name="reports")
    post = models.ForeignKey(
        ForumPost, on_delete=models.CASCADE, blank=True, null=True, related_name="reports",
    )
    reason = models.CharField(max_length=50)
    details = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, default="pending")
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        db_column="reported_by", related_name="forum_reports",
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        blank=True, null=True, db_column="reviewed_by",
        related_name="reviewed_forum_reports",
    )
    created_date = models.DateTimeField(default=timezone.now)
    reviewed_date = models.DateTimeField(blank=True, null=True)
    resolution_notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "forum_reports"
