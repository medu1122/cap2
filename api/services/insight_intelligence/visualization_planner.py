"""
Visualization Planner - Gợi ý chart tự động dựa trên intent và data
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ChartSuggestion:
    """Một chart được gợi ý"""
    chart_type: str  # "line" | "bar" | "pie" | "scatter" | "area" | "table"
    title: str
    x_axis: str | None = None
    y_axis: str | None = None
    color_by: str | None = None
    config: dict = field(default_factory=dict)
    reason: str = ""
    priority: int = 1  # 1-5, cao hơn = ưu tiên hơn


@dataclass
class VisualizationPlan:
    """Plan đầy đủ về visualizations cho response"""
    suggestions: list[ChartSuggestion] = field(default_factory=list)
    primary_chart: ChartSuggestion | None = None
    alternative_charts: list[ChartSuggestion] = field(default_factory=list)
    reasoning: str = ""


class VisualizationPlanner:
    """
    Planner để suggest visualizations dựa trên:
    - Intent của câu hỏi user
    - Data context (columns, types)
    - Computation results
    """
    
    # Decision tree để chọn chart type
    CHART_DECISION_RULES = {
        # Trend over time → Line/Area
        ("trend", "time"): ["line", "area"],
        ("trend", "category"): ["bar", "line"],
        
        # Comparison → Bar/Horizontal Bar
        ("comparison", "2-5"): ["bar", "horizontal_bar"],
        ("comparison", "many"): ["horizontal_bar", "table"],
        
        # Distribution → Histogram/Pie
        ("distribution", "numeric"): ["histogram", "bar"],
        ("distribution", "categorical"): ["pie", "donut"],
        
        # Part to whole → Pie/Donut
        ("part_to_whole", "any"): ["pie", "donut", "bar"],
        
        # Correlation → Scatter
        ("correlation", "numeric"): ["scatter", "line"],
        
        # KPI summary → Big number / Gauge
        ("kpi", "simple"): ["big_number", "gauge"],
    }
    
    # Chart type descriptions
    CHART_TYPES = {
        "line": {
            "name": "Đồ thị đường",
            "description": "Hiển thị xu hướng theo thời gian",
            "best_for": ["trend", "time series", "so sánh theo thời gian"],
        },
        "bar": {
            "name": "Biểu đồ cột",
            "description": "So sánh giá trị giữa các nhóm",
            "best_for": ["comparison", "category", "ranking"],
        },
        "horizontal_bar": {
            "name": "Biểu đồ cột ngang",
            "description": "So sánh khi có nhiều categories",
            "best_for": ["comparison", "many items", "ranking"],
        },
        "pie": {
            "name": "Biểu đồ tròn",
            "description": "Hiển thị tỷ lệ phần trăm",
            "best_for": ["part_to_whole", "distribution", "share"],
        },
        "donut": {
            "name": "Biểu đồ donut",
            "description": "Tương tự pie nhưng hiện đại hơn",
            "best_for": ["part_to_whole", "distribution"],
        },
        "scatter": {
            "name": "Biểu đồ phân tán",
            "description": "Hiển thị mối quan hệ giữa 2 biến số",
            "best_for": ["correlation", "relationship", "outliers"],
        },
        "area": {
            "name": "Biểu đồ vùng",
            "description": "Hiển thị trend với độ lớn",
            "best_for": ["trend", "cumulative", "stock"],
        },
        "histogram": {
            "name": "Biểu đồ tần suất",
            "description": "Phân bố giá trị số",
            "best_for": ["distribution", "frequency", "anomaly"],
        },
        "big_number": {
            "name": "Số lớn",
            "description": "Hiển thị 1 số liệu nổi bật",
            "best_for": ["kpi", "summary", "highlight"],
        },
        "table": {
            "name": "Bảng dữ liệu",
            "description": "Hiển thị chi tiết từng giá trị",
            "best_for": ["detail", "many columns", "sortable"],
        },
    }
    
    def plan(
        self,
        intent_type: str,
        data_context,  # DataContext
        computation_result: Any = None,
        entities: dict | None = None,
    ) -> VisualizationPlan:
        """
        Generate visualization plan dựa trên context.
        
        Args:
            intent_type: Loại intent (kpi_query, trend_analysis, etc.)
            data_context: DataContext với columns info
            computation_result: Kết quả tính toán (nếu có)
            entities: Các entities đã detect
        
        Returns:
            VisualizationPlan với suggestions
        """
        suggestions: list[ChartSuggestion] = []
        
        # 1. Analyze data for chart suitability
        time_columns = self._find_columns_by_type(data_context, "date")
        numeric_columns = self._find_columns_by_type(data_context, "number")
        categorical_columns = self._find_columns_by_type(data_context, "text")
        
        primary_metric = None
        if entities and entities.get("primary_metric"):
            primary_metric = entities["primary_metric"].get("linked_column")
        
        # 2. Generate suggestions based on intent
        if intent_type == "kpi_query":
            suggestions.extend(self._suggest_kpi_charts(
                numeric_columns, primary_metric, computation_result
            ))
        
        elif intent_type == "trend_analysis":
            suggestions.extend(self._suggest_trend_charts(
                time_columns, numeric_columns, primary_metric, computation_result
            ))
        
        elif intent_type == "anomaly_detection":
            suggestions.extend(self._suggest_anomaly_charts(
                numeric_columns, primary_metric, computation_result
            ))
        
        elif intent_type == "comparison":
            suggestions.extend(self._suggest_comparison_charts(
                categorical_columns, numeric_columns, primary_metric
            ))
        
        elif intent_type == "visualization":
            # User explicitly asks for visualization
            suggestions.extend(self._suggest_general_charts(
                time_columns, numeric_columns, categorical_columns
            ))
        
        # 3. Sort by priority
        suggestions.sort(key=lambda x: x.priority, reverse=True)
        
        # 4. Create plan
        plan = VisualizationPlan(
            suggestions=suggestions,
            primary_chart=suggestions[0] if suggestions else None,
            alternative_charts=suggestions[1:4] if len(suggestions) > 1 else [],
            reasoning=self._generate_reasoning(intent_type, suggestions),
        )
        
        return plan
    
    def _find_columns_by_type(self, data_context, data_type: str) -> list:
        """Tìm columns theo data type"""
        if not data_context or not data_context.columns:
            return []
        return [c.name for c in data_context.columns if c.data_type == data_type]
    
    def _suggest_kpi_charts(
        self,
        numeric_columns: list,
        primary_metric: str | None,
        computation_result: Any,
    ) -> list[ChartSuggestion]:
        """Suggest charts cho KPI query"""
        suggestions = []
        
        # Big number - always good for KPI
        if primary_metric:
            suggestions.append(ChartSuggestion(
                chart_type="big_number",
                title=f"Tổng {primary_metric}",
                y_axis=primary_metric,
                reason="Hiển thị tổng quan số liệu chính",
                priority=5,
            ))
        
        # Breakdown chart nếu có breakdown
        if computation_result and hasattr(computation_result, 'breakdown') and computation_result.breakdown:
            suggestions.append(ChartSuggestion(
                chart_type="bar",
                title=f"Chi tiết theo danh mục",
                y_axis=primary_metric,
                config={"breakdown": computation_result.breakdown},
                reason="Hiển thị chi tiết từng phần",
                priority=4,
            ))
        
        return suggestions
    
    def _suggest_trend_charts(
        self,
        time_columns: list,
        numeric_columns: list,
        primary_metric: str | None,
        computation_result: Any,
    ) -> list[ChartSuggestion]:
        """Suggest charts cho trend analysis"""
        suggestions = []
        
        metric = primary_metric or (numeric_columns[0] if numeric_columns else None)
        time_col = time_columns[0] if time_columns else None
        
        if time_col and metric:
            # Line chart - primary choice
            suggestions.append(ChartSuggestion(
                chart_type="line",
                title=f"Xu hướng {metric} theo thời gian",
                x_axis=time_col,
                y_axis=metric,
                reason="Hiển thị rõ xu hướng tăng/giảm theo thời gian",
                priority=5,
            ))
            
            # Area chart - alternative
            suggestions.append(ChartSuggestion(
                chart_type="area",
                title=f"Xu hướng {metric} (diện tích)",
                x_axis=time_col,
                y_axis=metric,
                reason="Nhấn mạnh độ lớn của giá trị",
                priority=4,
            ))
        
        elif metric:
            # Bar chart nếu không có time column
            suggestions.append(ChartSuggestion(
                chart_type="bar",
                title=f"So sánh {metric}",
                y_axis=metric,
                reason="So sánh giá trị giữa các kỳ",
                priority=4,
            ))
        
        # Add trend info nếu có
        if computation_result and hasattr(computation_result, 'direction'):
            direction = computation_result.direction
            if direction == "up":
                suggestions[0].config["trend"] = "Tăng"
                suggestions[0].config["change_percent"] = computation_result.change_percent
            elif direction == "down":
                suggestions[0].config["trend"] = "Giảm"
                suggestions[0].config["change_percent"] = computation_result.change_percent
        
        return suggestions
    
    def _suggest_anomaly_charts(
        self,
        numeric_columns: list,
        primary_metric: str | None,
        computation_result: Any,
    ) -> list[ChartSuggestion]:
        """Suggest charts cho anomaly detection"""
        suggestions = []
        
        metric = primary_metric or (numeric_columns[0] if numeric_columns else None)
        
        if metric:
            # Scatter plot với highlighting
            suggestions.append(ChartSuggestion(
                chart_type="scatter",
                title=f"Phân bố {metric} (highlight outliers)",
                y_axis=metric,
                color_by="is_outlier",
                config={
                    "highlight_outliers": True,
                    "outliers": computation_result.outliers if computation_result and hasattr(computation_result, 'outliers') else [],
                },
                reason="Dễ dàng nhận diện điểm bất thường",
                priority=5,
            ))
            
            # Histogram
            suggestions.append(ChartSuggestion(
                chart_type="histogram",
                title=f"Phân bố tần suất {metric}",
                x_axis=metric,
                reason="Hiển thị phân bố giá trị",
                priority=4,
            ))
        
        # Table với outliers
        if computation_result and hasattr(computation_result, 'outliers') and computation_result.outliers:
            suggestions.append(ChartSuggestion(
                chart_type="table",
                title="Chi tiết các điểm bất thường",
                config={
                    "columns": ["Dòng", "Giá trị", "Lý do"],
                    "data": [
                        [o.get("row"), o.get("value"), o.get("reason")]
                        for o in computation_result.outliers[:10]
                    ],
                },
                reason="Xem chi tiết từng điểm bất thường",
                priority=3,
            ))
        
        return suggestions
    
    def _suggest_comparison_charts(
        self,
        categorical_columns: list,
        numeric_columns: list,
        primary_metric: str | None,
    ) -> list[ChartSuggestion]:
        """Suggest charts cho comparison"""
        suggestions = []
        
        metric = primary_metric or (numeric_columns[0] if numeric_columns else None)
        
        if metric:
            # Bar chart - primary
            suggestions.append(ChartSuggestion(
                chart_type="bar",
                title=f"So sánh {metric}",
                y_axis=metric,
                config={"sort": "descending"},
                reason="So sánh trực quan giữa các nhóm",
                priority=5,
            ))
            
            # Horizontal bar cho nhiều items
            if len(categorical_columns) > 0:
                suggestions.append(ChartSuggestion(
                    chart_type="horizontal_bar",
                    title=f"So sánh {metric} theo {categorical_columns[0]}",
                    x_axis=metric,
                    y_axis=categorical_columns[0],
                    reason="Thuận tiện khi có nhiều danh mục",
                    priority=4,
                ))
            
            # Pie cho 2-5 categories
            if categorical_columns:
                suggestions.append(ChartSuggestion(
                    chart_type="pie",
                    title=f"Tỷ lệ {metric} theo {categorical_columns[0]}",
                    y_axis=metric,
                    color_by=categorical_columns[0],
                    reason="Hiển thị tỷ lệ phần trăm",
                    priority=3,
                ))
        
        return suggestions
    
    def _suggest_general_charts(
        self,
        time_columns: list,
        numeric_columns: list,
        categorical_columns: list,
    ) -> list[ChartSuggestion]:
        """Suggest general charts"""
        suggestions = []
        
        # Line chart nếu có time
        if time_columns and numeric_columns:
            suggestions.append(ChartSuggestion(
                chart_type="line",
                title=f"Xu hướng {numeric_columns[0]}",
                x_axis=time_columns[0],
                y_axis=numeric_columns[0],
                reason="Biểu đồ phổ biến nhất cho dữ liệu theo thời gian",
                priority=5,
            ))
        
        # Bar chart cho comparison
        if categorical_columns and numeric_columns:
            suggestions.append(ChartSuggestion(
                chart_type="bar",
                title=f"So sánh {numeric_columns[0]} theo {categorical_columns[0]}",
                y_axis=numeric_columns[0],
                color_by=categorical_columns[0],
                reason="So sánh giữa các nhóm",
                priority=4,
            ))
        
        # Scatter cho correlation
        if len(numeric_columns) >= 2:
            suggestions.append(ChartSuggestion(
                chart_type="scatter",
                title=f"Tương quan {numeric_columns[0]} vs {numeric_columns[1]}",
                x_axis=numeric_columns[0],
                y_axis=numeric_columns[1],
                reason="Phát hiện mối quan hệ giữa 2 biến",
                priority=3,
            ))
        
        return suggestions
    
    def _generate_reasoning(self, intent_type: str, suggestions: list) -> str:
        """Generate reasoning text"""
        if not suggestions:
            return "Không có chart phù hợp cho loại truy vấn này."
        
        primary = suggestions[0]
        chart_info = self.CHART_TYPES.get(primary.chart_type, {})
        
        reasoning_map = {
            "kpi_query": f"Nên dùng {chart_info.get('name', primary.chart_type)} để hiển thị số liệu tổng quan.",
            "trend_analysis": f"{chart_info.get('name', primary.chart_type)} là lựa chọn tốt nhất để thể hiện xu hướng.",
            "anomaly_detection": f"Sử dụng {chart_info.get('name', primary.chart_type)} để dễ dàng nhận diện điểm bất thường.",
            "comparison": f"So sánh các giá trị, nên dùng {chart_info.get('name', primary.chart_type)}.",
            "visualization": f"Gợi ý {chart_info.get('name', primary.chart_type)} cho dữ liệu này.",
        }
        
        return reasoning_map.get(intent_type, f"Chart được đề xuất: {chart_info.get('name', primary.chart_type)}")
    
    def get_chart_config(self, suggestion: ChartSuggestion, data_context) -> dict:
        """
        Generate chart config cho frontend.
        Frontend có thể dùng config này để render chart.
        """
        config = {
            "type": suggestion.chart_type,
            "title": suggestion.title,
            "data": {},
            "options": {},
        }
        
        # Add axis config
        if suggestion.x_axis:
            config["data"]["x"] = suggestion.x_axis
        if suggestion.y_axis:
            config["data"]["y"] = suggestion.y_axis
        if suggestion.color_by:
            config["data"]["colorBy"] = suggestion.color_by
        
        # Add specific options
        if suggestion.chart_type == "line":
            config["options"] = {
                "showPoints": True,
                "curve": "monotone",
            }
        elif suggestion.chart_type == "bar":
            config["options"] = {
                "horizontal": False,
                "showValues": True,
            }
        elif suggestion.chart_type == "pie":
            config["options"] = {
                "showPercent": True,
                "showLegend": True,
            }
        
        # Merge suggestion config
        if suggestion.config:
            config["options"].update(suggestion.config)
        
        return config


def format_visualization_for_response(plan: VisualizationPlan) -> dict:
    """Format visualization plan cho response JSON"""
    return {
        "has_suggestions": len(plan.suggestions) > 0,
        "primary_chart": {
            "type": plan.primary_chart.chart_type if plan.primary_chart else None,
            "title": plan.primary_chart.title if plan.primary_chart else None,
            "reason": plan.primary_chart.reason if plan.primary_chart else None,
            "config": plan.primary_chart.config if plan.primary_chart else {},
        } if plan.primary_chart else None,
        "alternative_charts": [
            {
                "type": c.chart_type,
                "title": c.title,
                "reason": c.reason,
            }
            for c in plan.alternative_charts
        ],
        "reasoning": plan.reasoning,
    }
