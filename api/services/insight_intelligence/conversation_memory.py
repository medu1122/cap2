"""
Conversation Memory - Lưu trữ và tóm tắt cuộc trò chuyện
Giúp AI nhớ được context qua nhiều messages
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Any


@dataclass
class ConversationMemory:
    """
    Memory của một cuộc trò chuyện.
    Lưu trữ:
    - Tóm tắt cuộc trò chuyện
    - Các entities đã được đề cập
    - Pending questions
    - Confirmed context (filters, segments đã được user confirm)
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    
    # Tóm tắt
    summary: str = ""
    
    # Entities đã được nhắc đến
    mentioned_entities: list[str] = field(default_factory=list)
    
    # Câu hỏi đang chờ hoặc chưa trả đủ
    pending_questions: list[str] = field(default_factory=list)
    
    # Context đã được confirm bởi user
    confirmed_context: dict[str, Any] = field(default_factory=dict)
    # Ví dụ: {"segment": "VIP", "period": "Q1 2024", "filters": {"status": "active"}}
    
    # Các entities cần theo dõi (để resolve references)
    tracked_entities: dict[str, Any] = field(default_factory=dict)
    # Ví dụ: {"last_row": {"number": 45, "data": {...}}, "last_column": "doanh_thu"}
    
    # Message count
    message_count: int = 0
    
    # Last update
    last_updated: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    
    # Tags for context
    context_tags: list[str] = field(default_factory=list)
    # Ví dụ: ["revenue_analysis", "customer_segment", "anomaly_detected"]
    
    def to_dict(self) -> dict:
        """Convert to dict for JSON serialization"""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: dict) -> "ConversationMemory":
        """Create from dict"""
        return cls(**data)


class ConversationMemoryManager:
    """
    Manager để quản lý conversation memory.
    Cung cấp methods để:
    - Update memory sau mỗi message
    - Generate summary khi cần
    - Resolve references từ memory
    """
    
    def __init__(self, memory: ConversationMemory | None = None):
        self.memory = memory or ConversationMemory()
    
    def update(
        self,
        role: str,
        content: str,
        entities: list[str] | None = None,
        intent: str | None = None,
        references: dict[str, Any] | None = None,
    ):
        """
        Update memory sau khi có message mới.
        
        Args:
            role: "user" hoặc "assistant"
            content: Nội dung message
            entities: Các entities được mention
            intent: Intent của message
            references: Các references (rows, columns) được nhắc đến
        """
        self.memory.message_count += 1
        self.memory.last_updated = datetime.utcnow().isoformat()
        
        # Update entities
        if entities:
            for entity in entities:
                if entity not in self.memory.mentioned_entities:
                    self.memory.mentioned_entities.append(entity)
        
        # Update tracked entities (references)
        if references:
            if "row" in references:
                self.memory.tracked_entities["last_row"] = references["row"]
            if "column" in references:
                self.memory.tracked_entities["last_column"] = references["column"]
        
        # Update context tags
        if intent:
            if intent not in self.memory.context_tags:
                self.memory.context_tags.append(intent)
        
        # Update confirmed context if user confirms something
        if role == "user":
            self._update_confirmed_context(content)
        
        # Add to pending questions if assistant asks something
        if role == "assistant":
            self._check_pending_questions(content)
    
    def _update_confirmed_context(self, content: str):
        """Parse user message để extract confirmed context"""
        import re
        
        # Pattern: "có", "đúng", "ừ" = confirm
        confirm_patterns = [
            r"(?:có|đúng|ừ|ừm|đồng ý|vâng)\s*(?:thì|là|đó)?",
        ]
        
        # Pattern: "là X", "X tháng", "X khách hàng"
        value_patterns = [
            r"(?:là|tháng|khoảng)\s*(\d+[\w\s]*)",
            r"(\w+)\s+(?:khách|hàng|đơn)",
        ]
        
        for pattern in confirm_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                # User có vẻ đang confirm something
                pass  # Có thể implement thêm logic phức tạp hơn
    
    def _check_pending_questions(self, content: str):
        """Check nếu assistant đang hỏi user something"""
        import re
        
        # Pattern: câu hỏi chưa có dấu ?
        question_markers = [
            r"\?$",
            r"phải\s+không",
            r"(?:có|không)\s*\?",
            r"bạn\s+(?:có\s+)?muốn",
        ]
        
        for pattern in question_markers:
            if re.search(pattern, content, re.IGNORECASE):
                # Có thể add vào pending_questions
                # Nhưng hiện tại chưa implement
                pass
    
    def add_pending_question(self, question: str):
        """Add a pending question"""
        if question not in self.memory.pending_questions:
            self.memory.pending_questions.append(question)
    
    def resolve_pending_question(self, question: str):
        """Mark a pending question as resolved"""
        if question in self.memory.pending_questions:
            self.memory.pending_questions.remove(question)
    
    def get_last_row_reference(self) -> dict | None:
        """Get last referenced row"""
        return self.memory.tracked_entities.get("last_row")
    
    def get_last_column_reference(self) -> str | None:
        """Get last referenced column"""
        return self.memory.tracked_entities.get("last_column")
    
    def get_context_summary(self) -> str:
        """Get a summary string for prompt"""
        parts = []
        
        if self.memory.summary:
            parts.append(f"Tóm tắt: {self.memory.summary}")
        
        if self.memory.mentioned_entities:
            parts.append(f"Đã hỏi về: {', '.join(self.memory.mentioned_entities[:5])}")
        
        if self.memory.confirmed_context:
            parts.append(f"Context đã confirm: {json.dumps(self.memory.confirmed_context, ensure_ascii=False)}")
        
        if self.memory.pending_questions:
            parts.append(f"Đang chờ trả lời: {len(self.memory.pending_questions)} câu")
        
        return "\n".join(parts) if parts else ""
    
    def should_summarize(self, threshold: int = 15) -> bool:
        """
        Kiểm tra xem có nên generate summary mới không.
        Called after every N messages.
        """
        return self.memory.message_count > 0 and self.memory.message_count % threshold == 0
    
    async def generate_summary(
        self,
        messages: list[dict],
        llm_callable,
    ) -> str:
        """
        Generate summary từ messages.
        Sử dụng LLM để tạo summary ngắn gọn.
        
        Args:
            messages: List of messages
            llm_callable: Function to call LLM
        
        Returns:
            Summary string
        """
        if not messages:
            return ""
        
        # Build prompt
        history_text = "\n".join([
            f"{'User' if m.get('role') == 'user' else 'AI'}: {m.get('content', '')[:200]}"
            for m in messages[-20:]  # Last 20 messages
        ])
        
        prompt = f"""Tóm tắt cuộc trò chuyện sau bằng 1-2 câu tiếng Việt:
        
Cuộc trò chuyện:
{history_text}

Tóm tắt:"""
        
        try:
            summary = await llm_callable(prompt)
            self.memory.summary = summary.strip()
            return self.memory.summary
        except Exception:
            return self.memory.summary
    
    def to_json(self) -> str:
        """Serialize to JSON"""
        return json.dumps(self.memory.to_dict(), ensure_ascii=False)
    
    @classmethod
    def from_json(cls, json_str: str) -> "ConversationMemoryManager":
        """Deserialize from JSON"""
        try:
            data = json.loads(json_str)
            return cls(memory=ConversationMemory.from_dict(data))
        except Exception:
            return cls()


# Helper function để create memory from DB
def create_memory_from_dict(data: dict | None) -> ConversationMemoryManager:
    """Create ConversationMemoryManager từ dict (có thể từ DB)"""
    if not data:
        return ConversationMemoryManager()
    
    try:
        memory = ConversationMemory.from_dict(data)
        return ConversationMemoryManager(memory=memory)
    except Exception:
        return ConversationMemoryManager()
