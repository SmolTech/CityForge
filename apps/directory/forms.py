from __future__ import annotations

from django import forms

from .models import Card, CardSubmission, Review


class CardSubmissionForm(forms.ModelForm):
    tags_text = forms.CharField(
        label="Tags",
        required=False,
        help_text="Comma-separated tags (e.g. plumber, 24/7, family-owned).",
        widget=forms.TextInput(),
    )

    class Meta:
        model = CardSubmission
        fields = (
            "name",
            "description",
            "website_url",
            "phone_number",
            "email",
            "address",
            "address_override_url",
            "contact_name",
            "image_url",
            "tags_text",
        )
        widgets = {"description": forms.Textarea(attrs={"rows": 5})}


class CardModerationForm(forms.ModelForm):
    class Meta:
        model = Card
        fields = (
            "name",
            "description",
            "website_url",
            "phone_number",
            "email",
            "address",
            "address_override_url",
            "contact_name",
            "image_url",
            "featured",
            "approved",
        )
        widgets = {"description": forms.Textarea(attrs={"rows": 5})}


class ReviewForm(forms.ModelForm):
    rating = forms.IntegerField(min_value=1, max_value=5)

    class Meta:
        model = Review
        fields = ("rating", "title", "comment")
        widgets = {"comment": forms.Textarea(attrs={"rows": 4})}
