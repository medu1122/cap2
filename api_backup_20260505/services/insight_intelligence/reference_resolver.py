"""
Reference Resolver - Resolve các tham chiếu trong câu hỏi của user
Ví dụ: "dòng đó", "cột kia", "nó", "tháng trước"
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ResolvedReference:
    """Kết quả resolve một tham chiếu"""
    original: str  # Text gốc: "dòng đó"
    resolved: str   # Text đã resolve: "dòng #45 (doanh_thu=50M)"
    reference_type: str  # "row" | "column" | "period" | "entity"
    target: Any = None  # Object được tham chiếu (row data, column name, etc.)


@dataclass
class ReferenceResolutionResult:
    """Kết quả resolve toàn bộ input"""
    original_input: str
    resolved_input: str
    references: list[ResolvedReference] = field(default_factory=list)
    context_updates: dict[str, Any] = field(default_factory=dict)


class ReferenceResolver:
    """
    Resolve các tham chiếu trong câu hỏi của user.
    Ví dụ:
    - "dòng đó" → "dòng #45"
    - "cột đó" → "cột Doanh_thu_VND"
    - "nó" → entity cuối cùng được nhắc đến
    - "tháng trước" → "tháng 3/2024"
    """
    
    # Patterns để detect references
    REFERENCE_PATTERNS = [
        # Row references
        (r"\bdòng\s+đó\b", "row_last"),
        (r"\bdòng\s+#?(\d+)\b", "row_number"),
        (r"\bdòng\s+(?:thứ|mấy)\s+(\d+)\b", "row_ordinal"),
        (r"\bcon số\s+đó\b", "row_last_numeric"),
        (r"\bgiá trị\s+đó\b", "row_last_numeric"),
        
        # Column references
        (r"\bcột\s+đó\b", "column_last"),
        (r"\bcột\s+(\w+)\b", "column_named"),
        (r"\btrường\s+đó\b", "column_last"),
        
        # Pronouns
        (r"\b它\b", "entity_last"),  # Chinese
        (r"\b nó \b", "entity_last"),  # standalone "nó"
        (r"\b cái đó \b", "entity_last"),
        (r"\b đó \b", "entity_last"),
        
        # Time references
        (r"\btháng\s+trước\b", "period_last_month"),
        (r"\btuần\s+trước\b", "period_last_week"),
        (r"\bnăm\s+trước\b", "period_last_year"),
        (r"\bhôm\s+qua\b", "period_yesterday"),
        (r"\b(hôm nay|hôm nay)\b", "period_today"),
        
        # Comparative references
        (r"\b(còn|so)\s+(với)?\s*$", "context_carryover"),
    ]
    
    def __init__(self):
        # Compile patterns for performance
        self._compiled_patterns = [
            (re.compile(pattern, re.IGNORECASE | re.UNICODE), ref_type)
            for pattern, ref_type in self.REFERENCE_PATTERNS
        ]
    
    async def resolve(
        self,
        user_input: str,
        data_context,  # DataContext
        chat_history: list[dict],
        memory=None,
    ) -> tuple[str, list[dict]]:
        """
        Resolve all references in user input.
        
        Args:
            user_input: Câu hỏi của user
            data_context: DataContext với data info
            chat_history: Lịch sử chat
            memory: ConversationMemory nếu có
        
        Returns:
            Tuple of (resolved_input, list of detected entities)
        """
        resolved_input = user_input
        resolved_references = []
        detected_entities = {}
        
        # 1. Get last referenced row from chat history
        last_row = self._get_last_referenced_row(chat_history)
        last_column = self._get_last_referenced_column(chat_history)
        last_entity = self._get_last_entity(chat_history)
        
        # 2. Resolve row references
        resolved_input, row_refs = self._resolve_row_references(
            resolved_input, last_row, data_context
        )
        resolved_references.extend(row_refs)
        
        # 3. Resolve column references
        resolved_input, col_refs = self._resolve_column_references(
            resolved_input, last_column, data_context
        )
        resolved_references.extend(col_refs)
        
        # 4. Resolve entity references (pronouns)
        resolved_input, entity_refs = self._resolve_entity_references(
            resolved_input, last_entity, data_context
        )
        resolved_references.extend(entity_refs)
        
        # 5. Resolve time references
        resolved_input, time_refs = self._resolve_time_references(
            resolved_input, data_context, memory
        )
        resolved_references.extend(time_refs)
        
        # 6. Extract entities for later processing
        detected_entities = self._extract_entities(user_input, data_context)
        
        return resolved_input, detected_entities
    
    def _get_last_referenced_row(self, chat_history: list[dict]) -> dict | None:
        """Lấy row được tham chiếu cuối cùng từ chat history"""
        for msg in reversed(chat_history):
            if msg.get("role") == "assistant":
                content = msg.get("content", "")
                # Tìm row reference trong content
                match = re.search(r"dòng\s+#?(\d+)", content, re.IGNORECASE)
                if match:
                    row_num = int(match.group(1))
                    # Có thể lấy thêm row data từ context
                    return {"row_number": row_num, "raw": match.group(0)}
        return None
    
    def _get_last_referenced_column(self, chat_history: list[dict]) -> str | None:
        """Lấy column được tham chiếu cuối cùng"""
        for msg in reversed(chat_history):
            if msg.get("role") == "assistant":
                content = msg.get("content", "")
                # Tìm column reference trong content
                match = re.search(r"\*\*(?:cột|trường):\s*\*\*(.+?)(?:\*|$)", content, re.IGNORECASE)
                if match:
                    return match.group(1).strip()
        return None
    
    def _get_last_entity(self, chat_history: list[dict]) -> str | None:
        """Lấy entity cuối cùng được nhắc đến"""
        for msg in reversed(chat_history):
            if msg.get("role") == "assistant":
                content = msg.get("content", "")
                # Tìm các entities thường gặp
                entities = re.findall(
                    r"\*\*(?:doanh thu|đơn hàng|chi phí|khách hàng|doanh số)\*\*",
                    content, re.IGNORECASE
                )
                if entities:
                    return entities[-1].strip("*")
        return None
    
    def _resolve_row_references(
        self,
        text: str,
        last_row: dict | None,
        data_context,
    ) -> tuple[str, list[ResolvedReference]]:
        """Resolve các row references"""
        resolved = text
        refs = []
        
        # "dòng đó" → "dòng #N"
        if re.search(r"\bdòng\s+đó\b", resolved, re.IGNORECASE):
            if last_row:
                row_num = last_row.get("row_number", "?")
                resolved = re.sub(
                    r"\bdòng\s+đó\b",
                    f"dòng #{row_num}",
                    resolved, flags=re.IGNORECASE
                )
                refs.append(ResolvedReference(
                    original="dòng đó",
                    resolved=f"dòng #{row_num}",
                    reference_type="row",
                    target=last_row,
                ))
            else:
                # Không có context, thay bằng placeholder
                resolved = re.sub(
                    r"\bdòng\s+đó\b",
                    "[DÒNG CẦN CHỈ RÕ]",
                    resolved, flags=re.IGNORECASE
                )
                refs.append(ResolvedReference(
                    original="dòng đó",
                    resolved="[DÒNG CẦN CHỈ RÕ]",
                    reference_type="row",
                    target=None,
                ))
        
        # "dòng #N" → resolve với data nếu có
        for match in re.finditer(r"\bdòng\s+#?(\d+)\b", resolved):
            row_num = int(match.group(1))
            if data_context and data_context.full_data:
                rows = data_context.full_data
                if 0 < row_num <= len(rows):
                    row_data = rows[row_num - 1]  # 1-indexed
                    # Tạo description ngắn
                    cols = list(row_data.keys())
                    preview = ", ".join([f"{k}={row_data[k]}" for k in cols[:3] if row_data.get(k)])
                    replacement = f"dòng #{row_num} ({preview})"
                    resolved = resolved.replace(match.group(0), replacement)
                    refs.append(ResolvedReference(
                        original=match.group(0),
                        resolved=replacement,
                        reference_type="row",
                        target=row_data,
                    ))
        
        return resolved, refs
    
    def _resolve_column_references(
        self,
        text: str,
        last_column: str | None,
        data_context,
    ) -> tuple[str, list[ResolvedReference]]:
        """Resolve các column references"""
        resolved = text
        refs = []
        
        # "cột đó" → "cột [TÊN]"
        if re.search(r"\bcột\s+đó\b", resolved, re.IGNORECASE):
            if last_column:
                resolved = re.sub(
                    r"\bcột\s+đó\b",
                    f"cột **{last_column}**",
                    resolved, flags=re.IGNORECASE
                )
                refs.append(ResolvedReference(
                    original="cột đó",
                    resolved=f"cột **{last_column}**",
                    reference_type="column",
                    target=last_column,
                ))
            else:
                resolved = re.sub(
                    r"\bcột\s+đó\b",
                    "[CỘT CẦN CHỈ RÕ]",
                    resolved, flags=re.IGNORECASE
                )
                refs.append(ResolvedReference(
                    original="cột đó",
                    resolved="[CỘT CẦN CHỈ RÕ]",
                    reference_type="column",
                    target=None,
                ))
        
        # "cột [tên]" → bold lên nếu tìm thấy trong schema
        if data_context and data_context.columns:
            column_names = [c.name for c in data_context.columns]
            for col_name in column_names:
                pattern = rf"\bcột\s+{re.escape(col_name)}\b"
                if re.search(pattern, resolved, re.IGNORECASE):
                    resolved = re.sub(
                        pattern,
                        f"cột **{col_name}**",
                        resolved, flags=re.IGNORECASE
                    )
        
        return resolved, refs
    
    def _resolve_entity_references(
        self,
        text: str,
        last_entity: str | None,
        data_context,
    ) -> tuple[str, list[ResolvedReference]]:
        """Resolve các pronoun references"""
        resolved = text
        refs = []
        
        # "nó" → entity cuối cùng
        if re.search(r"\b nó \b", resolved):
            if last_entity:
                resolved = re.sub(r"\b nó \b", f" **{last_entity}** ", resolved)
                refs.append(ResolvedReference(
                    original="nó",
                    resolved=last_entity,
                    reference_type="entity",
                    target=last_entity,
                ))
            else:
                resolved = re.sub(r"\b nó \b", " [ĐỐI TƯỢNG CẦN CHỈ RÕ] ", resolved)
        
        return resolved, refs
    
    def _resolve_time_references(
        self,
        text: str,
        data_context,
        memory=None,
    ) -> tuple[str, list[ResolvedReference]]:
        """Resolve các time references"""
        resolved = text
        refs = []
        
        # "tháng trước" → cần extract từ data context
        if re.search(r"\btháng\s+trước\b", resolved, re.IGNORECASE):
            # Tìm date column trong data
            date_col = None
            if data_context and data_context.columns:
                for col in data_context.columns:
                    if col.data_type == "date":
                        date_col = col.name
                        break
            
            if date_col and data_context.full_data:
                # Lấy last date
                dates = []
                for row in data_context.full_data:
                    if row.get(date_col):
                        dates.append(row[date_col])
                if dates:
                    last_date = dates[-1] if dates else None
                    resolved = re.sub(
                        r"\btháng\s+trước\b",
                        f"tháng của **{last_date}**",
                        resolved, flags=re.IGNORECASE
                    )
                    refs.append(ResolvedReference(
                        original="tháng trước",
                        resolved=f"tháng của {last_date}",
                        reference_type="period",
                        target={"column": date_col, "date": last_date},
                    ))
        
        return resolved, refs
    
    def _extract_entities(self, text: str, data_context) -> dict[str, Any]:
        """Extract các entities (columns, values) từ input"""
        entities = {}
        
        if not data_context or not data_context.columns:
            return entities
        
        # Tìm column names trong text
        column_names = [c.name for c in data_context.columns]
        for col_name in column_names:
            if col_name.lower() in text.lower():
                entities[f"column_{col_name}"] = col_name
        
        # Tìm numeric values
        numbers = re.findall(r"[\d.,]+(?:\s*(?:triệu|nghìn|đ|đồng))?", text)
        if numbers:
            entities["numeric_values"] = numbers
        
        # Tìm date patterns
        dates = re.findall(r"\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}", text)
        if dates:
            entities["dates"] = dates
        
        return entities
