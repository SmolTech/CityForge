from datetime import UTC, datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app import db, limiter
from app.models.support_ticket import SupportTicket, SupportTicketMessage
from app.models.user import User

bp = Blueprint("support_tickets", __name__)


def is_supporter_or_admin(user):
    """Check if user has supporter or admin privileges."""
    return user.is_admin or user.is_supporter


@bp.route("/api/support-tickets", methods=["GET"])
@jwt_required()
def get_support_tickets():
    """
    Get support tickets.
    - Regular users see only their own tickets
    - Supporters see all tickets
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found or inactive"}), 404

    # Get query parameters
    status = request.args.get("status")
    category = request.args.get("category")
    priority = request.args.get("priority")
    assigned_to_me = request.args.get("assigned_to_me", "false").lower() == "true"
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)

    # Build query based on user role
    if is_supporter_or_admin(user):
        # Supporters see all tickets
        query = SupportTicket.query

        # Filter by assignment if requested
        if assigned_to_me:
            query = query.filter_by(assigned_to=user_id)
    else:
        # Regular users see only their own tickets
        query = SupportTicket.query.filter_by(created_by=user_id)

    # Apply filters
    if status and status != "all":
        query = query.filter_by(status=status)
    if category and category != "all":
        query = query.filter_by(category=category)
    if priority and priority != "all":
        query = query.filter_by(priority=priority)

    # Get total count
    total_count = query.count()

    # Get tickets with pagination
    tickets = query.order_by(SupportTicket.created_date.desc()).offset(offset).limit(limit).all()

    return jsonify(
        {
            "tickets": [
                ticket.to_dict(current_user_id=user_id, is_supporter=is_supporter_or_admin(user))
                for ticket in tickets
            ],
            "total": total_count,
            "offset": offset,
            "limit": limit,
        }
    )


@bp.route("/api/support-tickets/<int:ticket_id>", methods=["GET"])
@jwt_required()
def get_support_ticket(ticket_id):
    """
    Get a specific support ticket with messages.
    - Regular users can only see their own tickets
    - Supporters can see all tickets
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found or inactive"}), 404

    ticket = SupportTicket.query.get_or_404(ticket_id)

    # Check permissions
    if not is_supporter_or_admin(user) and ticket.created_by != user_id:
        return jsonify({"message": "You can only view your own tickets"}), 403

    return jsonify(
        ticket.to_dict(
            include_messages=True,
            current_user_id=user_id,
            is_supporter=is_supporter_or_admin(user),
        )
    )


@bp.route("/api/support-tickets", methods=["POST"])
@jwt_required()
@limiter.limit("10 per hour")
def create_support_ticket():
    """Create a new support ticket."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found or inactive"}), 404

    data = request.get_json()

    if not data:
        return jsonify({"message": "No data provided"}), 400

    # Validate required fields
    required_fields = ["title", "description", "category"]
    for field in required_fields:
        if field not in data or not data[field]:
            return jsonify({"message": f"Missing required field: {field}"}), 400

    # Validate category
    valid_categories = ["housing", "food", "transportation", "healthcare", "financial", "other"]
    if data["category"] not in valid_categories:
        return (
            jsonify(
                {"message": f"Invalid category. Must be one of: {', '.join(valid_categories)}"}
            ),
            400,
        )

    # Validate priority if provided
    priority = data.get("priority", "normal")
    valid_priorities = ["low", "normal", "high", "urgent"]
    if priority not in valid_priorities:
        return (
            jsonify(
                {"message": f"Invalid priority. Must be one of: {', '.join(valid_priorities)}"}
            ),
            400,
        )

    # Create ticket
    ticket = SupportTicket(
        title=data["title"],
        description=data["description"],
        category=data["category"],
        priority=priority,
        is_anonymous=data.get("is_anonymous", False),
        created_by=user_id,
    )

    db.session.add(ticket)
    db.session.commit()

    return (
        jsonify(ticket.to_dict(current_user_id=user_id, is_supporter=is_supporter_or_admin(user))),
        201,
    )


@bp.route("/api/support-tickets/<int:ticket_id>", methods=["PUT"])
@jwt_required()
def update_support_ticket(ticket_id):
    """
    Update a support ticket.
    - Regular users can update their own tickets (limited fields)
    - Supporters can update any ticket (all fields)
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found or inactive"}), 404

    ticket = SupportTicket.query.get_or_404(ticket_id)

    # Check permissions
    is_creator = ticket.created_by == user_id
    is_supporter = is_supporter_or_admin(user)

    if not is_creator and not is_supporter:
        return jsonify({"message": "You can only edit your own tickets"}), 403

    data = request.get_json()

    if not data:
        return jsonify({"message": "No data provided"}), 400

    # Regular users can only update limited fields on their own tickets
    if is_creator and not is_supporter:
        if "title" in data:
            ticket.title = data["title"]
        if "description" in data:
            ticket.description = data["description"]
        if "status" in data and data["status"] in ["open", "closed"]:
            ticket.status = data["status"]
            if data["status"] == "closed":
                ticket.closed_date = datetime.now(UTC)

    # Supporters can update all fields
    if is_supporter:
        if "title" in data:
            ticket.title = data["title"]
        if "description" in data:
            ticket.description = data["description"]
        if "category" in data:
            valid_categories = [
                "housing",
                "food",
                "transportation",
                "healthcare",
                "financial",
                "other",
            ]
            if data["category"] not in valid_categories:
                return (
                    jsonify(
                        {
                            "message": f"Invalid category. Must be one of: {', '.join(valid_categories)}"
                        }
                    ),
                    400,
                )
            ticket.category = data["category"]
        if "priority" in data:
            valid_priorities = ["low", "normal", "high", "urgent"]
            if data["priority"] not in valid_priorities:
                return (
                    jsonify(
                        {
                            "message": f"Invalid priority. Must be one of: {', '.join(valid_priorities)}"
                        }
                    ),
                    400,
                )
            ticket.priority = data["priority"]
        if "status" in data:
            valid_statuses = ["open", "in_progress", "resolved", "closed"]
            if data["status"] not in valid_statuses:
                return (
                    jsonify(
                        {"message": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"}
                    ),
                    400,
                )
            ticket.status = data["status"]
            if data["status"] == "resolved" and not ticket.resolved_date:
                ticket.resolved_date = datetime.now(UTC)
            elif data["status"] == "closed" and not ticket.closed_date:
                ticket.closed_date = datetime.now(UTC)
        if "assigned_to" in data:
            # Validate that assigned user is a supporter
            if data["assigned_to"]:
                assigned_user = User.query.get(data["assigned_to"])
                if not assigned_user or not is_supporter_or_admin(assigned_user):
                    return jsonify({"message": "Assigned user must be a supporter"}), 400
            ticket.assigned_to = data["assigned_to"]

    db.session.commit()

    return jsonify(
        ticket.to_dict(current_user_id=user_id, is_supporter=is_supporter_or_admin(user))
    )


@bp.route("/api/support-tickets/<int:ticket_id>", methods=["DELETE"])
@jwt_required()
def delete_support_ticket(ticket_id):
    """
    Delete a support ticket.
    - Users can delete their own tickets
    - Admins can delete any ticket
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found or inactive"}), 404

    ticket = SupportTicket.query.get_or_404(ticket_id)

    # Check permissions
    if ticket.created_by != user_id and not user.is_admin:
        return jsonify({"message": "You can only delete your own tickets"}), 403

    db.session.delete(ticket)
    db.session.commit()

    return jsonify({"message": "Ticket deleted successfully"}), 200


@bp.route("/api/support-tickets/<int:ticket_id>/messages", methods=["POST"])
@jwt_required()
@limiter.limit("20 per hour")
def add_ticket_message(ticket_id):
    """
    Add a message to a support ticket.
    - Ticket creator can add messages
    - Supporters can add messages (including internal notes)
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found or inactive"}), 404

    ticket = SupportTicket.query.get_or_404(ticket_id)

    # Check permissions
    is_creator = ticket.created_by == user_id
    is_supporter = is_supporter_or_admin(user)

    if not is_creator and not is_supporter:
        return jsonify({"message": "You can only add messages to your own tickets"}), 403

    data = request.get_json()

    if not data or "content" not in data:
        return jsonify({"message": "Message content is required"}), 400

    # Only supporters can create internal notes
    is_internal_note = data.get("is_internal_note", False)
    if is_internal_note and not is_supporter:
        return jsonify({"message": "Only supporters can create internal notes"}), 403

    # Create message
    message = SupportTicketMessage(
        ticket_id=ticket_id,
        content=data["content"],
        is_internal_note=is_internal_note,
        created_by=user_id,
    )

    db.session.add(message)
    db.session.commit()

    return (
        jsonify(message.to_dict(current_user_id=user_id, is_supporter=is_supporter_or_admin(user))),
        201,
    )


@bp.route("/api/support-tickets/stats", methods=["GET"])
@jwt_required()
def get_support_ticket_stats():
    """
    Get statistics about support tickets.
    - Regular users see stats for their own tickets only
    - Supporters see stats for all tickets
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.is_active:
        return jsonify({"message": "User not found or inactive"}), 404

    # Build base query
    if is_supporter_or_admin(user):
        base_query = SupportTicket.query
    else:
        base_query = SupportTicket.query.filter_by(created_by=user_id)

    # Get counts by status
    stats = {
        "total": base_query.count(),
        "open": base_query.filter_by(status="open").count(),
        "in_progress": base_query.filter_by(status="in_progress").count(),
        "resolved": base_query.filter_by(status="resolved").count(),
        "closed": base_query.filter_by(status="closed").count(),
    }

    # Add supporter-specific stats
    if is_supporter_or_admin(user):
        stats["assigned_to_me"] = SupportTicket.query.filter_by(assigned_to=user_id).count()
        stats["unassigned"] = base_query.filter_by(assigned_to=None).count()

    return jsonify(stats)
