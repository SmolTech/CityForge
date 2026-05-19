from __future__ import annotations

from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

User = get_user_model()


class CaptchaFormMixin:
    def __init__(
        self,
        *args,
        captcha_prompt: str | None = None,
        captcha_expected: str | None = None,
        **kwargs,
    ):
        self._captcha_expected = (captcha_expected or "").strip()
        super().__init__(*args, **kwargs)
        self.fields["captcha_answer"].help_text = captcha_prompt or "Solve the challenge above."

    def clean_captcha_answer(self) -> str:
        answer = (self.cleaned_data.get("captcha_answer") or "").strip()
        if not self._captcha_expected or answer != self._captcha_expected:
            raise ValidationError("Incorrect security check answer.")
        return answer


class RegisterForm(CaptchaFormMixin, forms.ModelForm):
    password1 = forms.CharField(
        label="Password",
        widget=forms.PasswordInput,
        strip=False,
    )
    password2 = forms.CharField(
        label="Confirm password",
        widget=forms.PasswordInput,
        strip=False,
    )
    captcha_answer = forms.CharField(label="Security check")

    class Meta:
        model = User
        fields = ("email", "first_name", "last_name")

    def clean_email(self) -> str:
        email = self.cleaned_data["email"].lower().strip()
        if User.objects.filter(email__iexact=email).exists():
            raise ValidationError("An account with that email already exists.")
        return email

    def clean(self):
        cleaned = super().clean()
        p1 = cleaned.get("password1")
        p2 = cleaned.get("password2")
        if p1 and p2 and p1 != p2:
            self.add_error("password2", "Passwords do not match.")
        if p1:
            try:
                validate_password(p1)
            except ValidationError as exc:
                self.add_error("password1", exc)
        return cleaned

    def save(self, commit: bool = True) -> User:
        user = super().save(commit=False)
        # Password validated above via validate_password() in clean().
        password = self.cleaned_data["password1"]
        user.set_password(  # nosemgrep: python.django.security.audit.unvalidated-password.unvalidated-password
            password
        )
        if commit:
            user.save()
        return user


class LoginForm(forms.Form):
    email = forms.EmailField()
    password = forms.CharField(widget=forms.PasswordInput, strip=False)


class ForgotPasswordForm(CaptchaFormMixin, forms.Form):
    email = forms.EmailField()
    captcha_answer = forms.CharField(label="Security check")


class ResetPasswordForm(CaptchaFormMixin, forms.Form):
    password1 = forms.CharField(
        label="New password",
        widget=forms.PasswordInput,
        strip=False,
    )
    password2 = forms.CharField(
        label="Confirm new password",
        widget=forms.PasswordInput,
        strip=False,
    )
    captcha_answer = forms.CharField(label="Security check")

    def clean(self):
        cleaned = super().clean()
        p1 = cleaned.get("password1")
        p2 = cleaned.get("password2")
        if p1 and p2 and p1 != p2:
            self.add_error("password2", "Passwords do not match.")
        if p1:
            try:
                validate_password(p1)
            except ValidationError as exc:
                self.add_error("password1", exc)
        return cleaned
