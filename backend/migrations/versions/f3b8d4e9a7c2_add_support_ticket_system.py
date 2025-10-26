"""Add support ticket system and is_supporter field to users

Revision ID: f3b8d4e9a7c2
Revises: e89963f4a481
Create Date: 2025-10-26 10:16:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "f3b8d4e9a7c2"
down_revision = "e07dbcd9324c"
branch_labels = None
depends_on = None


def upgrade():
    # Add is_supporter column to users table
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("is_supporter", sa.Boolean(), nullable=True))

    # Set default value for existing users
    op.execute("UPDATE users SET is_supporter = false WHERE is_supporter IS NULL")

    # Make column non-nullable after setting defaults
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.alter_column("is_supporter", nullable=False, server_default=sa.text("false"))

    # Create support_tickets table
    op.create_table(
        "support_tickets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("priority", sa.String(length=20), nullable=False),
        sa.Column("is_anonymous", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("assigned_to", sa.Integer(), nullable=True),
        sa.Column("created_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_date", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["assigned_to"], ["users.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("support_tickets", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_support_tickets_category"), ["category"], unique=False)
        batch_op.create_index(
            batch_op.f("ix_support_tickets_created_date"), ["created_date"], unique=False
        )
        batch_op.create_index(batch_op.f("ix_support_tickets_status"), ["status"], unique=False)
        batch_op.create_index(batch_op.f("ix_support_tickets_title"), ["title"], unique=False)

    # Create support_ticket_messages table
    op.create_table(
        "support_ticket_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ticket_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_internal_note", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_date", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["ticket_id"], ["support_tickets.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade():
    # Drop support_ticket_messages table
    op.drop_table("support_ticket_messages")

    # Drop support_tickets table
    with op.batch_alter_table("support_tickets", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_support_tickets_title"))
        batch_op.drop_index(batch_op.f("ix_support_tickets_status"))
        batch_op.drop_index(batch_op.f("ix_support_tickets_created_date"))
        batch_op.drop_index(batch_op.f("ix_support_tickets_category"))

    op.drop_table("support_tickets")

    # Remove is_supporter column from users table
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("is_supporter")
