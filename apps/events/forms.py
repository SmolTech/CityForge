from __future__ import annotations

from typing import Any

from django import forms
from django.core.validators import URLValidator

from .models import EventSubmission


class SafeUrlField(forms.URLField):
    """URL field that only permits http and https schemes."""

    default_validators = [URLValidator(schemes=["http", "https"])]


class EventSubmissionForm(forms.ModelForm):
    url = SafeUrlField(required=False)
    start_at = forms.DateTimeField(
        widget=forms.DateTimeInput(attrs={"type": "datetime-local"}),
        input_formats=["%Y-%m-%dT%H:%M", "%Y-%m-%dT%H:%M:%S"],
    )
    end_at = forms.DateTimeField(
        required=False,
        widget=forms.DateTimeInput(attrs={"type": "datetime-local"}),
        input_formats=["%Y-%m-%dT%H:%M", "%Y-%m-%dT%H:%M:%S"],
    )

    class Meta:
        model = EventSubmission
        fields = ("title", "description", "location", "start_at", "end_at", "url", "all_day")
        widgets = {"description": forms.Textarea(attrs={"rows": 5})}

    def clean(self) -> dict[str, Any]:
        cleaned = super().clean() or {}
        start_at = cleaned.get("start_at")
        end_at = cleaned.get("end_at")
        if start_at and end_at and end_at < start_at:
            raise forms.ValidationError("End time must be after start time.")
        return cleaned
