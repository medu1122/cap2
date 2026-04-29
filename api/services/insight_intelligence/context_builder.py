"""
Context Builder - Xây dựng context đầy đủ cho LLM
Bao gồm: schema, data, history, memory, computed stats
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field, asdict
from typing import Any

from .reference_resolver import ReferenceResolver
from .entity_linker import EntityLinker
from .conversation_memory import ConversationMemory


@dataclass
class ColumnInfo:
    """Thông tin về một cột trong data source"""
    name: str
    data_type: str  # "text" | "number" | "date"
    unique_count: int | None = None
    sample_values: list[str] = field(default_factory=list)
    is_key_column: bool = False


@dataclass
class DataContext:
    """Context về dữ liệu"""
    name: str
    row_count: int
    columns: list[ColumnInfo]
    sample_rows: list[dict[str, Any]]
    all_rows: list[dict[str, Any]] | None = None  # Optional, để tính toán


@dataclass
class KPIData:
    """KPI đã được phân tích"""
    revenue: float | None = None
    ad_spend: float | None = None
    orders: float | None = None
    leads: float | None = None
    roas: float | None = None
    conversion_rate: float | None = None
    repeat_rate: float | None = None
    aov: float | None = None


@dataclass
class InsightData:
    """Kết quả phân tích đã có"""
    kpis: KPIData | None = None
    insights: list[dict[str, Any]] = field(default_factory=list)
    suggested_actions: list[dict[str, Any]] = field(default_factory=list)
    schema_mapping: dict[str, str | None] = field(default_factory=dict)


@dataclass
class ChatContext:
    """
    Toàn bộ context cần thiết để LLM hiểu và trả lời chính xác.
    """
    # Data context
    data_source_name: str
    data: DataContext | None = None
    insight: InsightData | None = None
    
    # Chat history
    messages: list[dict[str, str]] = field(default_factory=list)  # [{"role": "user", "content": "..."}]
    
    # Memory
    memory: ConversationMemory | None = None
    
    # Pre-resolved entities cho message hiện tại
    resolved_input: str | None = None
    detected_entities: dict[str, Any] = field(default_factory=dict)
    detected_intent: str | None = None
    
    # Full data (để tính toán)
    full_data: list[dict[str, Any]] | None = None
    
    def to_prompt_context(self) -> str:
        """Chuyển context thành text để đưa vào prompt"""
        lines = []
        
        # 1. Data Source Info
        lines.append(f"## Nguồn dữ liệu: {self.data_source_name}")
        if self.data:
            lines.append(f"- Số dòng: {self.data.row_count}")
            lines.append(f"- Số cột: {len(self.data.columns)}")
            lines.append("\n### Cấu trúc cột:")
            for col in self.data.columns:
                unique_info = f" ({col.unique_count} giá trị)" if col.unique_count else ""
                sample_info = f" - vd: {col.sample_values[:3]}" if col.sample_values else ""
                lines.append(f"- **{col.name}**: {col.data_type}{unique_info}{sample_info}")
        
        # 2. KPI Analysis
        if self.insight and self.insight.kpis:
            lines.append("\n## KPI đã phân tích:")
            kpi = self.insight.kpis
            if kpi.revenue:
                lines.append(f"- Doanh thu: {kpi.revenue:,.0f} VND")
            if kpi.orders:
                lines.append(f"- Đơn hàng: {kpi.orders:,.0f}")
            if kpi.roas:
                lines.append(f"- ROAS: {kpi.roas:.2f}")
            if kpi.conversion_rate:
                lines.append(f"- Tỷ lệ chuyển đổi: {kpi.conversion_rate*100:.1f}%")
        
        # 3. Detected Entities
        if self.detected_entities:
            lines.append("\n## Entities đã nhận diện trong câu hỏi:")
            for entity, value in self.detected_entities.items():
                lines.append(f"- {entity}: {value}")
        
        # 4. Memory Summary
        if self.memory:
            lines.append("\n## Lịch sử trò chuyện:")
            lines.append(f"- Đã hỏi về: {', '.join(self.memory.mentioned_entities[:5]) if self.memory.mentioned_entities else 'chưa có'}")
            lines.append(f"- Câu hỏi đang chờ: {len(self.memory.pending_questions) if self.memory.pending_questions else 0}")
        
        return "\n".join(lines)
    
    def to_chat_history_text(self) -> str:
        """Chuyển chat history thành text format cho LLM"""
        if not self.messages:
            return "(Cuộc trò chuyện mới)"
        
        lines = []
        for i, msg in enumerate(self.messages[-10:], 1):  # Last 10 messages
            role = "👤 User" if msg["role"] == "user" else "🤖 AI"
            content = msg["content"][:200] + "..." if len(msg["content"]) > 200 else msg["content"]
            lines.append(f"{role}: {content}")
        
        return "\n".join(lines)


class ContextBuilder:
    """
    Xây dựng context đầy đủ cho mỗi request.
    Module này orchestrates các module khác để tạo context hoàn chỉnh.
    """
    
    def __init__(self):
        self.reference_resolver = ReferenceResolver()
        self.entity_linker = EntityLinker()
    
    async def build(
        self,
        data_source,
        insight_result: dict | None,
        messages: list[dict],
        current_input: str,
        memory: ConversationMemory | None = None,
    ) -> ChatContext:
        """
        Xây dựng ChatContext hoàn chỉnh từ các thành phần.
        
        Args:
            data_source: InsightDataSource model
            insight_result: Kết quả phân tích từ insight_report_runs
            messages: Lịch sử chat
            current_input: Câu hỏi hiện tại của user
            memory: ConversationMemory nếu có
        
        Returns:
            ChatContext với đầy đủ thông tin
        """
        # 1. Build Data Context
        data_context = self._build_data_context(data_source)
        
        # 2. Build Insight Data
        insight_data = self._build_insight_data(insight_result)
        
        # 3. Resolve references trong input
        resolved_input, resolved_entities = await self.reference_resolver.resolve(
            user_input=current_input,
            data_context=data_context,
            chat_history=messages,
            memory=memory,
        )
        
        # 4. Link entities
        linked_entities = self.entity_linker.link(
            entities=resolved_entities,
            data_context=data_context,
            insight_data=insight_data,
        )
        
        # 5. Build ChatContext
        context = ChatContext(
            data_source_name=data_source.name if data_source else "Không rõ",
            data=data_context,
            insight=insight_data,
            messages=messages,
            memory=memory,
            resolved_input=resolved_input,
            detected_entities=linked_entities,
            full_data=data_source.data_json.get("rows") if data_source and data_source.data_json else None,
        )
        
        return context
    
    def _build_data_context(self, data_source) -> DataContext | None:
        """Build DataContext từ InsightDataSource"""
        if not data_source:
            return None
        
        schema = data_source.schema_json or {}
        columns_data = schema.get("columns", [])
        rows = data_source.data_json.get("rows", []) if data_source.data_json else []
        
        columns = []
        for col in columns_data:
            col_name = col.get("name", "")
            col_type = col.get("data_type", "text")
            
            # Calculate unique count
            unique_vals = set(str(row.get(col_name, "")) for row in rows)
            
            # Get sample values
            sample_vals = [str(row.get(col_name, "")) for row in rows[:20] if row.get(col_name)]
            sample_vals = list(dict.fromkeys(sample_vals))[:5]  # Remove dupes, limit 5
            
            columns.append(ColumnInfo(
                name=col_name,
                data_type=col_type,
                unique_count=len(unique_vals),
                sample_values=sample_vals,
            ))
        
        return DataContext(
            name=data_source.name,
            row_count=len(rows),
            columns=columns,
            sample_rows=rows[:10],
            all_rows=rows,
        )
    
    def _build_insight_data(self, insight_result: dict | None) -> InsightData | None:
        """Build InsightData từ kết quả phân tích"""
        if not insight_result:
            return None
        
        kpis_data = insight_result.get("kpis", {})
        kpis = KPIData(
            revenue=kpis_data.get("revenue"),
            ad_spend=kpis_data.get("ad_spend"),
            orders=kpis_data.get("orders"),
            leads=kpis_data.get("leads"),
            roas=kpis_data.get("roas"),
            conversion_rate=kpis_data.get("conversion_rate"),
            repeat_rate=kpis_data.get("repeat_rate"),
            aov=kpis_data.get("aov"),
        )
        
        return InsightData(
            kpis=kpis,
            insights=insight_result.get("insights", []),
            suggested_actions=insight_result.get("suggested_actions", []),
            schema_mapping=insight_result.get("schema_mapping", {}),
        )
