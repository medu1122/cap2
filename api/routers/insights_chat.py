from __future__ import annotations

import json
import re
import unicodedata
import uuid
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.config import settings
from core.database import get_db
from core.deps import get_current_user

from models.user import User
from models.insight_chat import InsightChat, InsightChatMessage
from models.insight_data_source import InsightDataSource

from services.insight_intelligence import (
    CalculatorAgent,
    ChatContext,
    ContextBuilder,
    DataManipulationAgent,
    EntityLinker,
    GuidanceAgent,
    IntentClassifier,
    IntentType,
    ReferenceResolver,
    VisualizationPlanner,
    format_computation_for_response,
    format_guidance_for_response,
    format_manipulation_result,
    format_visualization_for_response,
)

router = APIRouter()


# =========================================================
# SCHEMAS
# =========================================================

class ColumnSchema(BaseModel):
    name: str
    data_type: str = "text"


class TableDataSchema(BaseModel):
    columns: list[ColumnSchema]
    rows: list[dict[str, Any]]


class CreateDataSourceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    source_type: str = "manual"
    original_filename: str | None = None
    table_data: TableDataSchema | None = None


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1)
    message_context: dict[str, Any] | None = None


# =========================================================
# HELPERS
# =========================================================
try:
    QWEN_TIMEOUT = int(settings.QWEN_TIMEOUT or 180)
except Exception:
    QWEN_TIMEOUT = 180

QWEN_TIMEOUT = max(30, min(300, QWEN_TIMEOUT))


METRIC_HINTS: dict[str, list[str]] = {
    "revenue": ["doanh thu", "doanh so", "tong thu", "revenue", "sales", "amount", "doanh_thu"],
    "orders": ["don hang", "don", "so don", "tong don", "orders", "order", "transactions", "so_don"],
    "ad_spend": ["chi phi quang cao", "chi phi ads", "ads", "ad spend", "marketing cost", "chi_phi_quang_cao"],
    "cost": ["chi phi", "cost", "expense", "gia von", "chi_phi"],
    "profit": ["loi nhuan", "profit", "margin", "loi_nhuan"],
    "leads": ["lead", "khach tiem nang", "leads"],
    "customers": ["khach hang", "customer", "customers", "khach"],
    "quantity": ["so luong", "quantity", "qty", "so_luong"],
}

DATE_HINTS = ["thang", "month", "ngay", "date", "nam", "year", "time", "created"]
CURRENCY_HINTS = ["doanh", "thu", "vnd", "chi phi", "cost", "spend", "revenue", "sales", "gia", "price", "profit"]


def _normalize_text(value: Any) -> str:
    text = str(value or "").replace("đ", "d").replace("Đ", "D")
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _parse_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if value is None:
        return None

    raw = str(value).strip()
    if not raw:
        return None
    cleaned = re.sub(r"[^\d,.\-]", "", raw)
    if not cleaned or cleaned in {"-", ".", ","}:
        return None

    # 1.000.000 or 1,000,000 are thousands separators.
    if "," not in cleaned and cleaned.count(".") > 1:
        cleaned = cleaned.replace(".", "")
    elif "." not in cleaned and cleaned.count(",") > 1:
        cleaned = cleaned.replace(",", "")
    elif "," in cleaned and "." in cleaned:
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif "." in cleaned:
        integer, decimal = cleaned.rsplit(".", 1)
        if len(decimal) == 3 and integer.replace("-", "").isdigit():
            cleaned = integer + decimal
    elif "," in cleaned:
        integer, decimal = cleaned.rsplit(",", 1)
        if len(decimal) == 3 and integer.replace("-", "").isdigit():
            cleaned = integer + decimal
        else:
            cleaned = integer + "." + decimal

    try:
        return float(cleaned)
    except ValueError:
        return None


def _format_number(value: float, *, currency: bool = False, ratio: bool = False) -> str:
    if ratio:
        return f"{value:.2f}".rstrip("0").rstrip(".")
    if abs(value - round(value)) < 0.000001:
        text = f"{round(value):,}".replace(",", ".")
    else:
        text = f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{text} đ" if currency else text


def _columns_from_source(data_source: InsightDataSource, rows: list[dict[str, Any]]) -> list[str]:
    schema_cols = (data_source.schema_json or {}).get("columns", []) if data_source else []
    names = [str(col.get("name")) for col in schema_cols if isinstance(col, dict) and col.get("name")]
    if not names and rows:
        names = [str(col) for col in rows[0].keys()]
    return list(dict.fromkeys(names))


def _is_currency_column(column: str, metric_key: str | None = None) -> bool:
    if metric_key in {"revenue", "ad_spend", "cost", "profit"}:
        return True
    norm = _normalize_text(column)
    return any(hint in norm for hint in CURRENCY_HINTS)


def _is_date_like_column(column: str) -> bool:
    norm = _normalize_text(column)
    return any(hint in norm for hint in DATE_HINTS)


def _detect_metric_key(question_norm: str) -> str | None:
    if "roas" in question_norm:
        return "roas"
    if "aov" in question_norm or "gia tri don" in question_norm or "don trung binh" in question_norm:
        return "aov"
    for key, hints in METRIC_HINTS.items():
        if any(_normalize_text(hint) in question_norm for hint in hints):
            return key
    return None


def _find_column(columns: list[str], question_norm: str, metric_key: str | None = None) -> str | None:
    best_col: str | None = None
    best_score = 0.0
    hints = METRIC_HINTS.get(metric_key or "", [])

    for col in columns:
        col_norm = _normalize_text(col)
        score = 0.0
        if not metric_key:
            if col_norm and col_norm in question_norm:
                score = max(score, 1.0)
            if question_norm and question_norm in col_norm:
                score = max(score, 0.85)
        elif col_norm and col_norm in question_norm and not _is_date_like_column(col):
            score = max(score, 0.75)
        for hint in hints:
            hint_norm = _normalize_text(hint)
            if hint_norm and hint_norm in col_norm:
                score = max(score, 0.9)
            if hint_norm and hint_norm in question_norm and any(part in col_norm for part in hint_norm.split()):
                score = max(score, 0.65)

        if score > best_score:
            best_score = score
            best_col = col

    return best_col if best_score >= 0.55 else None


def _find_date_column(columns: list[str], rows: list[dict[str, Any]], question_norm: str) -> str | None:
    for col in columns:
        col_norm = _normalize_text(col)
        if col_norm in question_norm and col_norm:
            return col
    for col in columns:
        col_norm = _normalize_text(col)
        if any(hint in col_norm for hint in DATE_HINTS):
            return col
    for col in columns:
        samples = [str(row.get(col, "")) for row in rows[:8]]
        if any(re.search(r"\b\d{4}[-/]\d{1,2}|\b\d{1,2}[-/]\d{4}", sample) for sample in samples):
            return col
    return None


def _group_label(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return "(trống)"
    norm = _normalize_text(raw)
    match = re.search(r"\b(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?\b", raw)
    if match:
        return f"{match.group(1)}-{int(match.group(2)):02d}"
    match = re.search(r"\b(\d{1,2})[-/](\d{4})\b", raw)
    if match:
        return f"{match.group(2)}-{int(match.group(1)):02d}"
    match = re.search(r"\bthang\s*(\d{1,2})(?:\s*nam\s*(\d{4}))?", norm)
    if match:
        return f"{match.group(2)}-{int(match.group(1)):02d}" if match.group(2) else f"Tháng {int(match.group(1))}"
    return raw


def _numeric_values(rows: list[dict[str, Any]], column: str) -> list[float]:
    values: list[float] = []
    for row in rows:
        number = _parse_number(row.get(column))
        if number is not None:
            values.append(number)
    return values


def _format_column_list(columns: list[str]) -> str:
    return ", ".join(columns[:12]) + ("..." if len(columns) > 12 else "")


def _answer_anomalies(rows: list[dict[str, Any]], columns: list[str]) -> tuple[str, dict[str, Any]] | None:
    findings: list[dict[str, Any]] = []
    for col in columns:
        values = [(idx, _parse_number(row.get(col))) for idx, row in enumerate(rows)]
        values = [(idx, val) for idx, val in values if val is not None]
        if len(values) < 4:
            continue
        sorted_vals = sorted(val for _, val in values)
        q1 = sorted_vals[len(sorted_vals) // 4]
        q3 = sorted_vals[(len(sorted_vals) * 3) // 4]
        iqr = q3 - q1
        if iqr == 0:
            continue
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        for idx, val in values:
            if val < lower or val > upper:
                findings.append({"row": idx + 1, "column": col, "value": val, "lower": lower, "upper": upper})

    if not findings:
        return (
            f"Chưa thấy điểm bất thường rõ ràng theo phương pháp IQR trên {len(rows)} dòng dữ liệu số.",
            {"fast_answer": True, "operation": "anomaly_iqr", "row_count": len(rows), "findings": []},
        )

    findings = sorted(findings, key=lambda item: abs(item["value"]), reverse=True)[:5]
    lines = [f"Phát hiện {len(findings)} điểm bất thường nổi bật theo IQR:"]
    for item in findings:
        currency = _is_currency_column(str(item["column"]))
        lines.append(f"- Dòng {item['row']}, cột {item['column']}: {_format_number(item['value'], currency=currency)}")
    return "\n".join(lines), {"fast_answer": True, "operation": "anomaly_iqr", "row_count": len(rows), "findings": findings}


def build_fast_data_answer(question: str, data_source: InsightDataSource | None) -> tuple[str, dict[str, Any]] | None:
    if not data_source or not data_source.data_json:
        return None

    rows = data_source.data_json.get("rows", [])
    if not isinstance(rows, list) or not rows:
        return ("Bảng dữ liệu hiện chưa có dòng nào để tính toán.", {"fast_answer": True, "row_count": 0})

    rows = [row for row in rows if isinstance(row, dict)]
    columns = _columns_from_source(data_source, rows)
    question_norm = _normalize_text(question)

    if any(phrase in question_norm for phrase in ["bao nhieu dong", "so dong", "tong dong"]):
        return (
            f"Bảng {data_source.name} có {len(rows)} dòng dữ liệu.",
            {"fast_answer": True, "operation": "row_count", "row_count": len(rows)},
        )

    if any(phrase in question_norm for phrase in ["bao nhieu cot", "so cot", "danh sach cot", "cac cot"]):
        return (
            f"Bảng có {len(columns)} cột: {_format_column_list(columns)}.",
            {"fast_answer": True, "operation": "column_list", "columns": columns, "row_count": len(rows)},
        )

    row_match = re.search(r"(?:dong|row)\s*(\d+)", question_norm)
    if row_match:
        row_index = int(row_match.group(1)) - 1
        if 0 <= row_index < len(rows):
            row = rows[row_index]
            preview = "\n".join(f"- {col}: {row.get(col, '')}" for col in columns[:12])
            return (
                f"Dòng {row_index + 1} trong bảng:\n{preview}",
                {"fast_answer": True, "operation": "row_detail", "row_index": row_index + 1, "row": row},
            )
        return (f"Bảng chỉ có {len(rows)} dòng, nên không có dòng {row_index + 1}.", {"fast_answer": True})

    if any(word in question_norm for word in ["bat thuong", "outlier", "ngoai lai", "dang chu y"]):
        return _answer_anomalies(rows, columns)

    metric_key = _detect_metric_key(question_norm)

    if metric_key == "roas":
        revenue_col = _find_column(columns, question_norm, "revenue")
        spend_col = _find_column(columns, question_norm, "ad_spend")
        if revenue_col and spend_col:
            revenue = sum(_numeric_values(rows, revenue_col))
            spend = sum(_numeric_values(rows, spend_col))
            if spend == 0:
                return (f"Không tính được ROAS vì tổng {spend_col} bằng 0.", {"fast_answer": True})
            roas = revenue / spend
            return (
                f"ROAS = {_format_number(roas, ratio=True)}.\nCách tính: tổng {revenue_col} {_format_number(revenue, currency=True)} / tổng {spend_col} {_format_number(spend, currency=True)}.",
                {"fast_answer": True, "operation": "derived_roas", "used_columns": [revenue_col, spend_col], "value": roas},
            )

    if metric_key == "aov":
        revenue_col = _find_column(columns, question_norm, "revenue")
        orders_col = _find_column(columns, question_norm, "orders")
        if revenue_col and orders_col:
            revenue = sum(_numeric_values(rows, revenue_col))
            orders = sum(_numeric_values(rows, orders_col))
            if orders == 0:
                return (f"Không tính được AOV vì tổng {orders_col} bằng 0.", {"fast_answer": True})
            aov = revenue / orders
            return (
                f"AOV = {_format_number(aov, currency=True)}.\nCách tính: tổng {revenue_col} {_format_number(revenue, currency=True)} / tổng {orders_col} {_format_number(orders)}.",
                {"fast_answer": True, "operation": "derived_aov", "used_columns": [revenue_col, orders_col], "value": aov},
            )

    metric_col = _find_column(columns, question_norm, metric_key)
    date_col = _find_date_column(columns, rows, question_norm)

    wants_group = (
        "theo thang" in question_norm
        or "thang nao" in question_norm
        or "theo ngay" in question_norm
        or "theo nam" in question_norm
    )
    wants_max = any(word in question_norm for word in ["nhieu nhat", "cao nhat", "lon nhat", "max", "tot nhat"])
    wants_min = any(word in question_norm for word in ["it nhat", "thap nhat", "nho nhat", "min", "kem nhat"])

    if wants_group and date_col:
        groups: dict[str, dict[str, float]] = {}
        for row in rows:
            label = _group_label(row.get(date_col))
            groups.setdefault(label, {"value": 0.0, "count": 0})
            groups[label]["count"] += 1
            if metric_col:
                groups[label]["value"] += _parse_number(row.get(metric_col)) or 0.0
            else:
                groups[label]["value"] += 1.0

        if not groups:
            return None

        selected = min(groups.items(), key=lambda item: item[1]["value"]) if wants_min else max(groups.items(), key=lambda item: item[1]["value"])
        currency = _is_currency_column(metric_col or "", metric_key)
        metric_label = metric_col or "số dòng"
        sorted_groups = sorted(groups.items(), key=lambda item: str(item[0]))
        breakdown = "; ".join(
            f"{label}: {_format_number(info['value'], currency=currency)}"
            for label, info in sorted_groups[:8]
        )
        if wants_max or wants_min or "thang nao" in question_norm:
            direction = "thấp nhất" if wants_min else "cao nhất"
            return (
                f"{selected[0]} có {metric_label} {direction}: {_format_number(selected[1]['value'], currency=currency)}.\nĐã nhóm theo cột {date_col} và tính từ {len(rows)} dòng dữ liệu.\nChi tiết: {breakdown}",
                {
                    "fast_answer": True,
                    "operation": "group_extreme",
                    "group_column": date_col,
                    "metric_column": metric_col,
                    "groups": groups,
                },
            )
        return (
            f"{metric_label} theo {date_col}:\n" + "\n".join(
                f"- {label}: {_format_number(info['value'], currency=currency)}"
                for label, info in sorted_groups[:12]
            ),
            {"fast_answer": True, "operation": "group_summary", "group_column": date_col, "metric_column": metric_col, "groups": groups},
        )

    if metric_col:
        values = _numeric_values(rows, metric_col)
        if not values:
            return (f"Cột {metric_col} không có giá trị số hợp lệ để tính toán.", {"fast_answer": True})

        currency = _is_currency_column(metric_col, metric_key)
        if any(word in question_norm for word in ["trung binh", "average", "avg"]):
            value = sum(values) / len(values)
            return (
                f"Trung bình {metric_col} là {_format_number(value, currency=currency)} (tính trên {len(values)} giá trị hợp lệ).",
                {"fast_answer": True, "operation": "avg", "metric_column": metric_col, "value": value},
            )
        if wants_min:
            value = min(values)
            return (
                f"{metric_col} thấp nhất là {_format_number(value, currency=currency)}.",
                {"fast_answer": True, "operation": "min", "metric_column": metric_col, "value": value},
            )
        if wants_max:
            value = max(values)
            return (
                f"{metric_col} cao nhất là {_format_number(value, currency=currency)}.",
                {"fast_answer": True, "operation": "max", "metric_column": metric_col, "value": value},
            )

        if any(word in question_norm for word in ["tong", "bao nhieu", "la bao nhieu", "bang bao nhieu", "so luong"]):
            value = sum(values)
            return (
                f"Tổng {metric_col} là {_format_number(value, currency=currency)} (tính từ {len(values)} giá trị hợp lệ trong {len(rows)} dòng).",
                {"fast_answer": True, "operation": "sum", "metric_column": metric_col, "value": value, "row_count": len(rows)},
            )

    return None


def _message_payload(message: InsightChatMessage, extra_data: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = {
        "id": str(message.id),
        "role": message.role,
        "content": message.content,
        "message_context": message.message_context,
        "suggested_visualizations": message.suggested_visualizations,
        "created_at": message.created_at.isoformat(),
    }
    if extra_data is not None:
        payload["extra_data"] = extra_data
    return payload


async def chat_completion(
    messages: list[dict[str, str]],
    temperature: float = 0.3,
) -> str:
    """
    Call Qwen/OpenAI compatible API.
    """

    url = f"{settings.QWEN_BASE_URL.rstrip('/')}/chat/completions"

    headers = {
        "Content-Type": "application/json",
    }

    if settings.OPENAI_API_KEY:
        headers["Authorization"] = f"Bearer {settings.OPENAI_API_KEY}"

    payload = {
        "model": settings.QWEN_MODEL,
        "messages": messages,
        "temperature": temperature,
        "stream": False,
    }

    timeout = httpx.Timeout(
        timeout=min(QWEN_TIMEOUT, 90),
        connect=15,
    )

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            url,
            headers=headers,
            json=payload,
        )

        response.raise_for_status()

        data = response.json()

    return data["choices"][0]["message"]["content"]


def build_system_prompt(
    context: ChatContext,
    intent_info: dict[str, Any],
    computation_result: Any | None = None,
) -> str:

    lines: list[str] = []

    lines.append("Bạn là AI Data Analyst chuyên phân tích dữ liệu kinh doanh.")
    lines.append("Trả lời bằng tiếng Việt.")
    lines.append("Ngắn gọn, chính xác, dễ hiểu.")
    lines.append("")

    # =====================================================
    # DATASET INFO
    # =====================================================

    lines.append("=== THÔNG TIN DATASET ===")

    if context.data and context.data.columns:
        lines.append(f"Số dòng: {context.data.row_count}")
        lines.append(f"Số cột: {len(context.data.columns)}")

        lines.append("")
        lines.append("Danh sách cột:")

        for col in context.data.columns:
            sample = ", ".join(map(str, col.sample_values[:3])) if col.sample_values else ""

            lines.append(
                f"- {col.name} ({col.data_type}) | ví dụ: {sample}"
            )

    # =====================================================
    # RESOLVED QUESTION
    # =====================================================

    if context.resolved_input:
        lines.append("")
        lines.append("=== CÂU HỎI ĐÃ RESOLVE ===")
        lines.append(context.resolved_input)

    # =====================================================
    # ENTITIES
    # =====================================================

    if context.detected_entities:
        lines.append("")
        lines.append("=== ENTITIES ===")

        primary = context.detected_entities.get("primary_metric")

        if primary:
            lines.append(
                f"Primary: {primary.get('entity')} -> {primary.get('linked_column')}"
            )

    # =====================================================
    # COMPUTATION
    # =====================================================

    if computation_result and computation_result.success:
        lines.append("")
        lines.append("=== KẾT QUẢ TÍNH TOÁN ===")

        formatted = format_computation_for_response(computation_result)

        lines.append(json.dumps(formatted, ensure_ascii=False))

    # =====================================================
    # CHAT HISTORY
    # =====================================================

    history = context.to_chat_history_text()

    if history:
        lines.append("")
        lines.append("=== LỊCH SỬ CHAT ===")
        lines.append(history)

    # =====================================================
    # RULES
    # =====================================================

    lines.append("")
    lines.append("=== QUY TẮC ===")
    lines.append("1. Luôn dùng số liệu cụ thể.")
    lines.append("2. Nếu không biết thì nói không chắc.")
    lines.append("3. Không bịa dữ liệu.")
    lines.append("4. Trả lời tối đa 8-12 dòng.")
    lines.append("5. Có thể gợi ý chart phù hợp.")

    # =====================================================
    # INTENT
    # =====================================================

    lines.append("")
    lines.append(f"Intent hiện tại: {intent_info.get('type')}")

    return "\n".join(lines)


async def generate_ai_response(
    *,
    context: ChatContext,
    intent_info: dict[str, Any],
    current_input: str,
    messages_history: list[dict[str, str]],
) -> tuple[str, dict[str, Any]]:

    calculator = CalculatorAgent()

    computation_result = None

    try:
        primary_metric = (
            context.detected_entities.get("primary_metric")
            if context.detected_entities
            else None
        )

        if (
            primary_metric
            and primary_metric.get("linked_column")
            and context.full_data
        ):
            computation_result = await calculator.compute(
                computation_type=intent_info.get("type"),
                data=context.full_data,
                column=primary_metric["linked_column"],
                context=intent_info.get("parameters"),
            )

    except Exception:
        computation_result = None

    system_prompt = build_system_prompt(
        context=context,
        intent_info=intent_info,
        computation_result=computation_result,
    )

    llm_messages = [
        {
            "role": "system",
            "content": system_prompt,
        },
        *messages_history[-10:],
        {
            "role": "user",
            "content": context.resolved_input or current_input,
        },
    ]

    try:
        response_text = await chat_completion(llm_messages)

    except Exception as e:
        if computation_result and computation_result.success:
            formatted = format_computation_for_response(
                computation_result
            )

            return (
                f"Kết quả tính toán:\n{json.dumps(formatted, ensure_ascii=False, indent=2)}",
                {
                    "fallback": True,
                    "warning": str(e),
                },
            )

        raise HTTPException(
            status_code=500,
            detail=f"LLM Error: {str(e)}",
        )

    viz_planner = VisualizationPlanner()

    viz_plan = viz_planner.plan(
        intent_type=intent_info.get("type"),
        data_context=context.data,
        computation_result=computation_result,
        entities=context.detected_entities,
    )

    extra_data = {
        "visualizations": format_visualization_for_response(viz_plan),
    }

    if computation_result and computation_result.success:
        extra_data["computation"] = (
            format_computation_for_response(computation_result)
        )

    return response_text, extra_data


# =========================================================
# DATA SOURCES
# =========================================================

@router.get("/data-sources")
async def list_data_sources(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    result = await db.execute(
        select(InsightDataSource)
        .where(InsightDataSource.user_id == current_user.id)
        .order_by(desc(InsightDataSource.updated_at))
    )

    sources = result.scalars().all()

    return [
        {
            "id": str(s.id),
            "name": s.name,
            "source_type": s.source_type,
            "row_count": len(s.data_json.get("rows", []))
            if s.data_json
            else 0,
            "column_count": len(s.schema_json.get("columns", []))
            if s.schema_json
            else 0,
            "original_filename": s.original_filename,
            "created_at": s.created_at.isoformat(),
            "updated_at": s.updated_at.isoformat(),
        }
        for s in sources
    ]


@router.get("/data-sources/{source_id}")
async def get_data_source(
    source_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InsightDataSource).where(
            InsightDataSource.id == source_id,
            InsightDataSource.user_id == current_user.id,
        )
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(404, "Data source not found")

    return {
        "id": str(source.id),
        "name": source.name,
        "source_type": source.source_type,
        "original_filename": source.original_filename,
        "schema": source.schema_json or {"columns": []},
        "data": source.data_json or {"rows": []},
        "created_at": source.created_at.isoformat(),
        "updated_at": source.updated_at.isoformat(),
    }


@router.put("/data-sources/{source_id}")
async def update_data_source(
    source_id: uuid.UUID,
    payload: CreateDataSourceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InsightDataSource).where(
            InsightDataSource.id == source_id,
            InsightDataSource.user_id == current_user.id,
        )
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(404, "Data source not found")

    if payload.name:
        source.name = payload.name
    if payload.source_type:
        source.source_type = payload.source_type
    if payload.table_data:
        source.schema_json = {"columns": [c.model_dump() for c in payload.table_data.columns]}
        source.data_json = {"rows": payload.table_data.rows}

    await db.commit()
    return {"id": str(source.id), "name": source.name}


@router.post("/data-sources")
async def create_data_source(
    payload: CreateDataSourceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    if not payload.table_data:
        raise HTTPException(
            status_code=400,
            detail="table_data required",
        )

    source = InsightDataSource(
        user_id=current_user.id,
        name=payload.name,
        source_type=payload.source_type,
        original_filename=payload.original_filename,
        schema_json={
            "columns": [
                c.model_dump()
                for c in payload.table_data.columns
            ]
        },
        data_json={
            "rows": payload.table_data.rows
        },
    )

    db.add(source)

    await db.commit()
    await db.refresh(source)

    return {
        "id": str(source.id),
        "name": source.name,
    }


# =========================================================
# CHAT
# =========================================================

@router.post("/chats")
async def create_chat(
    data_source_id: uuid.UUID,
    insight_run_id: uuid.UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    result = await db.execute(
        select(InsightDataSource).where(
            InsightDataSource.id == data_source_id,
            InsightDataSource.user_id == current_user.id,
        )
    )

    source = result.scalar_one_or_none()

    if not source:
        source_exists = await db.execute(
            select(InsightDataSource.id).where(InsightDataSource.id == data_source_id)
        )
        if source_exists.scalar_one_or_none():
            raise HTTPException(403, "Bảng dữ liệu này thuộc tài khoản khác. Vui lòng đăng nhập đúng tài khoản.")
        raise HTTPException(404, "Không tìm thấy bảng dữ liệu để tạo chat.")

    chat = InsightChat(
        user_id=current_user.id,
        data_source_id=source.id,
        insight_run_id=insight_run_id,
        title=f"Chat - {source.name}",
    )

    db.add(chat)

    await db.commit()
    await db.refresh(chat)

    return {
        "id": str(chat.id),
        "title": chat.title,
    }


@router.get("/chats/{chat_id}")
async def get_chat(
    chat_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    result = await db.execute(
        select(InsightChat)
        .where(
            InsightChat.id == chat_id,
            InsightChat.user_id == current_user.id,
        )
        .options(selectinload(InsightChat.messages))
    )

    chat = result.scalar_one_or_none()

    if not chat:
        raise HTTPException(404, "Chat not found")

    return {
        "id": str(chat.id),
        "title": chat.title,
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "message_context": m.message_context,
                "suggested_visualizations": m.suggested_visualizations,
                "created_at": m.created_at.isoformat(),
            }
            for m in chat.messages
        ],
    }


@router.post("/chats/{chat_id}/messages")
async def send_message(
    chat_id: uuid.UUID,
    payload: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    # =====================================================
    # LOAD CHAT
    # =====================================================

    result = await db.execute(
        select(InsightChat)
        .where(
            InsightChat.id == chat_id,
            InsightChat.user_id == current_user.id,
        )
        .options(selectinload(InsightChat.messages))
    )

    chat = result.scalar_one_or_none()

    if not chat:
        raise HTTPException(404, "Chat not found")

    # =====================================================
    # LOAD DATA SOURCE
    # =====================================================

    ds_result = await db.execute(
        select(InsightDataSource).where(
            InsightDataSource.id == chat.data_source_id
        )
    )

    data_source = ds_result.scalar_one_or_none()
    if not data_source:
        raise HTTPException(404, "Data source not found")

    fast_answer = build_fast_data_answer(payload.content, data_source)
    if fast_answer:
        response_text, extra_data = fast_answer

        user_msg = InsightChatMessage(
            chat_id=chat.id,
            role="user",
            content=payload.content,
        )
        db.add(user_msg)

        assistant_msg = InsightChatMessage(
            chat_id=chat.id,
            role="assistant",
            content=response_text,
            message_context=extra_data,
            suggested_visualizations=extra_data.get("visualizations"),
        )
        db.add(assistant_msg)

        await db.commit()
        await db.refresh(user_msg)
        await db.refresh(assistant_msg)

        return {
            "user_message": _message_payload(user_msg),
            "assistant_message": _message_payload(assistant_msg, extra_data),
        }

    # =====================================================
    # BUILD HISTORY
    # =====================================================

    messages_history = [
        {
            "role": m.role,
            "content": m.content,
        }
        for m in chat.messages[-20:]
    ]

    # =====================================================
    # INTELLIGENCE
    # =====================================================

    context_builder = ContextBuilder()
    intent_classifier = IntentClassifier()
    reference_resolver = ReferenceResolver()
    entity_linker = EntityLinker()

    guidance_agent = GuidanceAgent()
    manipulation_agent = DataManipulationAgent()

    # =====================================================
    # CLASSIFY INTENT
    # =====================================================

    intent = intent_classifier.classify(payload.content)

    intent_info = {
        "type": intent.type.value,
        "confidence": intent.confidence,
        "entities": intent.entities,
        "parameters": intent.parameters,
    }

    # =====================================================
    # GUIDANCE MODE
    # =====================================================

    if intent.type in {
        IntentType.GREETING,
        IntentType.HELP_REQUEST,
        IntentType.GUIDANCE_HOW_TO,
    }:

        _, guidance = guidance_agent.classify_and_get_guidance(
            user_input=payload.content,
            context={},
        )

        response_text = guidance.message

        extra_data = {
            "guidance": format_guidance_for_response(guidance)
        }

    # =====================================================
    # DATA MANIPULATION
    # =====================================================

    elif intent.type in {
        IntentType.DATA_CREATE_COLUMN,
        IntentType.DATA_DELETE_COLUMN,
        IntentType.DATA_ADD_ROW,
    }:

        result = await manipulation_agent.execute(
            operation=intent.type.value,
            data=data_source.data_json.get("rows", []),
            schema=data_source.schema_json.get("columns", []),
            params=intent.parameters,
        )

        if result.success:

            data_source.data_json = {
                "rows": result.new_data
            }

            data_source.schema_json = {
                "columns": result.new_schema
            }

            await db.commit()

        response_text = result.message

        extra_data = {
            "manipulation": format_manipulation_result(result)
        }

    # =====================================================
    # ANALYSIS MODE
    # =====================================================

    else:

        context = await context_builder.build(
            data_source=data_source,
            insight_result=None,
            messages=messages_history,
            current_input=payload.content,
        )

        resolved_input, detected_entities = (
            await reference_resolver.resolve(
                user_input=payload.content,
                data_context=context.data,
                chat_history=messages_history,
                memory=None,
            )
        )

        linked_entities = entity_linker.link(
            entities=detected_entities,
            data_context=context.data,
            insight_data=context.insight,
        )

        context.resolved_input = resolved_input
        context.detected_entities = linked_entities

        response_text, extra_data = await generate_ai_response(
            context=context,
            intent_info=intent_info,
            current_input=payload.content,
            messages_history=messages_history,
        )

    # =====================================================
    # SAVE USER MESSAGE
    # =====================================================

    user_msg = InsightChatMessage(
        chat_id=chat.id,
        role="user",
        content=payload.content,
    )

    db.add(user_msg)

    # =====================================================
    # SAVE ASSISTANT MESSAGE
    # =====================================================

    assistant_msg = InsightChatMessage(
        chat_id=chat.id,
        role="assistant",
        content=response_text,
        message_context=extra_data,
        suggested_visualizations=extra_data.get(
            "visualizations"
        ),
    )

    db.add(assistant_msg)

    await db.commit()

    await db.refresh(user_msg)
    await db.refresh(assistant_msg)

    return {
        "user_message": _message_payload(user_msg),
        "assistant_message": _message_payload(assistant_msg, extra_data),
    }


@router.delete("/chats/{chat_id}")
async def delete_chat(
    chat_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    result = await db.execute(
        select(InsightChat).where(
            InsightChat.id == chat_id,
            InsightChat.user_id == current_user.id,
        )
    )

    chat = result.scalar_one_or_none()

    if not chat:
        raise HTTPException(404, "Chat not found")

    await db.delete(chat)

    await db.commit()

    return {
        "success": True
    }
