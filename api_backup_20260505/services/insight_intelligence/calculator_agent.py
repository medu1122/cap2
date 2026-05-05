"""
Calculator Agent - Tính toán các chỉ số từ dữ liệu
Bao gồm: KPI computation, trend analysis, anomaly detection, correlation
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any
from statistics import mean, stdev


@dataclass
class ComputationResult:
    """Kết quả tính toán"""
    success: bool
    value: Any = None
    breakdown: dict | None = None
    comparison: dict | None = None
    error: str | None = None
    
    # Metadata
    computation_type: str = ""
    confidence: float = 1.0
    limitations: list[str] = field(default_factory=list)


@dataclass
class KPIResult(ComputationResult):
    """Kết quả KPI"""
    unit: str = "number"
    format: str = "number"  # "number" | "currency" | "percent"
    
    def __post_init__(self):
        self.computation_type = "kpi"


@dataclass
class TrendResult(ComputationResult):
    """Kết quả phân tích xu hướng"""
    direction: str = "flat"  # "up" | "down" | "flat"
    change_percent: float = 0.0
    change_absolute: float = 0.0
    peak: dict | None = None
    valley: dict | None = None
    
    def __post_init__(self):
        self.computation_type = "trend"


@dataclass
class AnomalyResult(ComputationResult):
    """Kết quả phát hiện anomaly"""
    outliers: list[dict] = field(default_factory=list)
    stats: dict | None = None
    
    def __post_init__(self):
        self.computation_type = "anomaly"


@dataclass
class ComparisonResult(ComputationResult):
    """Kết quả so sánh"""
    item_a: Any = None
    item_b: Any = None
    difference: float = 0.0
    difference_percent: float = 0.0
    
    def __post_init__(self):
        self.computation_type = "comparison"


class CalculatorAgent:
    """
    Agent để tính toán các chỉ số từ dữ liệu.
    Xử lý:
    - KPI computation (sum, avg, max, min, count)
    - Trend analysis (growth rate, direction)
    - Anomaly detection (IQR, Z-score)
    - Correlation analysis
    """
    
    def __init__(self):
        self._stats_cache = {}
    
    async def compute(
        self,
        computation_type: str,
        data: list[dict],
        column: str,
        context: dict | None = None,
    ) -> ComputationResult:
        """
        Main entry point để compute.
        
        Args:
            computation_type: "kpi" | "trend" | "anomaly" | "comparison"
            data: List of rows
            column: Column name to compute
            context: Additional context (periods, filters, etc.)
        
        Returns:
            ComputationResult subclass
        """
        if not data or len(data) == 0:
            return ComputationResult(success=False, error="Không có dữ liệu")
        
        if column not in data[0]:
            return ComputationResult(success=False, error=f"Cột '{column}' không tồn tại")
        
        try:
            if computation_type == "kpi":
                return await self._compute_kpi(data, column, context)
            elif computation_type == "trend":
                return await self._compute_trend(data, column, context)
            elif computation_type == "anomaly":
                return await self._compute_anomaly(data, column, context)
            elif computation_type == "comparison":
                return await self._compute_comparison(data, column, context)
            else:
                return ComputationResult(success=False, error=f"Unknown computation type: {computation_type}")
        except Exception as e:
            return ComputationResult(success=False, error=f"Lỗi tính toán: {str(e)}")
    
    async def _compute_kpi(
        self,
        data: list[dict],
        column: str,
        context: dict | None = None,
    ) -> KPIResult:
        """Tính KPI cơ bản"""
        values = self._extract_numeric_values(data, column)
        
        if not values:
            return KPIResult(success=False, error=f"Không có giá trị số trong cột '{column}'")
        
        # Compute stats
        total = sum(values)
        average = mean(values)
        max_val = max(values)
        min_val = min(values)
        count = len(values)
        
        # Determine format
        unit = context.get("unit", "number") if context else "number"
        
        # Breakdown by categories if available
        breakdown = {}
        if context and context.get("group_by"):
            group_col = context["group_by"]
            groups: dict[str, list[float]] = {}
            for row in data:
                key = str(row.get(group_col, "unknown"))
                val = self._parse_number(row.get(column, 0))
                if val is not None:
                    groups.setdefault(key, []).append(val)
            
            for key, vals in sorted(groups.items()):
                breakdown[key] = {
                    "sum": sum(vals),
                    "avg": mean(vals),
                    "count": len(vals),
                }
        
        return KPIResult(
            success=True,
            value=total,
            breakdown=breakdown,
            unit=unit,
            format="currency" if "vnd" in column.lower() or "đ" in column.lower() else "number",
            confidence=0.95 if len(values) >= 10 else 0.8,
            computation_type="kpi",
        )
    
    async def _compute_trend(
        self,
        data: list[dict],
        column: str,
        context: dict | None = None,
    ) -> TrendResult:
        """Phân tích xu hướng"""
        # Sort data by date if available
        sorted_data = self._sort_by_date(data, context)
        
        values = [self._parse_number(row.get(column, 0)) for row in sorted_data]
        values = [v for v in values if v is not None]
        
        if len(values) < 2:
            return TrendResult(
                success=False,
                error="Cần ít nhất 2 điểm dữ liệu để phân tích xu hướng"
            )
        
        # Calculate change
        first_val = values[0]
        last_val = values[-1]
        change_abs = last_val - first_val
        change_pct = ((last_val - first_val) / first_val * 100) if first_val != 0 else 0
        
        # Determine direction
        if change_pct > 5:
            direction = "up"
        elif change_pct < -5:
            direction = "down"
        else:
            direction = "flat"
        
        # Find peak and valley
        peak_idx = values.index(max(values))
        valley_idx = values.index(min(values))
        
        # Calculate growth rate (CAGR-like)
        growth_rate = self._calculate_growth_rate(values)
        
        return TrendResult(
            success=True,
            value=last_val,
            direction=direction,
            change_percent=round(change_pct, 2),
            change_absolute=round(change_abs, 2),
            peak={
                "index": peak_idx + 1,
                "value": max(values),
                "label": sorted_data[peak_idx].get(context.get("date_column", "date"), f"Điểm {peak_idx+1}") if context else f"Điểm {peak_idx+1}",
            } if sorted_data else None,
            valley={
                "index": valley_idx + 1,
                "value": min(values),
                "label": sorted_data[valley_idx].get(context.get("date_column", "date"), f"Điểm {valley_idx+1}") if context else f"Điểm {valley_idx+1}",
            } if sorted_data else None,
            breakdown={
                "first_value": first_val,
                "last_value": last_val,
                "average": round(mean(values), 2),
                "growth_rate": round(growth_rate, 2) if growth_rate is not None else None,
            },
            confidence=0.9 if len(values) >= 5 else 0.7,
            computation_type="trend",
        )
    
    async def _compute_anomaly(
        self,
        data: list[dict],
        column: str,
        context: dict | None = None,
        method: str = "iqr",
    ) -> AnomalyResult:
        """Phát hiện outliers/anomalies"""
        values = [(i, self._parse_number(row.get(column, 0))) for i, row in enumerate(data)]
        values = [(i, v) for i, v in values if v is not None]
        
        if len(values) < 3:
            return AnomalyResult(
                success=False,
                error="Cần ít nhất 3 điểm dữ liệu để phát hiện anomaly"
            )
        
        numeric_values = [v for _, v in values]
        mean_val = mean(numeric_values)
        
        if method == "iqr":
            # IQR method
            sorted_vals = sorted(numeric_values)
            q1_idx = len(sorted_vals) // 4
            q3_idx = 3 * len(sorted_vals) // 4
            q1 = sorted_vals[q1_idx]
            q3 = sorted_vals[q3_idx]
            iqr = q3 - q1
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr
            
            outliers = []
            for idx, val in values:
                if val < lower_bound or val > upper_bound:
                    delta = val - mean_val
                    delta_pct = (delta / mean_val * 100) if mean_val != 0 else 0
                    outliers.append({
                        "row": idx + 1,
                        "value": val,
                        "type": "below" if val < lower_bound else "above",
                        "bound": lower_bound if val < lower_bound else upper_bound,
                        "delta": round(delta, 2),
                        "delta_percent": round(delta_pct, 1),
                        "reason": f"{'thấp hơn' if val < lower_bound else 'cao hơn'} {abs(delta_pct):.1f}% so với trung bình",
                    })
            
            stats = {
                "method": "IQR",
                "q1": q1,
                "q3": q3,
                "iqr": iqr,
                "lower_bound": lower_bound,
                "upper_bound": upper_bound,
                "mean": mean_val,
            }
        
        else:
            # Z-score method
            std_val = stdev(numeric_values) if len(numeric_values) > 1 else 0
            
            if std_val == 0:
                return AnomalyResult(
                    success=False,
                    error="Độ lệch chuẩn bằng 0, không thể phát hiện anomaly"
                )
            
            outliers = []
            for idx, val in values:
                z_score = abs((val - mean_val) / std_val)
                if z_score > 3:
                    delta = val - mean_val
                    delta_pct = (delta / mean_val * 100) if mean_val != 0 else 0
                    outliers.append({
                        "row": idx + 1,
                        "value": val,
                        "z_score": round(z_score, 2),
                        "type": "above" if val > mean_val else "below",
                        "delta": round(delta, 2),
                        "delta_percent": round(delta_pct, 1),
                        "reason": f"{'cao hơn' if val > mean_val else 'thấp hơn'} {z_score:.1f} độ lệch chuẩn so với trung bình",
                    })
            
            stats = {
                "method": "Z-Score",
                "mean": mean_val,
                "std": std_val,
                "z_threshold": 3,
            }
        
        return AnomalyResult(
            success=True,
            value=len(outliers),
            outliers=outliers,
            stats=stats,
            confidence=0.85,
            computation_type="anomaly",
        )
    
    async def _compute_comparison(
        self,
        data: list[dict],
        column: str,
        context: dict | None = None,
    ) -> ComparisonResult:
        """So sánh 2 periods hoặc categories"""
        if not context:
            return ComparisonResult(
                success=False,
                error="Cần cung cấp context với period_a và period_b"
            )
        
        period_a = context.get("period_a")
        period_b = context.get("period_b")
        date_column = context.get("date_column", "date")
        
        if not period_a or not period_b:
            return ComparisonResult(
                success=False,
                error="Cần cung cấp period_a và period_b trong context"
            )
        
        # Filter data for each period
        values_a = []
        values_b = []
        
        for row in data:
            date_val = str(row.get(date_column, "")).lower()
            val = self._parse_number(row.get(column, 0))
            if val is None:
                continue
            
            if self._matches_period(date_val, period_a):
                values_a.append(val)
            elif self._matches_period(date_val, period_b):
                values_b.append(val)
        
        if not values_a or not values_b:
            return ComparisonResult(
                success=False,
                error="Không tìm thấy dữ liệu cho một trong hai period"
            )
        
        sum_a = sum(values_a)
        sum_b = sum(values_b)
        avg_a = mean(values_a)
        avg_b = mean(values_b)
        
        diff = sum_b - sum_a
        diff_pct = ((sum_b - sum_a) / sum_a * 100) if sum_a != 0 else 0
        
        return ComparisonResult(
            success=True,
            item_a={"period": period_a, "sum": sum_a, "avg": avg_a, "count": len(values_a)},
            item_b={"period": period_b, "sum": sum_b, "avg": avg_b, "count": len(values_b)},
            value=sum_b,
            difference=round(diff, 2),
            difference_percent=round(diff_pct, 2),
            breakdown={
                "sum_a": sum_a,
                "sum_b": sum_b,
                "avg_a": round(avg_a, 2),
                "avg_b": round(avg_b, 2),
            },
            confidence=0.9,
            computation_type="comparison",
        )
    
    def _extract_numeric_values(self, data: list[dict], column: str) -> list[float]:
        """Extract numeric values từ column"""
        values = []
        for row in data:
            val = self._parse_number(row.get(column, 0))
            if val is not None:
                values.append(val)
        return values
    
    def _parse_number(self, value: Any) -> float | None:
        """Parse giá trị thành số"""
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            # Remove common separators and symbols
            cleaned = re.sub(r"[^\d.,]", "", str(value))
            if not cleaned:
                return None
            # Handle Vietnamese number format (1.000.000,5)
            if cleaned.count(",") == 1 and cleaned.count(".") > 1:
                cleaned = cleaned.replace(".", "").replace(",", ".")
            elif cleaned.count(",") > 1:
                cleaned = cleaned.replace(",", "")
            elif "," in cleaned and "." in cleaned:
                cleaned = cleaned.replace(",", "") if cleaned.rfind(",") < cleaned.rfind(".") else cleaned.replace(",", ".")
            elif "," in cleaned:
                cleaned = cleaned.replace(",", ".")
            try:
                return float(cleaned)
            except ValueError:
                return None
        return None
    
    def _sort_by_date(self, data: list[dict], context: dict | None) -> list[dict]:
        """Sort data by date column"""
        date_col = context.get("date_column", "date") if context else "date"
        sorted_data = sorted(data, key=lambda x: str(x.get(date_col, "")))
        return sorted_data
    
    def _calculate_growth_rate(self, values: list[float]) -> float | None:
        """Calculate average growth rate"""
        if len(values) < 2 or values[0] == 0:
            return None
        
        rates = []
        for i in range(1, len(values)):
            if values[i-1] != 0:
                rate = (values[i] - values[i-1]) / values[i-1]
                rates.append(rate)
        
        return mean(rates) * 100 if rates else None
    
    def _matches_period(self, date_str: str, period: str) -> bool:
        """Check if date string matches period"""
        period = period.lower().strip()
        
        # "tháng trước", "last month"
        if "tháng trước" in period or "last month" in period:
            return True  # Simplified - should use actual date comparison
        
        # "tháng này", "this month"
        if "tháng này" in period or "this month" in period:
            return True
        
        # Specific month: "tháng 3", "march", "3/2024"
        month_match = re.search(r"tháng\s*(\d+)", period)
        if month_match:
            month = month_match.group(1)
            return month in date_str
        
        # Quarter: "Q1", "Q2"
        quarter_match = re.search(r"Q(\d)", period)
        if quarter_match:
            q = quarter_match.group(1)
            return f"Q{q}" in date_str
        
        return period in date_str


# Helper function to format computation result for response
def format_computation_for_response(result: ComputationResult) -> dict:
    """Format computation result thành dict cho response"""
    if not result.success:
        return {
            "success": False,
            "error": result.error,
        }
    
    base = {
        "success": True,
        "value": result.value,
        "confidence": result.confidence,
        "computation_type": result.computation_type,
    }
    
    if isinstance(result, KPIResult):
        base["unit"] = result.unit
        base["format"] = result.format
        if result.breakdown:
            base["breakdown"] = result.breakdown
    
    elif isinstance(result, TrendResult):
        base["direction"] = result.direction
        base["change_percent"] = result.change_percent
        base["change_absolute"] = result.change_absolute
        if result.peak:
            base["peak"] = result.peak
        if result.valley:
            base["valley"] = result.valley
    
    elif isinstance(result, AnomalyResult):
        base["outliers"] = result.outliers
        base["stats"] = result.stats
    
    elif isinstance(result, ComparisonResult):
        base["item_a"] = result.item_a
        base["item_b"] = result.item_b
        base["difference"] = result.difference
        base["difference_percent"] = result.difference_percent
    
    if result.breakdown:
        base["breakdown"] = result.breakdown
    
    return base
