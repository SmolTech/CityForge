"""Initial database schema

Revision ID: 001
Revises:
Create Date: 2025-10-12

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=100), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=True),
        sa.Column("last_name", sa.String(length=100), nullable=True),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=True),
        sa.Column("created_date", sa.DateTime(), nullable=True),
        sa.Column("last_login", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    # Create tags table
    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=500), nullable=False),
        sa.Column("created_date", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_tags_name"), "tags", ["name"], unique=True)

    # Create cards table
    op.create_table(
        "cards",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("website_url", sa.String(length=255), nullable=True),
        sa.Column("phone_number", sa.String(length=20), nullable=True),
        sa.Column("email", sa.String(length=100), nullable=True),
        sa.Column("address", sa.String(length=255), nullable=True),
        sa.Column("address_override_url", sa.String(length=500), nullable=True),
        sa.Column("contact_name", sa.String(length=100), nullable=True),
        sa.Column("featured", sa.Boolean(), nullable=True),
        sa.Column("image_url", sa.String(length=255), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("approved", sa.Boolean(), nullable=True),
        sa.Column("approved_by", sa.Integer(), nullable=True),
        sa.Column("approved_date", sa.DateTime(), nullable=True),
        sa.Column("created_date", sa.DateTime(), nullable=True),
        sa.Column("updated_date", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["approved_by"],
            ["users.id"],
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_cards_name"), "cards", ["name"], unique=False)

    # Create card_tags association table
    op.create_table(
        "card_tags",
        sa.Column("card_id", sa.Integer(), nullable=False),
        sa.Column("tag_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["card_id"],
            ["cards.id"],
        ),
        sa.ForeignKeyConstraint(
            ["tag_id"],
            ["tags.id"],
        ),
        sa.PrimaryKeyConstraint("card_id", "tag_id"),
    )

    # Create card_submissions table
    op.create_table(
        "card_submissions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("website_url", sa.String(length=255), nullable=True),
        sa.Column("phone_number", sa.String(length=20), nullable=True),
        sa.Column("email", sa.String(length=100), nullable=True),
        sa.Column("address", sa.String(length=255), nullable=True),
        sa.Column("address_override_url", sa.String(length=500), nullable=True),
        sa.Column("contact_name", sa.String(length=100), nullable=True),
        sa.Column("image_url", sa.String(length=255), nullable=True),
        sa.Column("tags_text", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=True),
        sa.Column("submitted_by", sa.Integer(), nullable=False),
        sa.Column("reviewed_by", sa.Integer(), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("card_id", sa.Integer(), nullable=True),
        sa.Column("created_date", sa.DateTime(), nullable=True),
        sa.Column("reviewed_date", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["card_id"],
            ["cards.id"],
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by"],
            ["users.id"],
        ),
        sa.ForeignKeyConstraint(
            ["submitted_by"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create card_modifications table
    op.create_table(
        "card_modifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("card_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("website_url", sa.String(length=255), nullable=True),
        sa.Column("phone_number", sa.String(length=20), nullable=True),
        sa.Column("email", sa.String(length=100), nullable=True),
        sa.Column("address", sa.String(length=255), nullable=True),
        sa.Column("address_override_url", sa.String(length=500), nullable=True),
        sa.Column("contact_name", sa.String(length=100), nullable=True),
        sa.Column("image_url", sa.String(length=255), nullable=True),
        sa.Column("tags_text", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=True),
        sa.Column("submitted_by", sa.Integer(), nullable=False),
        sa.Column("reviewed_by", sa.Integer(), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("created_date", sa.DateTime(), nullable=True),
        sa.Column("reviewed_date", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["card_id"],
            ["cards.id"],
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by"],
            ["users.id"],
        ),
        sa.ForeignKeyConstraint(
            ["submitted_by"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create resource_categories table
    op.create_table(
        "resource_categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("icon", sa.String(length=50), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=True),
        sa.Column("created_date", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    # Create resource_items table
    op.create_table(
        "resource_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("address", sa.String(length=255), nullable=True),
        sa.Column("icon", sa.String(length=50), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=True),
        sa.Column("created_date", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create quick_access_items table
    op.create_table(
        "quick_access_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("identifier", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("subtitle", sa.String(length=200), nullable=True),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("color", sa.String(length=50), nullable=True),
        sa.Column("icon", sa.String(length=50), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=True),
        sa.Column("created_date", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("identifier"),
    )

    # Create resource_config table
    op.create_table(
        "resource_config",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("value", sa.Text(), nullable=True),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("updated_date", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )

    # Create help_wanted_posts table
    op.create_table(
        "help_wanted_posts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("contact_info", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_date", sa.DateTime(), nullable=True),
        sa.Column("updated_date", sa.DateTime(), nullable=True),
        sa.Column("resolved_date", sa.DateTime(), nullable=True),
        sa.Column("view_count", sa.Integer(), nullable=True),
        sa.Column("report_count", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_help_wanted_posts_status"), "help_wanted_posts", ["status"], unique=False
    )

    # Create help_wanted_comments table
    op.create_table(
        "help_wanted_comments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("post_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_date", sa.DateTime(), nullable=True),
        sa.Column("updated_date", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
        ),
        sa.ForeignKeyConstraint(["post_id"], ["help_wanted_posts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create help_wanted_reports table
    op.create_table(
        "help_wanted_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("post_id", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=50), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("reported_by", sa.Integer(), nullable=False),
        sa.Column("created_date", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=True),
        sa.Column("reviewed_by", sa.Integer(), nullable=True),
        sa.Column("reviewed_date", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["post_id"], ["help_wanted_posts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["reported_by"],
            ["users.id"],
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("help_wanted_reports")
    op.drop_table("help_wanted_comments")
    op.drop_index(op.f("ix_help_wanted_posts_status"), table_name="help_wanted_posts")
    op.drop_table("help_wanted_posts")
    op.drop_table("resource_config")
    op.drop_table("quick_access_items")
    op.drop_table("resource_items")
    op.drop_table("resource_categories")
    op.drop_table("card_modifications")
    op.drop_table("card_submissions")
    op.drop_table("card_tags")
    op.drop_index(op.f("ix_cards_name"), table_name="cards")
    op.drop_table("cards")
    op.drop_index(op.f("ix_tags_name"), table_name="tags")
    op.drop_table("tags")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
