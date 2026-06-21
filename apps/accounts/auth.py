from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import timedelta
from typing import Any

import jwt
from django.conf import settings
from django.utils import timezone
from jwt.exceptions import InvalidTokenError

from apps.accounts.models import TokenBlacklist, User

MOBILE_AUTH_TOKEN_TTL = timedelta(days=7)
MOBILE_TOKEN_AUDIENCE = "cityforge-mobile"
MOBILE_TOKEN_ISSUER = "cityforge"


def _auth_token_signing_key() -> str:
    """Derive a dedicated mobile-auth signing key from Django's SECRET_KEY.

    This keeps token signing separate from session signing even though both
    ultimately rely on the same root secret.
    """
    return hmac.new(
        b"cityforge-mobile-auth-token-v1",
        str(settings.SECRET_KEY).encode(),
        hashlib.sha256,
    ).hexdigest()


def encode_auth_token(payload: dict[str, object]) -> str:
    """Encode a payload as a signed HS256 JWT."""
    return jwt.encode(payload, _auth_token_signing_key(), algorithm="HS256")


def decode_auth_token(token: str) -> dict[str, Any] | None:
    """Decode and verify a mobile auth JWT.

    Returns the payload dict if valid, or None if the token is malformed,
    expired, has an invalid signature, or fails audience/issuer checks.
    """
    try:
        return jwt.decode(
            token,
            _auth_token_signing_key(),
            algorithms=["HS256"],
            audience=MOBILE_TOKEN_AUDIENCE,
            issuer=MOBILE_TOKEN_ISSUER,
            options={"require": ["sub", "jti", "exp"]},
        )
    except InvalidTokenError:
        return None


def issue_mobile_auth_token(user: User) -> str:
    """Issue a short-lived access token for mobile API clients."""
    now = timezone.now()
    payload = {
        "sub": str(user.id),
        "jti": secrets.token_urlsafe(16),
        "iat": int(now.timestamp()),
        "exp": int((now + MOBILE_AUTH_TOKEN_TTL).timestamp()),
        "aud": MOBILE_TOKEN_AUDIENCE,
        "iss": MOBILE_TOKEN_ISSUER,
        "type": "access",
    }
    return encode_auth_token(payload)


def mobile_user_from_request(request: Any) -> User | None:
    """Return the User for a request bearing a valid mobile Bearer token."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header.removeprefix("Bearer ").strip()
    payload = decode_auth_token(token)
    if not payload:
        return None

    jti = payload.get("jti")
    if not isinstance(jti, str):
        return None

    if TokenBlacklist.objects.filter(jti=jti).exists():
        return None

    exp = payload.get("exp")
    if not isinstance(exp, int) or exp <= int(timezone.now().timestamp()):
        return None

    user_id = payload.get("sub")
    if isinstance(user_id, str):
        try:
            user_id = int(user_id)
        except ValueError:
            return None
    if not isinstance(user_id, int):
        return None

    user = User.objects.filter(pk=user_id).first()
    if user is None or not user.is_active:
        return None
    return user
