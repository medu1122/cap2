"""allow multiple brands per user

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-14 10:30:00.000000
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Handle both naming styles depending on how the DB was initialized.
    op.execute("ALTER TABLE brands DROP CONSTRAINT IF EXISTS uq_brands_user_id")
    op.execute("ALTER TABLE brands DROP CONSTRAINT IF EXISTS brands_user_id_key")


def downgrade() -> None:
    op.execute("ALTER TABLE brands ADD CONSTRAINT uq_brands_user_id UNIQUE (user_id)")
