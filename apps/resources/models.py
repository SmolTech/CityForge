from django.db import models
from django.utils import timezone


class ResourceCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    display_order = models.IntegerField(blank=True, null=True)
    created_date = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "resource_categories"
        ordering = ["display_order", "name"]

    def __str__(self) -> str:
        return self.name


class QuickAccessItem(models.Model):
    identifier = models.CharField(max_length=50, unique=True)
    title = models.CharField(max_length=100)
    subtitle = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    color = models.CharField(max_length=20)
    icon = models.CharField(max_length=50)
    display_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_date = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "quick_access_items"
        ordering = ["display_order", "title"]

    def __str__(self) -> str:
        return self.title


class ResourceItem(models.Model):
    title = models.CharField(max_length=200)
    url = models.CharField(max_length=500)
    description = models.TextField()
    category = models.CharField(max_length=100)
    category_obj = models.ForeignKey(
        ResourceCategory,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        db_column="category_id",
        related_name="resource_items",
    )
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.CharField(max_length=500, blank=True, null=True)
    icon = models.CharField(max_length=50)
    display_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "resource_items"
        indexes = [
            models.Index(fields=["category"]),
            models.Index(fields=["title"]),
        ]
        ordering = ["display_order", "title"]

    def __str__(self) -> str:
        return self.title


class ResourceConfig(models.Model):
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField()
    description = models.CharField(max_length=500, blank=True, null=True)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "resource_config"

    def __str__(self) -> str:
        return self.key
