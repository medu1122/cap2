from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class InsightChat(Base):
    """
    Lưu một cuộc hội thoại chat liên quan đến một nguồn dữ liệu.
    Mỗi lần user tạo/restore một phân tích có thể bắt đầu 1 chat session mới.
    """
    __tablename__ = "insight_chats"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    data_source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("insight_data_sources.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Liên kết với insight_report_run nếu có (để biết kết quả phân tích nào đang dùng)
    insight_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("insight_report_runs.id", ondelete="SET NULL"), nullable=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active"
    )  # "active" | "archived"

    created_at: Mapped[datetime] = mapped_column(
        "created_at", nullable=False, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updated_at", nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    user = relationship("User", back_populates="insight_chats")
    data_source = relationship("InsightDataSource", back_populates="chats")
    insight_run = relationship("InsightReportRun")
    messages = relationship(
        "InsightChatMessage", back_populates="chat",
        cascade="all, delete-orphan", order_by="InsightChatMessage.created_at"
    )

    def __repr__(self):
        return f"<InsightChat {self.id}>"


class InsightChatMessage(Base):
    """
    Lưu từng tin nhắn trong cuộc hội thoại.
    User có thể reference đến row/cột cụ thể trong dữ liệu.
    """
    __tablename__ = "insight_chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    chat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("insight_chats.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # "user" | "assistant"

    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Context của tin nhắn - AI cần biết user đang hỏi về gì
    message_context: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # {
    #   "referenced_columns": ["Doanh_thu", "Chi_phi_QA"],
    #   "referenced_row_indices": [45],
    #   "referenced_data_sample": {...},  # sample dữ liệu được hỏi
    #   "intent": "ask_why_anomaly"  # phân loại intent
    # }

    # Với assistant: lưu thêm các chart/suggestion đã suggest
    suggested_visualizations: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # [
    #   {"type": "bar_chart", "title": "...", "config": {...}},
    #   {"type": "line_chart", "title": "...", "config": {...}}
    # ]

    # Token usage (để track chi phí)
    input_tokens: Mapped[int | None] = mapped_column(default=None)
    output_tokens: Mapped[int | None] = mapped_column(default=None)

    created_at: Mapped[datetime] = mapped_column(
        "created_at", nullable=False, default=datetime.utcnow
    )

    # Relationships
    chat = relationship("InsightChat", back_populates="messages")

    def __repr__(self):
        return f"<InsightChatMessage {self.role} ({self.id})>"
