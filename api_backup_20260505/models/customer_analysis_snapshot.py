import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from core.database import Base


class CustomerAnalysisSnapshot(Base):
    """
    Lưu kết quả phân tích customer list (phân tích segment, churn risk, VIP, etc.)
    Mỗi customer_list có thể có nhiều snapshot, nhưng chỉ lấy bản mới nhất.
    """
    __tablename__ = "customer_analysis_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_list_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customer_lists.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Lưu toàn bộ kết quả phân tích dạng JSON (cùng cấu trúc với response của analyze endpoint)
    result_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
