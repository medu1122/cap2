import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from core.database import Base


class AgentRunLog(Base):
    __tablename__ = "agent_run_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_name: Mapped[str] = mapped_column(String(50), nullable=False)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    channel: Mapped[str | None] = mapped_column(String(30))
    model_used: Mapped[str] = mapped_column(String(100), nullable=False)
    model_provider: Mapped[str] = mapped_column(String(20), nullable=False)
    prompt_preview: Mapped[str | None] = mapped_column(Text)
    output_preview: Mapped[str | None] = mapped_column(Text)
    input_tokens: Mapped[int | None] = mapped_column(Integer)
    output_tokens: Mapped[int | None] = mapped_column(Integer)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="success")
    error_detail: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="agent_run_logs")
