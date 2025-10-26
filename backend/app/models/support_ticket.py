from datetime import UTC, datetime

from app import db


class SupportTicket(db.Model):
    __tablename__ = "support_tickets"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False, index=True)
    description = db.Column(db.Text, nullable=False)
    category = db.Column(
        db.String(50), nullable=False, index=True
    )  # 'housing', 'food', 'transportation', 'healthcare', 'financial', 'other'
    status = db.Column(
        db.String(20), default="open", index=True
    )  # 'open', 'in_progress', 'resolved', 'closed'
    priority = db.Column(db.String(20), default="normal")  # 'low', 'normal', 'high', 'urgent'
    is_anonymous = db.Column(
        db.Boolean, default=False
    )  # Allow users to submit anonymously to supporters

    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    assigned_to = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=True
    )  # Supporter assigned to ticket

    created_date = db.Column(db.DateTime, default=lambda: datetime.now(UTC), index=True)
    updated_date = db.Column(
        db.DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )
    resolved_date = db.Column(db.DateTime, nullable=True)
    closed_date = db.Column(db.DateTime, nullable=True)

    # Relationships
    creator = db.relationship("User", foreign_keys=[created_by], backref="support_tickets")
    assigned_supporter = db.relationship(
        "User", foreign_keys=[assigned_to], backref="assigned_tickets"
    )
    messages = db.relationship(
        "SupportTicketMessage",
        backref="ticket",
        lazy="dynamic",
        cascade="all, delete-orphan",
        order_by="SupportTicketMessage.created_date.asc()",
    )

    def to_dict(self, include_messages=False, current_user_id=None, is_supporter=False):
        """
        Convert ticket to dictionary.

        Args:
            include_messages: Whether to include ticket messages
            current_user_id: ID of the user requesting the data
            is_supporter: Whether the requesting user is a supporter
        """
        # Hide creator info if anonymous and user is not the creator or a supporter
        show_creator = True
        if self.is_anonymous and current_user_id != self.created_by and not is_supporter:
            show_creator = False

        data = {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "status": self.status,
            "priority": self.priority,
            "is_anonymous": self.is_anonymous,
            "created_date": self.created_date.isoformat(),
            "updated_date": self.updated_date.isoformat(),
            "resolved_date": self.resolved_date.isoformat() if self.resolved_date else None,
            "closed_date": self.closed_date.isoformat() if self.closed_date else None,
            "creator": (
                self.creator.to_dict()
                if self.creator and show_creator
                else {"username": "Anonymous"}
            ),
            "assigned_supporter": (
                self.assigned_supporter.to_dict() if self.assigned_supporter else None
            ),
            "message_count": self.messages.count(),
        }

        if include_messages:
            data["messages"] = [
                message.to_dict(current_user_id=current_user_id, is_supporter=is_supporter)
                for message in self.messages.all()
            ]

        return data


class SupportTicketMessage(db.Model):
    __tablename__ = "support_ticket_messages"

    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey("support_tickets.id"), nullable=False)
    content = db.Column(db.Text, nullable=False)
    is_internal_note = db.Column(
        db.Boolean, default=False
    )  # Internal notes only visible to supporters

    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_date = db.Column(db.DateTime, default=lambda: datetime.now(UTC))
    updated_date = db.Column(
        db.DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )

    # Relationships
    creator = db.relationship("User", foreign_keys=[created_by], backref="support_ticket_messages")

    def to_dict(self, current_user_id=None, is_supporter=False):
        """
        Convert message to dictionary.

        Args:
            current_user_id: ID of the user requesting the data
            is_supporter: Whether the requesting user is a supporter
        """
        # Hide internal notes from non-supporters
        if self.is_internal_note and not is_supporter:
            return None

        # Hide creator info if ticket is anonymous and user is not creator or supporter
        show_creator = True
        if (
            self.ticket.is_anonymous
            and current_user_id != self.ticket.created_by
            and not is_supporter
        ):
            show_creator = False

        return {
            "id": self.id,
            "ticket_id": self.ticket_id,
            "content": self.content,
            "is_internal_note": self.is_internal_note,
            "created_date": self.created_date.isoformat(),
            "updated_date": self.updated_date.isoformat(),
            "creator": (
                self.creator.to_dict()
                if self.creator and show_creator
                else {"username": "Anonymous"}
            ),
        }
