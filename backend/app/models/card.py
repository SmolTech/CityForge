from datetime import UTC, datetime

from app import db
from app.utils.helpers import generate_slug

card_tags = db.Table(
    "card_tags",
    db.Column("card_id", db.Integer, db.ForeignKey("cards.id"), primary_key=True),
    db.Column("tag_id", db.Integer, db.ForeignKey("tags.id"), primary_key=True),
)


class Tag(db.Model):
    __tablename__ = "tags"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(500), nullable=False, unique=True, index=True)
    created_date = db.Column(db.DateTime, default=lambda: datetime.now(UTC))

    def to_dict(self):
        return {"id": self.id, "name": self.name, "created_date": self.created_date.isoformat()}


class Card(db.Model):
    __tablename__ = "cards"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, index=True)
    description = db.Column(db.Text)
    website_url = db.Column(db.String(255))
    phone_number = db.Column(db.String(20))
    email = db.Column(db.String(100))
    address = db.Column(db.String(255))
    address_override_url = db.Column(db.String(500))
    contact_name = db.Column(db.String(100))
    featured = db.Column(db.Boolean, default=False)
    image_url = db.Column(db.String(255))
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    approved = db.Column(db.Boolean, default=True)
    approved_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    approved_date = db.Column(db.DateTime)
    created_date = db.Column(db.DateTime, default=lambda: datetime.now(UTC))
    updated_date = db.Column(db.DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    tags = db.relationship(
        "Tag", secondary=card_tags, lazy="subquery", backref=db.backref("cards", lazy=True)
    )
    creator = db.relationship("User", foreign_keys=[created_by], backref="created_cards")
    approver = db.relationship("User", foreign_keys=[approved_by], backref="approved_cards")

    @property
    def slug(self):
        """Generate URL-friendly slug from business name."""
        return generate_slug(self.name)

    @property
    def share_url(self):
        """Generate shareable URL for this business."""
        return f"/business/{self.id}/{self.slug}"

    def to_dict(self, include_share_url=False, include_ratings=False):
        data = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "website_url": self.website_url,
            "phone_number": self.phone_number,
            "email": self.email,
            "address": self.address,
            "address_override_url": self.address_override_url,
            "contact_name": self.contact_name,
            "featured": self.featured,
            "image_url": self.image_url,
            "approved": self.approved,
            "created_date": self.created_date.isoformat(),
            "updated_date": self.updated_date.isoformat(),
            "tags": [tag.name for tag in self.tags],
            "creator": self.creator.to_dict() if self.creator else None,
            "approver": self.approver.to_dict() if self.approver else None,
            "approved_date": self.approved_date.isoformat() if self.approved_date else None,
        }

        if include_share_url:
            data["slug"] = self.slug
            data["share_url"] = self.share_url

        if include_ratings:
            # Calculate average rating from non-hidden reviews
            visible_reviews = [r for r in self.reviews if not r.hidden]
            if visible_reviews:
                avg_rating = sum(r.rating for r in visible_reviews) / len(visible_reviews)
                data["average_rating"] = round(avg_rating, 1)
                data["review_count"] = len(visible_reviews)
            else:
                data["average_rating"] = None
                data["review_count"] = 0

        return data


class CardSubmission(db.Model):
    __tablename__ = "card_submissions"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    website_url = db.Column(db.String(255))
    phone_number = db.Column(db.String(20))
    email = db.Column(db.String(100))
    address = db.Column(db.String(255))
    address_override_url = db.Column(db.String(500))
    contact_name = db.Column(db.String(100))
    image_url = db.Column(db.String(255))
    tags_text = db.Column(db.Text)
    status = db.Column(db.String(20), default="pending")
    submitted_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    reviewed_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    review_notes = db.Column(db.Text)
    card_id = db.Column(db.Integer, db.ForeignKey("cards.id"), nullable=True)
    created_date = db.Column(db.DateTime, default=lambda: datetime.now(UTC))
    reviewed_date = db.Column(db.DateTime)

    submitter = db.relationship("User", foreign_keys=[submitted_by], backref="submissions")
    reviewer = db.relationship("User", foreign_keys=[reviewed_by], backref="reviewed_submissions")
    card = db.relationship("Card", backref="submission_source")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "website_url": self.website_url,
            "phone_number": self.phone_number,
            "email": self.email,
            "address": self.address,
            "address_override_url": self.address_override_url,
            "contact_name": self.contact_name,
            "image_url": self.image_url,
            "tags_text": self.tags_text,
            "status": self.status,
            "review_notes": self.review_notes,
            "created_date": self.created_date.isoformat(),
            "reviewed_date": self.reviewed_date.isoformat() if self.reviewed_date else None,
            "submitter": self.submitter.to_dict() if self.submitter else None,
            "reviewer": self.reviewer.to_dict() if self.reviewer else None,
            "card_id": self.card_id,
        }


class CardModification(db.Model):
    __tablename__ = "card_modifications"

    id = db.Column(db.Integer, primary_key=True)
    card_id = db.Column(db.Integer, db.ForeignKey("cards.id"), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    website_url = db.Column(db.String(255))
    phone_number = db.Column(db.String(20))
    email = db.Column(db.String(100))
    address = db.Column(db.String(255))
    address_override_url = db.Column(db.String(500))
    contact_name = db.Column(db.String(100))
    image_url = db.Column(db.String(255))
    tags_text = db.Column(db.Text)
    status = db.Column(db.String(20), default="pending")
    submitted_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    reviewed_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    review_notes = db.Column(db.Text)
    created_date = db.Column(db.DateTime, default=lambda: datetime.now(UTC))
    reviewed_date = db.Column(db.DateTime)

    card = db.relationship("Card", backref="modifications")
    submitter = db.relationship("User", foreign_keys=[submitted_by], backref="card_modifications")
    reviewer = db.relationship("User", foreign_keys=[reviewed_by], backref="reviewed_modifications")

    def to_dict(self):
        return {
            "id": self.id,
            "card_id": self.card_id,
            "name": self.name,
            "description": self.description,
            "website_url": self.website_url,
            "phone_number": self.phone_number,
            "email": self.email,
            "address": self.address,
            "address_override_url": self.address_override_url,
            "contact_name": self.contact_name,
            "image_url": self.image_url,
            "tags_text": self.tags_text,
            "status": self.status,
            "review_notes": self.review_notes,
            "created_date": self.created_date.isoformat(),
            "reviewed_date": self.reviewed_date.isoformat() if self.reviewed_date else None,
            "submitter": self.submitter.to_dict() if self.submitter else None,
            "reviewer": self.reviewer.to_dict() if self.reviewer else None,
            "card": self.card.to_dict() if self.card else None,
        }
