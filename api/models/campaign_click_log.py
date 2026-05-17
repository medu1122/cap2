"""Model cho campaign_click_logs - ghi mỗi lần truy cập link với IP để đếm người dùng thật."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from core.database import Base


class CampaignClickLog(Base):
    __tablename__ = "campaign_click_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id = Column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False
    )
    link_id = Column(
        UUID(as_uuid=True), ForeignKey("campaign_tracking_links.id", ondelete="SET NULL"), nullable=True
    )
    ip_address = Column(String(45), nullable=False)  # IPv6 max 45 chars
    user_agent = Column(Text, nullable=True)
    clicked_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    # Relationships
    campaign = relationship("Campaign", back_populates="click_logs")
    link = relationship("CampaignTrackingLink", back_populates="click_logs")

    def __repr__(self) -> str:
        return f"<CampaignClickLog campaign={self.campaign_id} ip={self.ip_address} at {self.clicked_at}>"
