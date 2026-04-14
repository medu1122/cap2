"""insight a2a run trace tables

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-14 18:10:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "insight_report_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("business_name", sa.String(length=255), nullable=False),
        sa.Column("industry", sa.String(length=120), nullable=True),
        sa.Column("report_type", sa.String(length=50), nullable=False, server_default="generic_report"),
        sa.Column("source_filename", sa.String(length=255), nullable=True),
        sa.Column("summary_json", postgresql.JSONB(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="completed"),
        sa.Column("fallback_provider", sa.String(length=20), nullable=True),
        sa.Column("fallback_reason", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_insight_report_runs_user_id", "insight_report_runs", ["user_id"])
    op.create_index("ix_insight_report_runs_status", "insight_report_runs", ["status"])

    op.create_table(
        "insight_report_schema_maps",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("insight_report_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_column", sa.String(length=120), nullable=False),
        sa.Column("canonical_column", sa.String(length=120), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0.7"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_insight_report_schema_maps_run_id", "insight_report_schema_maps", ["run_id"])

    op.create_table(
        "insight_agent_traces",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("insight_report_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_order", sa.Integer(), nullable=False),
        sa.Column("step_name", sa.String(length=100), nullable=False),
        sa.Column("agent_name", sa.String(length=100), nullable=False),
        sa.Column("model_provider", sa.String(length=20), nullable=False),
        sa.Column("model_name", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="success"),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("detail_json", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_insight_agent_traces_run_id", "insight_agent_traces", ["run_id"])

    op.create_table(
        "insight_result_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("insight_report_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("result_json", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_insight_result_snapshots_run_id", "insight_result_snapshots", ["run_id"])


def downgrade() -> None:
    op.drop_index("ix_insight_result_snapshots_run_id", table_name="insight_result_snapshots")
    op.drop_table("insight_result_snapshots")
    op.drop_index("ix_insight_agent_traces_run_id", table_name="insight_agent_traces")
    op.drop_table("insight_agent_traces")
    op.drop_index("ix_insight_report_schema_maps_run_id", table_name="insight_report_schema_maps")
    op.drop_table("insight_report_schema_maps")
    op.drop_index("ix_insight_report_runs_status", table_name="insight_report_runs")
    op.drop_index("ix_insight_report_runs_user_id", table_name="insight_report_runs")
    op.drop_table("insight_report_runs")
