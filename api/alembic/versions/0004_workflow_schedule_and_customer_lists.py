"""workflow schedule and customer list tables

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-14 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "workflow_schedules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("preset_type", sa.String(length=50), nullable=False),
        sa.Column("cron_expression", sa.String(length=100), nullable=False),
        sa.Column("timezone_name", sa.String(length=64), nullable=False, server_default="Asia/Ho_Chi_Minh"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("default_brief_template", postgresql.JSONB(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_workflow_schedules_user_id", "workflow_schedules", ["user_id"])
    op.create_index("ix_workflow_schedules_is_active", "workflow_schedules", ["is_active"])
    op.create_index("ix_workflow_schedules_next_run_at", "workflow_schedules", ["next_run_at"])

    op.add_column("workflow_jobs", sa.Column("schedule_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_workflow_jobs_schedule_id",
        "workflow_jobs",
        "workflow_schedules",
        ["schedule_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "file_uploads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("stored_path", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False, server_default="text/csv"),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("purpose", sa.String(length=50), nullable=False, server_default="customer_list"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_file_uploads_user_id", "file_uploads", ["user_id"])

    op.create_table(
        "customer_lists",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_upload_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("file_uploads.id", ondelete="SET NULL"), nullable=True),
        sa.Column("list_name", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="processing"),
        sa.Column("total_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("valid_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("invalid_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_customer_lists_user_id", "customer_lists", ["user_id"])
    op.create_index("ix_customer_lists_status", "customer_lists", ["status"])

    op.create_table(
        "customers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_list_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("customer_lists.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("extra_fields", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_customers_customer_list_id", "customers", ["customer_list_id"])
    op.create_index("ix_customers_email", "customers", ["email"])


def downgrade() -> None:
    op.drop_index("ix_customers_email", table_name="customers")
    op.drop_index("ix_customers_customer_list_id", table_name="customers")
    op.drop_table("customers")

    op.drop_index("ix_customer_lists_status", table_name="customer_lists")
    op.drop_index("ix_customer_lists_user_id", table_name="customer_lists")
    op.drop_table("customer_lists")

    op.drop_index("ix_file_uploads_user_id", table_name="file_uploads")
    op.drop_table("file_uploads")

    op.drop_constraint("fk_workflow_jobs_schedule_id", "workflow_jobs", type_="foreignkey")
    op.drop_column("workflow_jobs", "schedule_id")

    op.drop_index("ix_workflow_schedules_next_run_at", table_name="workflow_schedules")
    op.drop_index("ix_workflow_schedules_is_active", table_name="workflow_schedules")
    op.drop_index("ix_workflow_schedules_user_id", table_name="workflow_schedules")
    op.drop_table("workflow_schedules")
