from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        # Called from createsuperuser / data import; AUTH_PASSWORD_VALIDATORS
        # are not applied for these admin-driven flows by design.
        user.set_password(  # type: ignore[attr-defined]  # nosemgrep: python.django.security.audit.unvalidated-password.unvalidated-password
            password
        )
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", User.Role.USER)
        extra_fields.setdefault("is_active", True)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields["role"] = User.Role.ADMIN
        extra_fields["is_staff"] = True
        extra_fields["is_superuser"] = True
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("email_verified", True)
        extra_fields.setdefault("first_name", "Admin")
        extra_fields.setdefault("last_name", "User")
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        USER = "user", "User"
        ADMIN = "admin", "Admin"
        SUPPORT = "support", "Support"

    email = models.EmailField("email", max_length=120, unique=True)
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.USER)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_date = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(blank=True, null=True)

    email_verified = models.BooleanField(default=False)
    email_verification_token = models.CharField(max_length=255, blank=True, null=True)
    email_verification_sent_at = models.DateTimeField(blank=True, null=True)
    registration_ip_address = models.GenericIPAddressField(blank=True, null=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    objects = UserManager()

    class Meta:
        db_table = "users"

    def __str__(self) -> str:
        return self.email

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    def get_full_name(self) -> str:
        return self.full_name

    def get_short_name(self) -> str:
        return self.first_name

    @property
    def is_admin(self) -> bool:
        return self.role == self.Role.ADMIN or self.is_superuser

    @property
    def is_support(self) -> bool:
        return self.role == self.Role.SUPPORT or self.is_admin


class PasswordResetToken(models.Model):
    user = models.ForeignKey(User, related_name="password_reset_tokens", on_delete=models.CASCADE)
    token = models.CharField(max_length=255, unique=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    used_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "password_reset_tokens"
        indexes = [
            models.Index(fields=["token"]),
            models.Index(fields=["expires_at"]),
        ]

    def __str__(self) -> str:
        return f"Password reset token for {self.user}"

    def is_valid(self) -> bool:
        return not self.used and self.expires_at > timezone.now()


class TokenBlacklist(models.Model):
    """Retained for compatibility with imported data; not used by Django sessions."""

    jti = models.CharField(max_length=36, unique=True)
    token_type = models.CharField(max_length=10)
    user = models.ForeignKey(
        User,
        related_name="revoked_tokens",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
    )
    revoked_at = models.DateTimeField()
    expires_at = models.DateTimeField()

    class Meta:
        db_table = "token_blacklist"
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["expires_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.token_type}:{self.jti}"
