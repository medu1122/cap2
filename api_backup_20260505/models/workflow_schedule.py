import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from core.database import Base


class WorkflowSchedule(Base):
    __tablename__ = "workflow_schedules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    preset_type: Mapped[str] = mapped_column(String(50), nullable=False)
    cron_expression: Mapped[str] = mapped_column(String(100), nullable=False)
    timezone_name: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Ho_Chi_Minh")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    default_brief_template: Mapped[dict | None] = mapped_column(JSONB)
    notes: Mapped[str | None] = mapped_column(Text)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
