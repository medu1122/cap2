import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from core.database import Base


class OutreachLog(Base):
    __tablename__ = "outreach_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_list_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("customer_lists.id", ondelete="SET NULL"), index=True)
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="SET NULL"), index=True)
    mode: Mapped[str] = mapped_column(String(10), nullable=False)  # 'email' or 'sms'
    subject: Mapped[str | None] = mapped_column(Text)
    message: Mapped[str | None] = mapped_column(Text)
    recipient_count: Mapped[int | None] = mapped_column(Integer, default=0)
    sent_count: Mapped[int | None] = mapped_column(Integer, default=0)
    failed_count: Mapped[int | None] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user: Mapped["User"] = relationship("User", back_populates="outreach_logs")
    customer_list: Mapped["CustomerList | None"] = relationship("CustomerList", back_populates="outreach_logs")
    campaign: Mapped["Campaign | None"] = relationship("Campaign", back_populates="outreach_logs")
