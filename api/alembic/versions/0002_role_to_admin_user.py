"""normalize roles to admin/user

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-14 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # owner/assistant -> user, keep admin unchanged
    op.execute("UPDATE users SET role = 'user' WHERE role IN ('owner', 'assistant')")
    op.execute("UPDATE users SET role = 'user' WHERE role IS NULL OR role = ''")
    op.execute("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user'")


def downgrade() -> None:
    # fallback all non-admin roles back to owner semantics
    op.execute("UPDATE users SET role = 'owner' WHERE role = 'user'")
    op.execute("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'owner'")
