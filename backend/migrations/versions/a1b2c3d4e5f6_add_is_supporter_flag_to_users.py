"""Add is_supporter_flag to users

Revision ID: a1b2c3d4e5f6
Revises: f3b8d4e9a7c2
Create Date: 2025-10-26 16:20:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "f3b8d4e9a7c2"
branch_labels = None
depends_on = None


def upgrade():
    # Add is_supporter_flag column to users table
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("is_supporter_flag", sa.Boolean(), nullable=False, server_default="false")
        )


def downgrade():
    # Remove is_supporter_flag column from users table
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("is_supporter_flag")
