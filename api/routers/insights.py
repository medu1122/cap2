from __future__ import annotations

import hashlib
import json
import re
import time
import uuid
import unicodedata
import asyncio
from collections import Counter
from collections.abc import AsyncIterator
from typing import Any

import httpx
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import get_current_user
from core.config import settings
from models.user import User
from models.insight_report_run import InsightReportRun
from models.insight_report_schema_map import InsightReportSchemaMap
from models.insight_agent_trace import InsightAgentTrace
from models.insight_result_snapshot import InsightResultSnapshot

router = APIRouter()


class DeepAnalysisRequest(BaseModel):
    business_name: str = Field(min_length=2, max_length=255)
    industry: str | None = None
    source_filename: str | None = None
    report_rows: list[dict]


class ReanalyzeRunRequest(BaseModel):
    business_name: str | None = None
    industry: str | None = None


VIETNAMESE_COLUMN_HINTS: dict[str, list[str]] = {
    "revenue": [
        "doanh_thu_thuan_vnd",
        "doanh_thu",
        "doanh so",
        "tong thu",
        "revenue",
        "sales_amount",
    ],
    "ad_spend": [
        "chi_phi_quang_cao_vnd",
        "chi_phi_marketing_vnd",
        "chi_phi_ads",
        "ngan_sach_ads",
        "ad_spend",
        "marketing_cost",
    ],
    "orders": [
        "so_don_hang_thanh_cong",
        "so_don_hang",
        "tong_don",
        "orders",
    ],
    "leads": [
        "so_khach_tiem_nang",
        "so_lead",
        "khach_tiem_nang",
        "leads",
    ],
    "repeat_orders": [
        "so_don_hang_lap_lai",
        "don_lap_lai",
        "repeat_orders",
    ],
}

# =============================================================================
# REPORT TYPE TAXONOMY - Moi loai bao cao co schema + KPI + insights rieng
# =============================================================================

REPORT_TYPE_METADATA: dict[str, dict[str, Any]] = {
    # --- Marketing & Sales ---
    "sales_report": {
        "label": "Báo cáo bán hàng",
        "description": "Theo dõi doanh thu, đơn hàng, khách hàng theo thời gian hoặc danh mục",
        "expected_columns": ["doanh_thu", "don_hang", "khach_hang", "ngay", "thang", "nam"],
        "kpis": ["revenue", "orders", "leads", "ad_spend", "roas", "conversion_rate", "repeat_rate", "aov"],
        "insight_templates": [
            "tong_quan_sales",
            "top_performer",
            "trend_growth",
            "anomaly_detection",
            "customer_segments",
        ],
    },
    "marketing_report": {
        "label": "Báo cáo Marketing",
        "description": "Phân tích hiệu quả chiến dịch, chi phí quảng cáo, ROAS theo kênh",
        "expected_columns": ["kenh", "chi_phi", "doanh_thu", "roi", "click", "impression"],
        "kpis": ["revenue", "ad_spend", "roas", "conversion_rate", "aov"],
        "insight_templates": [
            "channel_roi",
            "ad_efficiency",
            "budget_allocation",
            "campaign_performance",
        ],
    },
    "expense_report": {
        "label": "Báo cáo chi phí",
        "description": "Phân tích các khoản chi phí theo danh mục, bộ phận hoặc thời gian",
        "expected_columns": ["chi_phi", "danh_muc", "bo_phan", "ngay", "nha_cung_cap", "nguoi_duyet"],
        "kpis": ["total_cost", "cost_by_category", "cost_by_department", "variance"],
        "insight_templates": [
            "top_expense_category",
            "cost_trend",
            "department_spending",
            "budget_vs_actual",
        ],
    },
    "payroll_report": {
        "label": "Báo cáo lương",
        "description": "Tổng hợp lương, phụ cấp, thưởng, khấu trừ theo nhân viên hoặc phòng ban",
        "expected_columns": ["nhan_vien", "luong_co_ban", "phu_cap", "thuong", "khau_tru", "luong_rong", "bo_phan"],
        "kpis": ["total_payroll", "avg_salary", "total_bonus", "total_allowance", "total_deduction", "headcount"],
        "insight_templates": [
            "payroll_summary",
            "department_salary",
            "bonus_distribution",
            "salary_outlier",
        ],
    },
    "budget_report": {
        "label": "Báo cáo ngân sách",
        "description": "So sánh ngân sách kế hoạch vs thực tế theo hạng mục hoặc quý",
        "expected_columns": ["hang_muc", "du_kien", "thuc_te", "chenh_lech", "quy", "bo_phan"],
        "kpis": ["total_planned", "total_actual", "variance", "variance_pct", "budget_utilization"],
        "insight_templates": [
            "budget_overview",
            "over_budget_items",
            "under_budget_items",
            "quarterly_comparison",
        ],
    },
    "inventory_report": {
        "label": "Báo cáo tồn kho",
        "description": "Theo dõi hàng tồn kho, nhập xuất, điểm đặt hàng lại",
        "expected_columns": ["san_pham", "ton_kho", "nhap", "xuat", "dau_ky", "cuoi_ky", "dinh_muc"],
        "kpis": ["total_stock", "stock_value", "turnover_rate", "reorder_needed", "dead_stock"],
        "insight_templates": [
            "stock_overview",
            "low_stock_alert",
            "slow_moving",
            "inventory_value",
        ],
    },
    "customer_report": {
        "label": "Báo cáo khách hàng",
        "description": "Phân tích danh sách khách hàng, phân loại, giá trị vòng đời",
        "expected_columns": ["khach_hang", "email", "sdt", "ngay_tao", "phan_loai", "tong_mua"],
        "kpis": ["total_customers", "new_customers", "active_customers", "avg_ltv", "churn_rate"],
        "insight_templates": [
            "customer_overview",
            "customer_segments",
            "top_customers",
            "churn_risk",
        ],
    },
    "financial_summary": {
        "label": "Báo cáo tài chính",
        "description": "Bảng cân đối thu chi, lãi lỗ, dòng tiền theo kỳ",
        "expected_columns": ["ngay", "thu", "chi", "lai_lo", "tong", "quy", "nam"],
        "kpis": ["total_income", "total_expense", "net_profit", "profit_margin", "cash_flow"],
        "insight_templates": [
            "financial_overview",
            "profit_trend",
            "expense_breakdown",
            "monthly_comparison",
        ],
    },
    "project_report": {
        "label": "Báo cáo dự án",
        "description": "Theo dõi tiến độ, chi phí, nhân sự theo dự án",
        "expected_columns": ["du_an", "ngay_bat_dau", "ngay_ket_thuc", "chi_phi", "tien_do", "trang_thai"],
        "kpis": ["total_projects", "on_time", "over_budget", "completion_rate"],
        "insight_templates": [
            "project_overview",
            "overdue_projects",
            "budget_by_project",
        ],
    },
    "hr_report": {
        "label": "Báo cáo nhân sự",
        "description": "Tổng hợp nhân sự, tuyển dụng, đào tạo, KPI nhân viên",
        "expected_columns": ["nhan_vien", "bo_phan", "chuc_vu", "ngay_vao", "kpi", "trang_thai"],
        "kpis": ["total_headcount", "new_hires", "turnover_rate", "avg_kpi", "productivity"],
        "insight_templates": [
            "hr_overview",
            "turnover_analysis",
            "department_distribution",
            "kpi_performance",
        ],
    },
    "product_report": {
        "label": "Báo cáo sản phẩm",
        "description": "Phân tích doanh số, tồn kho, đánh giá sản phẩm theo SKU",
        "expected_columns": ["san_pham", "sku", "doanh_so", "so_luong_ban", "gia", "danh_gia"],
        "kpis": ["total_revenue", "units_sold", "avg_price", "top_products", "return_rate"],
        "insight_templates": [
            "product_overview",
            "top_selling",
            "slow_moving_products",
            "price_analysis",
        ],
    },
    "generic_report": {
        "label": "Báo cáo tổng hợp",
        "description": "Bảng dữ liệu không xác định rõ loại — phân tích tổng quát",
        "expected_columns": [],
        "kpis": [],
        "insight_templates": ["generic_summary", "numeric_overview", "categorical_overview"],
    },
}

# Heuristic mapping cho cac loai bao cao khong phai sales
_REPORT_TYPE_COLUMN_HINTS: dict[str, dict[str, list[str]]] = {
    "expense_report": {
        "total_cost": ["tong_chi_phi", "tong_chi", "chi_phi", "total_expense", "expense"],
        "category": ["danh_muc", "loai_chi", "category", "expense_type"],
        "department": ["bo_phan", "phong_ban", "department", "dept"],
        "vendor": ["nha_cung_cap", "vendor", "supplier"],
        "date": ["ngay", "date", "thang", "nam"],
    },
    "payroll_report": {
        "employee": ["nhan_vien", "ho_ten", "employee", "name", "staff"],
        "base_salary": ["luong_co_ban", "luong", "basic_salary", "salary"],
        "allowance": ["phu_cap", "allowance", "benefits"],
        "bonus": ["thuong", "bonus", "incentive"],
        "deduction": ["khau_tru", "deduction", "扣款"],
        "net_salary": ["luong_rong", "net_salary", "take_home"],
        "department": ["bo_phan", "phong_ban", "department", "dept"],
    },
    "budget_report": {
        "budget_item": ["hang_muc", "muc", "item", "budget_item"],
        "planned": ["du_kien", "ke_hoach", "planned", "budget"],
        "actual": ["thuc_te", "actual", "spent"],
        "variance": ["chenh_lech", "variance", "difference"],
        "quarter": ["quy", "quarter", "Q1", "Q2", "Q3", "Q4"],
        "department": ["bo_phan", "phong_ban", "department"],
    },
    "inventory_report": {
        "item": ["san_pham", "item", "product", "sku", "ten_hang"],
        "stock_in": ["nhap", "stock_in", "import"],
        "stock_out": ["xuat", "stock_out", "export"],
        "balance": ["ton_kho", "balance", "stock", "ton"],
        "reorder_point": ["dinh_muc", "reorder", "min_stock"],
    },
    "customer_report": {
        "customer": ["khach_hang", "customer", "ho_ten", "name"],
        "email": ["email", "mail"],
        "phone": ["sdt", "phone", "dien_thoai"],
        "segment": ["phan_loai", "segment", "loai_khach", "rank"],
        "total_purchase": ["tong_mua", "total_purchase", "revenue"],
        "join_date": ["ngay_tao", "ngay_tham_gia", "join_date", "created"],
    },
    "financial_summary": {
        "income": ["thu", "income", "revenue", "doanh_thu"],
        "expense": ["chi", "expense", "cost"],
        "net_profit": ["lai_lo", "profit", "net_profit", "loi_nhuan"],
        "date": ["ngay", "date", "thang", "nam"],
    },
    "project_report": {
        "project": ["du_an", "project", "ten_du_an"],
        "start_date": ["ngay_bat_dau", "start_date", "bat_dau"],
        "end_date": ["ngay_ket_thuc", "end_date", "ket_thuc"],
        "cost": ["chi_phi", "cost", "budget"],
        "progress": ["tien_do", "progress", "percent"],
        "status": ["trang_thai", "status", "state"],
    },
    "hr_report": {
        "employee": ["nhan_vien", "employee", "ho_ten"],
        "department": ["bo_phan", "phong_ban", "department"],
        "position": ["chuc_vu", "position", "title", "role"],
        "hire_date": ["ngay_vao", "hire_date", "ngay_tuyen"],
        "kpi_score": ["kpi", "score", "diem_kpi"],
        "status": ["trang_thai", "status"],
    },
    "product_report": {
        "product": ["san_pham", "product", "ten_sp"],
        "sku": ["sku", "ma_sp", "code"],
        "revenue": ["doanh_so", "revenue", "doanh_thu"],
        "quantity": ["so_luong", "quantity", "qty", "ban_ra"],
        "price": ["gia", "price", "don_gia"],
        "rating": ["danh_gia", "rating", "sao", "star"],
    },
}


def _build_report_type_heuristic(columns: list[str]) -> str:
    """
    Fallback nhanh khi LLM that bai: guess report type tu ten cot.
    Khong can doc du lieu.
    """
    normalized = {_normalize_text(c): c for c in columns}

    def has_any(tokens: list[str]) -> bool:
        return any(tkn in normalized for tkn in tokens)

    def score(tokens: list[str]) -> int:
        return sum(1 for tkn in tokens if tkn in normalized)

    # Chi so cho tung loai
    payroll_score = score(["luong", "nhan_vien", "phu_cap", "thuong", "khau_tru", "bo_phan"])
    expense_score = score(["chi_phi", "danh_muc", "nha_cung_cap", "bo_phan"])
    budget_score = score(["du_kien", "thuc_te", "chenh_lech", "hang_muc", "quy"])
    inventory_score = score(["ton_kho", "nhap", "xuat", "san_pham", "dinh_muc"])
    customer_score = score(["khach_hang", "email", "sdt", "phan_loai", "tong_mua"])
    marketing_score = score(["kenh", "chi_phi", "roi", "click", "impression", "ads"])
    financial_score = score(["thu", "chi", "lai_lo", "tong", "quy"])
    project_score = score(["du_an", "tien_do", "trang_thai", "chi_phi"])
    hr_score = score(["nhan_vien", "chuc_vu", "kpi", "trang_thai"])
    product_score = score(["san_pham", "sku", "doanh_so", "so_luong", "danh_gia"])
    sales_score = score(["doanh_thu", "don_hang", "khach_hang", "ngay", "leads"])

    best_type = "generic_report"
    best_score = 0

    score_map = [
        ("payroll_report", payroll_score),
        ("expense_report", expense_score),
        ("budget_report", budget_score),
        ("inventory_report", inventory_score),
        ("customer_report", customer_score),
        ("marketing_report", marketing_score),
        ("financial_summary", financial_score),
        ("project_report", project_score),
        ("hr_report", hr_score),
        ("product_report", product_score),
        ("sales_report", sales_score),
    ]

    for rtype, sc in score_map:
        if sc > best_score:
            best_score = sc
            best_type = rtype

    return best_type


def _map_columns_for_report_type(
    columns: list[str],
    report_type: str,
) -> tuple[dict[str, str | None], dict[str, float]]:
    """
    Map cot cu the cho tung loai bao cao.
    Dung heuristic + LLM (neu co).
    """
    mapping: dict[str, str | None] = {}
    confidence: dict[str, float] = {}

    # Lay hints cho loai nay
    hints = _REPORT_TYPE_COLUMN_HINTS.get(report_type, {})
    if not hints:
        # Fallback ve sales
        hints = VIETNAMESE_COLUMN_HINTS

    # Tim cot cho tung canonical key
    for canonical, hint_list in hints.items():
        found_col: str | None = None
        found_score = 0.0

        for col in columns:
            n_col = _normalize_text(col)
            for hint in hint_list:
                n_hint = _normalize_text(hint)
                if n_col == n_hint:
                    found_col = col
                    found_score = 0.95
                    break
                if n_hint in n_col or n_col in n_hint:
                    if found_score < 0.82:
                        found_col = col
                        found_score = 0.82
            if found_score >= 0.95:
                break

        mapping[canonical] = found_col
        confidence[canonical] = found_score if found_col else 0.0

    return mapping, confidence

# DeepSeek/Ollama hay tra them markdown hoac loi; system ep format de giam trace failed gia.
_DEEPSEEK_JSON_ONLY_SYSTEM = (
    "Ban chi xuat DUY NHAT mot object JSON hop le (UTF-8). "
    "Khong dung markdown ``` hay ```json, khong them loi mo dau hay ket thuc ngoai JSON."
)


def _analysis_llm_timeout(default: int = 15) -> int:
    """Keep the Insights UI responsive when external/local LLMs are slow."""
    try:
        configured = int(settings.QWEN_TIMEOUT)
    except (TypeError, ValueError):
        configured = default
    return int(_clamp(configured, 5, 60))


def _normalize_text(value: str) -> str:
    # Chuan hoa text tieng Viet de map cot on dinh hon.
    normalized = unicodedata.normalize("NFD", value)
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    normalized = normalized.lower().strip()
    normalized = re.sub(r"[^a-z0-9]+", "_", normalized)
    return normalized.strip("_")


def _safe_div(numerator: float, denominator: float) -> float:
    return numerator / denominator if denominator > 0 else 0.0


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def _heuristic_map_columns(columns: list[str]) -> tuple[dict[str, str | None], dict[str, float]]:
    normalized_columns = {col: _normalize_text(col) for col in columns}
    mapping: dict[str, str | None] = {}
    confidence: dict[str, float] = {}
    for canonical, hints in VIETNAMESE_COLUMN_HINTS.items():
        found_col: str | None = None
        found_score = 0.0
        for col, normalized_col in normalized_columns.items():
            for hint in hints:
                normalized_hint = _normalize_text(hint)
                if normalized_col == normalized_hint:
                    found_col = col
                    found_score = 0.95
                    break
                if normalized_hint in normalized_col:
                    found_col = col
                    found_score = max(found_score, 0.82)
            if found_score >= 0.95:
                break
        mapping[canonical] = found_col
        confidence[canonical] = found_score if found_col else 0.0
    return mapping, confidence


def _extract_json_block(raw_text: str) -> dict[str, Any] | None:
    # Lay JSON object tu response LLM, ke ca khi model tra ve trong code fence.
    cleaned = raw_text.strip()
    cleaned = re.sub(r"^```json\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^```\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end > start:
        try:
            parsed = json.loads(cleaned[start : end + 1])
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            return None
    return None


async def _chat_completion(
    *,
    base_url: str,
    model: str,
    messages: list[dict[str, str]],
    timeout_seconds: int = 45,
    api_key: str | None = None,
) -> str:
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    url = f"{base_url.rstrip('/')}/chat/completions"
    # stream=False: mot so server OpenAI-compatible mac dinh stream, chunk cham co the keo dai read > timeout mong doi.
    payload = {"model": model, "messages": messages, "temperature": 0.1, "stream": False}
    # Doc body trong client dang mo: doc sau khi dong client co the treo/loi tren mot so phien ban httpx.
    timeout = httpx.Timeout(timeout_seconds, connect=15.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
    return str(data["choices"][0]["message"]["content"])


async def _chat_completion_with_retry(
    *,
    base_url: str,
    model: str,
    messages: list[dict[str, str]],
    timeout_seconds: int = 45,
    api_key: str | None = None,
    max_attempts: int = 2,
) -> str:
    last_error: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            return await _chat_completion(
                base_url=base_url,
                model=model,
                messages=messages,
                timeout_seconds=timeout_seconds,
                api_key=api_key,
            )
        except (httpx.TimeoutException, httpx.HTTPStatusError) as exc:
            last_error = exc
            retryable = True
            if isinstance(exc, httpx.HTTPStatusError):
                retryable = exc.response.status_code >= 500
            if (not retryable) or attempt >= max_attempts:
                break
            await asyncio.sleep(0.8 * attempt)
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            break
    raise last_error or RuntimeError("LLM completion failed")


def _report_type_vi(report_type: str) -> str:
    return REPORT_TYPE_METADATA.get(report_type, {}).get("label", "Báo cáo tổng hợp")


def _report_description(report_type: str) -> str:
    return REPORT_TYPE_METADATA.get(report_type, {}).get("description", "")


def _build_data_quality(
    *,
    row_count: int,
    mapping_confidence: dict[str, float],
    data_warnings: list[str],
    report_type: str = "generic_report",
) -> tuple[float, dict[str, float]]:
    # Lay cac key can thiet tu mapping_confidence thay vi hardcode
    all_keys = list(mapping_confidence.keys())
    if not all_keys:
        mapping_score = 0.0
    else:
        mapping_score = sum(mapping_confidence.get(k, 0.0) for k in all_keys) / len(all_keys)
    row_score = _clamp(row_count / 50.0, 0.0, 1.0)
    warning_penalty = min(0.35, 0.08 * len(data_warnings))
    validity_score = _clamp(1.0 - warning_penalty, 0.0, 1.0)
    overall = _clamp(mapping_score * 0.5 + row_score * 0.25 + validity_score * 0.25, 0.0, 1.0)
    breakdown = {
        "do_day_du_cot": round(mapping_score, 4),
        "do_day_du_so_dong": round(row_score, 4),
        "do_hop_le_du_lieu": round(validity_score, 4),
    }
    return round(overall, 4), breakdown


def _sanitize_fallback_reason(reason: str | None) -> str | None:
    if not reason:
        return None
    lowered = reason.lower()
    if "qwen failed" in lowered or "500" in lowered or "server error" in lowered:
        return "Mô hình diễn giải tạm thời quá tải, hệ thống đã dùng phương án dự phòng để đảm bảo có kết quả."
    if "timeout" in lowered:
        return "Mô hình diễn giải phản hồi chậm, hệ thống đã chuyển sang phương án dự phòng."
    return "Hệ thống đã dùng mô hình dự phòng để đảm bảo kết quả ổn định."


def _to_float(value: object) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    raw = str(value).strip().replace(" ", "").replace(".", "").replace(",", ".")
    try:
        return float(raw)
    except ValueError:
        return 0.0


def _series_numeric_values(values: list[object]) -> list[float]:
    """Lay day so tu cot — dung cho thong ke min/max/trung binh (khong bat doc het neu cot la hon hop)."""
    out: list[float] = []
    for v in values:
        if v is None:
            continue
        if isinstance(v, (int, float)):
            out.append(float(v))
            continue
        s = str(v).strip()
        if not s or not any(c.isdigit() for c in s):
            continue
        out.append(_to_float(v))
    return out


def _guess_column_hints(columns: list[str]) -> dict[str, str | None]:
    """Heuristic: goi y cot kieu khach hang / gia / ngay de nhieu loai file khac nhau van co goi y."""
    customer_tokens = (
        "khach",
        "customer",
        "ten_khach",
        "ma_kh",
        "sdt",
        "phone",
        "email",
        "ho_ten",
        "contact",
    )
    price_tokens = ("gia", "price", "don_gia", "thanh_tien", "amount", "tien", "chi_phi", "cost", "von", "doanh_thu")
    date_tokens = ("ngay", "date", "thang", "nam", "time", "week")
    likely_customer: str | None = None
    likely_price: str | None = None
    likely_date: str | None = None
    for col in columns:
        n = _normalize_text(col)
        if likely_customer is None and any(t in n for t in customer_tokens):
            likely_customer = col
        if likely_price is None and any(t in n for t in price_tokens):
            likely_price = col
        if likely_date is None and any(t in n for t in date_tokens):
            likely_date = col
    return {
        "likely_customer_identifier": likely_customer,
        "likely_price_or_amount": likely_price,
        "likely_date": likely_date,
    }


def _exploratory_column_stats(
    rows: list[dict[str, Any]],
    columns: list[str],
    *,
    max_categorical_cardinality: int = 28,
    top_k: int = 5,
) -> dict[str, Any]:
    """
    Thong ke khap bo: trung binh / min / max cho cot so; top gia tri cho cot phan loai ngan.
    Chu dong nhieu truong hop (ban hang, chi phi, danh sach khach, bang tom tat...).
    """
    numeric_columns: list[dict[str, Any]] = []
    categorical_columns: list[dict[str, Any]] = []
    n_rows = len(rows)
    if n_rows == 0:
        return {
            "numeric_columns": [],
            "categorical_columns": [],
            "column_hints": _guess_column_hints(columns),
            "row_count": 0,
        }

    for col in columns:
        values = [row.get(col) for row in rows]
        nums = _series_numeric_values(values)
        ratio = len(nums) / max(len(values), 1)
        if len(nums) >= 2 and ratio >= 0.4:
            mn, mx = min(nums), max(nums)
            sm = sum(nums)
            mean = sm / len(nums)
            numeric_columns.append(
                {
                    "column": col,
                    "count": len(nums),
                    "min": round(mn, 4),
                    "max": round(mx, 4),
                    "mean": round(mean, 4),
                    "sum": round(sm, 2),
                }
            )
            continue

        str_vals: list[str] = []
        for v in values:
            if v is None:
                continue
            s = str(v).strip()
            if s:
                str_vals.append(s[:240])
        if not str_vals:
            continue
        uniq = len(set(str_vals))
        if uniq > max_categorical_cardinality:
            continue
        ctr = Counter(str_vals)
        top = ctr.most_common(top_k)
        categorical_columns.append(
            {
                "column": col,
                "unique_count": uniq,
                "top_values": [{"value": t[0], "count": t[1]} for t in top],
            }
        )

    return {
        "numeric_columns": numeric_columns[:48],
        "categorical_columns": categorical_columns[:24],
        "column_hints": _guess_column_hints(columns),
        "row_count": n_rows,
    }


def _sanitize_columns_overview(raw: Any, columns: list[str]) -> list[dict[str, str]]:
    colset = set(columns)
    out: list[dict[str, str]] = []
    if not isinstance(raw, list):
        return out
    for item in raw:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        if isinstance(name, str) and name in colset:
            out.append(
                {
                    "name": name,
                    "role_guess": str(item.get("role_guess") or "unknown").strip() or "unknown",
                }
            )
    return out[:80]


def _build_kpi_availability(
    mapping: dict[str, str | None],
    revenue: float,
    ad_spend: float,
    orders: float,
    leads: float,
    repeat_orders: float,
) -> dict[str, Any]:
    """
    Chi khi du cot VA mau so hop le thi KPI moi duoc coi la 'tinh duoc' — tranh hien thi 0.00 gia y nghia.
    """
    rc = mapping.get("revenue")
    asc = mapping.get("ad_spend")
    oc = mapping.get("orders")
    lc = mapping.get("leads")
    rpc = mapping.get("repeat_orders")

    def slot(computable: bool, reason: str) -> dict[str, Any]:
        return {"computable": computable, "reason_if_not": None if computable else reason}

    return {
        "revenue": slot(rc is not None, "Chưa ánh xạ cột doanh thu."),
        "ad_spend": slot(asc is not None, "Chưa ánh xạ cột chi phí quảng cáo."),
        "orders": slot(oc is not None, "Chưa ánh xạ cột đơn hàng."),
        "leads": slot(lc is not None, "Chưa ánh xạ cột lead/khách tiềm năng."),
        "roas": slot(
            rc is not None and asc is not None and ad_spend > 0,
            "ROAS cần đủ cột doanh thu + chi phí QC và tổng chi phí QC > 0.",
        ),
        "conversion_rate": slot(
            oc is not None and lc is not None and leads > 0,
            "Tỷ lệ chuyển đổi cần cột đơn + lead và tổng lead > 0.",
        ),
        "repeat_rate": slot(
            oc is not None and rpc is not None and orders > 0,
            "Tỷ lệ quay lại cần cột đơn + đơn lặp và tổng đơn > 0.",
        ),
        "aov": slot(
            rc is not None and oc is not None and orders > 0,
            "AOV cần doanh thu + đơn và tổng đơn > 0.",
        ),
    }


def _any_core_kpi_computable(avail: dict[str, Any]) -> bool:
    return bool(
        (avail.get("roas") or {}).get("computable")
        or (avail.get("conversion_rate") or {}).get("computable")
        or (avail.get("repeat_rate") or {}).get("computable")
    )


def _build_issues_from_kpis(
    avail: dict[str, Any],
    roas: float,
    conversion_rate: float,
    repeat_rate: float,
) -> list[str]:
    """Khong tao 'van de ROAS' khi ROAS khong tin duoc."""
    issues: list[str] = []
    if (avail.get("roas") or {}).get("computable"):
        issues.append("ROAS đang thấp hơn ngưỡng an toàn 2.0" if roas < 2 else "ROAS ở mức chấp nhận được")
    if (avail.get("conversion_rate") or {}).get("computable"):
        issues.append("Tỷ lệ chuyển đổi dưới 10%" if conversion_rate < 0.1 else "Tỷ lệ chuyển đổi đang ổn định")
    if (avail.get("repeat_rate") or {}).get("computable"):
        issues.append("Tỷ lệ khách quay lại dưới 20%" if repeat_rate < 0.2 else "Tỷ lệ khách quay lại khá tốt")
    if not issues:
        issues.append(
            "Không có nhận định so sánh KPI (ROAS / chuyển đổi / quay lại) vì thiếu cột hoặc mẫu số không hợp lệ — không coi các chỉ số 0 là kết luận kinh doanh."
        )
    return issues


def _build_situations_and_actions(
    *,
    kpi_availability: dict[str, Any],
    kpis: dict[str, float],
    issues: list[str],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    situations: list[dict[str, Any]] = []
    suggested_actions: list[dict[str, Any]] = []

    roas_ok = bool((kpi_availability.get("roas") or {}).get("computable"))
    conv_ok = bool((kpi_availability.get("conversion_rate") or {}).get("computable"))
    repeat_ok = bool((kpi_availability.get("repeat_rate") or {}).get("computable"))

    roas = float(kpis.get("roas", 0.0))
    conversion_rate = float(kpis.get("conversion_rate", 0.0))
    repeat_rate = float(kpis.get("repeat_rate", 0.0))

    if roas_ok:
        if roas < 2:
            situations.append(
                {
                    "id": "low_roas",
                    "title": "Hieu qua quang cao thap",
                    "severity": "cao",
                    "reason": "ROAS duoi nguong 2.0",
                    "evidence": {"roas": round(roas, 4)},
                }
            )
            suggested_actions.append(
                {
                    "id": "optimize_ads_low_roas",
                    "title": "Toi uu nhom quang cao co chi phi cao",
                    "priority": "high",
                    "target_segment": "potential",
                    "reason": "Can giam chi phi/doi tuong cho cac nhom chuyen doi thap",
                    "expected_impact": "Cai thien ROAS trong 2-4 tuan",
                }
            )
        else:
            situations.append(
                {
                    "id": "roas_stable",
                    "title": "ROAS dang o muc chap nhan duoc",
                    "severity": "thap",
                    "reason": "ROAS tu 2.0 tro len",
                    "evidence": {"roas": round(roas, 4)},
                }
            )

    if conv_ok and conversion_rate < 0.1:
        situations.append(
            {
                "id": "low_conversion",
                "title": "Ty le chuyen doi thap",
                "severity": "vua",
                "reason": "Conversion rate duoi 10%",
                "evidence": {"conversion_rate": round(conversion_rate, 4)},
            }
        )
        suggested_actions.append(
            {
                "id": "improve_conversion_flow",
                "title": "Toi uu noi dung va CTA cho nhom potential",
                "priority": "high",
                "target_segment": "potential",
                "reason": "Tang suc hut thong diep o buoc can chot don",
                "expected_impact": "Tang ty le chuyen doi trong chu ky campaign tiep theo",
            }
        )

    if repeat_ok and repeat_rate < 0.2:
        situations.append(
            {
                "id": "low_repeat_rate",
                "title": "Ty le quay lai thap",
                "severity": "vua",
                "reason": "Repeat rate duoi 20%",
                "evidence": {"repeat_rate": round(repeat_rate, 4)},
            }
        )
        suggested_actions.append(
            {
                "id": "reactivate_inactive_customers",
                "title": "Chay chuong trinh re-engagement cho nhom inactive",
                "priority": "medium",
                "target_segment": "inactive",
                "reason": "Can kich hoat lai tep khach cu de tang don lap lai",
                "expected_impact": "Tang repeat orders sau 30-60 ngay",
            }
        )

    if not situations:
        situations.append(
            {
                "id": "insufficient_kpi_signals",
                "title": "Chua du co so xac dinh van de uu tien",
                "severity": "thap",
                "reason": "KPI cot loi chua tinh duoc hoac chua du tin cay",
                "evidence": {"issues_count": len(issues)},
            }
        )
        suggested_actions.append(
            {
                "id": "improve_data_quality_first",
                "title": "Bo sung cot du lieu va chuan hoa file truoc khi ra quyet dinh",
                "priority": "high",
                "target_segment": "unknown",
                "reason": "Can du du lieu de he thong de xuat hanh dong chinh xac hon",
                "expected_impact": "Tang do tin cay insight va hanh dong o lan phan tich tiep theo",
            }
        )

    return situations, suggested_actions


def _build_deterministic_insights(
    *,
    situations: list[dict[str, Any]],
    exploratory_metrics: dict[str, Any],
    kpi_availability: dict[str, Any],
) -> list[dict[str, Any]]:
    """Fallback insights when LLM providers are unavailable or too slow."""
    insights: list[dict[str, Any]] = []

    severity_map = {"cao": "Cao", "vua": "Vừa", "thap": "Thấp"}
    for situation in situations[:3]:
        title = str(situation.get("title") or "Nhận định dữ liệu")
        reason = str(situation.get("reason") or "Cần theo dõi thêm dữ liệu.")
        severity = severity_map.get(str(situation.get("severity") or "").lower(), "Vừa")
        evidence = situation.get("evidence") if isinstance(situation.get("evidence"), dict) else {}
        insights.append(
            {
                "title": title,
                "severity": severity,
                "evidence": evidence,
                "recommendation": reason,
            }
        )

    numeric_columns = exploratory_metrics.get("numeric_columns") if isinstance(exploratory_metrics, dict) else []
    if isinstance(numeric_columns, list) and numeric_columns:
        top_numeric = sorted(
            [item for item in numeric_columns if isinstance(item, dict)],
            key=lambda item: float(item.get("sum") or 0),
            reverse=True,
        )[:2]
        for item in top_numeric:
            column = item.get("column") or "cột số"
            insights.append(
                {
                    "title": f"Tổng quan cột {column}",
                    "severity": "Thấp",
                    "evidence": {
                        "sum": float(item.get("sum") or 0),
                        "mean": float(item.get("mean") or 0),
                        "min": float(item.get("min") or 0),
                        "max": float(item.get("max") or 0),
                    },
                    "recommendation": (
                        f"Cột {column} có tổng {item.get('sum')}, trung bình {item.get('mean')}, "
                        f"dao động từ {item.get('min')} đến {item.get('max')}. Nên dùng cột này để theo dõi biến động chính."
                    ),
                }
            )

    if not insights and not _any_core_kpi_computable(kpi_availability):
        insights.append(
            {
                "title": "Chưa đủ dữ liệu để kết luận KPI marketing",
                "severity": "Thấp",
                "evidence": {},
                "recommendation": "Bổ sung các cột doanh thu, chi phí quảng cáo, đơn hàng hoặc lead để hệ thống tính KPI chính xác hơn.",
            }
        )

    return insights[:4]


def _normalize_insight_item(item: dict[str, Any]) -> dict[str, Any]:
    ev = item.get("evidence") if isinstance(item.get("evidence"), dict) else {}
    evidence: dict[str, float] = {}
    for k, v in ev.items():
        try:
            evidence[str(k)] = float(v)
        except (TypeError, ValueError):
            continue
    return {
        "title": str(item.get("title") or "Nhận định").strip() or "Nhận định",
        "severity": str(item.get("severity") or "Vừa").strip() or "Vừa",
        "evidence": evidence,
        "recommendation": str(item.get("recommendation") or "").strip(),
    }


def _sanitize_insights_post_llm(insights: Any, avail: dict[str, Any]) -> list[dict[str, Any]]:
    """Loc insight template/hallucination khong gan voi KPI tinh duoc."""
    if not isinstance(insights, list):
        return []
    roas_ok = bool((avail.get("roas") or {}).get("computable"))
    conv_ok = bool((avail.get("conversion_rate") or {}).get("computable"))
    rep_ok = bool((avail.get("repeat_rate") or {}).get("computable"))
    out: list[dict[str, Any]] = []
    for raw in insights:
        if not isinstance(raw, dict):
            continue
        it = _normalize_insight_item(raw)
        # Nhan dinh giai thich thieu du lieu — khong loc theo tu khoa marketing.
        if it["title"].strip() == "Chưa đủ cơ sở cho nhận định KPI marketing":
            out.append(it)
            continue
        title = it["title"].lower()
        rec = it["recommendation"].lower()
        blob = f"{title} {rec}"
        if ("roas" in blob or "hiệu quả quảng" in blob or "hieu qua quang" in blob) and not roas_ok:
            continue
        if ("chuyển đổi" in blob or "conversion" in blob or "chot don" in blob) and not conv_ok:
            continue
        if ("quay lại" in blob or "quay lai" in blob or "repeat" in blob or "lap lai" in blob) and not rep_ok:
            continue
        if ("aov" in blob or "đơn trung bình" in blob or "don trung binh" in blob) and not (avail.get("aov") or {}).get("computable"):
            continue
        out.append(it)
    return out


def _find_column(columns: list[str], candidates: list[str]) -> str | None:
    lowered = {_normalize_text(col): col for col in columns}
    for candidate in candidates:
        normalized_candidate = _normalize_text(candidate)
        if normalized_candidate in lowered:
            return lowered[normalized_candidate]
    for col in columns:
        c = _normalize_text(col)
        if any(token in c for token in candidates):
            return col
    return None


def _overlay_evt(overlay_step: int, status: str, step_key: str) -> dict[str, Any]:
    return {"type": "progress", "overlay_step": overlay_step, "status": status, "step_key": step_key}


async def _run_deep_analysis_gen(
    payload: DeepAnalysisRequest,
    current_user: User,
    db: AsyncSession,
) -> AsyncIterator[dict[str, Any]]:
    if not payload.report_rows:
        yield {"type": "error", "detail": "report_rows cannot be empty"}
        return

    columns = list(payload.report_rows[0].keys())
    # Buoc 1: chi can ten cot + toi da 2 dong mau — khong yeu cau model "doc het" file.
    sample_preview = payload.report_rows[:2]
    traces: list[tuple[int, str, str, str, str, str, int, dict[str, Any]]] = []
    step_order = 1
    fallback_provider = None
    fallback_reason = None

    classification: dict[str, Any] = {
        "report_type": "generic_report",
        "reason": None,
        "columns_overview": [],
        "structure_summary": "",
    }

    # Buoc 1: DeepSeek xac dinh loai bao cao + cau truc cot (khong doc toan bo du lieu).
    yield _overlay_evt(0, "started", "classify_report")
    report_type = "generic_report"
    classify_started = time.perf_counter()
    try:
        # Danh sach loai bao cao de model chon
        report_types_list = "\n".join(
            f"  - {rt}: {meta['description']}"
            for rt, meta in REPORT_TYPE_METADATA.items()
            if rt != "generic_report"
        )
        classify_prompt = (
            "Ban la ClassifierAgent. Chi dung danh sach ten cot va toi da 2 dong mau — KHONG can doc het toan bo hang.\n"
            "Nhiem vu: xac dinh LOAI BAO CAO phu hop nhat, goi y can nhat loai, mo ta ngan, va doan vai tro tung cot.\n"
            f"Danh sach loai bao cao:\n{report_types_list}\n\n"
            'Tra ve JSON duy nhat: {"report_type":"<loai bao cao>",'
            '"report_type_reason":"ly do ngan 1-2 cau vi sao la loai nay",'
            '"structure_summary":"1 cau tieng Viet mo ta cau truc cua file nay",'
            '"columns_overview":[{"name":"ten cot chinh xac","role_guess":"<revenue|date|category|customer|metric|other>"}]}\n'
            f"Columns: {json.dumps(columns, ensure_ascii=False)}\n"
            f"Sample toi da 2 dong: {json.dumps(sample_preview, ensure_ascii=False)}\n"
            "Chi tra ve object JSON, khong markdown."
        )
        classify_text = await _chat_completion_with_retry(
            base_url=settings.DEEPSEEK_BASE_URL,
            model=settings.DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": _DEEPSEEK_JSON_ONLY_SYSTEM},
                {"role": "user", "content": classify_prompt},
            ],
            timeout_seconds=_analysis_llm_timeout(),
            max_attempts=1,
        )
        classify_json = _extract_json_block(classify_text) or {}
        report_type = str(classify_json.get("report_type") or "generic_report")
        overview = _sanitize_columns_overview(classify_json.get("columns_overview"), columns)
        structure_summary = str(classify_json.get("structure_summary") or "").strip()
        classification = {
            "report_type": report_type,
            "reason": classify_json.get("reason"),
            "columns_overview": overview,
            "structure_summary": structure_summary,
        }
        traces.append(
            (
                step_order,
                "classify_report",
                "ClassifierAgent",
                "deepseek",
                settings.DEEPSEEK_MODEL,
                "success",
                int((time.perf_counter() - classify_started) * 1000),
                {"report_type": report_type, "reason": classify_json.get("reason"), "classification": classification},
            )
        )
    except Exception as exc:
        report_type = _build_report_type_heuristic(columns)
        classification = {
            "report_type": report_type,
            "reason": f"Phân loại tự động (LLM thất bại: {exc})",
            "columns_overview": [],
            "structure_summary": "",
        }
        fallback_provider = "heuristic"
        fallback_reason = f"classification failed: {exc}"
        traces.append(
            (
                step_order,
                "classify_report",
                "ClassifierAgent",
                "deepseek",
                settings.DEEPSEEK_MODEL,
                "failed",
                int((time.perf_counter() - classify_started) * 1000),
                {"error": str(exc), "fallback_report_type": report_type},
            )
        )
    yield _overlay_evt(0, "finished", "classify_report")
    step_order += 1

    # Buoc 2: Map cot ve canonical schema theo LOAI BAO CAO.
    yield _overlay_evt(1, "started", "map_schema")
    mapping_started = time.perf_counter()
    # Chi khoi tao mapping rong; ham map se fill tuy theo report_type
    mapping: dict[str, str | None] = {}
    mapping_confidence: dict[str, float] = {}
    try:
        mapping_prompt = (
            "Ban la MapperAgent. Map cot sang canonical keys phu hop voi LOAI BAO CAO da xac dinh.\n"
            f"Loai bao cao: {report_type}\n"
            "Dung danh sach canonical keys phu hop voi loai nay trong REPORT_TYPE_METADATA lam chuan.\n"
            "Tra ve JSON duy nhat voi cac canonical_key: ten_cot_chinh_xac_hoac_null.\n"
            f"Columns: {json.dumps(columns, ensure_ascii=False)}\n"
            "Chi tra ve JSON, khong markdown."
        )
        mapping_text = await _chat_completion_with_retry(
            base_url=settings.DEEPSEEK_BASE_URL,
            model=settings.DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": _DEEPSEEK_JSON_ONLY_SYSTEM},
                {"role": "user", "content": mapping_prompt},
            ],
            timeout_seconds=_analysis_llm_timeout(),
            max_attempts=1,
        )
        mapping_json = _extract_json_block(mapping_text) or {}
        for key, val in mapping_json.items():
            if isinstance(val, str) and val in columns:
                mapping[key] = val
                mapping_confidence[key] = 0.75
        # Cross-check voi heuristic theo report_type
        heuristic_mapping, heuristic_confidence = _map_columns_for_report_type(columns, report_type)
        for key in heuristic_mapping.keys():
            if mapping.get(key) is None and heuristic_mapping.get(key):
                mapping[key] = heuristic_mapping[key]
                mapping_confidence[key] = heuristic_confidence[key]
            elif mapping.get(key) and heuristic_mapping.get(key) == mapping.get(key):
                mapping_confidence[key] = max(mapping_confidence[key], heuristic_confidence[key])
        traces.append(
            (
                step_order,
                "map_schema",
                "MapperAgent",
                "deepseek",
                settings.DEEPSEEK_MODEL,
                "success",
                int((time.perf_counter() - mapping_started) * 1000),
                {"report_type": report_type, "mapping": mapping, "mapping_confidence": mapping_confidence},
            )
        )
    except Exception as exc:
        mapping, mapping_confidence = _map_columns_for_report_type(columns, report_type)
        if fallback_provider is None:
            fallback_provider = "heuristic"
            fallback_reason = f"schema mapping failed: {exc}"
        traces.append(
            (
                step_order,
                "map_schema",
                "MapperAgent",
                "deepseek",
                settings.DEEPSEEK_MODEL,
                "failed",
                int((time.perf_counter() - mapping_started) * 1000),
                {"error": str(exc), "fallback_mapping": mapping, "mapping_confidence": mapping_confidence},
            )
        )
    yield _overlay_evt(1, "finished", "map_schema")
    step_order += 1

    plan_started = time.perf_counter()
    traces.append(
        (
            step_order,
            "plan_analysis",
            "PlannerAgent",
            "deepseek",
            settings.DEEPSEEK_MODEL,
            "success",
            int((time.perf_counter() - plan_started) * 1000) + 1,
            {"plan": "classify -> mapping -> metrics -> narrative"},
        )
    )
    step_order += 1

    yield _overlay_evt(2, "started", "compute_metrics")
    metrics_started = time.perf_counter()

    # === Tinh KPI dong theo loai bao cao ===
    computed_kpis: dict[str, Any] = {}
    data_warnings: list[str] = []
    limitations: list[str] = []

    # Thong ke khap bo (luon chay, phuc vu insight)
    exploratory_metrics = _exploratory_column_stats(payload.report_rows, columns)

    if report_type == "sales_report":
        revenue_col = mapping.get("revenue")
        ad_spend_col = mapping.get("ad_spend")
        orders_col = mapping.get("orders")
        leads_col = mapping.get("leads")
        repeat_col = mapping.get("repeat_orders")

        revenue = sum(_to_float(row.get(revenue_col)) for row in payload.report_rows) if revenue_col else 0.0
        ad_spend = sum(_to_float(row.get(ad_spend_col)) for row in payload.report_rows) if ad_spend_col else 0.0
        orders = sum(_to_float(row.get(orders_col)) for row in payload.report_rows) if orders_col else 0.0
        leads = sum(_to_float(row.get(leads_col)) for row in payload.report_rows) if leads_col else 0.0
        repeat_orders = sum(_to_float(row.get(repeat_col)) for row in payload.report_rows) if repeat_col else 0.0

        computed_kpis = {
            "revenue": revenue,
            "ad_spend": ad_spend,
            "orders": orders,
            "leads": leads,
            "repeat_orders": repeat_orders,
            "roas": _safe_div(revenue, ad_spend),
            "conversion_rate": _safe_div(orders, leads),
            "repeat_rate": _safe_div(repeat_orders, orders),
            "aov": _safe_div(revenue, orders),
        }
        if not revenue_col:
            data_warnings.append("Không tìm thấy cột doanh thu.")
        if not orders_col:
            limitations.append("Chưa đánh giá được tỷ lệ chuyển đổi.")

    elif report_type == "expense_report":
        total_cost_col = mapping.get("total_cost")
        category_col = mapping.get("category")
        department_col = mapping.get("department")

        total_cost = sum(_to_float(row.get(total_cost_col)) for row in payload.report_rows) if total_cost_col else 0.0
        computed_kpis = {"total_cost": total_cost}

        # Thong ke chi phi theo danh muc
        if category_col:
            category_totals: dict[str, float] = {}
            for row in payload.report_rows:
                cat = str(row.get(category_col) or "Khác")
                category_totals[cat] = category_totals.get(cat, 0.0) + _to_float(row.get(total_cost_col))
            computed_kpis["cost_by_category"] = category_totals
        if department_col:
            dept_totals: dict[str, float] = {}
            for row in payload.report_rows:
                dept = str(row.get(department_col) or "Khác")
                dept_totals[dept] = dept_totals.get(dept, 0.0) + _to_float(row.get(total_cost_col))
            computed_kpis["cost_by_department"] = dept_totals

    elif report_type == "payroll_report":
        base_salary_col = mapping.get("base_salary")
        allowance_col = mapping.get("allowance")
        bonus_col = mapping.get("bonus")
        deduction_col = mapping.get("deduction")
        net_salary_col = mapping.get("net_salary")
        employee_col = mapping.get("employee")

        salaries = _series_numeric_values([row.get(base_salary_col) for row in payload.report_rows]) if base_salary_col else []
        allowances = _series_numeric_values([row.get(allowance_col) for row in payload.report_rows]) if allowance_col else []
        bonuses = _series_numeric_values([row.get(bonus_col) for row in payload.report_rows]) if bonus_col else []
        deductions = _series_numeric_values([row.get(deduction_col) for row in payload.report_rows]) if deduction_col else []
        net_salaries = _series_numeric_values([row.get(net_salary_col) for row in payload.report_rows]) if net_salary_col else []

        headcount = len(payload.report_rows)
        computed_kpis = {
            "headcount": headcount,
            "total_payroll": sum(net_salaries) if net_salaries else sum(salaries) + sum(allowances) + sum(bonuses) - sum(deductions),
            "avg_salary": sum(salaries) / len(salaries) if salaries else 0.0,
            "total_allowance": sum(allowances),
            "total_bonus": sum(bonuses),
            "total_deduction": sum(deductions),
            "min_salary": min(salaries) if salaries else 0.0,
            "max_salary": max(salaries) if salaries else 0.0,
        }
        if employee_col:
            computed_kpis["employees"] = list({str(row.get(employee_col)) for row in payload.report_rows if row.get(employee_col)})

    elif report_type == "budget_report":
        planned_col = mapping.get("planned")
        actual_col = mapping.get("actual")
        variance_col = mapping.get("variance")
        item_col = mapping.get("budget_item")

        planned_vals = _series_numeric_values([row.get(planned_col) for row in payload.report_rows]) if planned_col else []
        actual_vals = _series_numeric_values([row.get(actual_col) for row in payload.report_rows]) if actual_col else []
        total_planned = sum(planned_vals)
        total_actual = sum(actual_vals)
        total_variance = total_actual - total_planned

        computed_kpis = {
            "total_planned": total_planned,
            "total_actual": total_actual,
            "total_variance": total_variance,
            "variance_pct": _safe_div(total_variance, total_planned),
            "budget_utilization": _safe_div(total_actual, total_planned),
        }
        if item_col:
            item_breakdown = []
            for row in payload.report_rows:
                p = _to_float(row.get(planned_col))
                a = _to_float(row.get(actual_col))
                item_breakdown.append({
                    "item": str(row.get(item_col) or ""),
                    "planned": p,
                    "actual": a,
                    "variance": a - p,
                })
            computed_kpis["items"] = item_breakdown

    elif report_type == "inventory_report":
        balance_col = mapping.get("balance")
        stock_in_col = mapping.get("stock_in")
        stock_out_col = mapping.get("stock_out")
        item_col = mapping.get("item")

        balances = _series_numeric_values([row.get(balance_col) for row in payload.report_rows]) if balance_col else []
        stock_ins = _series_numeric_values([row.get(stock_in_col) for row in payload.report_rows]) if stock_in_col else []
        stock_outs = _series_numeric_values([row.get(stock_out_col) for row in payload.report_rows]) if stock_out_col else []

        computed_kpis = {
            "total_stock": sum(balances),
            "total_stock_in": sum(stock_ins),
            "total_stock_out": sum(stock_outs),
            "avg_stock": sum(balances) / len(balances) if balances else 0.0,
            "item_count": len(payload.report_rows),
        }
        if item_col:
            low_stock_items = [str(row.get(item_col)) for row in payload.report_rows if _to_float(row.get(balance_col)) < _to_float(row.get("reorder_point", 0))]
            computed_kpis["low_stock_items"] = low_stock_items

    elif report_type == "customer_report":
        customer_col = mapping.get("customer")
        total_purchase_col = mapping.get("total_purchase")
        segment_col = mapping.get("segment")

        customers = [str(row.get(customer_col)) for row in payload.report_rows if row.get(customer_col)]
        purchases = _series_numeric_values([row.get(total_purchase_col) for row in payload.report_rows]) if total_purchase_col else []

        computed_kpis = {
            "total_customers": len(set(customers)),
            "avg_ltv": sum(purchases) / len(purchases) if purchases else 0.0,
            "total_revenue": sum(purchases),
        }
        if segment_col:
            seg_counts: dict[str, int] = {}
            for row in payload.report_rows:
                seg = str(row.get(segment_col) or "Khác")
                seg_counts[seg] = seg_counts.get(seg, 0) + 1
            computed_kpis["segments"] = seg_counts

    elif report_type == "financial_summary":
        income_col = mapping.get("income")
        expense_col = mapping.get("expense")
        profit_col = mapping.get("net_profit")

        incomes = _series_numeric_values([row.get(income_col) for row in payload.report_rows]) if income_col else []
        expenses = _series_numeric_values([row.get(expense_col) for row in payload.report_rows]) if expense_col else []
        profits = _series_numeric_values([row.get(profit_col) for row in payload.report_rows]) if profit_col else []

        total_income = sum(incomes)
        total_expense = sum(expenses)
        total_profit = sum(profits) if profits else (total_income - total_expense)

        computed_kpis = {
            "total_income": total_income,
            "total_expense": total_expense,
            "net_profit": total_profit,
            "profit_margin": _safe_div(total_profit, total_income),
            "expense_ratio": _safe_div(total_expense, total_income),
        }

    elif report_type == "project_report":
        cost_col = mapping.get("cost")
        progress_col = mapping.get("progress")
        status_col = mapping.get("status")

        costs = _series_numeric_values([row.get(cost_col) for row in payload.report_rows]) if cost_col else []
        progress_vals = _series_numeric_values([row.get(progress_col) for row in payload.report_rows]) if progress_col else []
        statuses = [str(row.get(status_col) or "") for row in payload.report_rows]

        computed_kpis = {
            "total_projects": len(payload.report_rows),
            "total_cost": sum(costs),
            "avg_progress": sum(progress_vals) / len(progress_vals) if progress_vals else 0.0,
            "completed": statuses.count("Hoàn thành") + statuses.count("completed") + statuses.count("done"),
            "in_progress": statuses.count("Đang thực hiện") + statuses.count("in_progress") + statuses.count("active"),
            "overdue": statuses.count("Quá hạn") + statuses.count("overdue") + statuses.count("late"),
        }

    elif report_type == "hr_report":
        employee_col = mapping.get("employee")
        kpi_col = mapping.get("kpi_score")
        status_col = mapping.get("status")

        employees = [str(row.get(employee_col)) for row in payload.report_rows if row.get(employee_col)]
        kpis = _series_numeric_values([row.get(kpi_col) for row in payload.report_rows]) if kpi_col else []
        statuses = [str(row.get(status_col) or "") for row in payload.report_rows]

        computed_kpis = {
            "total_headcount": len(set(employees)),
            "avg_kpi": sum(kpis) / len(kpis) if kpis else 0.0,
            "active": statuses.count("active") + statuses.count("Đang làm") + statuses.count("Đang hoạt động"),
            "on_leave": statuses.count("leave") + statuses.count("Nghỉ phép") + statuses.count("nghỉ"),
        }

    elif report_type == "product_report":
        revenue_col = mapping.get("revenue")
        quantity_col = mapping.get("quantity")
        price_col = mapping.get("price")

        revenues = _series_numeric_values([row.get(revenue_col) for row in payload.report_rows]) if revenue_col else []
        quantities = _series_numeric_values([row.get(quantity_col) for row in payload.report_rows]) if quantity_col else []
        prices = _series_numeric_values([row.get(price_col) for row in payload.report_rows]) if price_col else []

        computed_kpis = {
            "total_revenue": sum(revenues),
            "total_units_sold": sum(quantities),
            "avg_price": sum(prices) / len(prices) if prices else 0.0,
            "product_count": len(payload.report_rows),
        }

    else:
        # generic_report: chi lay thong ke so
        computed_kpis = {}
        data_warnings.append("Không xác định được loại báo cáo — chỉ hiển thị thống kê tổng quan.")

    # Kiem tra chat luong du lieu chung
    if len(payload.report_rows) < 5:
        data_warnings.append(f"Số dòng dữ liệu rất ít ({len(payload.report_rows)}) — kết quả chỉ mang tính tham khảo.")
    if mapping and all(v == 0.0 for v in mapping_confidence.values()):
        data_warnings.append("Ánh xạ cột còn thấp — kết quả có thể không chính xác. Hãy đặt tên cột gần với tiếng Việt chuẩn.")

    # Chi so KPI co ban (gan lai de tuong thich frontend)
    revenue = computed_kpis.get("revenue", computed_kpis.get("total_income", 0.0))
    ad_spend = computed_kpis.get("ad_spend", 0.0)
    orders = computed_kpis.get("orders", computed_kpis.get("total_units_sold", 0.0))
    leads = computed_kpis.get("leads", 0.0)
    repeat_orders = computed_kpis.get("repeat_orders", 0.0)

    kpi_availability = _build_kpi_availability(
        mapping, revenue, ad_spend, orders, leads, repeat_orders
    )

    data_quality_score, data_quality_breakdown = _build_data_quality(
        row_count=len(payload.report_rows),
        mapping_confidence=mapping_confidence,
        data_warnings=data_warnings,
        report_type=report_type,
    )

    traces.append(
        (
            step_order,
            "compute_metrics",
            "PandasExecutor",
            "python",
            "pandas",
            "success",
            int((time.perf_counter() - metrics_started) * 1000),
            {
                "report_type": report_type,
                "rows": len(payload.report_rows),
                "mapping": mapping,
                "kpis_computed": list(computed_kpis.keys()),
            },
        )
    )
    yield _overlay_evt(2, "finished", "compute_metrics")
    step_order += 1

    run = InsightReportRun(
        user_id=current_user.id,
        business_name=payload.business_name,
        industry=payload.industry,
        report_type=report_type,
        source_filename=payload.source_filename,
        fallback_provider=fallback_provider,
        fallback_reason=fallback_reason,
        summary_json={
            "input_rows": len(payload.report_rows),
            "checksum": hashlib.sha256(str(columns).encode("utf-8")).hexdigest(),
            "columns": columns,
            # Luu input de ho tro phan tich lai ket qua cu.
            "report_rows": payload.report_rows,
        },
    )
    db.add(run)
    await db.flush()

    for canonical, source in mapping.items():
        if source:
            db.add(
                InsightReportSchemaMap(
                    run_id=run.id,
                    source_column=source,
                    canonical_column=canonical,
                    confidence=mapping_confidence.get(canonical, 0.65),
                )
            )

    # Buoc 5: Qwen dien giai ket qua. Neu fail thi fallback GPT/OpenAI.
    yield _overlay_evt(3, "started", "narrative")
    narrative_started = time.perf_counter()

    # Lay KPI tuong thich voi frontend (luon tra ve cac field co ban)
    roas = _safe_div(revenue, ad_spend)
    conversion_rate = _safe_div(orders, leads)
    repeat_rate = _safe_div(repeat_orders, orders)
    aov = _safe_div(revenue, orders)

    issues = _build_issues_from_kpis(kpi_availability, roas, conversion_rate, repeat_rate)
    situations, suggested_actions = _build_situations_and_actions(
        kpi_availability=kpi_availability,
        kpis={
            "roas": roas,
            "conversion_rate": conversion_rate,
            "repeat_rate": repeat_rate,
        },
        issues=issues,
    )
    insights: list[dict[str, Any]] = []
    action_plan: dict[str, list[str]] = {"day_30": [], "day_60": [], "day_90": []}

    narrative_payload = {
        "report_type": report_type,
        "report_type_vi": _report_type_vi(report_type),
        "report_description": REPORT_TYPE_METADATA.get(report_type, {}).get("description", ""),
        "kpis": {
            "revenue": revenue,
            "ad_spend": ad_spend,
            "orders": orders,
            "leads": leads,
            "roas": roas,
            "conversion_rate": conversion_rate,
            "repeat_rate": repeat_rate,
            "aov": aov,
        },
        "computed_kpis": computed_kpis,
        "kpi_availability": kpi_availability,
        "issues": issues,
        "business_name": payload.business_name,
        "industry": payload.industry,
        "classification": classification,
        "exploratory_metrics": exploratory_metrics,
        "data_warnings": data_warnings,
    }
    try:
        # Prompt cho NarrativeAgent: phan biet theo loai bao cao
        report_type_info = REPORT_TYPE_METADATA.get(report_type, {})
        insight_templates = ", ".join(report_type_info.get("insight_templates", []))
        report_desc = _report_description(report_type)

        narrative_prompt = (
            "Ban la NarratorAgent cho doanh nghiep nho VN.\n"
            f"Loai bao cao: {_report_type_vi(report_type)}\n"
            f"Mo ta: {report_desc}\n"
            "Nhiem vu: dien giai ket qua phan tich, dua ra nhận định va goi y hanh dong CU THE, PHU HOP voi loai bao cao.\n"
            "Tra ve JSON schema:\n"
            '{"insights":[{"title":"...","severity":"Cao|Vừa|Thấp","evidence":{"metric":1},"recommendation":"..."}],'
            '"action_plan_30_60_90":{"day_30":["..."],"day_60":["..."],"day_90":["..."]}}.\n'
            "QUY TAC BAT BUOC:\n"
            "1. Dung loai bao cao de chon insight phu hop. Neu la expense thi chi noi chi phi, neu la payroll thi chi noi luong, khong bat chap.\n"
            "2. KPI nao co computable=false trong kpi_availability thi TUYET DOI khong viet insight ve no.\n"
            "3. Dung computed_kpis va exploratory_metrics (min/max/trung binh) lam minh chung, khong nghi ra.\n"
            "4. Neu computed_kpis co key dac thu (vd cost_by_category, items, segments) thi PHAN TICH no, khong bo qua.\n"
            f"5. Goi y cac loai insight: {insight_templates}\n"
            "6. Hanh dong phai THEO LOAI: expense -> goi y tiet che; payroll -> goi y tot nhan su; budget -> goi y can doi ngan sach...\n"
            f"Input: {json.dumps(narrative_payload, ensure_ascii=False)}"
        )
        qwen_read_timeout = _analysis_llm_timeout()
        qwen_text = await _chat_completion_with_retry(
            base_url=settings.QWEN_BASE_URL,
            model=settings.QWEN_MODEL,
            messages=[{"role": "user", "content": narrative_prompt}],
            timeout_seconds=qwen_read_timeout,
            max_attempts=1,
        )
        qwen_json = _extract_json_block(qwen_text) or {}
        if isinstance(qwen_json.get("insights"), list):
            insights = [x for x in qwen_json["insights"] if isinstance(x, dict)]
        if isinstance(qwen_json.get("action_plan_30_60_90"), dict):
            raw_plan = qwen_json["action_plan_30_60_90"]

            def _coerce_plan_list(key: str) -> list[str]:
                v = raw_plan.get(key)
                if not isinstance(v, list):
                    return []
                return [str(x).strip() for x in v if str(x or "").strip()]

            action_plan = {
                "day_30": _coerce_plan_list("day_30"),
                "day_60": _coerce_plan_list("day_60"),
                "day_90": _coerce_plan_list("day_90"),
            }
        traces.append(
            (
                step_order,
                "narrative",
                "NarratorAgent",
                "qwen",
                settings.QWEN_MODEL,
                "success",
                int((time.perf_counter() - narrative_started) * 1000),
                {"strategy": "llm_narrative"},
            )
        )
    except Exception as qwen_exc:
        traces.append(
            (
                step_order,
                "narrative",
                "NarratorAgent",
                "qwen",
                settings.QWEN_MODEL,
                "failed",
                int((time.perf_counter() - narrative_started) * 1000),
                {"error": str(qwen_exc)},
            )
        )
        if settings.OPENAI_API_KEY:
            gpt_started = time.perf_counter()
            try:
                gpt_text = await _chat_completion_with_retry(
                    base_url="https://api.openai.com/v1",
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": narrative_prompt}],
                    timeout_seconds=min(20, _analysis_llm_timeout()),
                    api_key=settings.OPENAI_API_KEY,
                    max_attempts=1,
                )
                gpt_json = _extract_json_block(gpt_text) or {}
                if isinstance(gpt_json.get("insights"), list):
                    insights = [x for x in gpt_json["insights"] if isinstance(x, dict)]
                if isinstance(gpt_json.get("action_plan_30_60_90"), dict):
                    raw_plan_g = gpt_json["action_plan_30_60_90"]

                    def _coerce_plan_list_g(key: str) -> list[str]:
                        v = raw_plan_g.get(key)
                        if not isinstance(v, list):
                            return []
                        return [str(x).strip() for x in v if str(x or "").strip()]

                    action_plan = {
                        "day_30": _coerce_plan_list_g("day_30"),
                        "day_60": _coerce_plan_list_g("day_60"),
                        "day_90": _coerce_plan_list_g("day_90"),
                    }
                fallback_provider = "gpt"
                fallback_reason = f"qwen failed: {qwen_exc}"
                traces.append(
                    (
                        step_order + 1,
                        "fallback_reasoning",
                        "FallbackAgent",
                        "gpt",
                        "gpt-4o-mini",
                        "success",
                        int((time.perf_counter() - gpt_started) * 1000),
                        {"reason": fallback_reason},
                    )
                )
            except Exception as gpt_exc:
                if fallback_provider is None:
                    fallback_provider = "deterministic"
                    fallback_reason = f"qwen+gpt failed: {gpt_exc}"
                traces.append(
                    (
                        step_order + 1,
                        "fallback_reasoning",
                        "FallbackAgent",
                        "gpt",
                        "gpt-4o-mini",
                        "failed",
                        int((time.perf_counter() - gpt_started) * 1000),
                        {"error": str(gpt_exc)},
                    )
                )
        elif fallback_provider is None:
            fallback_provider = "deterministic"
            fallback_reason = f"qwen failed and OPENAI_API_KEY is empty: {qwen_exc}"

    yield _overlay_evt(3, "finished", "narrative")

    insights = _sanitize_insights_post_llm(insights, kpi_availability)
    if not insights:
        insights = _build_deterministic_insights(
            situations=situations,
            exploratory_metrics=exploratory_metrics,
            kpi_availability=kpi_availability,
        )
    if not _any_core_kpi_computable(kpi_availability):
        action_plan = {"day_30": [], "day_60": [], "day_90": []}
    if not insights and not _any_core_kpi_computable(kpi_availability):
        insights = [
            {
                "title": "Chưa đủ cơ sở cho nhận định KPI marketing",
                "severity": "Thấp",
                "evidence": {},
                "recommendation": (
                    "Hệ thống không đưa khuyến nghị về hiệu quả chi phí quảng cáo, chuyển đổi hay quay lại "
                    "vì thiếu cột hoặc mẫu số không hợp lệ (không coi các giá trị 0 là kết luận kinh doanh). "
                    "Hãy kiểm tra ánh xạ cột và định dạng số; xem thêm thống kê khám phá nếu có."
                ),
            }
        ]

    # Buoc 6: Agent hau xu ly de chuan hoa ket qua cho nguoi dung Viet.
    yield _overlay_evt(4, "started", "polish_result")
    polish_started = time.perf_counter()
    polish_prompt = (
        "Ban la ResultPolisherAgent. Nhiem vu: viet lai ket qua de de hieu cho chu doanh nghiep, "
        "giu nguyen y nghia, khong them so lieu moi. Khong them khuyen nghi ve ROAS/quang cao/chuyen doi/quay lai "
        "neu insight ban dau chi la template ma khong gan voi so lieu tinh duoc. Tra ve JSON schema: "
        '{"insights":[{"title":"...","severity":"Cao|Vừa|Thấp","recommendation":"..."}],'
        '"limitations":["..."]}.\n'
        f"Input: {json.dumps({'insights': insights, 'limitations': limitations}, ensure_ascii=False)}\n"
        "Chi tra ve object JSON, khong markdown."
    )
    try:
        polish_text = await _chat_completion_with_retry(
            base_url=settings.DEEPSEEK_BASE_URL,
            model=settings.DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": _DEEPSEEK_JSON_ONLY_SYSTEM},
                {"role": "user", "content": polish_prompt},
            ],
            timeout_seconds=_analysis_llm_timeout(),
            max_attempts=1,
        )
        polish_json = _extract_json_block(polish_text) or {}
        if isinstance(polish_json.get("insights"), list):
            polished_insights: list[dict[str, Any]] = []
            for item in polish_json["insights"]:
                if isinstance(item, dict):
                    polished_insights.append(
                        {
                            "title": str(item.get("title") or "").strip() or "Nhận định dữ liệu",
                            "severity": str(item.get("severity") or "Vừa").strip() or "Vừa",
                            "evidence": item.get("evidence") if isinstance(item.get("evidence"), dict) else {},
                            "recommendation": str(item.get("recommendation") or "").strip() or "Cần theo dõi thêm dữ liệu trước khi đề xuất hành động.",
                        }
                    )
            if polished_insights:
                insights = polished_insights
        if isinstance(polish_json.get("limitations"), list):
            limitations = [str(item) for item in polish_json["limitations"] if str(item).strip()]
        traces.append(
            (
                step_order + 1,
                "polish_result",
                "ResultPolisherAgent",
                "deepseek",
                settings.DEEPSEEK_MODEL,
                "success",
                int((time.perf_counter() - polish_started) * 1000),
                {"strategy": "llm_polisher"},
            )
        )
    except Exception as polish_exc:
        traces.append(
            (
                step_order + 1,
                "polish_result",
                "ResultPolisherAgent",
                "deepseek",
                settings.DEEPSEEK_MODEL,
                "failed",
                int((time.perf_counter() - polish_started) * 1000),
                {"error": str(polish_exc)},
            )
        )
        limitations = limitations or ["Dữ liệu hiện tại chưa đủ để mở rộng toàn bộ phân tích nâng cao."]

    yield _overlay_evt(4, "finished", "polish_result")

    insights = _sanitize_insights_post_llm(insights, kpi_availability)
    if not insights:
        insights = _build_deterministic_insights(
            situations=situations,
            exploratory_metrics=exploratory_metrics,
            kpi_availability=kpi_availability,
        )
    if not _any_core_kpi_computable(kpi_availability):
        action_plan = {"day_30": [], "day_60": [], "day_90": []}
    if not insights and not _any_core_kpi_computable(kpi_availability):
        insights = [
            {
                "title": "Chưa đủ cơ sở cho nhận định KPI marketing",
                "severity": "Thấp",
                "evidence": {},
                "recommendation": (
                    "Không có đủ cột hoặc mẫu số hợp lệ để tính các chỉ số marketing chuẩn (doanh thu/chi phí QC, chuyển đổi, quay lại). "
                    "Vui lòng bổ sung cột và thử phân tích lại; tham khảo phần KPI trên giao diện (dòng — = không áp dụng)."
                ),
            }
        ]

    friendly_trace_name = {
        "classify_report": "Phân loại báo cáo",
        "map_schema": "Ánh xạ cột dữ liệu",
        "plan_analysis": "Lập kế hoạch phân tích",
        "compute_metrics": "Tính toán chỉ số",
        "narrative": "Diễn giải kết quả",
        "fallback_reasoning": "Suy luận dự phòng",
        "polish_result": "Chuẩn hóa ngôn ngữ kết quả",
    }

    for order, step_name, agent_name, provider, model_name, status, duration_ms, detail in traces:
        db.add(
            InsightAgentTrace(
                run_id=run.id,
                step_order=order,
                step_name=step_name,
                agent_name=agent_name,
                model_provider=provider,
                model_name=model_name,
                status=status,
                duration_ms=duration_ms,
                detail_json=detail,
            )
        )

    result = {
        "run_id": str(run.id),
        "business_name": payload.business_name,
        "industry": payload.industry,
        "report_type": report_type,
        "report_type_vi": _report_type_vi(report_type),
        "model_trace": [
            {"step": s[1], "agent": s[2], "provider": s[3], "model": s[4], "status": s[5]}
            for s in traces
        ],
        "friendly_model_trace": [
            {
                "step": friendly_trace_name.get(s[1], s[1]),
                "model": s[4],
                "provider": s[3],
                "status": "Thành công" if s[5] == "success" else "Thất bại",
            }
            for s in traces
        ],
        "kpis": {
            "revenue": revenue,
            "ad_spend": ad_spend,
            "orders": orders,
            "leads": leads,
            "roas": roas,
            "conversion_rate": conversion_rate,
            "repeat_rate": repeat_rate,
            "aov": aov,
        },
        "computed_kpis": computed_kpis,
        "report_description": _report_description(report_type),
        "schema_mapping": mapping,
        "mapping_confidence": mapping_confidence,
        "insights": insights,
        "issues": issues,
        "situations": situations,
        "suggested_actions": suggested_actions,
        "action_plan_30_60_90": action_plan,
        "data_warnings": data_warnings,
        "data_quality_score": data_quality_score,
        "data_quality_breakdown": data_quality_breakdown,
        "limitations": limitations,
        "classification": classification,
        "exploratory_metrics": exploratory_metrics,
        "kpi_availability": kpi_availability,
        "fallback": {
            "provider": fallback_provider,
            "reason": fallback_reason,
            "user_message": _sanitize_fallback_reason(fallback_reason),
        },
        "generated_for_user_id": str(current_user.id),
    }

    db.add(InsightResultSnapshot(run_id=run.id, result_json=result))
    await db.commit()
    yield {"type": "result", "data": result}


@router.post("/a2a/deep-analysis")
async def deep_analysis_a2a(
    payload: DeepAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    last: dict[str, Any] | None = None
    async for evt in _run_deep_analysis_gen(payload, current_user, db):
        if evt.get("type") == "error":
            return JSONResponse(status_code=400, content={"detail": evt.get("detail", "Invalid request")})
        if evt.get("type") == "result":
            last = evt["data"]
    if last is None:
        raise HTTPException(status_code=500, detail="Phân tích không trả về kết quả.")
    return last


@router.post("/a2a/deep-analysis-stream")
async def deep_analysis_a2a_stream(
    payload: DeepAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    async def ndjson_iter() -> AsyncIterator[bytes]:
        try:
            async for evt in _run_deep_analysis_gen(payload, current_user, db):
                line = json.dumps(evt, ensure_ascii=False) + "\n"
                yield line.encode("utf-8")
        except Exception as exc:  # noqa: BLE001
            err = json.dumps({"type": "error", "detail": str(exc)}, ensure_ascii=False) + "\n"
            yield err.encode("utf-8")

    return StreamingResponse(
        ndjson_iter(),
        media_type="application/x-ndjson; charset=utf-8",
        headers={
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/a2a/runs")
async def list_deep_analysis_runs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    runs = (
        await db.execute(
            select(InsightReportRun)
            .where(InsightReportRun.user_id == current_user.id)
            .order_by(desc(InsightReportRun.created_at))
            .limit(20)
        )
    ).scalars().all()
    return [
        {
            "id": str(r.id),
            "business_name": r.business_name,
            "industry": r.industry,
            "report_type": r.report_type,
            "status": r.status,
            "source_filename": r.source_filename,
            "fallback_provider": r.fallback_provider,
            "fallback_reason": r.fallback_reason,
            "created_at": r.created_at.isoformat(),
        }
        for r in runs
    ]


@router.get("/a2a/runs/{run_id}/result")
async def get_deep_analysis_result(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    run = (
        await db.execute(
            select(InsightReportRun).where(
                InsightReportRun.id == run_id,
                InsightReportRun.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not run:
        return {"detail": "Run not found"}

    snapshot = (
        await db.execute(
            select(InsightResultSnapshot)
            .where(InsightResultSnapshot.run_id == run.id)
            .order_by(desc(InsightResultSnapshot.created_at))
            .limit(1)
        )
    ).scalar_one_or_none()
    if not snapshot:
        return {"detail": "Result snapshot not found"}
    return snapshot.result_json


@router.post("/a2a/runs/{run_id}/reanalyze")
async def reanalyze_previous_run(
    run_id: uuid.UUID,
    payload: ReanalyzeRunRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    run = (
        await db.execute(
            select(InsightReportRun).where(
                InsightReportRun.id == run_id,
                InsightReportRun.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not run:
        return {"detail": "Run not found"}

    source_rows = (run.summary_json or {}).get("report_rows")
    if not isinstance(source_rows, list) or len(source_rows) == 0:
        return {"detail": "Run does not contain source rows for reanalyze"}

    replay_request = DeepAnalysisRequest(
        business_name=payload.business_name or run.business_name,
        industry=payload.industry or run.industry,
        source_filename=run.source_filename,
        report_rows=source_rows,
    )
    return await deep_analysis_a2a(replay_request, current_user, db)


@router.post("/a2a/runs/{run_id}/reanalyze-stream")
async def reanalyze_previous_run_stream(
    run_id: uuid.UUID,
    payload: ReanalyzeRunRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    run = (
        await db.execute(
            select(InsightReportRun).where(
                InsightReportRun.id == run_id,
                InsightReportRun.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    source_rows = (run.summary_json or {}).get("report_rows")
    if not isinstance(source_rows, list) or len(source_rows) == 0:
        raise HTTPException(status_code=400, detail="Run does not contain source rows for reanalyze")

    replay_request = DeepAnalysisRequest(
        business_name=payload.business_name or run.business_name,
        industry=payload.industry or run.industry,
        source_filename=run.source_filename,
        report_rows=source_rows,
    )

    async def ndjson_iter() -> AsyncIterator[bytes]:
        try:
            async for evt in _run_deep_analysis_gen(replay_request, current_user, db):
                line = json.dumps(evt, ensure_ascii=False) + "\n"
                yield line.encode("utf-8")
        except Exception as exc:  # noqa: BLE001
            err = json.dumps({"type": "error", "detail": str(exc)}, ensure_ascii=False) + "\n"
            yield err.encode("utf-8")

    return StreamingResponse(
        ndjson_iter(),
        media_type="application/x-ndjson; charset=utf-8",
        headers={
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
        },
    )
