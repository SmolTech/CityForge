from __future__ import annotations

from django import forms

from .models import Card, CardModification, CardSubmission, Review


class CardSubmissionForm(forms.ModelForm):
    image = forms.ImageField(
        required=False,
        help_text="Upload a JPG, PNG, GIF, or WebP image up to 5 MB.",
        widget=forms.ClearableFileInput(
            attrs={"accept": "image/jpeg,image/png,image/gif,image/webp"}
        ),
    )
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
            "image",
            "tags_text",
        )
        widgets = {"description": forms.Textarea(attrs={"rows": 5})}

    def clean_image(self):
        image = self.cleaned_data.get("image")
        if image and image.size > 5 * 1024 * 1024:
            raise forms.ValidationError("Image must be 5 MB or smaller.")
        return image


class CardModificationForm(forms.ModelForm):
    image = forms.ImageField(
        required=False,
        help_text="Upload a JPG, PNG, GIF, or WebP image up to 5 MB.",
        widget=forms.ClearableFileInput(
            attrs={"accept": "image/jpeg,image/png,image/gif,image/webp"}
        ),
    )
    tags_text = forms.CharField(
        label="Tags",
        required=False,
        help_text="Comma-separated tags (e.g. plumber, 24/7, family-owned).",
        widget=forms.TextInput(),
    )

    class Meta:
        model = CardModification
        fields = (
            "name",
            "description",
            "website_url",
            "phone_number",
            "email",
            "address",
            "address_override_url",
            "contact_name",
            "image",
            "tags_text",
        )
        widgets = {"description": forms.Textarea(attrs={"rows": 5})}

    def clean_image(self):
        image = self.cleaned_data.get("image")
        if image and image.size > 5 * 1024 * 1024:
            raise forms.ValidationError("Image must be 5 MB or smaller.")
        return image


class CardModerationForm(forms.ModelForm):
    tags_text = forms.CharField(required=False, label="Tags (comma-separated)")

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
    rating = forms.TypedChoiceField(
        choices=[(value, "★" * value) for value in range(1, 6)],
        coerce=int,
        empty_value=None,
        widget=forms.RadioSelect,
    )

    class Meta:
        model = Review
        fields = ("rating", "title", "comment")
        widgets = {"comment": forms.Textarea(attrs={"rows": 4})}
