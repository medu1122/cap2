from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import String, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class InsightDataSource(Base):
    """
    Lưu nguồn dữ liệu mà user tạo hoặc upload để phân tích.
    - Có thể là table đơn giản tạo trên UI (bảng có cột + dòng)
    - Hoặc file CSV/Excel upload lên
    """
    __tablename__ = "insight_data_sources"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    source_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="manual"
    )  # "manual" | "csv_upload" | "xlsx_upload"

    # Với manual table: schema + data lưu trong JSONB
    schema_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    data_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Với file upload: lưu file_upload_id thay vì data_json
    file_upload_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("file_uploads.id", ondelete="SET NULL"), nullable=True
    )
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        "created_at", nullable=False, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updated_at", nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    user = relationship("User", back_populates="insight_data_sources")
    chats = relationship("InsightChat", back_populates="data_source", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<InsightDataSource {self.name} ({self.source_type})>"


# Thêm vào User model relationship (sẽ cập nhật sau)
# user.insight_data_sources = relationship(...)
