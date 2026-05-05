import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from core.database import Base


class InsightAgentTrace(Base):
    __tablename__ = "insight_agent_traces"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("insight_report_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    step_name: Mapped[str] = mapped_column(String(100), nullable=False)
    agent_name: Mapped[str] = mapped_column(String(100), nullable=False)
    model_provider: Mapped[str] = mapped_column(String(20), nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="success")
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    detail_json: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
