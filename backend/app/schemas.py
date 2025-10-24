"""
Marshmallow schemas for input validation across all API endpoints.

This module provides comprehensive validation for:
- URLs (HTTP/HTTPS only)
- Email addresses (RFC-compliant)
- Phone numbers (international format)
- Text fields (length limits, HTML sanitization)
- Tags (format and length)
"""

import re

import bleach
import phonenumbers
from marshmallow import Schema, ValidationError, fields, validate, validates


class SanitizedString(fields.String):
    """String field that sanitizes HTML to prevent XSS attacks."""

    def _deserialize(self, value, attr, data, **kwargs):
        value = super()._deserialize(value, attr, data, **kwargs)
        if value:
            # Remove all HTML tags but preserve line breaks
            value = bleach.clean(value, tags=[], strip=True)
        return value


def validate_phone_number(value):
    """Validate phone number using phonenumbers library."""
    if not value:
        return
    try:
        # Try parsing with US region first (for local format like (508) 555-0123)
        try:
            parsed = phonenumbers.parse(value, "US")
        except phonenumbers.phonenumberutil.NumberParseException:
            # Fall back to international format (e.g., +1234567890)
            parsed = phonenumbers.parse(value, None)

        if not phonenumbers.is_valid_number(parsed):
            raise ValidationError("Invalid phone number format")
    except phonenumbers.phonenumberutil.NumberParseException:
        raise ValidationError(
            "Invalid phone number format. Examples: (508) 555-0123 or +15085550123"
        ) from None


def validate_url(value):
    """Validate URL is HTTP or HTTPS only."""
    if not value:
        return
    if not value.startswith(("http://", "https://")):
        raise ValidationError("URL must start with http:// or https://")
    # Basic URL structure validation
    url_pattern = re.compile(
        r"^https?://"  # http:// or https://
        r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|"  # domain...
        r"localhost|"  # localhost...
        r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"  # ...or ip
        r"(?::\d+)?"  # optional port
        r"(?:/?|[/?]\S+)$",
        re.IGNORECASE,
    )
    if not url_pattern.match(value):
        raise ValidationError("Invalid URL format")


def validate_tag_name(value):
    """Validate tag name format."""
    if not value:
        return
    if len(value) > 500:
        raise ValidationError("Tag name must not exceed 500 characters")
    # Allow alphanumeric, spaces, hyphens, and common punctuation
    if not re.match(r"^[\w\s\-.,&()]+$", value, re.UNICODE):
        raise ValidationError(
            "Tag name can only contain letters, numbers, spaces, hyphens, and basic punctuation"
        )


class CardSubmissionSchema(Schema):
    """Validation schema for card submissions."""

    name = SanitizedString(required=True, validate=validate.Length(min=1, max=255))
    description = SanitizedString(validate=validate.Length(max=5000), allow_none=True)
    website_url = fields.String(validate=validate_url, allow_none=True)
    phone_number = fields.String(validate=validate_phone_number, allow_none=True)
    email = fields.Email(allow_none=True)
    address = SanitizedString(validate=validate.Length(max=500), allow_none=True)
    address_override_url = fields.String(validate=validate_url, allow_none=True)
    contact_name = SanitizedString(validate=validate.Length(max=100), allow_none=True)
    image_url = fields.String(validate=validate_url, allow_none=True)
    tags_text = SanitizedString(validate=validate.Length(max=2000), allow_none=True)

    @validates("tags_text")
    def validate_tags(self, value):
        """Validate individual tags if tags_text is provided."""
        if value:
            tags = [tag.strip() for tag in value.split(",")]
            for tag in tags:
                if tag:  # Skip empty tags
                    validate_tag_name(tag)


class CardModificationSchema(CardSubmissionSchema):
    """Schema for card modification suggestions (inherits from CardSubmissionSchema)."""

    pass


class UserRegistrationSchema(Schema):
    """Validation schema for user registration."""

    email = fields.Email(required=True)
    password = fields.String(required=True, validate=validate.Length(min=8, max=128))
    first_name = SanitizedString(required=True, validate=validate.Length(min=1, max=50))
    last_name = SanitizedString(required=True, validate=validate.Length(min=1, max=50))


class UserLoginSchema(Schema):
    """Validation schema for user login."""

    email = fields.Email(required=True)
    password = fields.String(required=True)


class UserUpdateEmailSchema(Schema):
    """Validation schema for updating user email."""

    new_email = fields.Email(required=True)


class UserUpdatePasswordSchema(Schema):
    """Validation schema for updating user password."""

    current_password = fields.String(required=True)
    new_password = fields.String(required=True, validate=validate.Length(min=8, max=128))


class UserUpdateProfileSchema(Schema):
    """Validation schema for updating user profile."""

    first_name = SanitizedString(validate=validate.Length(min=1, max=50), allow_none=True)
    last_name = SanitizedString(validate=validate.Length(min=1, max=50), allow_none=True)


class TagSchema(Schema):
    """Validation schema for tags."""

    name = SanitizedString(
        required=True, validate=[validate.Length(min=1, max=500), validate_tag_name]
    )


class ReviewSchema(Schema):
    """Validation schema for reviews."""

    rating = fields.Integer(required=True, validate=validate.Range(min=1, max=5))
    comment = SanitizedString(validate=validate.Length(max=2000), allow_none=True)


class ForumPostSchema(Schema):
    """Validation schema for forum posts."""

    content = SanitizedString(required=True, validate=validate.Length(min=1, max=10000))


class ForumThreadSchema(Schema):
    """Validation schema for forum threads."""

    title = SanitizedString(required=True, validate=validate.Length(min=1, max=255))
    content = SanitizedString(required=True, validate=validate.Length(min=1, max=10000))


class HelpWantedPostSchema(Schema):
    """Validation schema for help wanted / classifieds posts."""

    title = SanitizedString(required=True, validate=validate.Length(min=1, max=255))
    description = SanitizedString(required=True, validate=validate.Length(min=1, max=5000))
    contact_email = fields.Email(allow_none=True)
    contact_phone = fields.String(validate=validate_phone_number, allow_none=True)


class ForumThreadUpdateSchema(Schema):
    """Validation schema for updating forum threads."""

    title = SanitizedString(required=True, validate=validate.Length(min=1, max=255))


class ForumCategoryRequestSchema(Schema):
    """Validation schema for requesting new forum categories."""

    name = SanitizedString(required=True, validate=validate.Length(min=3, max=100))
    description = SanitizedString(required=True, validate=validate.Length(min=10, max=1000))
    justification = SanitizedString(required=True, validate=validate.Length(min=10, max=1000))
