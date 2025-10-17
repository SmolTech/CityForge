from datetime import UTC, datetime

from app import db


class TokenBlacklist(db.Model):
    """
    Store blacklisted JWT tokens.
    Tokens are added here when users log out.
    """

    __tablename__ = "token_blacklist"

    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(36), nullable=False, unique=True, index=True)
    token_type = db.Column(db.String(10), nullable=False)  # 'access' or 'refresh'
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    revoked_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(UTC))
    expires_at = db.Column(db.DateTime, nullable=False)

    user = db.relationship("User", backref="revoked_tokens")

    def __repr__(self):
        return f"<TokenBlacklist {self.jti}>"

    @classmethod
    def is_jti_blacklisted(cls, jti):
        """Check if a token JTI is blacklisted."""
        return cls.query.filter_by(jti=jti).first() is not None

    @classmethod
    def add_token_to_blacklist(cls, jti, token_type, user_id, expires_at):
        """Add a token to the blacklist."""
        blacklisted_token = cls(
            jti=jti, token_type=token_type, user_id=user_id, expires_at=expires_at
        )
        db.session.add(blacklisted_token)
        db.session.commit()

    @classmethod
    def cleanup_expired_tokens(cls):
        """
        Remove expired tokens from the blacklist.
        This should be called periodically (e.g., via a cron job).
        """
        now = datetime.now(UTC)
        expired_tokens = cls.query.filter(cls.expires_at < now).all()
        for token in expired_tokens:
            db.session.delete(token)
        db.session.commit()
        return len(expired_tokens)
