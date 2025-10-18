from datetime import UTC, datetime

from app import db


class HelpWantedPost(db.Model):
    __tablename__ = "help_wanted_posts"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False, index=True)
    description = db.Column(db.Text, nullable=False)
    category = db.Column(
        db.String(50), nullable=False, index=True
    )  # 'hiring', 'collaboration', 'general'
    status = db.Column(db.String(20), default="open", index=True)  # 'open', 'closed'
    location = db.Column(db.String(255))
    budget = db.Column(db.String(100))  # Optional budget/compensation info
    contact_preference = db.Column(db.String(50), default="message")  # 'email', 'phone', 'message'
    report_count = db.Column(db.Integer, default=0, nullable=False)  # Number of pending reports

    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_date = db.Column(db.DateTime, default=lambda: datetime.now(UTC), index=True)
    updated_date = db.Column(db.DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    # Relationships
    creator = db.relationship("User", foreign_keys=[created_by], backref="help_wanted_posts")
    comments = db.relationship(
        "HelpWantedComment", backref="post", lazy="dynamic", cascade="all, delete-orphan"
    )
    reports = db.relationship(
        "HelpWantedReport", backref="post", lazy="dynamic", cascade="all, delete-orphan"
    )

    def to_dict(self, include_comments=False):
        data = {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "status": self.status,
            "location": self.location,
            "budget": self.budget,
            "contact_preference": self.contact_preference,
            "report_count": self.report_count,
            "created_date": self.created_date.isoformat(),
            "updated_date": self.updated_date.isoformat(),
            "creator": self.creator.to_dict() if self.creator else None,
            "comment_count": self.comments.count(),
        }

        if include_comments:
            data["comments"] = [
                comment.to_dict()
                for comment in self.comments.order_by(HelpWantedComment.created_date.asc()).all()
            ]

        return data


class HelpWantedComment(db.Model):
    __tablename__ = "help_wanted_comments"

    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey("help_wanted_posts.id"), nullable=False)
    content = db.Column(db.Text, nullable=False)
    parent_id = db.Column(
        db.Integer, db.ForeignKey("help_wanted_comments.id"), nullable=True
    )  # For threaded replies

    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_date = db.Column(db.DateTime, default=lambda: datetime.now(UTC))
    updated_date = db.Column(db.DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    # Relationships
    creator = db.relationship("User", foreign_keys=[created_by], backref="help_wanted_comments")
    replies = db.relationship(
        "HelpWantedComment",
        backref=db.backref("parent", remote_side=[id]),
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    def to_dict(self, include_replies=True):
        data = {
            "id": self.id,
            "post_id": self.post_id,
            "content": self.content,
            "parent_id": self.parent_id,
            "created_date": self.created_date.isoformat(),
            "updated_date": self.updated_date.isoformat(),
            "creator": self.creator.to_dict() if self.creator else None,
        }

        if include_replies and self.parent_id is None:
            data["replies"] = [
                reply.to_dict(include_replies=False)
                for reply in self.replies.order_by(HelpWantedComment.created_date.asc()).all()
            ]

        return data


class HelpWantedReport(db.Model):
    __tablename__ = "help_wanted_reports"

    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey("help_wanted_posts.id"), nullable=False)
    reason = db.Column(
        db.String(50), nullable=False
    )  # 'spam', 'inappropriate', 'misleading', 'other'
    details = db.Column(db.Text)
    status = db.Column(db.String(20), default="pending")  # 'pending', 'reviewed', 'resolved'

    reported_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    reviewed_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    created_date = db.Column(db.DateTime, default=lambda: datetime.now(UTC))
    reviewed_date = db.Column(db.DateTime)
    resolution_notes = db.Column(db.Text)

    # Relationships
    reporter = db.relationship("User", foreign_keys=[reported_by], backref="help_wanted_reports")
    reviewer = db.relationship(
        "User", foreign_keys=[reviewed_by], backref="reviewed_help_wanted_reports"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "post_id": self.post_id,
            "reason": self.reason,
            "details": self.details,
            "status": self.status,
            "created_date": self.created_date.isoformat(),
            "reviewed_date": self.reviewed_date.isoformat() if self.reviewed_date else None,
            "reporter": self.reporter.to_dict() if self.reporter else None,
            "reviewer": self.reviewer.to_dict() if self.reviewer else None,
            "resolution_notes": self.resolution_notes,
            "post": self.post.to_dict() if self.post else None,
        }
