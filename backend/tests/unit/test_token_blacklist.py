from datetime import datetime, timedelta, timezone

import pytest

from app.models.token_blacklist import TokenBlacklist


@pytest.mark.unit
class TestTokenBlacklistModel:
    def test_token_blacklist_creation(self, db_session):
        """Test creating a token blacklist entry"""
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        token = TokenBlacklist(
            jti="test-jti-123",
            token_type="access",
            user_id=1,
            expires_at=expires_at,
        )
        db_session.session.add(token)
        db_session.session.commit()

        assert token.id is not None
        assert token.jti == "test-jti-123"
        assert token.token_type == "access"
        assert token.user_id == 1
        assert token.revoked_at is not None
        assert token.expires_at is not None  # Just verify it was set

    def test_add_token_to_blacklist(self, db_session):
        """Test adding token to blacklist using class method"""
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)

        TokenBlacklist.add_token_to_blacklist(
            jti="test-jti-456",
            token_type="access",
            user_id=1,
            expires_at=expires_at,
        )

        # Query to verify it was added
        token = TokenBlacklist.query.filter_by(jti="test-jti-456").first()
        assert token is not None
        assert token.token_type == "access"
        assert token.user_id == 1

    def test_is_jti_blacklisted_true(self, db_session):
        """Test checking if JTI is blacklisted (should return True)"""
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        TokenBlacklist.add_token_to_blacklist(
            jti="blacklisted-jti",
            token_type="access",
            user_id=1,
            expires_at=expires_at,
        )

        assert TokenBlacklist.is_jti_blacklisted("blacklisted-jti") is True

    def test_is_jti_blacklisted_false(self, db_session):
        """Test checking if JTI is blacklisted (should return False)"""
        assert TokenBlacklist.is_jti_blacklisted("non-existent-jti") is False

    def test_cleanup_expired_tokens(self, db_session):
        """Test cleaning up expired tokens"""
        # Add an expired token
        expired_time = datetime.now(timezone.utc) - timedelta(days=1)
        TokenBlacklist.add_token_to_blacklist(
            jti="expired-jti",
            token_type="access",
            user_id=1,
            expires_at=expired_time,
        )

        # Add a valid token
        valid_time = datetime.now(timezone.utc) + timedelta(days=7)
        TokenBlacklist.add_token_to_blacklist(
            jti="valid-jti",
            token_type="access",
            user_id=1,
            expires_at=valid_time,
        )

        # Cleanup expired tokens
        deleted_count = TokenBlacklist.cleanup_expired_tokens()

        assert deleted_count == 1
        assert TokenBlacklist.is_jti_blacklisted("expired-jti") is False
        assert TokenBlacklist.is_jti_blacklisted("valid-jti") is True

    def test_multiple_tokens_same_user(self, db_session, admin_user):
        """Test that multiple tokens can be blacklisted for the same user"""
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)

        TokenBlacklist.add_token_to_blacklist(
            jti="user-token-1",
            token_type="access",
            user_id=admin_user.id,
            expires_at=expires_at,
        )

        TokenBlacklist.add_token_to_blacklist(
            jti="user-token-2",
            token_type="access",
            user_id=admin_user.id,
            expires_at=expires_at,
        )

        assert TokenBlacklist.is_jti_blacklisted("user-token-1") is True
        assert TokenBlacklist.is_jti_blacklisted("user-token-2") is True

        # Verify both belong to same user
        tokens = TokenBlacklist.query.filter_by(user_id=admin_user.id).all()
        assert len(tokens) == 2

    def test_token_blacklist_relationship(self, db_session, admin_user):
        """Test relationship between token blacklist and user"""
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)

        TokenBlacklist.add_token_to_blacklist(
            jti="relationship-test",
            token_type="access",
            user_id=admin_user.id,
            expires_at=expires_at,
        )

        token = TokenBlacklist.query.filter_by(jti="relationship-test").first()
        assert token.user is not None
        assert token.user.id == admin_user.id
        assert token.user.email == admin_user.email

    def test_token_blacklist_unique_jti(self, db_session):
        """Test that JTI must be unique"""
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)

        TokenBlacklist.add_token_to_blacklist(
            jti="unique-jti",
            token_type="access",
            user_id=1,
            expires_at=expires_at,
        )

        # Attempting to add same JTI should raise an error
        with pytest.raises(Exception):  # SQLAlchemy will raise IntegrityError
            TokenBlacklist.add_token_to_blacklist(
                jti="unique-jti",
                token_type="access",
                user_id=1,
                expires_at=expires_at,
            )

    def test_cleanup_no_expired_tokens(self, db_session):
        """Test cleanup when there are no expired tokens"""
        # Add only valid tokens
        valid_time = datetime.now(timezone.utc) + timedelta(days=7)
        TokenBlacklist.add_token_to_blacklist(
            jti="valid-only",
            token_type="access",
            user_id=1,
            expires_at=valid_time,
        )

        deleted_count = TokenBlacklist.cleanup_expired_tokens()
        assert deleted_count == 0
        assert TokenBlacklist.is_jti_blacklisted("valid-only") is True

    def test_token_type_access_and_refresh(self, db_session):
        """Test both access and refresh token types"""
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)

        TokenBlacklist.add_token_to_blacklist(
            jti="access-token",
            token_type="access",
            user_id=1,
            expires_at=expires_at,
        )

        TokenBlacklist.add_token_to_blacklist(
            jti="refresh-token",
            token_type="refresh",
            user_id=1,
            expires_at=expires_at,
        )

        access_token = TokenBlacklist.query.filter_by(jti="access-token").first()
        refresh_token = TokenBlacklist.query.filter_by(jti="refresh-token").first()

        assert access_token.token_type == "access"
        assert refresh_token.token_type == "refresh"
