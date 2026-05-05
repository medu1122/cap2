"""Model cho campaign_tracking_links - theo dõi clicks trên custom links."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from core.database import Base


class CampaignTrackingLink(Base):
    __tablename__ = "campaign_tracking_links"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id = Column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(255), nullable=False)
    destination_url = Column(Text, nullable=False)
    short_code = Column(String(64), nullable=False, unique=True)
    click_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    # Relationships
    campaign = relationship("Campaign", back_populates="tracking_links")

    def __repr__(self) -> str:
        return f"<CampaignTrackingLink {self.short_code} -> {self.destination_url}>"
