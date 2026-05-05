"""
Guidance Agent - Hướng dẫn user khi không có data source
Cung cấp: best practices, format CSV, gợi ý metrics, cách bắt đầu
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any


@dataclass
class GuidanceResult:
    """Kết quả guidance"""
    success: bool = True
    message: str = ""
    guidance_type: str = ""  # "how_to", "recommendation", "best_practice", "csv_format", "metrics"
    suggestions: list[str] = field(default_factory=list)
    examples: list[str] = field(default_factory=list)
    action_buttons: list[dict] = field(default_factory=list)  # [{label, action}]
    next_steps: list[str] = field(default_factory=list)


class GuidanceAgent:
    """
    Agent để hướng dẫn user khi không có data source.
    Cung cấp:
    - How to get started
    - Best practices
    - CSV format recommendations
    - Metrics suggestions
    """
    
    # Guidance templates
    GUIDANCE_TEMPLATES = {
        "how_to": {
            "title": "Bắt đầu với AI Analyst",
            "steps": [
                "**Bước 1: Chuẩn bị dữ liệu** - Upload file CSV/Excel hoặc tạo bảng thủ công",
                "**Bước 2: Phân tích tự động** - Tôi sẽ phân tích và đề xuất insights",
                "**Bước 3: Trò chuyện** - Hỏi bất cứ câu nào về dữ liệu của bạn",
                "**Bước 4: Hành động** - Tạo campaign từ insights hoặc xuất báo cáo",
            ],
            "tips": [
                "Dữ liệu càng đầy đủ, insights càng chính xác",
                "Nên có ít nhất 1 cột ngày/tháng để phân tích xu hướng",
                "Các cột số (doanh thu, đơn hàng...) giúp tính KPI tự động",
            ],
        },
        "best_practice": {
            "title": "Best Practices cho Phân tích Dữ liệu",
            "practices": [
                "**Data Quality**: Làm sạch dữ liệu trước khi phân tích (xóa dòng trùng, check lỗi chính tả)",
                "**Consistent Format**: Dùng định dạng thống nhất cho ngày tháng (DD/MM/YYYY)",
                "**Metric Definition**: Đặt tên cột rõ ràng (VD: 'Doanh_thu_VND' thay vì 'DT')",
                "**Granularity**: Chọn độ chi tiết phù hợp (theo ngày/tuần/tháng tùy mục đích)",
            ],
        },
        "csv_format": {
            "title": "Định dạng File CSV tốt nhất",
            "structure": [
                "**Dòng đầu tiên**: Tên các cột (không dấu cách, gạch dưới thay khoảng trắng)",
                "**Dòng tiếp theo**: Dữ liệu từng dòng",
                "**Cột ngày tháng**: Nên đặt tên chứa 'date', 'ngay', 'thang'",
                "**Cột số**: Không chứa ký tự (chỉ số), VD: 1000000 thay vì '1 triệu'",
            ],
            "example": {
                "good": "date,Doanh_thu_VND,So_don_hang\\n01/01/2024,50000000,150",
                "bad": "Ngày, Doanh Thu, Đơn Hàng\\n1-Jan, 50 triệu, 150 cái",
            },
            "recommended_columns": [
                "**date/thang**: Cột thời gian",
                "**doanh_thu/revenue**: Tổng doanh thu",
                "**so_don/orders**: Số đơn hàng",
                "**chi_phi_ads/ad_spend**: Chi phí quảng cáo",
                "**khach_hang/customers**: Số khách hàng mới",
            ],
        },
        "metrics": {
            "title": "Các Chỉ Số Quan Trọng Nên Theo Dõi",
            "categories": {
                "ecommerce": {
                    "name": "Thương mại điện tử",
                    "metrics": [
                        "**Revenue**: Tổng doanh thu",
                        "**Orders**: Số đơn hàng",
                        "**AOV**: Giá trị đơn hàng trung bình",
                        "**Conversion Rate**: Tỷ lệ chuyển đổi",
                        "**ROAS**: Hiệu quả quảng cáo",
                        "**Repeat Rate**: Tỷ lệ khách hàng quay lại",
                    ],
                },
                "marketing": {
                    "name": "Marketing",
                    "metrics": [
                        "**Ad Spend**: Chi phí quảng cáo",
                        "**Impressions**: Số lần hiển thị",
                        "**Clicks**: Số click",
                        "**CTR**: Tỷ lệ click",
                        "**CPC**: Chi phí mỗi click",
                        "**Leads**: Số khách tiềm năng",
                    ],
                },
                "saas": {
                    "name": "SaaS / Dịch vụ",
                    "metrics": [
                        "**MRR**: Doanh thu hàng tháng",
                        "**ARR**: Doanh thu hàng năm",
                        "**Churn Rate**: Tỷ lệ khách hàng rời bỏ",
                        "**LTV**: Giá trị vòng đời khách hàng",
                        "**CAC**: Chi phí có khách hàng mới",
                    ],
                },
            },
        },
    }
    
    def get_guidance(
        self,
        guidance_type: str,
        context: dict | None = None,
    ) -> GuidanceResult:
        """
        Get guidance for a specific type.
        
        Args:
            guidance_type: "how_to" | "best_practice" | "csv_format" | "metrics"
            context: Additional context (industry, use case)
        
        Returns:
            GuidanceResult
        """
        context = context or {}
        industry = context.get("industry", "")
        
        if guidance_type == "how_to":
            return self._guidance_how_to()
        elif guidance_type == "best_practice":
            return self._guidance_best_practice()
        elif guidance_type == "csv_format":
            return self._guidance_csv_format()
        elif guidance_type == "metrics":
            return self._guidance_metrics(industry)
        elif guidance_type == "recommendation":
            return self._guidance_recommendation(context)
        else:
            return GuidanceResult(
                success=False,
                message=f"Guidance type '{guidance_type}' không được hỗ trợ.",
            )
    
    def _guidance_how_to(self) -> GuidanceResult:
        """Hướng dẫn cách bắt đầu"""
        template = self.GUIDANCE_TEMPLATES["how_to"]
        
        return GuidanceResult(
            success=True,
            guidance_type="how_to",
            message=f"## {template['title']}\n\n" + "\n\n".join(template["steps"]),
            suggestions=template["tips"],
            action_buttons=[
                {"label": "📊 Tạo bảng mới", "action": "create_table"},
                {"label": "📁 Upload CSV", "action": "upload_csv"},
                {"label": "❓ Xem ví dụ", "action": "show_example"},
            ],
            next_steps=[
                "Tạo bảng dữ liệu mới",
                "Upload file CSV của bạn",
                "Yêu cầu tôi tạo bảng mẫu",
            ],
        )
    
    def _guidance_best_practice(self) -> GuidanceResult:
        """Hướng dẫn best practices"""
        template = self.GUIDANCE_TEMPLATES["best_practice"]
        
        return GuidanceResult(
            success=True,
            guidance_type="best_practice",
            message=f"## {template['title']}\n\n" + "\n\n".join([f"- {p}" for p in template["practices"]]),
            suggestions=[],
        )
    
    def _guidance_csv_format(self) -> GuidanceResult:
        """Hướng dẫn format CSV"""
        template = self.GUIDANCE_TEMPLATES["csv_format"]
        
        message = f"""## {template['title']}

### Cấu trúc file
""" + "\n".join([f"- {s}" for s in template["structure"]]) + """

### Ví dụ
**✅ Tốt:**
```
{template['example']['good']}
```

**❌ Không tốt:**
```
{template['example']['bad']}
```

### Các cột nên có
""" + "\n".join([f"- {c}" for c in template["recommended_columns"]])
        
        return GuidanceResult(
            success=True,
            guidance_type="csv_format",
            message=message,
            action_buttons=[
                {"label": "📥 Tải file mẫu", "action": "download_template"},
                {"label": "📁 Upload CSV", "action": "upload_csv"},
            ],
        )
    
    def _guidance_metrics(self, industry: str = "") -> GuidanceResult:
        """Gợi ý metrics theo ngành"""
        template = self.GUIDANCE_TEMPLATES["metrics"]
        
        categories = list(template["categories"].values())
        
        if industry and industry in template["categories"]:
            selected = template["categories"][industry]
            message = f"""## Metrics cho ngành: {selected['name']}

""" + "\n".join([f"- {m}" for m in selected["metrics"]])
            
            suggestions = [f"Kể từ ngành {selected['name']}, tôi gợi ý theo dõi các chỉ số trên."]
        else:
            message = f"""## Các Chỉ Số Quan Trọng

""" + "\n\n".join([
                f"### {cat['name']}\n" + "\n".join([f"- {m}" for m in cat["metrics"]])
                for cat in categories
            ])
            
            suggestions = [
                "Bạn đang kinh doanh ngành nào? Tôi có thể gợi ý cụ thể hơn.",
            ]
        
        return GuidanceResult(
            success=True,
            guidance_type="metrics",
            message=message,
            suggestions=suggestions,
            action_buttons=[
                {"label": "🏪 E-commerce", "action": "set_industry:ecommerce"},
                {"label": "📢 Marketing", "action": "set_industry:marketing"},
                {"label": "☁️ SaaS", "action": "set_industry:saas"},
            ],
        )
    
    def _guidance_recommendation(self, context: dict) -> GuidanceResult:
        """Gợi ý bước tiếp theo"""
        has_data = context.get("has_data", False)
        
        if has_data:
            message = """## Gợi ý cho bạn

Dựa trên dữ liệu của bạn, tôi đề xuất:

1. **Phân tích xu hướng** - Xem doanh thu thay đổi theo thời gian
2. **Phát hiện anomaly** - Tìm các điểm bất thường trong dữ liệu
3. **So sánh period** - Đối chiếu với kỳ trước
4. **Tạo visualization** - Trực quan hóa dữ liệu
"""
            next_steps = [
                "Phân tích xu hướng",
                "Tìm điểm bất thường",
                "So sánh với kỳ trước",
            ]
        else:
            message = """## Bạn chưa có dữ liệu?

Tôi có thể giúp bạn theo nhiều cách:

1. **📊 Tạo bảng mới** - Tôi sẽ tạo bảng với các cột phù hợp cho bạn điền
2. **📁 Upload file** - Upload CSV/Excel có sẵn
3. **❓ Hỏi tôi** - Hỏi về cách chuẩn bị dữ liệu tốt nhất
"""
            next_steps = [
                "Tạo bảng mới",
                "Upload file",
                "Hỏi về format dữ liệu",
            ]
        
        return GuidanceResult(
            success=True,
            guidance_type="recommendation",
            message=message,
            next_steps=next_steps,
            action_buttons=[
                {"label": "📊 Tạo bảng", "action": "create_table"},
                {"label": "📁 Upload CSV", "action": "upload_csv"},
                {"label": "❓ Hỏi thêm", "action": "ask_more"},
            ],
        )
    
    def classify_and_get_guidance(
        self,
        user_input: str,
        context: dict | None = None,
    ) -> tuple[str, GuidanceResult]:
        """
        Phân loại input và trả về guidance phù hợp.
        
        Returns:
            (guidance_type, GuidanceResult)
        """
        normalized = user_input.lower()
        
        # Match guidance type
        if any(kw in normalized for kw in ["làm sao", "hướng dẫn", "cách"]):
            return "how_to", self._guidance_how_to()
        
        elif any(kw in normalized for kw in ["best practice", "tốt nhất", "nên"]):
            return "best_practice", self._guidance_best_practice()
        
        elif any(kw in normalized for kw in ["file", "csv", "format", "cấu trúc", "upload"]):
            return "csv_format", self._guidance_csv_format()
        
        elif any(kw in normalized for kw in ["chỉ số", "metrics", "kpi", "theo dõi"]):
            industry = ""
            if context:
                industry = context.get("industry", "")
            return "metrics", self._guidance_metrics(industry)
        
        elif any(kw in normalized for kw in ["nên làm", "bắt đầu", "gợi ý", "recommend"]):
            return "recommendation", self._guidance_recommendation(context or {})
        
        else:
            # Default - show recommendation
            return "recommendation", self._guidance_recommendation(context or {})


def format_guidance_for_response(result: GuidanceResult) -> dict:
    """Format GuidanceResult thành dict cho API"""
    return {
        "success": result.success,
        "message": result.message,
        "guidance_type": result.guidance_type,
        "suggestions": result.suggestions,
        "examples": result.examples,
        "action_buttons": result.action_buttons,
        "next_steps": result.next_steps,
    }
