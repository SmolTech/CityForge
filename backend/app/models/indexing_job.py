from datetime import UTC, datetime

from app import db


class IndexingJob(db.Model):
    """Track indexing progress and status for business cards."""

    __tablename__ = "indexing_jobs"

    id = db.Column(db.Integer, primary_key=True)
    resource_id = db.Column(db.Integer, nullable=False, index=True)
    status = db.Column(
        db.String(20), nullable=False, default="pending", index=True
    )  # pending, in_progress, completed, failed
    pages_indexed = db.Column(db.Integer, default=0)
    total_pages = db.Column(db.Integer, default=0)
    last_error = db.Column(db.Text)
    started_at = db.Column(db.DateTime(timezone=True))
    completed_at = db.Column(db.DateTime(timezone=True))
    retry_count = db.Column(db.Integer, default=0)
    created_date = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_date = db.Column(db.DateTime(timezone=True), onupdate=lambda: datetime.now(UTC))

    def to_dict(self):
        """Convert indexing job to dictionary"""
        return {
            "id": self.id,
            "resource_id": self.resource_id,
            "status": self.status,
            "pages_indexed": self.pages_indexed,
            "total_pages": self.total_pages,
            "last_error": self.last_error,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "retry_count": self.retry_count,
            "created_date": self.created_date.isoformat() if self.created_date else None,
            "updated_date": self.updated_date.isoformat() if self.updated_date else None,
        }

    @classmethod
    def get_or_create(cls, resource_id):
        """Get existing job or create new one for resource"""
        job = cls.query.filter_by(resource_id=resource_id).first()
        if not job:
            job = cls(resource_id=resource_id)
            db.session.add(job)
        return job

    @classmethod
    def get_pending_jobs(cls):
        """Get all pending or failed jobs that can be retried"""
        return cls.query.filter(
            db.or_(
                cls.status == "pending",
                db.and_(cls.status == "failed", cls.retry_count < 3),
            )
        ).all()

    @classmethod
    def get_failed_jobs(cls, max_retries=3):
        """Get jobs that failed and can still be retried"""
        return cls.query.filter(
            cls.status == "failed",
            cls.retry_count < max_retries
        ).all()

    @classmethod
    def reset_all_jobs(cls):
        """Reset all jobs to pending status (for full reindex)"""
        cls.query.update(
            {
                "status": "pending",
                "pages_indexed": 0,
                "total_pages": 0,
                "last_error": None,
                "started_at": None,
                "completed_at": None,
                "retry_count": 0,
            }
        )
        db.session.commit()
