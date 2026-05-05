"""
Response Formatter - Format response từ AI thành structured output
Hỗ trợ: text, table, list, bullet points
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class FormattedResponse:
    """Response đã được format"""
    text: str  # Text chính
    blocks: list[dict] = field(default_factory=list)  # Các blocks (table, list, etc.)
    suggestions: list[str] = field(default_factory=list)  # Follow-up suggestions
    metadata: dict = field(default_factory=dict)  # Metadata bổ sung


@dataclass
class TableBlock:
    """Block dạng bảng"""
    headers: list[str]
    rows: list[list[Any]]
    caption: str | None = None


@dataclass
class ListBlock:
    """Block dạng list"""
    items: list[str]
    ordered: bool = False


@dataclass
class NumberBlock:
    """Block dạng số lớn (KPI)"""
    value: str
    label: str
    comparison: str | None = None  # "+15%", "-5%"
    trend: str | None = None  # "up", "down", "flat"


class ResponseFormatter:
    """
    Formatter để convert AI response thành structured format.
    Giúp frontend render đẹp hơn.
    """
    
    def __init__(self):
        self._block_patterns = {
            "kpi": r"\*\*(Kết quả|Kết quả chính|Value):\*\*\s*([^\n]+)",
            "comparison": r"\*\*(So sánh|Comparison):\*\*\s*([^\n]+)",
            "trend": r"\*\*(Xu hướng|Trend):\*\*\s*([^\n]+)",
            "table_start": r"^\|",
            "list_start": r"^[-\*]\s",
            "numbered_start": r"^\d+\.\s",
        }
    
    def format(self, raw_response: str, intent_type: str, computation_result: Any = None) -> FormattedResponse:
        """
        Format raw response từ AI.
        
        Args:
            raw_response: Response thô từ AI
            intent_type: Loại intent
            computation_result: Kết quả tính toán (nếu có)
        
        Returns:
            FormattedResponse với structured blocks
        """
        blocks: list[dict] = []
        suggestions: list[str] = []
        
        # 1. Extract structured blocks
        lines = raw_response.split("\n")
        
        # Extract tables
        tables = self._extract_tables(lines)
        blocks.extend(tables)
        
        # Extract KPI numbers
        kpi_blocks = self._extract_kpi_blocks(raw_response, computation_result)
        blocks.extend(kpi_blocks)
        
        # Extract lists
        lists = self._extract_lists(lines)
        blocks.extend(lists)
        
        # 2. Generate follow-up suggestions
        suggestions = self._generate_suggestions(intent_type, computation_result)
        
        # 3. Clean text (remove markdown artifacts)
        clean_text = self._clean_text(raw_response)
        
        return FormattedResponse(
            text=clean_text,
            blocks=blocks,
            suggestions=suggestions,
            metadata={
                "intent_type": intent_type,
                "has_computation": computation_result is not None,
            },
        )
    
    def _extract_tables(self, lines: list[str]) -> list[dict]:
        """Extract markdown tables từ lines"""
        tables = []
        current_table: list[str] = []
        in_table = False
        headers: list[str] = []
        
        for line in lines:
            if re.match(r"^\|.*\|$", line.strip()):
                if not in_table:
                    in_table = True
                    headers = []
                
                cells = [c.strip() for c in line.split("|")[1:-1]]
                
                # Check if header row (contains ---)
                if all(re.match(r"^-+$", c) for c in cells):
                    continue
                
                if not headers:
                    headers = cells
                else:
                    current_table.append(cells)
            else:
                if in_table and current_table:
                    tables.append({
                        "type": "table",
                        "headers": headers,
                        "rows": current_table,
                    })
                    current_table = []
                in_table = False
        
        # Handle table at end
        if in_table and current_table:
            tables.append({
                "type": "table",
                "headers": headers,
                "rows": current_table,
            })
        
        return tables
    
    def _extract_kpi_blocks(self, text: str, computation_result: Any = None) -> list[dict]:
        """Extract KPI number blocks"""
        blocks = []
        
        # Extract numbers with units
        number_patterns = [
            (r"([\d.,]+)\s*(?:triệu|đồng|đ|VND)", "currency"),
            (r"([\d.,]+)\s*%", "percent"),
            (r"([\d.,]+)", "number"),
        ]
        
        for pattern, unit in number_patterns:
            matches = re.findall(pattern, text)
            if matches:
                for match in matches:
                    blocks.append({
                        "type": "number",
                        "value": match,
                        "unit": unit,
                    })
                    break  # Chỉ lấy 1 number block chính
        
        # Add computation result as KPI if available
        if computation_result and hasattr(computation_result, 'value') and computation_result.value is not None:
            kpi_block = {
                "type": "kpi",
                "value": computation_result.value,
                "confidence": computation_result.confidence,
            }
            
            if hasattr(computation_result, 'unit'):
                kpi_block["unit"] = computation_result.unit
            
            if hasattr(computation_result, 'change_percent'):
                kpi_block["change_percent"] = computation_result.change_percent
            
            blocks.insert(0, kpi_block)
        
        return blocks
    
    def _extract_lists(self, lines: list[str]) -> list[dict]:
        """Extract bullet/numbered lists"""
        lists = []
        current_list: list[str] = []
        is_ordered = False
        
        for line in lines:
            stripped = line.strip()
            
            # Bullet list
            if re.match(r"^[-\*]\s", stripped):
                item = re.sub(r"^[-\*]\s", "", stripped)
                current_list.append(item)
                is_ordered = False
            
            # Numbered list
            elif re.match(r"^\d+\.\s", stripped):
                item = re.sub(r"^\d+\.\s", "", stripped)
                current_list.append(item)
                is_ordered = True
            
            # Empty line - end of list
            elif not stripped and current_list:
                lists.append({
                    "type": "list",
                    "items": current_list,
                    "ordered": is_ordered,
                })
                current_list = []
        
        # Handle list at end
        if current_list:
            lists.append({
                "type": "list",
                "items": current_list,
                "ordered": is_ordered,
            })
        
        return lists
    
    def _clean_text(self, text: str) -> str:
        """Clean markdown artifacts từ text"""
        # Remove table markdown
        lines = text.split("\n")
        clean_lines = []
        skip_next = False
        
        for i, line in enumerate(lines):
            # Skip table separator lines
            if re.match(r"^\|[\s-|]+\|$", line):
                continue
            
            # Skip header markdown rows
            if re.match(r"^\|.*\|$", line):
                cells = [c.strip() for c in line.split("|")[1:-1]]
                if all(len(c) <= 3 for c in cells):
                    continue
                # Keep header row as text
                clean_lines.append(" | ".join(cells))
                continue
            
            clean_lines.append(line)
        
        result = "\n".join(clean_lines)
        
        # Remove bold markers but keep text
        result = re.sub(r"\*\*(.*?)\*\*", r"\1", result)
        
        # Clean up multiple blank lines
        result = re.sub(r"\n{3,}", "\n\n", result)
        
        return result.strip()
    
    def _generate_suggestions(self, intent_type: str, computation_result: Any = None) -> list[str]:
        """Generate follow-up suggestions"""
        suggestions = {
            "kpi_query": [
                "Bạn có muốn xem chi tiết theo từng tháng không?",
                "Có muốn so sánh với kỳ trước không?",
            ],
            "trend_analysis": [
                "Có muốn biết nguyên nhân của xu hướng này không?",
                "Bạn có muốn dự báo cho kỳ tới không?",
            ],
            "anomaly_detection": [
                "Có muốn xem chi tiết dòng bất thường không?",
                "Bạn có muốn biết nguyên nhân không?",
            ],
            "comparison": [
                "Có muốn xem biểu đồ so sánh không?",
                "Bạn có muốn phân tích sâu hơn không?",
            ],
            "causation": [
                "Có muốn xem tương quan giữa các yếu tố không?",
                "Bạn có muốn đề xuất hành động cụ thể không?",
            ],
            "visualization": [
                "Có muốn tôi gợi ý cách cải thiện không?",
                "Bạn có muốn tạo campaign từ insight này không?",
            ],
        }
        
        return suggestions.get(intent_type, ["Có câu hỏi nào khác không?"])
    
    def format_as_markdown(self, response: FormattedResponse) -> str:
        """Convert FormattedResponse back to markdown for display"""
        parts = []
        
        # Add KPI blocks first
        for block in response.blocks:
            if block["type"] == "kpi":
                parts.append(f"**Kết quả**: {block['value']}")
                if block.get("change_percent"):
                    parts.append(f"**Thay đổi**: {block['change_percent']:+.1f}%")
                parts.append("")
        
        # Add text
        if response.text:
            parts.append(response.text)
            parts.append("")
        
        # Add tables
        for block in response.blocks:
            if block["type"] == "table":
                parts.append(self._format_table_markdown(block))
                parts.append("")
        
        # Add lists
        for block in response.blocks:
            if block["type"] == "list":
                for i, item in enumerate(block["items"]):
                    prefix = f"{i+1}. " if block["ordered"] else "- "
                    parts.append(f"{prefix}{item}")
                parts.append("")
        
        # Add suggestions
        if response.suggestions:
            parts.append("**Gợi ý tiếp theo:**")
            for s in response.suggestions:
                parts.append(f"- {s}")
        
        return "\n".join(parts)
    
    def _format_table_markdown(self, table: dict) -> str:
        """Format table as markdown"""
        headers = table["headers"]
        rows = table["rows"]
        
        lines = []
        lines.append("| " + " | ".join(headers) + " |")
        lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
        
        for row in rows:
            lines.append("| " + " | ".join(str(c) for c in row) + " |")
        
        return "\n".join(lines)


def format_response_for_api(response: FormattedResponse) -> dict:
    """Format response cho API response"""
    return {
        "text": response.text,
        "blocks": response.blocks,
        "suggestions": response.suggestions,
        "metadata": response.metadata,
    }
