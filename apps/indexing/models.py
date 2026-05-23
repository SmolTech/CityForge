from django.db import models
from django.utils import timezone


class IndexingJobStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    RUNNING = "running", "Running"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"


class IndexingJob(models.Model):
    resource_id = models.IntegerField()
    status = models.CharField(
        max_length=20, choices=IndexingJobStatus.choices, default=IndexingJobStatus.PENDING
    )
    pages_indexed = models.IntegerField(blank=True, null=True)
    total_pages = models.IntegerField(blank=True, null=True)
    last_error = models.TextField(blank=True, null=True)
    started_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    retry_count = models.IntegerField(default=0)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "indexing_jobs"
        indexes = [
            models.Index(fields=["resource_id"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"Resource {self.resource_id}: {self.status}"
