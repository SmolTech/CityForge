from datetime import UTC, datetime

from app import db


class ResourceCategory(db.Model):
    __tablename__ = "resource_categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True, index=True)
    display_order = db.Column(db.Integer, default=0)
    created_date = db.Column(db.DateTime, default=lambda: datetime.now(UTC))

    resource_items = db.relationship("ResourceItem", backref="category_obj", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "display_order": self.display_order,
            "created_date": self.created_date.isoformat(),
        }


class QuickAccessItem(db.Model):
    __tablename__ = "quick_access_items"

    id = db.Column(db.Integer, primary_key=True)
    identifier = db.Column(db.String(50), nullable=False, unique=True, index=True)
    title = db.Column(db.String(100), nullable=False)
    subtitle = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    color = db.Column(db.String(20), nullable=False, default="blue")
    icon = db.Column(db.String(50), nullable=False, default="building")
    display_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_date = db.Column(db.DateTime, default=lambda: datetime.now(UTC))

    def to_dict(self):
        return {
            "id": self.identifier,
            "title": self.title,
            "subtitle": self.subtitle,
            "phone": self.phone,
            "color": self.color,
            "icon": self.icon,
        }


class ResourceItem(db.Model):
    __tablename__ = "resource_items"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False, index=True)
    url = db.Column(db.String(500), nullable=False)
    description = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(100), nullable=False, index=True)
    category_id = db.Column(db.Integer, db.ForeignKey("resource_categories.id"), nullable=True)
    phone = db.Column(db.String(20), nullable=True)
    address = db.Column(db.String(500), nullable=True)
    icon = db.Column(db.String(50), nullable=False, default="building")
    display_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_date = db.Column(db.DateTime, default=lambda: datetime.now(UTC))
    updated_date = db.Column(
        db.DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "url": self.url,
            "description": self.description,
            "category": self.category,
            "phone": self.phone,
            "address": self.address,
            "icon": self.icon,
        }


class ResourceConfig(db.Model):
    __tablename__ = "resource_config"

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), nullable=False, unique=True, index=True)
    value = db.Column(db.Text, nullable=False)
    description = db.Column(db.String(500), nullable=True)
    created_date = db.Column(db.DateTime, default=lambda: datetime.now(UTC))
    updated_date = db.Column(
        db.DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )

    def to_dict(self):
        return {
            "id": self.id,
            "key": self.key,
            "value": self.value,
            "description": self.description,
            "created_date": self.created_date.isoformat(),
            "updated_date": self.updated_date.isoformat(),
        }
