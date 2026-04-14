import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from core.database import Base


class Brand(Base):
    __tablename__ = "brands"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    brand_name: Mapped[str] = mapped_column(String(255), nullable=False)
    tagline: Mapped[str | None] = mapped_column(String(512))
    brand_description: Mapped[str] = mapped_column(Text, nullable=False)
    tone_of_voice: Mapped[str] = mapped_column(String(50), nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(1024))
    primary_color: Mapped[str | None] = mapped_column(String(7))
    target_audience: Mapped[str] = mapped_column(Text, nullable=False)
    key_products: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    forbidden_words: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    preferred_cta: Mapped[str | None] = mapped_column(String(255))
    preferred_salutation: Mapped[str | None] = mapped_column(String(50))
    sample_post: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user: Mapped["User"] = relationship("User", back_populates="brands")
