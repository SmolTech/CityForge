from datetime import datetime

from app import db


class Review(db.Model):
    __tablename__ = "reviews"

    id = db.Column(db.Integer, primary_key=True)
    card_id = db.Column(db.Integer, db.ForeignKey("cards.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    rating = db.Column(db.Integer, nullable=False)  # 1-5 stars
    title = db.Column(db.String(200))
    comment = db.Column(db.Text)
    reported = db.Column(db.Boolean, default=False, index=True)
    reported_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    reported_date = db.Column(db.DateTime)
    reported_reason = db.Column(db.Text)
    hidden = db.Column(db.Boolean, default=False, index=True)
    created_date = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_date = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    card = db.relationship("Card", backref="reviews")
    user = db.relationship("User", foreign_keys=[user_id], backref="reviews")
    reporter = db.relationship("User", foreign_keys=[reported_by], backref="reported_reviews")

    def to_dict(self, include_user=True, include_reported=False):
        data = {
            "id": self.id,
            "card_id": self.card_id,
            "rating": self.rating,
            "title": self.title,
            "comment": self.comment,
            "hidden": self.hidden,
            "created_date": self.created_date.isoformat(),
            "updated_date": self.updated_date.isoformat(),
        }

        if include_user and self.user:
            data["user"] = {
                "id": self.user.id,
                "first_name": self.user.first_name,
                "last_name": self.user.last_name,
            }

        # Include reported info for admin views
        if include_reported:
            data["reported"] = self.reported
            data["reported_date"] = self.reported_date.isoformat() if self.reported_date else None
            data["reported_reason"] = self.reported_reason
            if self.reporter:
                data["reporter"] = {
                    "id": self.reporter.id,
                    "first_name": self.reporter.first_name,
                    "last_name": self.reporter.last_name,
                }

        return data

    def __repr__(self):
        return f"<Review {self.id} - Card {self.card_id} - Rating {self.rating}>"
