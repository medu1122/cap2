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
    
    # ===== DATA QUERIES (cần data) =====
    KPI_QUERY = "kpi_query"  # "doanh thu bao nhiêu?"
    TREND_ANALYSIS = "trend_analysis"  # "xu hướng thế nào?"
    COMPARISON = "comparison"  # "so sánh với tháng trước"
    
    # ===== DATA INSPECTION (cần data) =====
    ANOMALY_DETECTION = "anomaly_detection"  # "có dòng nào bất thường?"
    DATA_INSPECTION = "data_inspection"  # "xem dòng 45"
    ROW_DETAILS = "row_details"  # "dòng này có gì?"
    
    # ===== ANALYSIS (cần data) =====
    CAUSATION = "causation"  # "tại sao giảm?"
    CORRELATION = "correlation"  # "có liên quan gì không?"
    
    # ===== DATA MANIPULATION (cần data) =====
    DATA_CREATE_COLUMN = "data_create_column"  # "tạo cột ROAS = doanh_thu / chi_phi"
    DATA_EDIT_COLUMN = "data_edit_column"  # "đổi tên cột X thành Y"
    DATA_DELETE_COLUMN = "data_delete_column"  # "xóa cột X"
    DATA_ADD_ROW = "data_add_row"  # "thêm dòng mới"
    DATA_EDIT_ROW = "data_edit_row"  # "sửa dòng 45"
    DATA_DELETE_ROW = "data_delete_row"  # "xóa dòng 45"
    DATA_COMPUTE = "data_compute"  # "tính tổng cột X"
    DATA_FILTER = "data_filter"  # "lọc các dòng có X > 100"
    DATA_SORT = "data_sort"  # "sắp xếp theo cột X"
    
    # ===== CSV / FILE OPERATIONS (cần data) =====
    CSV_APPEND = "csv_append"  # "thêm dữ liệu từ file CSV"
    CSV_REPLACE = "csv_replace"  # "thay thế bằng file mới"
    CSV_MERGE = "csv_merge"  # "gộp với file khác"
    
    # ===== ACTIONS (cần data) =====
    VISUALIZATION = "visualization"  # "nên vẽ biểu đồ gì?"
    ACTION_RECOMMENDATION = "action_recommendation"  # "làm gì với thông tin này?"
    NEXT_STEPS = "next_steps"  # "tiếp theo nên làm gì?"
    
    # ===== GENERAL / NO DATA NEEDED =====
    GREETING = "greeting"  # "xin chào"
    GENERAL = "general"  # fallback
    CLARIFICATION = "clarification"  # cần hỏi lại
    DATA_DEFINITION = "data_definition"  # "cột này là gì?"
    
    # ===== GUIDANCE MODE (không cần data - AI guidance) =====
    GUIDANCE_HOW_TO = "guidance_how_to"  # "làm sao để phân tích dữ liệu?"
    GUIDANCE_RECOMMENDATION = "guidance_recommendation"  # "tôi nên bắt đầu từ đâu?"
    GUIDANCE_BEST_PRACTICE = "guidance_best_practice"  # "cách phân tích tốt nhất là gì?"
    GUIDANCE_CSV_FORMAT = "guidance_csv_format"  # "file CSV cần có cột gì?"
    GUIDANCE_METRICS = "guidance_metrics"  # "tôi nên theo dõi chỉ số gì?"
    GUIDANCE_UNDERSTAND = "guidance_understand"  # "giải thích về phân tích dữ liệu"
    
    # ===== ONBOARDING (không cần data) =====
    HELP_REQUEST = "help_request"  # "bạn có thể làm gì?"
    SUGGEST_NEXT = "suggest_next"  # "gợi ý bước tiếp theo"


@dataclass
class Intent:
    """Kết quả phân loại intent"""
    type: IntentType
    confidence: float  # 0.0 - 1.0
    entities: list[str] = field(default_factory=list)
    parameters: dict[str, Any] = field(default_factory=dict)
    suggested_response_format: str = "text"  # "text" | "table" | "chart" | "list" | "action"
    follow_up_suggestions: list[str] = field(default_factory=list)
    requires_data: bool = True  # Intent có cần data source hay không


class IntentClassifier:
    """
    Classifier để phân loại intent từ câu hỏi của user.
    Sử dụng pattern matching + heuristics.
    """
    
    # Intent patterns - ordered by priority
    INTENT_PATTERNS = {
        # ===== GUIDANCE / NO DATA NEEDED =====
        IntentType.GREETING: [
            r"^(?:xin\s+)?chào|hello|hi|hey|chào\s+bạn",
            r"^(?:cảm\s+ơn|thanks|thank\s+you)",
        ],
        IntentType.GUIDANCE_HOW_TO: [
            r"làm\s+sao\s+(?:để|tôi|mình)",
            r"hướng\s+dẫn",
            r"chỉ\s+(?:tôi|mình)\s+(?:cách|cách\s+làm)",
            r"cách\s+(?:phân\s+tích|làm)",
            r"muốn\s+(?:biết|tìm\s+hiểu)",
        ],
        IntentType.GUIDANCE_RECOMMENDATION: [
            r"nên\s+bắt\s+đầu\s+từ",
            r"tôi\s+nên\s+(?:bắt|làm|gì)",
            r"gợi\s+ý\s+(?:cho\s+)?(?:tôi|mình)",
            r"(?:bạn|bot)\s+(?:có\s+)?thể\s+gợi",
            r"nên\s+(?:làm|lấy)\s+gì\s+trước",
        ],
        IntentType.GUIDANCE_BEST_PRACTICE: [
            r"best\s+practice",
            r"(?:cách|tip|kinh\s+nghiệm)\s+(?:phân\s+tích|tốt\s+nhất)",
            r"nên\s+(?:theo\s+dõi|đo|lường)\s+gì",
        ],
        IntentType.GUIDANCE_CSV_FORMAT: [
            r"(?:file|csv|excel)\s+(?:cần|có|nên)\s+(?:có|cột|gì)",
            r"định\s+dạng\s+(?:file|csv|excel)",
            r"cấu\s+trúc\s+(?:file|csv)",
            r"upload\s+(?:file|csv)",
        ],
        IntentType.GUIDANCE_METRICS: [
            r"(?:chỉ\s+)?số\s+(?:nên|theo\s+dõi|đo|lường)",
            r"metrics",
            r"kpi\s+(?:nên|gì)",
            r"(?:doanh\s+thu|đơn\s+hàng)\s+(?:theo|dõi)\s+gì",
        ],
        IntentType.GUIDANCE_UNDERSTAND: [
            r"(?:giải\s+thích|explain)\s+(?:về|tôi|cho\s+tôi)",
            r"(?:là\s+)?gì\s+(?:là| là)?(?:phân\s+tích|insight)",
            r"(?:phân\s+tích|insight|ai)\s+(?:là|hoạt\s+động)\s+(?:gì|như\s+thế\s+nào)",
        ],
        IntentType.HELP_REQUEST: [
            r"(?:bạn|bot)\s+(?:có\s+thể|làm)\s+(?:gì|được)",
            r"bạn\s+(?:có|hỗ\s+trợ)\s+(?:gì|chức\s+năng)",
            r"trợ\s+giúp|help",
            r"(?:chức\s+)?năng\s+(?:của|bạn)",
        ],
        IntentType.SUGGEST_NEXT: [
            r"tiếp\s+(?:theo|bước)\s+(?:nên|làm)\s+gì",
            r"gợi\s+ý\s+(?:bước|điều)\s+tiếp",
            r"nên\s+(?:làm|tạo)\s+(?:gì|chiến\s+dịch)\s+(?:tiếp|sau)",
        ],
        
        # ===== DATA QUERIES =====
        IntentType.KPI_QUERY: [
            r"bao\s+nhiêu",
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
        
        # ===== DATA INSPECTION =====
        IntentType.ANOMALY_DETECTION: [
            r"bất\s+thường",
            r"(?:dòng|cột|con\s+số)\s+(?:nào\s+)?(?:lệch|lạ|khác|bất\s+thường)",
            r"(?:có|phát\s+hiện)\s+(?:gì|điều)\s+(?:bất\s+thường|lệch|lạ)",
            r"outlier|ngoại\s+lai|lệch\s+(?:ra|khỏi)",
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
        
        # ===== ANALYSIS =====
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
        
        # ===== DATA MANIPULATION - COLUMNS =====
        IntentType.DATA_CREATE_COLUMN: [
            r"tạo\s+(?:cột|mới)",
            r"thêm\s+(?:cột|mới)",
            r"tính\s+(?:cột|thêm)\s+",
            r"tạo\s+(?:giúp\s+)?(?:tôi|mình)\s+(?:cột|cột\s+)",
            r"(?:=|:=)\s*",  # "cột X = công thức"
            r"(?:ROAS|CTR|CPC|ROI)\s*(?:=|là)",
            r"cột\s+mới\s+(?:tên|gọi|là)",
            r"(?:có\s+)?(?:thể\s+)?tạo\s+(?:thêm|cột)",
        ],
        IntentType.DATA_EDIT_COLUMN: [
            r"đổi\s+tên\s+cột",
            r"sửa\s+(?:cột|tên\s+cột)",
            r"cập\s+nhật\s+(?:cột|tên)",
            r"thay\s+đổi\s+(?:cột|tên)",
            r"rename\s+(?:cột|column)",
            r"(?:cột|trường)\s+(?:tên|là)\s+(?:thành|sang)",
        ],
        IntentType.DATA_DELETE_COLUMN: [
            r"xóa\s+(?:cột|trường)",
            r"bỏ\s+(?:cột|trường)",
            r"remove\s+(?:cột|column)",
            r"không\s+cần\s+(?:cột|trường)",
            r"xóa\s+bỏ\s+(?:cột|trường)",
        ],
        
        # ===== DATA MANIPULATION - ROWS =====
        IntentType.DATA_ADD_ROW: [
            r"thêm\s+(?:dòng|dữ\s+liệu)\s+mới",
            r"tạo\s+(?:dòng|dữ\s+liệu)\s+mới",
            r"insert\s+(?:row|dòng)",
            r"(?:dòng|dữ\s+liệu)\s+mới",
        ],
        IntentType.DATA_EDIT_ROW: [
            r"sửa\s+(?:dòng|dữ\s+liệu)",
            r"cập\s+nhật\s+(?:dòng|dữ\s+liệu)",
            r"edit\s+(?:dòng|row)",
            r"thay\s+đổi\s+(?:dòng|dữ\s+liệu)",
            r"(?:dòng|row)\s+#?\d+\s+(?:sửa|cập\s+nhật)",
        ],
        IntentType.DATA_DELETE_ROW: [
            r"xóa\s+(?:dòng|dữ\s+liệu)",
            r"remove\s+(?:dòng|row)",
            r"delete\s+(?:dòng|row)",
            r"bỏ\s+(?:dòng|dữ\s+liệu)",
            r"loại\s+bỏ\s+(?:dòng|dữ\s+liệu)",
        ],
        
        # ===== DATA OPERATIONS =====
        IntentType.DATA_COMPUTE: [
            r"tính\s+(?:tổng|trung\s+bình|max|min|count)",
            r"(?:sum|avg|average|mean|max|min|count)",
            r"tổng\s+(?:của|tất\s+cả)\s+",
            r"trung\s+bình\s+",
            r"số\s+lượng\s+",
        ],
        IntentType.DATA_FILTER: [
            r"lọc",
            r"filter",
            r"(?:có|chứa)\s+(?:giá\s+trị|dữ\s+liệu)",
            r"where\s+",
            r"nếu\s+(?:cột|dòng)\s+",
            r"(?:lớn|nhỏ|hơn|kém)\s+hơn",
        ],
        IntentType.DATA_SORT: [
            r"sắp\s+xếp",
            r"sort",
            r"order\s+by",
            r"(?:tăng|giảm)\s+(?:dần|theo)",
            r"từ\s+(?:lớn|nhỏ)\s+đến",
        ],
        
        # ===== CSV / FILE OPERATIONS =====
        IntentType.CSV_APPEND: [
            r"(?:thêm|append|merge)\s+(?:vào|cuối)\s+(?:file|csv|data)",
            r"upload\s+(?:thêm|file\s+mới)",
            r"thêm\s+(?:dữ\s+liệu|data)\s+từ\s+(?:file|csv)",
            r"import\s+(?:thêm|more)",
            r"(?:file|csv)\s+mới\s+(?:vào|thêm)",
            r"bổ\s+sung\s+(?:file|dữ\s+liệu)",
        ],
        IntentType.CSV_REPLACE: [
            r"thay\s+thế\s+(?:bằng|file)",
            r"replace\s+",
            r"(?:xóa|remove)\s+(?:hết|tất\s+cả)\s+(?:rồi|đi)\s+thêm",
            r"(?:file|csv)\s+mới\s+thay\s+thế",
        ],
        IntentType.CSV_MERGE: [
            r"gộp\s+(?:file|với)",
            r"merge\s+(?:file|csv)",
            r"combine\s+",
            r"kết\s+hợp\s+(?:file|dữ\s+liệu)",
        ],
        
        # ===== ACTIONS =====
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
        
        # ===== GENERAL =====
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
        IntentType.DATA_CREATE_COLUMN: ["tạo cột", "thêm cột", "cột mới", "tính", "computed"],
        IntentType.DATA_EDIT_COLUMN: ["sửa cột", "đổi tên", "rename", "cập nhật cột"],
        IntentType.DATA_DELETE_COLUMN: ["xóa cột", "bỏ cột", "remove column"],
        IntentType.CSV_APPEND: ["thêm file", "upload", "append", "bổ sung"],
        IntentType.GUIDANCE_HOW_TO: ["làm sao", "hướng dẫn", "cách làm", "muốn biết"],
        IntentType.GUIDANCE_METRICS: ["chỉ số", "metrics", "kpi", "theo dõi"],
    }
    
    # Intents không cần data
    NO_DATA_INTENTS = {
        IntentType.GREETING,
        IntentType.GENERAL,
        IntentType.HELP_REQUEST,
        IntentType.SUGGEST_NEXT,
        IntentType.GUIDANCE_HOW_TO,
        IntentType.GUIDANCE_RECOMMENDATION,
        IntentType.GUIDANCE_BEST_PRACTICE,
        IntentType.GUIDANCE_CSV_FORMAT,
        IntentType.GUIDANCE_METRICS,
        IntentType.GUIDANCE_UNDERSTAND,
        IntentType.CLARIFICATION,
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
                boost = keyword_count * 0.15
                scores[intent_type] = scores.get(intent_type, 0.0) + boost
        
        # 3. Special handling for data manipulation - extract column names
        if any(kw in normalized_input for kw in ["tạo", "sửa", "xóa", "thêm", "cột"]):
            params = self._extract_column_params(user_input)
        else:
            params = self._extract_parameters(user_input)
        
        # 4. Find best match
        if not scores:
            return Intent(
                type=IntentType.GENERAL,
                confidence=0.5,
                suggested_response_format="text",
                requires_data=False,
            )
        
        best_intent = max(scores, key=scores.get)
        best_score = scores[best_intent]
        if best_intent == IntentType.GREETING and self._extract_intent_entities(user_input, IntentType.KPI_QUERY):
            best_intent = IntentType.KPI_QUERY
            best_score = max(best_score, 0.75)
        
        # 5. Check if requires data
        requires_data = best_intent not in self.NO_DATA_INTENTS
        
        # 6. Extract entities
        entities = self._extract_intent_entities(user_input, best_intent)
        
        # 7. Determine response format
        response_format = self._get_suggested_format(best_intent)
        
        # 8. Generate follow-up suggestions
        follow_ups = self._generate_follow_ups(best_intent)
        
        # Merge params
        params.update(self._extract_parameters(user_input, best_intent))
        
        return Intent(
            type=best_intent,
            confidence=min(best_score, 1.0),
            entities=entities,
            parameters=params,
            suggested_response_format=response_format,
            follow_up_suggestions=follow_ups,
            requires_data=requires_data,
        )
    
    def _extract_column_params(self, text: str) -> dict[str, Any]:
        """Extract parameters cho data manipulation intents"""
        params: dict[str, Any] = {}
        normalized = text.lower()
        
        # Extract column name
        col_patterns = [
            r"(?:cột|trường|column)\s+(?:tên\s+)?(?:là| có\s+tên\s+)?(\w+)",
            r"(?:tên\s+)?cột\s+(?:là\s+)?(\w+)",
            r"(\w+)\s*(?:=|là)\s*",  # column = formula
            r"cột\s+(?:mới\s+)?(?:tên\s+)?(\w+)",
        ]
        
        for pattern in col_patterns:
            match = re.search(pattern, normalized)
            if match:
                params["column_name"] = match.group(1).strip()
                break
        
        # Extract formula (for create column)
        formula_patterns = [
            r"(?:=|:=)\s*(.+?)(?:\s*với|$)",  # cột = công thức
            r"(?:tính|tạo)\s+(?:cột\s+)?(.+?)(?:\s*từ|$)",  # tính cột X từ Y
        ]
        
        for pattern in formula_patterns:
            match = re.search(pattern, normalized)
            if match:
                params["formula"] = match.group(1).strip()
                break
        
        # Extract row number
        if match := re.search(r"dòng\s*[#\s]*(\d+)", normalized):
            params["row_number"] = int(match.group(1))
        
        # Extract operation type
        if any(kw in normalized for kw in ["tạo", "thêm"]):
            params["operation"] = "create"
        elif any(kw in normalized for kw in ["sửa", "đổi", "cập nhật"]):
            params["operation"] = "edit"
        elif any(kw in normalized for kw in ["xóa", "bỏ", "remove", "delete"]):
            params["operation"] = "delete"
        
        return params
    
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
            (r"ctr", "ctr"),
            (r"cpc", "cpc"),
        ]
        
        for pattern, name in metric_patterns:
            if re.search(pattern, normalized):
                entities.append(name)
        
        return entities
    
    def _extract_parameters(self, text: str, intent: IntentType | None = None) -> dict[str, Any]:
        """Extract parameters từ input"""
        params: dict[str, Any] = {}
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
    
    def _get_suggested_format(self, intent: IntentType) -> str:
        """Xác định format phản hồi phù hợp"""
        format_mapping = {
            # Data queries
            IntentType.KPI_QUERY: "text",
            IntentType.TREND_ANALYSIS: "text",
            IntentType.COMPARISON: "table",
            IntentType.ANOMALY_DETECTION: "list",
            IntentType.DATA_INSPECTION: "table",
            IntentType.ROW_DETAILS: "text",
            IntentType.CAUSATION: "text",
            IntentType.CORRELATION: "text",
            
            # Data manipulation
            IntentType.DATA_CREATE_COLUMN: "action",
            IntentType.DATA_EDIT_COLUMN: "action",
            IntentType.DATA_DELETE_COLUMN: "action",
            IntentType.DATA_ADD_ROW: "action",
            IntentType.DATA_EDIT_ROW: "action",
            IntentType.DATA_DELETE_ROW: "action",
            IntentType.DATA_COMPUTE: "text",
            IntentType.DATA_FILTER: "table",
            IntentType.DATA_SORT: "table",
            
            # CSV operations
            IntentType.CSV_APPEND: "action",
            IntentType.CSV_REPLACE: "action",
            IntentType.CSV_MERGE: "action",
            
            # Actions
            IntentType.VISUALIZATION: "chart",
            IntentType.ACTION_RECOMMENDATION: "list",
            IntentType.NEXT_STEPS: "list",
            
            # Guidance
            IntentType.GREETING: "text",
            IntentType.GENERAL: "text",
            IntentType.CLARIFICATION: "text",
            IntentType.DATA_DEFINITION: "text",
            IntentType.HELP_REQUEST: "list",
            IntentType.SUGGEST_NEXT: "list",
            
            # Guidance mode
            IntentType.GUIDANCE_HOW_TO: "text",
            IntentType.GUIDANCE_RECOMMENDATION: "list",
            IntentType.GUIDANCE_BEST_PRACTICE: "text",
            IntentType.GUIDANCE_CSV_FORMAT: "list",
            IntentType.GUIDANCE_METRICS: "list",
            IntentType.GUIDANCE_UNDERSTAND: "text",
        }
        return format_mapping.get(intent, "text")
    
    def _generate_follow_ups(self, intent: IntentType) -> list[str]:
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
            IntentType.DATA_CREATE_COLUMN: [
                "Bạn có muốn tạo thêm cột nào khác không?",
                "Có muốn xem lại bảng sau khi thêm cột không?",
            ],
            IntentType.GUIDANCE_HOW_TO: [
                "Bạn đã có file dữ liệu chưa? Nếu chưa, tôi có thể hướng dẫn format.",
                "Bạn muốn phân tích loại dữ liệu nào? (doanh thu, marketing, khách hàng...)",
            ],
            IntentType.GUIDANCE_METRICS: [
                "Bạn đang kinh doanh ngành nào? Tôi có thể gợi ý metrics phù hợp.",
                "Bạn có muốn tôi tạo mẫu bảng dữ liệu không?",
            ],
            IntentType.HELP_REQUEST: [
                "Bạn có thể upload file CSV để tôi phân tích.",
                "Hoặc tôi có thể tạo bảng mẫu để bạn điền dữ liệu.",
            ],
        }
        return suggestions.get(intent, [])
