"""
Entity Linker - Liên kết entities trong câu hỏi với columns trong data
Ví dụ: "doanh thu" → "Doanh_thu_VND" (mapped từ KPI analysis)
"""

from __future__ import annotations

import unicodedata
import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class LinkedEntity:
    """Một entity đã được link đến column"""
    entity: str  # Text gốc: "doanh thu"
    linked_column: str | None  # Column được link: "Doanh_thu_VND"
    confidence: float  # Độ tin cậy: 0.0 - 1.0
    link_type: str  # "kpi_mapped" | "schema_match" | "fuzzy_match" | "not_found"
    alternatives: list[str] = field(default_factory=list)  # Các candidates khác


@dataclass
class EntityLinkingResult:
    """Kết quả link toàn bộ entities"""
    linked_entities: list[LinkedEntity] = field(default_factory=list)
    primary_metric: LinkedEntity | None = None  # Entity chính (thường là cái user hỏi)
    clarification_needed: bool = False
    clarification_for: list[str] = field(default_factory=list)  # Entities cần hỏi lại


class EntityLinker:
    """
    Link các entities trong câu hỏi với columns thực tế trong data.
    Ưu tiên:
    1. KPI mapping (từ insight analysis) - độ tin cậy cao nhất
    2. Schema exact match
    3. Fuzzy match
    """
    
    # Keywords tiếng Việt cho các loại metric phổ biến
    ENTITY_KEYWORDS = {
        # Revenue
        "revenue": ["doanh thu", "doanh số", "tổng thu", "sales", "revenue", "doanh_thu", "doanh-so"],
        "ad_spend": ["chi phí quảng cáo", "chi phí ads", "ngân sách ads", "ad spend", "marketing cost", "chi phi", "chi_phí"],
        "orders": ["đơn hàng", "đơn", "số đơn", "orders", "transactions", "don hang", "don"],
        "leads": ["lead", "khách tiềm năng", "leads", "prospects", "khach"],
        "customers": ["khách hàng", "customer", "khách", "người mua"],
        "aov": ["giá trị đơn trung bình", "aov", "average order", "đơn trung bình", "trung bình đơn"],
        "roas": ["roas", "hiệu quả quảng cáo", "quảng cáo"],
        "conversion": ["chuyển đổi", "conversion", "tỷ lệ chuyển đổi"],
        "repeat": ["quay lại", "lặp lại", "repeat", "khách cũ"],
    }
    
    def __init__(self):
        self._normalize_cache = {}
    
    def link(
        self,
        entities: dict[str, Any],
        data_context,  # DataContext
        insight_data,  # InsightData với schema_mapping
    ) -> dict[str, Any]:
        """
        Link entities với columns trong data.
        
        Args:
            entities: Dict của entities đã extract từ ReferenceResolver
            data_context: DataContext với columns info
            insight_data: InsightData với KPI mapping
        
        Returns:
            Dict của linked entities với column info
        """
        result = EntityLinkingResult()
        
        # 1. Link từ KPI mapping (độ tin cậy cao nhất)
        if insight_data and insight_data.schema_mapping:
            for canonical, mapped_col in insight_data.schema_mapping.items():
                if mapped_col:
                    result.linked_entities.append(LinkedEntity(
                        entity=canonical,
                        linked_column=mapped_col,
                        confidence=0.95,
                        link_type="kpi_mapped",
                    ))
        
        # 2. Link entities trong input
        for entity_key, entity_value in entities.items():
            if entity_key.startswith("column_"):
                # Entity là column name
                col_name = entity_value
                linked = self._find_best_column_match(
                    col_name, data_context, insight_data
                )
                result.linked_entities.append(linked)
                
                if linked.confidence >= 0.8:
                    result.primary_metric = linked
        
        # 3. Tìm primary metric (entity chính được hỏi)
        if not result.primary_metric:
            for entity_key, entity_value in entities.items():
                if entity_key == "numeric_values":
                    continue
                    
                linked = self._find_best_column_match(
                    str(entity_value), data_context, insight_data
                )
                if linked.confidence >= 0.5:
                    result.linked_entities.append(linked)
                    if not result.primary_metric:
                        result.primary_metric = linked
        
        # 4. Check nếu cần clarification
        if result.primary_metric and result.primary_metric.confidence < 0.5:
            result.clarification_needed = True
            result.clarification_for.append(result.primary_metric.entity)
        
        # Convert to dict for return
        return self._to_dict(result)
    
    def _find_best_column_match(
        self,
        entity: str,
        data_context,  # DataContext
        insight_data,  # InsightData
    ) -> LinkedEntity:
        """Tìm column tốt nhất cho một entity"""
        normalized_entity = self._normalize(entity)
        
        # 1. Check KPI mapping first
        if insight_data and insight_data.schema_mapping:
            for canonical, mapped_col in insight_data.schema_mapping.items():
                if mapped_col:
                    # Match với canonical name
                    if self._normalize(canonical) in normalized_entity or normalized_entity in self._normalize(canonical):
                        return LinkedEntity(
                            entity=entity,
                            linked_column=mapped_col,
                            confidence=0.95,
                            link_type="kpi_mapped",
                        )
                    # Match với keyword
                    for keyword in self.ENTITY_KEYWORDS.get(canonical, []):
                        if keyword in normalized_entity or normalized_entity in keyword:
                            return LinkedEntity(
                                entity=entity,
                                linked_column=mapped_col,
                                confidence=0.9,
                                link_type="kpi_mapped",
                            )
        
        # 2. Check column names in schema
        if data_context and data_context.columns:
            best_match = None
            best_score = 0
            
            for col in data_context.columns:
                score = self._calculate_match_score(normalized_entity, col.name, col.data_type)
                if score > best_score:
                    best_score = score
                    best_match = col
            
            if best_match and best_score >= 0.5:
                return LinkedEntity(
                    entity=entity,
                    linked_column=best_match.name,
                    confidence=best_score,
                    link_type="schema_match" if best_score >= 0.8 else "fuzzy_match",
                )
        
        # 3. Fuzzy match với column names
        if data_context and data_context.columns:
            candidates = []
            for col in data_context.columns:
                score = self._fuzzy_match(normalized_entity, self._normalize(col.name))
                if score > 0.3:
                    candidates.append((col.name, score))
            
            if candidates:
                candidates.sort(key=lambda x: x[1], reverse=True)
                best = candidates[0]
                return LinkedEntity(
                    entity=entity,
                    linked_column=best[0],
                    confidence=best[1],
                    link_type="fuzzy_match",
                    alternatives=[c[0] for c in candidates[1:4] if c[1] > 0.4],
                )
        
        # 4. Not found
        return LinkedEntity(
            entity=entity,
            linked_column=None,
            confidence=0.0,
            link_type="not_found",
        )
    
    def _calculate_match_score(self, normalized_entity: str, col_name: str, col_type: str) -> float:
        """Tính độ match giữa entity và column name"""
        normalized_col = self._normalize(col_name)
        
        # Exact match
        if normalized_entity == normalized_col:
            return 1.0
        
        # Contains
        if normalized_entity in normalized_col or normalized_col in normalized_entity:
            return 0.85
        
        # Partial match (>= 60% characters)
        common = sum(1 for c in normalized_entity if c in normalized_col)
        if len(normalized_entity) > 0:
            ratio = common / len(normalized_entity)
            if ratio >= 0.6:
                return 0.6 + (ratio * 0.2)  # 0.6 - 0.8
        
        # Type hint bonus
        type_bonus = 0.0
        if col_type == "number" and any(k in normalized_entity for k in ["doanh", "thu", "chi", "phi", "so", "sol", "price", "amount", "cost"]):
            type_bonus = 0.15
        elif col_type == "date" and any(k in normalized_entity for k in ["ngay", "thang", "date", "time"]):
            type_bonus = 0.15
        
        return 0.3 + type_bonus
    
    def _fuzzy_match(self, s1: str, s2: str) -> float:
        """Simple fuzzy matching using character overlap"""
        if not s1 or not s2:
            return 0.0
        
        # Quick checks
        if s1 == s2:
            return 1.0
        
        set1 = set(s1.replace("_", "").replace("-", ""))
        set2 = set(s2.replace("_", "").replace("-", ""))
        
        if not set1 or not set2:
            return 0.0
        
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        
        if union == 0:
            return 0.0
        
        jaccard = intersection / union
        
        # Also check if one contains the other
        if s1 in s2 or s2 in s1:
            jaccard = max(jaccard, 0.7)
        
        return min(jaccard, 1.0)
    
    def _normalize(self, text: str) -> str:
        """Normalize text cho việc so sánh"""
        if not text:
            return ""
        
        if text in self._normalize_cache:
            return self._normalize_cache[text]
        
        # Unicode normalize
        normalized = unicodedata.normalize("NFD", text)
        normalized = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
        
        # Lowercase và remove special chars
        normalized = normalized.lower().strip()
        normalized = re.sub(r"[^a-z0-9\s]", "", normalized)
        normalized = re.sub(r"\s+", "_", normalized)
        
        self._normalize_cache[text] = normalized
        return normalized
    
    def _to_dict(self, result: EntityLinkingResult) -> dict[str, Any]:
        """Convert EntityLinkingResult to dict for JSON serialization"""
        return {
            "primary_metric": {
                "entity": result.primary_metric.entity if result.primary_metric else None,
                "linked_column": result.primary_metric.linked_column if result.primary_metric else None,
                "confidence": result.primary_metric.confidence if result.primary_metric else 0.0,
                "link_type": result.primary_metric.link_type if result.primary_metric else None,
            } if result.primary_metric else None,
            "all_entities": [
                {
                    "entity": le.entity,
                    "linked_column": le.linked_column,
                    "confidence": le.confidence,
                    "link_type": le.link_type,
                    "alternatives": le.alternatives,
                }
                for le in result.linked_entities
            ],
            "clarification_needed": result.clarification_needed,
            "clarification_for": result.clarification_for,
        }
