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
    approved = db.Column(db.Boolean, default=False, index=True)
    approved_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    approved_date = db.Column(db.DateTime)
    created_date = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_date = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    card = db.relationship("Card", backref="reviews")
    user = db.relationship("User", foreign_keys=[user_id], backref="reviews")
    approver = db.relationship("User", foreign_keys=[approved_by], backref="approved_reviews")

    def to_dict(self, include_user=True):
        data = {
            "id": self.id,
            "card_id": self.card_id,
            "rating": self.rating,
            "title": self.title,
            "comment": self.comment,
            "approved": self.approved,
            "created_date": self.created_date.isoformat(),
            "updated_date": self.updated_date.isoformat(),
            "approved_date": self.approved_date.isoformat() if self.approved_date else None,
        }

        if include_user and self.user:
            data["user"] = {
                "id": self.user.id,
                "first_name": self.user.first_name,
                "last_name": self.user.last_name,
            }

        if self.approver:
            data["approver"] = self.approver.to_dict()

        return data

    def __repr__(self):
        return f"<Review {self.id} - Card {self.card_id} - Rating {self.rating}>"
