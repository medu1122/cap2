import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from core.database import Base


class CampaignExecutionLog(Base):
    """Log từng lần gửi (email thật / SMS mô phỏng) trong một batch chạy chiến dịch."""

    __tablename__ = "campaign_execution_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), index=True
    )
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    tracking_token: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    recipient_email: Mapped[str | None] = mapped_column(String(255))
    recipient_phone: Mapped[str | None] = mapped_column(String(50))
    recipient_name: Mapped[str | None] = mapped_column(String(255))
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    clicked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[str | None] = mapped_column(Text)
    ab_variant: Mapped[str | None] = mapped_column(String(8))
    click_target_url: Mapped[str | None] = mapped_column(String(2048))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="execution_logs")
