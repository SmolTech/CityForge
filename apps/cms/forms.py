from django import forms


class SiteSettingsForm(forms.Form):
    site_name = forms.CharField(label="Site name", max_length=100)
    site_tagline = forms.CharField(
        label="Site tagline",
        max_length=255,
        required=False,
        widget=forms.TextInput(),
    )
