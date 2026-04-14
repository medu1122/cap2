"""insight copilot core tables

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-14 14:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "insight_data_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("source_name", sa.String(length=255), nullable=False),
        sa.Column("config_json", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_insight_data_sources_user_id", "insight_data_sources", ["user_id"])
    op.create_index("ix_insight_data_sources_source_type", "insight_data_sources", ["source_type"])

    op.create_table(
        "insight_raw_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("data_source_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("insight_data_sources.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("payload_json", postgresql.JSONB(), nullable=False),
        sa.Column("checksum", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_insight_raw_snapshots_user_id", "insight_raw_snapshots", ["user_id"])
    op.create_index("ix_insight_raw_snapshots_source_type", "insight_raw_snapshots", ["source_type"])
    op.create_index("ix_insight_raw_snapshots_snapshot_date", "insight_raw_snapshots", ["snapshot_date"])
    op.create_index("ix_insight_raw_snapshots_checksum", "insight_raw_snapshots", ["checksum"])

    op.create_table(
        "insight_metrics_daily",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("metric_date", sa.Date(), nullable=False),
        sa.Column("channel", sa.String(length=50), nullable=True),
        sa.Column("revenue", sa.Float(), nullable=False, server_default="0"),
        sa.Column("orders", sa.Float(), nullable=False, server_default="0"),
        sa.Column("ad_spend", sa.Float(), nullable=False, server_default="0"),
        sa.Column("leads", sa.Float(), nullable=False, server_default="0"),
        sa.Column("repeat_orders", sa.Float(), nullable=False, server_default="0"),
        sa.Column("computed_json", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_insight_metrics_daily_user_id", "insight_metrics_daily", ["user_id"])
    op.create_index("ix_insight_metrics_daily_metric_date", "insight_metrics_daily", ["metric_date"])
    op.create_index("ix_insight_metrics_daily_channel", "insight_metrics_daily", ["channel"])

    op.create_table(
        "insight_cards",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("metric_date", sa.Date(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("priority", sa.String(length=10), nullable=False, server_default="P2"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0.5"),
        sa.Column("reasoning", sa.Text(), nullable=False),
        sa.Column("evidence_json", postgresql.JSONB(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_insight_cards_user_id", "insight_cards", ["user_id"])
    op.create_index("ix_insight_cards_metric_date", "insight_cards", ["metric_date"])
    op.create_index("ix_insight_cards_priority", "insight_cards", ["priority"])
    op.create_index("ix_insight_cards_status", "insight_cards", ["status"])

    op.create_table(
        "insight_actions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("insight_card_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("insight_cards.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action_text", sa.Text(), nullable=False),
        sa.Column("owner", sa.String(length=30), nullable=False, server_default="marketing"),
        sa.Column("impact_estimate", sa.String(length=20), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_insight_actions_user_id", "insight_actions", ["user_id"])
    op.create_index("ix_insight_actions_insight_card_id", "insight_actions", ["insight_card_id"])
    op.create_index("ix_insight_actions_status", "insight_actions", ["status"])

    op.create_table(
        "insight_feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("insight_card_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("insight_cards.id", ondelete="SET NULL"), nullable=True),
        sa.Column("sentiment", sa.String(length=20), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_insight_feedback_user_id", "insight_feedback", ["user_id"])
    op.create_index("ix_insight_feedback_insight_card_id", "insight_feedback", ["insight_card_id"])


def downgrade() -> None:
    op.drop_index("ix_insight_feedback_insight_card_id", table_name="insight_feedback")
    op.drop_index("ix_insight_feedback_user_id", table_name="insight_feedback")
    op.drop_table("insight_feedback")

    op.drop_index("ix_insight_actions_status", table_name="insight_actions")
    op.drop_index("ix_insight_actions_insight_card_id", table_name="insight_actions")
    op.drop_index("ix_insight_actions_user_id", table_name="insight_actions")
    op.drop_table("insight_actions")

    op.drop_index("ix_insight_cards_status", table_name="insight_cards")
    op.drop_index("ix_insight_cards_priority", table_name="insight_cards")
    op.drop_index("ix_insight_cards_metric_date", table_name="insight_cards")
    op.drop_index("ix_insight_cards_user_id", table_name="insight_cards")
    op.drop_table("insight_cards")

    op.drop_index("ix_insight_metrics_daily_channel", table_name="insight_metrics_daily")
    op.drop_index("ix_insight_metrics_daily_metric_date", table_name="insight_metrics_daily")
    op.drop_index("ix_insight_metrics_daily_user_id", table_name="insight_metrics_daily")
    op.drop_table("insight_metrics_daily")

    op.drop_index("ix_insight_raw_snapshots_checksum", table_name="insight_raw_snapshots")
    op.drop_index("ix_insight_raw_snapshots_snapshot_date", table_name="insight_raw_snapshots")
    op.drop_index("ix_insight_raw_snapshots_source_type", table_name="insight_raw_snapshots")
    op.drop_index("ix_insight_raw_snapshots_user_id", table_name="insight_raw_snapshots")
    op.drop_table("insight_raw_snapshots")

    op.drop_index("ix_insight_data_sources_source_type", table_name="insight_data_sources")
    op.drop_index("ix_insight_data_sources_user_id", table_name="insight_data_sources")
    op.drop_table("insight_data_sources")
