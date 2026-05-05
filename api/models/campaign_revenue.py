import uuid
from datetime import datetime, date, timezone
from sqlalchemy import String, Text, DateTime, Date, ForeignKey, Numeric, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from core.database import Base


class CampaignRevenue(Base):
    __tablename__ = "campaign_revenue"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Revenue data
    revenue: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    order_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cost: Mapped[float | None] = mapped_column(Numeric(15, 2), default=0)
    
    # Source
    source: Mapped[str] = mapped_column(String(20), default="manual")
    
    # Metadata
    notes: Mapped[str | None] = mapped_column(Text)
    recorded_date: Mapped[date | None] = mapped_column(Date)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="revenues")
    user: Mapped["User"] = relationship("User")


# Add relationship to Campaign model
from models.campaign import Campaign
Campaign.revenues = relationship("CampaignRevenue", back_populates="campaign", cascade="all, delete-orphan")
