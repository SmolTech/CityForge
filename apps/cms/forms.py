from django import forms


class SiteSettingsForm(forms.Form):
    site_name = forms.CharField(label="Site name", max_length=100)
    site_tagline = forms.CharField(
        label="Site tagline",
        max_length=255,
        required=False,
        widget=forms.TextInput(),
    )
    mattermost_webhook_url = forms.URLField(
        label="Mattermost webhook URL",
        required=False,
        max_length=500,
        help_text="Incoming webhook URL used for daily admin digest delivery.",
    )
    mattermost_webhook_enabled = forms.BooleanField(
        label="Enable Mattermost digest webhook",
        required=False,
    )
