from __future__ import annotations

from django import forms

from .models import EventSubmission


class EventSubmissionForm(forms.ModelForm):
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

    def clean(self):
        cleaned = super().clean()
        start_at = cleaned.get("start_at")
        end_at = cleaned.get("end_at")
        if start_at and end_at and end_at < start_at:
            raise forms.ValidationError("End time must be after start time.")
        return cleaned
