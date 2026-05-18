from django.contrib import admin

from .models import WebhookDelivery, WebhookEndpoint, WebhookEvent


@admin.register(WebhookEndpoint)
class WebhookEndpointAdmin(admin.ModelAdmin):
    list_display = ("name", "format", "enabled", "timeout_seconds", "updated_at")
    list_filter = ("enabled", "format")
    search_fields = ("name", "url")


@admin.register(WebhookEvent)
class WebhookEventAdmin(admin.ModelAdmin):
    list_display = ("type", "environment", "timestamp", "created_at")
    list_filter = ("type", "environment")
    search_fields = ("type",)


@admin.register(WebhookDelivery)
class WebhookDeliveryAdmin(admin.ModelAdmin):
    list_display = ("event_type", "webhook_endpoint", "status", "attempt", "created_at")
    list_filter = ("status", "event_type")
    search_fields = ("event_type", "webhook_endpoint__name")
