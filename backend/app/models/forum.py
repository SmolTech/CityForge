from datetime import UTC, datetime

from app import db


class ForumCategory(db.Model):
    __tablename__ = "forum_categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True, index=True)
    description = db.Column(db.Text)
    slug = db.Column(db.String(120), nullable=False, unique=True, index=True)
    display_order = db.Column(db.Integer, default=0)  # For custom ordering
    is_active = db.Column(db.Boolean, default=True)

    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_date = db.Column(db.DateTime, default=lambda: datetime.now(UTC))
    updated_date = db.Column(db.DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    # Relationships
    creator = db.relationship("User", foreign_keys=[created_by], backref="created_forum_categories")
    threads = db.relationship(
        "ForumThread", backref="category", lazy="dynamic", cascade="all, delete-orphan"
    )

    def to_dict(self, include_stats=False):
        data = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "slug": self.slug,
            "display_order": self.display_order,
            "is_active": self.is_active,
            "created_date": self.created_date.isoformat(),
            "updated_date": self.updated_date.isoformat(),
            "creator": self.creator.to_dict() if self.creator else None,
        }

        if include_stats:
            data["thread_count"] = self.threads.count()
            # Count total posts across all threads in this category
            total_posts = sum(thread.posts.count() for thread in self.threads.all())
            data["post_count"] = total_posts
            # Get latest thread
            latest_thread = self.threads.order_by(ForumThread.updated_date.desc()).first()
            data["latest_thread"] = latest_thread.to_dict() if latest_thread else None

        return data


class ForumCategoryRequest(db.Model):
    __tablename__ = "forum_category_requests"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    justification = db.Column(db.Text)  # Why this category is needed
    status = db.Column(
        db.String(20), default="pending", index=True
    )  # 'pending', 'approved', 'rejected'

    requested_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    reviewed_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    created_date = db.Column(db.DateTime, default=lambda: datetime.now(UTC))
    reviewed_date = db.Column(db.DateTime)
    review_notes = db.Column(db.Text)
    category_id = db.Column(
        db.Integer, db.ForeignKey("forum_categories.id"), nullable=True
    )  # If approved

    # Relationships
    requester = db.relationship("User", foreign_keys=[requested_by], backref="category_requests")
    reviewer = db.relationship(
        "User", foreign_keys=[reviewed_by], backref="reviewed_category_requests"
    )
    category = db.relationship("ForumCategory", backref="request_source")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "justification": self.justification,
            "status": self.status,
            "created_date": self.created_date.isoformat(),
            "reviewed_date": self.reviewed_date.isoformat() if self.reviewed_date else None,
            "review_notes": self.review_notes,
            "requester": self.requester.to_dict() if self.requester else None,
            "reviewer": self.reviewer.to_dict() if self.reviewer else None,
            "category_id": self.category_id,
        }


class ForumThread(db.Model):
    __tablename__ = "forum_threads"

    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey("forum_categories.id"), nullable=False)
    title = db.Column(db.String(255), nullable=False, index=True)
    slug = db.Column(db.String(280), nullable=False, index=True)
    is_pinned = db.Column(db.Boolean, default=False)
    is_locked = db.Column(db.Boolean, default=False)
    report_count = db.Column(db.Integer, default=0, nullable=False)

    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_date = db.Column(db.DateTime, default=lambda: datetime.now(UTC), index=True)
    updated_date = db.Column(
        db.DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), index=True
    )

    # Relationships
    creator = db.relationship("User", foreign_keys=[created_by], backref="forum_threads")
    posts = db.relationship(
        "ForumPost", backref="thread", lazy="dynamic", cascade="all, delete-orphan"
    )
    reports = db.relationship(
        "ForumReport",
        primaryjoin="and_(ForumThread.id==ForumReport.thread_id, ForumReport.post_id==None)",
        backref="thread",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    def to_dict(self, include_posts=False):
        data = {
            "id": self.id,
            "category_id": self.category_id,
            "category": (
                {
                    "id": self.category.id,
                    "name": self.category.name,
                    "slug": self.category.slug,
                }
                if self.category
                else None
            ),
            "title": self.title,
            "slug": self.slug,
            "is_pinned": self.is_pinned,
            "is_locked": self.is_locked,
            "report_count": self.report_count,
            "created_date": self.created_date.isoformat(),
            "updated_date": self.updated_date.isoformat(),
            "creator": self.creator.to_dict() if self.creator else None,
            "post_count": self.posts.count(),
        }

        if include_posts:
            data["posts"] = [
                post.to_dict() for post in self.posts.order_by(ForumPost.created_date.asc()).all()
            ]

        return data


class ForumPost(db.Model):
    __tablename__ = "forum_posts"

    id = db.Column(db.Integer, primary_key=True)
    thread_id = db.Column(db.Integer, db.ForeignKey("forum_threads.id"), nullable=False)
    content = db.Column(db.Text, nullable=False)
    is_first_post = db.Column(
        db.Boolean, default=False
    )  # True for the original post that started the thread
    report_count = db.Column(db.Integer, default=0, nullable=False)

    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_date = db.Column(db.DateTime, default=lambda: datetime.now(UTC))
    updated_date = db.Column(db.DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
    edited_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    edited_date = db.Column(db.DateTime)

    # Relationships
    creator = db.relationship("User", foreign_keys=[created_by], backref="forum_posts")
    editor = db.relationship("User", foreign_keys=[edited_by], backref="edited_forum_posts")
    reports = db.relationship(
        "ForumReport",
        primaryjoin="ForumPost.id==ForumReport.post_id",
        backref="post",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "thread_id": self.thread_id,
            "content": self.content,
            "is_first_post": self.is_first_post,
            "report_count": self.report_count,
            "created_date": self.created_date.isoformat(),
            "updated_date": self.updated_date.isoformat(),
            "edited_date": self.edited_date.isoformat() if self.edited_date else None,
            "creator": self.creator.to_dict() if self.creator else None,
            "editor": self.editor.to_dict() if self.editor else None,
        }


class ForumReport(db.Model):
    __tablename__ = "forum_reports"

    id = db.Column(db.Integer, primary_key=True)
    thread_id = db.Column(db.Integer, db.ForeignKey("forum_threads.id"), nullable=False)
    post_id = db.Column(
        db.Integer, db.ForeignKey("forum_posts.id"), nullable=True
    )  # Null if reporting thread
    reason = db.Column(
        db.String(50), nullable=False
    )  # 'spam', 'inappropriate', 'harassment', 'off_topic', 'other'
    details = db.Column(db.Text)
    status = db.Column(db.String(20), default="pending")  # 'pending', 'reviewed', 'resolved'

    reported_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    reviewed_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    created_date = db.Column(db.DateTime, default=lambda: datetime.now(UTC))
    reviewed_date = db.Column(db.DateTime)
    resolution_notes = db.Column(db.Text)

    # Relationships
    reporter = db.relationship("User", foreign_keys=[reported_by], backref="forum_reports")
    reviewer = db.relationship("User", foreign_keys=[reviewed_by], backref="reviewed_forum_reports")

    def to_dict(self):
        return {
            "id": self.id,
            "thread_id": self.thread_id,
            "post_id": self.post_id,
            "reason": self.reason,
            "details": self.details,
            "status": self.status,
            "created_date": self.created_date.isoformat(),
            "reviewed_date": self.reviewed_date.isoformat() if self.reviewed_date else None,
            "reporter": self.reporter.to_dict() if self.reporter else None,
            "reviewer": self.reviewer.to_dict() if self.reviewer else None,
            "resolution_notes": self.resolution_notes,
            "thread": self.thread.to_dict() if self.thread else None,
            "post": self.post.to_dict() if self.post else None,
        }
