import uuid
from datetime import datetime, date, timezone
from sqlalchemy import String, Date, DateTime, ForeignKey, Float
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from core.database import Base


class InsightMetricDaily(Base):
    __tablename__ = "insight_metrics_daily"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    metric_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    channel: Mapped[str | None] = mapped_column(String(50), index=True)
    revenue: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    orders: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    ad_spend: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    leads: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    repeat_orders: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    computed_json: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
