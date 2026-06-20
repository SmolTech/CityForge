"""Custom password validators for enhanced security."""

from typing import Any

from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


class PasswordComplexityValidator:
    """Validates that password meets complexity requirements.

    Requirements:
    - At least 12 characters (enforced via MinimumLengthValidator)
    - Maximum 128 characters (prevent DoS via bcrypt)
    - Contains at least one lowercase letter
    - Contains at least one uppercase letter
    - Contains at least one digit
    - Contains at least one special character
    """

    SPECIAL_CHARS = '!@#$%^&*(),.?":{}|<>-_=+'

    def validate(self, password: str, user: Any | None = None) -> None:
        errors = []

        if len(password) > 128:
            errors.append(
                ValidationError(
                    _("Password must not exceed 128 characters."),
                    code="password_too_long",
                )
            )

        if not any(char.islower() for char in password):
            errors.append(
                ValidationError(
                    _("Password must contain at least one lowercase letter."),
                    code="password_no_lower",
                )
            )

        if not any(char.isupper() for char in password):
            errors.append(
                ValidationError(
                    _("Password must contain at least one uppercase letter."),
                    code="password_no_upper",
                )
            )

        if not any(char.isdigit() for char in password):
            errors.append(
                ValidationError(
                    _("Password must contain at least one number."),
                    code="password_no_digit",
                )
            )

        if not any(char in self.SPECIAL_CHARS for char in password):
            errors.append(
                ValidationError(
                    _(
                        "Password must contain at least one special character "
                        '(!@#$%^&*(),.?":{}|<>-_=+).'
                    ),
                    code="password_no_special",
                )
            )

        if errors:
            raise ValidationError(errors)

    def get_help_text(self) -> str:
        return _(
            "Your password must have at least 12 characters and contain "
            "uppercase, lowercase, numbers, and special characters."
        )
