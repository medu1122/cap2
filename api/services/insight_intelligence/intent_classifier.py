"""
Intent Classifier - Phân loại intent của câu hỏi user
Ví dụ: "Doanh thu bao nhiêu?" → kpi_query
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any
from enum import Enum


class IntentType(Enum):
    """Các loại intent có thể có"""
    # Data queries
    KPI_QUERY = "kpi_query"  # "doanh thu bao nhiêu?"
    TREND_ANALYSIS = "trend_analysis"  # "xu hướng thế nào?"
    COMPARISON = "comparison"  # "so sánh với tháng trước"
    
    # Data inspection
    ANOMALY_DETECTION = "anomaly_detection"  # "có dòng nào bất thường?"
    DATA_INSPECTION = "data_inspection"  # "xem dòng 45"
    ROW_DETAILS = "row_details"  # "dòng này có gì?"
    
    # Analysis
    CAUSATION = "causation"  # "tại sao giảm?"
    CORRELATION = "correlation"  # "có liên quan gì không?"
    
    # Actions
    VISUALIZATION = "visualization"  # "nên vẽ biểu đồ gì?"
    ACTION_RECOMMENDATION = "action_recommendation"  # "làm gì với thông tin này?"
    NEXT_STEPS = "next_steps"  # "tiếp theo nên làm gì?"
    
    # General
    GREETING = "greeting"  # "xin chào"
    GENERAL = "general"  # fallback
    CLARIFICATION = "clarification"  # cần hỏi lại
    DATA_DEFINITION = "data_definition"  # "cột này là gì?"


@dataclass
class Intent:
    """Kết quả phân loại intent"""
    type: IntentType
    confidence: float  # 0.0 - 1.0
    entities: list[str] = field(default_factory=list)  # entities được detect
    parameters: dict[str, Any] = field(default_factory=dict)  # params bổ sung
    suggested_response_format: str = "text"  # "text" | "table" | "chart" | "list"
    follow_up_suggestions: list[str] = field(default_factory=list)


class IntentClassifier:
    """
    Classifier để phân loại intent từ câu hỏi của user.
    Sử dụng pattern matching + heuristics.
    """
    
    # Intent patterns - ordered by priority
    INTENT_PATTERNS = {
        IntentType.GREETING: [
            r"^(?:xin\s+)?chào|hello|hi|hey|chào\s+bạn",
            r"^(?:cảm\s+ơn|thanks|thank\s+you)",
        ],
        IntentType.KPI_QUERY: [
            r"bao\s+nhiêu",  # "bao nhiêu"
            r"tổng\s+cộng",
            r"giá\s+trị",
            r"bằng\s+mấy",
            r"là\s+mấy",
            r"(?:số|con)\s+",
            r"(?:có|la)\s+\d+",
            r"^(?:doanh\s+thu|đơn\s+hàng|chi\s+phí)\s*(?:là|=|bao)",
            r"thống\s+kê",
            r"tổng\s+quan",
        ],
        IntentType.TREND_ANALYSIS: [
            r"xu\s+hướng",
            r"(?:tăng|giảm|thay\s+đổi)\s*(?:như\s+thế\s+nào|ra\s+sao)",
            r"so\s+với",
            r"(?:theo\s+)?thời\s+gian",
            r"(?:đang|từ|trong)\s+(?:tháng|tuần|quý|năm)",
            r"có\s+(?:đang\s+)?(?:tăng|giảm|thay\s+đổi)\s*(?:không|\?)",
            r"(?:điều|gì)\s+(?:gì\s+)?(?:xảy\s+ra|h肿)",
        ],
        IntentType.COMPARISON: [
            r"so\s+sánh",
            r"(?:hơn|kém)\s+(?:bao|bằng)",
            r"khác\s+(?:nhau\s+)?như\s+thế\s+nào",
            r"(?:nào|tại\s+sao)\s+(?:tốt|hơn|kém)\s+hơn",
            r"(?:hay|là)\s+(?:có\s+)?(?:gì|mấy)",
        ],
        IntentType.ANOMALY_DETECTION: [
            r"bất\s+thường",
            r"(?:dòng|cột|con\s+số)\s+(?:nào\s+)?(?:lệch|lạ|khác|bất\s+thường)",
            r"(?:có|phát\s+hiện)\s+(?:gì|điều)\s+(?:bất\s+thường|lệch|lạ)",
            r"outlier|ngoại\s+lai|lệch\s+(?:ra|khỏi)",
            r"bất\s+thường",
            r"đáng\s+(?:chú\s+ý|quan\s+tâm)",
        ],
        IntentType.DATA_INSPECTION: [
            r"xem\s+(?:dòng|cột|row|col)",
            r"chi\s+tiết\s+(?:dòng|cột)",
            r"(?:dòng|cột)\s+",
            r"(?:cho|tới)\s+(?:xem|biết)\s+(?:tôi|minh)",
            r"hiển\s+thị",
            r"xem\s+lại",
        ],
        IntentType.ROW_DETAILS: [
            r"(?:dòng|cái)\s+(?:này|đó|45|...)",
            r"(?:có\s+)?(?:gì|thông\s+tin)\s+(?:trong|ở)\s+(?:dòng|này|đó)",
            r"nói\s+(?:cho|tôi)\s+(?:về|điều)\s+(?:dòng|này|đó)",
            r"(?:dòng|cái)\s+(?:này|đó)\s+(?:là|gì|có)",
        ],
        IntentType.CAUSATION: [
            r"tại\s+sao",
            r"vì\s+sao",
            r"nguyên\s+nhân",
            r"làm\s+sao\s+(?:để|mà)",
            r"(?:có\s+)?(?:phải|vì)\s+(?:là|do)\s+",
            r"gây\s+ra",
            r"dẫn\s+đến",
        ],
        IntentType.CORRELATION: [
            r"liên\s+quan",
            r"(?:có|ở)\s+(?:đâu|mối)\s+(?:liên|hệ)",
            r"tương\s+quan",
            r"ảnh\s+hưởng",
            r"tác\s+động",
        ],
        IntentType.VISUALIZATION: [
            r"biểu\s+đồ",
            r"vẽ|chart|graph|plot",
            r"hình\s+(?:ảnh|minh\s+họa)",
            r"trực\s+quan",
            r"(?:nên|vẽ)\s+(?:biểu\s+đồ|đồ\s+thị)",
        ],
        IntentType.ACTION_RECOMMENDATION: [
            r"nên\s+(?:làm|gì|là)",
            r"(?:làm\s+)?(?:gì|vài)\s+(?:với|để)\s+(?:thông\s+tin|này|data)",
            r"gợi\s+ý",
            r"khuyến\s+(?:nghị|cáo)",
            r"đề\s+xuất",
            r"(?:tiếp|theo)\s+(?:theo)\s+(?:làm|đến)",
            r"làm\s+(?:sao|gì)\s+(?:để|mà)\s+(?:cải|tăng)",
        ],
        IntentType.NEXT_STEPS: [
            r"tiếp\s+(?:theo|sau)",
            r"(?:sau|tiếp)\s+(?:đó|khi)",
            r"bước\s+(?:tiếp|sau)",
            r"(?:có\s+)?(?:thể|lên)\s+(?:kế\s+hoạch|làm)\s+(?:gì|)",
            r"nào\s+(?:để|để\s+mà)",
        ],
        IntentType.DATA_DEFINITION: [
            r"(?:cột|dòng|trường)\s+(?:này|là|để)\s+(?:gì|làm|mục\s+đích)",
            r"(?:có\s+)?(?:nghĩa|là)\s+(?:gì|sao)",
            r"giải\s+thích",
            r"(?:cho|tôi)\s+(?:biết|hiểu)\s+(?:về|được)",
        ],
        IntentType.CLARIFICATION: [
            r"không\s+(?:hiểu|rõ)",
            r"nhắc\s+lại",
            r"(?:nói|lại)\s+(?:lại|một\s+lần)",
            r"ý\s+(?:bạn|tôi)\s+(?:là|làm|gì)",
        ],
    }
    
    # Keywords cho mỗi intent (để boost confidence)
    INTENT_KEYWORDS = {
        IntentType.KPI_QUERY: ["bao nhiêu", "tổng", "bằng mấy", "giá trị", "số lượng", "con số"],
        IntentType.TREND_ANALYSIS: ["xu hướng", "tăng", "giảm", "thay đổi", "biến động", "đồ thị"],
        IntentType.ANOMALY_DETECTION: ["bất thường", "lệch", "ngoại lai", "đáng chú ý", "lạ"],
        IntentType.CAUSATION: ["tại sao", "vì sao", "nguyên nhân", "làm sao", "gây ra"],
        IntentType.VISUALIZATION: ["biểu đồ", "vẽ", "chart", "trực quan"],
        IntentType.ACTION_RECOMMENDATION: ["nên làm", "gợi ý", "đề xuất", "khuyến nghị"],
    }
    
    def __init__(self):
        # Compile patterns
        self._compiled_patterns: dict[IntentType, list[re.Pattern]] = {}
        for intent_type, patterns in self.INTENT_PATTERNS.items():
            self._compiled_patterns[intent_type] = [
                re.compile(p, re.IGNORECASE | re.UNICODE) for p in patterns
            ]
    
    def classify(self, user_input: str) -> Intent:
        """
        Phân loại intent từ câu hỏi của user.
        
        Args:
            user_input: Câu hỏi của user
        
        Returns:
            Intent với type, confidence, và các thông tin bổ sung
        """
        normalized_input = user_input.strip().lower()
        scores: dict[IntentType, float] = {}
        
        # 1. Check patterns
        for intent_type, patterns in self._compiled_patterns.items():
            score = 0.0
            for pattern in patterns:
                if pattern.search(normalized_input):
                    score += 1.0
            
            if score > 0:
                # Normalize by number of patterns
                scores[intent_type] = min(score / len(patterns), 1.0)
        
        # 2. Boost with keywords
        for intent_type, keywords in self.INTENT_KEYWORDS.items():
            keyword_count = sum(1 for kw in keywords if kw in normalized_input)
            if keyword_count > 0:
                boost = keyword_count * 0.1
                scores[intent_type] = scores.get(intent_type, 0.0) + boost
        
        # 3. Find best match
        if not scores:
            return Intent(
                type=IntentType.GENERAL,
                confidence=0.5,
                suggested_response_format="text",
            )
        
        best_intent = max(scores, key=scores.get)
        best_score = scores[best_intent]
        
        # 4. Extract entities
        entities = self._extract_intent_entities(user_input, best_intent)
        
        # 5. Determine response format
        response_format = self._get_suggested_format(best_intent, entities)
        
        # 6. Generate follow-up suggestions
        follow_ups = self._generate_follow_ups(best_intent, entities)
        
        return Intent(
            type=best_intent,
            confidence=min(best_score, 1.0),
            entities=entities,
            parameters=self._extract_parameters(user_input, best_intent),
            suggested_response_format=response_format,
            follow_up_suggestions=follow_ups,
        )
    
    def _extract_intent_entities(self, text: str, intent: IntentType) -> list[str]:
        """Extract entities liên quan đến intent"""
        entities = []
        normalized = text.lower()
        
        # Common metric entities
        metric_patterns = [
            (r"doanh\s*thu", "revenue"),
            (r"đơn\s*(?:hàng)?", "orders"),
            (r"chi\s*phí", "cost"),
            (r"khách\s*(?:hàng)?", "customers"),
            (r"lead", "leads"),
            (r"roas", "roas"),
        ]
        
        for pattern, name in metric_patterns:
            if re.search(pattern, normalized):
                entities.append(name)
        
        return entities
    
    def _extract_parameters(self, text: str, intent: IntentType) -> dict[str, Any]:
        """Extract parameters từ input"""
        params = {}
        normalized = text.lower()
        
        # Time period
        if match := re.search(r"(?:tháng|tuần|quý|năm)\s*(\d+)", normalized):
            params["period"] = match.group(0)
        
        # Row number
        if match := re.search(r"dòng\s*[#\s]*(\d+)", normalized):
            params["row_number"] = int(match.group(1))
        
        # Comparison period
        if re.search(r"(?:tháng|tuần)\s+trước", normalized):
            params["compare_to"] = "previous_period"
        
        return params
    
    def _get_suggested_format(self, intent: IntentType, entities: list[str]) -> str:
        """Xác định format phản hồi phù hợp"""
        format_mapping = {
            IntentType.KPI_QUERY: "text",
            IntentType.TREND_ANALYSIS: "text",
            IntentType.COMPARISON: "table",
            IntentType.ANOMALY_DETECTION: "list",
            IntentType.DATA_INSPECTION: "table",
            IntentType.ROW_DETAILS: "text",
            IntentType.CAUSATION: "text",
            IntentType.CORRELATION: "text",
            IntentType.VISUALIZATION: "chart",
            IntentType.ACTION_RECOMMENDATION: "list",
            IntentType.NEXT_STEPS: "list",
            IntentType.GREETING: "text",
            IntentType.GENERAL: "text",
            IntentType.CLARIFICATION: "text",
            IntentType.DATA_DEFINITION: "text",
        }
        return format_mapping.get(intent, "text")
    
    def _generate_follow_ups(self, intent: IntentType, entities: list[str]) -> list[str]:
        """Generate follow-up suggestions"""
        suggestions = {
            IntentType.KPI_QUERY: [
                "Bạn có muốn so sánh với kỳ trước không?",
                "Có muốn xem chi tiết theo từng tháng không?",
            ],
            IntentType.TREND_ANALYSIS: [
                "Có muốn biết nguyên nhân của xu hướng này không?",
                "Bạn có muốn dự báo cho kỳ tới không?",
            ],
            IntentType.ANOMALY_DETECTION: [
                "Có muốn xem chi tiết dòng bất thường không?",
                "Bạn có muốn biết nguyên nhân không?",
            ],
            IntentType.CAUSATION: [
                "Có muốn xem tương quan giữa các yếu tố không?",
                "Bạn có muốn đề xuất hành động cụ thể không?",
            ],
            IntentType.VISUALIZATION: [
                "Có muốn tôi gợi ý cách cải thiện không?",
                "Bạn có muốn tạo campaign từ insight này không?",
            ],
        }
        return suggestions.get(intent, [])
