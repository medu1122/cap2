import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_pw: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="user")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    brands: Mapped[list["Brand"]] = relationship("Brand", back_populates="user")
    campaigns: Mapped[list["Campaign"]] = relationship("Campaign", back_populates="user")
    campaign_ideas: Mapped[list["CampaignIdea"]] = relationship("CampaignIdea", back_populates="user")
    insight_data_sources: Mapped[list["InsightDataSource"]] = relationship("InsightDataSource", back_populates="user")
    insight_chats: Mapped[list["InsightChat"]] = relationship("InsightChat", back_populates="user")
