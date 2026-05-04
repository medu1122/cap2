import uuid
from datetime import datetime, date, timezone
from sqlalchemy import String, Text, DateTime, Date, ForeignKey, ARRAY, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from core.database import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    brand_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("brands.id", ondelete="SET NULL"), index=True)
    campaign_name: Mapped[str] = mapped_column(String(255), nullable=False)
    objective: Mapped[str] = mapped_column(Text, nullable=False)
    product_or_service: Mapped[str] = mapped_column(Text, nullable=False)
    target_audience: Mapped[str | None] = mapped_column(Text)
    offer_or_hook: Mapped[str | None] = mapped_column(Text)
    deadline: Mapped[date] = mapped_column(Date, nullable=False)
    channels: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False)
    additional_notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending_agent", index=True)
    error_message: Mapped[str | None] = mapped_column(Text)
    campaign_plan_json: Mapped[dict | None] = mapped_column(JSONB)
    cost: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user: Mapped["User"] = relationship("User", back_populates="campaigns")
    brand: Mapped["Brand | None"] = relationship("Brand", back_populates="campaigns")
    content_items: Mapped[list["ContentItem"]] = relationship("ContentItem", back_populates="campaign", cascade="all, delete-orphan")
    agent_run_logs: Mapped[list["AgentRunLog"]] = relationship("AgentRunLog", back_populates="campaign", cascade="all, delete-orphan")
    workflow_jobs: Mapped[list["WorkflowJob"]] = relationship("WorkflowJob", back_populates="campaign")
    execution_logs: Mapped[list["CampaignExecutionLog"]] = relationship(
        "CampaignExecutionLog", back_populates="campaign", cascade="all, delete-orphan"
    )
    outreach_logs: Mapped[list["OutreachLog"]] = relationship("OutreachLog", back_populates="campaign")
    tracking_links: Mapped[list["CampaignTrackingLink"]] = relationship(
        "CampaignTrackingLink", back_populates="campaign", cascade="all, delete-orphan"
    )
