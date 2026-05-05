import uuid
from datetime import datetime, date, timezone
from sqlalchemy import String, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from core.database import Base


class InsightRawSnapshot(Base):
    __tablename__ = "insight_raw_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    data_source_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("insight_data_sources.id", ondelete="SET NULL"))
    source_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    payload_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    checksum: Mapped[str | None] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
