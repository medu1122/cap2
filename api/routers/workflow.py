import asyncio
import csv
import html
import io
import json
import os
import random
import re
import unicodedata
import uuid
from datetime import date, datetime, timedelta, timezone

from croniter import croniter
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile
from openai import AsyncOpenAI
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import AsyncSessionLocal, get_db
from core.deps import get_current_user
from models.brand import Brand
from models.campaign import Campaign
from models.customer import Customer
from models.customer_list import CustomerList
from models.file_upload import FileUpload
from models.user import User
from models.workflow_job import WorkflowJob
from models.customer_analysis_snapshot import CustomerAnalysisSnapshot
from services.agent_dispatcher import dispatch_campaign
from services.customer_analysis_service import analyze_customer_rows

router = APIRouter()

# ---------------------------------------------------------------------------
# LLM clients (same pattern as campaigns.py)
# ---------------------------------------------------------------------------
_qwen = AsyncOpenAI(
    base_url=os.getenv("QWEN_BASE_URL", "http://171.238.156.10:11434/v1"),
    api_key="ollama",
)
_openai = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
QWEN_MODEL = os.getenv("QWEN_MODEL", "qwen2.5:14b")
QWEN_TIMEOUT = int(os.getenv("QWEN_TIMEOUT", "180"))


def _to_float_or_none(value: object) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    raw = str(value).strip().replace(" ", "").replace(",", "")
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def _to_int_or_none(value: object) -> int | None:
    parsed = _to_float_or_none(value)
    if parsed is None:
        return None
    return int(parsed)


def _segment_customer(extra_fields: dict | None) -> str:
    """
    Segment runtime (khong migration):
    - churn: days_since_last_purchase >= 60
    - vip: total_spend >= 10_000_000 hoac order_count >= 10
    - potential: con lai va co du lieu co ban
    """
    extra = extra_fields or {}
    days_since_last_purchase = _to_int_or_none(extra.get("days_since_last_purchase"))
    total_spend = _to_float_or_none(extra.get("total_spend"))
    order_count = _to_int_or_none(extra.get("order_count"))

    if days_since_last_purchase is not None and days_since_last_purchase >= 60:
        return "churn"
    if (total_spend is not None and total_spend >= 10_000_000) or (
        order_count is not None and order_count >= 10
    ):
        return "vip"
    if days_since_last_purchase is not None or total_spend is not None or order_count is not None:
        return "potential"
    return "unknown"


def _normalize_key(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value or "")
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    normalized = normalized.lower().strip()
    normalized = re.sub(r"[^a-z0-9]+", "", normalized)
    return normalized


def _pick_value_case_insensitive(row: dict, aliases: list[str]) -> str | None:
    if not isinstance(row, dict):
        return None
    normalized_aliases = {_normalize_key(a) for a in aliases}
    for k, v in row.items():
        if _normalize_key(str(k)) in normalized_aliases:
            text = str(v).strip()
            return text or None
    return None


def _row_to_customer_fields(row: dict) -> tuple[str | None, str | None, str | None, dict | None]:
    email = _pick_value_case_insensitive(row, ["email"])
    full_name = _pick_value_case_insensitive(row, ["hovaten", "ho va ten", "fullname", "name"])
    phone = _pick_value_case_insensitive(row, ["sdt", "phone", "so dien thoai"])

    reserved = {
        "id",
        "hovaten",
        "hovatens",
        "hova ten",
        "hovaten",
        "tuoi",
        "sdt",
        "email",
        "linkfb",
        "lancuoichitra",
        "tongsotiendachitra",
        "tongsolanquaylai",
        "loaikhachhang",
        "dichvulancuoisudung",
        "dichvusudungnhieunhat",
        "fullname",
        "name",
        "phone",
    }
    extra_fields: dict[str, str] = {}
    for k, v in row.items():
        nk = _normalize_key(str(k))
        if nk in reserved:
            continue
        value_text = str(v).strip()
        if value_text:
            extra_fields[str(k)] = value_text

    # Giu them cac cot nghiep vu template vao extra_fields de phan tich insight sau nay.
    for key, aliases in {
        "id": ["id"],
        "tuoi": ["tuoi", "age"],
        "link_fb": ["linkfb", "facebook", "link facebook"],
        "lan_cuoi_chi_tra": ["lancuoichitra", "last_payment_date"],
        "tong_so_tien_da_chi_tra": ["tongsotiendachitra", "total_spend"],
        "tong_so_lan_quay_lai": ["tongsolanquaylai", "order_count"],
        "loai_khach_hang": ["loaikhachhang", "customer_type"],
        "dich_vu_lan_cuoi_su_dung": ["dichvulancuoisudung", "last_service_used"],
        "dich_vu_su_dung_nhieu_nhat": ["dichvusudungnhieunhat", "most_used_service"],
    }.items():
        value = _pick_value_case_insensitive(row, aliases)
        if value is not None:
            extra_fields[key] = value

    return email, full_name, phone, (extra_fields or None)

# ---------------------------------------------------------------------------
# Preset definitions — source of truth for workflow automation
# ---------------------------------------------------------------------------
PRESETS: dict[str, dict] = {
    "weekly_promo": {
        "label": "Ưu đãi cuối tuần",
        "description": "Tự động tạo bài đăng Facebook quảng bá ưu đãi cho cuối tuần",
        "channels": ["facebook_post"],
        "objective_hint": "Tăng doanh số cuối tuần thông qua ưu đãi giới hạn thời gian",
        "deadline_days": 5,
    },
    "remind_old_customers": {
        "label": "Nhắc khách cũ",
        "description": "Gửi email nhắc nhở và tri ân khách hàng đã từng mua hàng",
        "channels": ["email"],
        "objective_hint": "Giữ chân khách hàng cũ, kích thích mua lại qua ưu đãi thành viên",
        "deadline_days": 7,
    },
    "new_product_launch": {
        "label": "Ra mắt sản phẩm mới",
        "description": "Tạo chiến dịch đa kênh giới thiệu sản phẩm hoặc dịch vụ mới nhất",
        "channels": ["facebook_post", "email"],
        "objective_hint": "Tạo nhận thức và kích thích thử nghiệm sản phẩm mới",
        "deadline_days": 10,
    },
    "monthly_newsletter": {
        "label": "Bản tin hàng tháng",
        "description": "Email tổng hợp tin tức, sản phẩm nổi bật và ưu đãi tháng này",
        "channels": ["email"],
        "objective_hint": "Giữ kết nối thương hiệu với khách hàng qua bản tin định kỳ",
        "deadline_days": 14,
    },
}


# ---------------------------------------------------------------------------
# Brief generation using Qwen (GPT fallback)
# ---------------------------------------------------------------------------
async def _generate_brief(preset: dict, brand: Brand) -> dict:
    """Ask Qwen to write a campaign brief tailored to the brand and preset."""
    brand_ctx = f"Thương hiệu: {brand.brand_name}\nMô tả: {brand.brand_description or ''}"
    if brand.key_products:
        brand_ctx += f"\nSản phẩm/dịch vụ: {', '.join(brand.key_products[:4])}"
    if brand.target_audience:
        brand_ctx += f"\nKhách hàng mục tiêu: {brand.target_audience}"
    if brand.contact_email:
        brand_ctx += f"\nEmail liên hệ: {brand.contact_email}"
    if brand.phone:
        brand_ctx += f"\nSĐT: {brand.phone}"
    if brand.address:
        brand_ctx += f"\nĐịa chỉ: {brand.address}"

    prompt = (
        f"{brand_ctx}\n\n"
        f"Loại chiến dịch: {preset['label']}\n"
        f"Mục tiêu gợi ý: {preset['objective_hint']}\n\n"
        "Tạo brief ngắn gọn cho chiến dịch marketing này. Trả về JSON:\n"
        "{\n"
        '  "campaign_name": "Tên chiến dịch ngắn, cụ thể (không quá 60 ký tự)",\n'
        '  "objective": "Mục tiêu 1-2 câu",\n'
        '  "product_or_service": "Sản phẩm hoặc dịch vụ chính",\n'
        '  "target_audience": "Đối tượng khách hàng cụ thể",\n'
        '  "offer_or_hook": "Ưu đãi hoặc thông điệp thu hút chính"\n'
        "}\n\n"
        "Chỉ trả về JSON, không thêm nội dung nào khác."
    )

    messages = [{"role": "user", "content": prompt}]

    try:
        resp = await asyncio.wait_for(
            _qwen.chat.completions.create(
                model=QWEN_MODEL, messages=messages, temperature=0.7
            ),
            timeout=QWEN_TIMEOUT,
        )
        raw = resp.choices[0].message.content.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        return json.loads(raw)
    except Exception:
        # GPT fallback — only when Qwen is unavailable/slow
        resp = await _openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
            response_format={"type": "json_object"},
        )
        return json.loads(resp.choices[0].message.content)


async def _generate_customer_analysis_narrative(analysis: dict) -> tuple[str, dict]:
    """
    Dung 1 model local de tom tat ket qua phan tich customer thanh doan ngan gon.
    Neu local loi/timeout thi fallback GPT.
    """
    overview = analysis.get("overview", {})
    segment_summary = (analysis.get("segmentation") or {}).get("summary", {})
    churn = analysis.get("churn_risk", {})
    prompt = (
        "Tom tat ket qua phan tich customer bang tieng Viet, toi da 3 bullet, ngan gon va hanh dong duoc.\n"
        f"- Tong khach: {overview.get('total_customers', 0)}\n"
        f"- Tong doanh thu: {overview.get('total_revenue', 0)}\n"
        f"- Hoat dong 30 ngay (%): {overview.get('recent_activity_30d_percent', overview.get('retention_rate_percent', 0))}\n"
        f"- Segment: VIP {segment_summary.get('vip', 0)}, Potential {segment_summary.get('potential', 0)}, "
        f"ChurnRisk {segment_summary.get('churn_risk', 0)}, New {segment_summary.get('new', 0)}\n"
        f"- Churn >30: {churn.get('inactive_over_30_days', 0)}, >60: {churn.get('inactive_over_60_days', 0)}\n"
        "Output chi la plain text, moi dong bat dau bang '- '."
    )
    messages = [{"role": "user", "content": prompt}]
    try:
        resp = await asyncio.wait_for(
            _qwen.chat.completions.create(
                model=QWEN_MODEL,
                messages=messages,
                temperature=0.2,
            ),
            timeout=min(QWEN_TIMEOUT, 60),
        )
        content = resp.choices[0].message.content.strip()
        return content, {"model_used": QWEN_MODEL, "fallback_used": False, "fallback_reason": None}
    except Exception:
        resp = await _openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.2,
        )
        content = resp.choices[0].message.content.strip()
        return content, {
            "model_used": "gpt-4o-mini",
            "fallback_used": True,
            "fallback_reason": "qwen_failed_or_timeout",
        }


# ---------------------------------------------------------------------------
# Background task: set running → dispatch pipeline → set done/failed
# ---------------------------------------------------------------------------
async def _execute_workflow_job(job_id: uuid.UUID, campaign_id: uuid.UUID):
    async with AsyncSessionLocal() as db:
        job = await db.get(WorkflowJob, job_id)
        if job:
            job.status = "running"
            await db.commit()

    try:
        await dispatch_campaign(str(campaign_id))
        async with AsyncSessionLocal() as db:
            job = await db.get(WorkflowJob, job_id)
            if job:
                job.status = "done"
                await db.commit()
    except Exception as exc:
        async with AsyncSessionLocal() as db:
            job = await db.get(WorkflowJob, job_id)
            if job:
                job.status = "failed"
                job.error_message = str(exc)[:500]
                await db.commit()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class TriggerPayload(BaseModel):
    preset_type: str


class ScheduleCreatePayload(BaseModel):
    preset_type: str
    cron_expression: str
    timezone_name: str = "Asia/Ho_Chi_Minh"
    notes: str | None = None
    default_brief_template: dict | None = None


class ScheduleUpdatePayload(BaseModel):
    cron_expression: str | None = None
    timezone_name: str | None = None
    notes: str | None = None
    default_brief_template: dict | None = None
    is_active: bool | None = None


class CustomerListCreatePayload(BaseModel):
    list_name: str


class CustomerListUpdatePayload(BaseModel):
    list_name: str


class CustomerRowsUpsertPayload(BaseModel):
    rows: list[dict]


class CustomerAnalyzePayload(BaseModel):
    rows: list[dict]


class CustomerPriorityUpsertPayload(BaseModel):
    customer_name: str
    email: str | None = None
    phone: str | None = None
    is_priority: bool = True


class QuickOutreachRecipient(BaseModel):
    name: str = ""
    email: str | None = None
    phone: str | None = None
    # variables: HoVaTen, days_since_last, … từ dòng bảng — thay {{key}} khi gửi
    variables: dict[str, str] | None = None


class QuickOutreachPayload(BaseModel):
    """Gửi nhanh từ bảng khách — email thật (SMTP) hoặc SMS mô phỏng."""

    mode: str
    subject: str = "Thông báo"
    message: str
    recipients: list[QuickOutreachRecipient]
    campaign_id: uuid.UUID | None = None


class SmartContactComposePayload(BaseModel):
    """AI soạn nội dung tin nhắn / email (Smart Contact)."""

    user_prompt: str
    mode: str = "email"
    context_one_liner: str | None = None
    # Tóm tắt khách đã chọn (tự build từ bảng) — đưa vào system để model không cần user chọn biến tay
    recipients_data_context: str | None = None
    # Hồ sơ thương hiệu trong Brand Vault — không gửi thì server dùng bản user cập nhật gần nhất (nếu có)
    brand_id: uuid.UUID | None = None


def _render_smart_contact_template(text: str, r: QuickOutreachRecipient) -> str:
    name = (r.name or "").strip() or "bạn"
    phone = (r.phone or "").strip()
    merged: dict[str, str] = {"name": name, "phone": phone}
    if r.variables:
        merged.update({str(k): str(v) if v is not None else "" for k, v in r.variables.items()})
    out = text or ""
    for key in sorted(merged.keys(), key=len, reverse=True):
        out = out.replace("{{" + key + "}}", merged[key])
    return out


def _format_brand_for_smart_contact(brand: Brand) -> str:
    """Gọn, tiếng Việt — đưa vào system prompt Smart Contact."""
    parts: list[str] = []
    parts.append(f"Tên thương hiệu: {brand.brand_name.strip()}")
    if (brand.tagline or "").strip():
        parts.append(f"Slogan / dòng phụ: {(brand.tagline or '').strip()[:400]}")
    bd = (brand.brand_description or "").strip()
    if bd:
        parts.append(f"Mô tả ngành hình & giá trị: {bd[:1600]}")
    else:
        # Ngành hình TRỐNG = cảnh báo để LLM không bịa
        parts.append("Mô tả ngành hình & giá trị: (CHƯA CẬP NHẬT — TUYỆT ĐỐI KHÔNG suy đoán ngành hình)")
    parts.append(f"Giọng điệu (tone_of_voice): {(brand.tone_of_voice or '').strip() or '(chưa cập nhật)'}")
    ta = (brand.target_audience or "").strip()
    if ta:
        parts.append(f"Khách hàng mục tiêu: {ta[:900]}")

    # Thông tin liên hệ và địa chỉ (quan trọng cho email)
    if (brand.contact_email or "").strip():
        parts.append(f"Email liên hệ: {(brand.contact_email or '').strip()}")
    if (brand.phone or "").strip():
        parts.append(f"Số điện thoại: {(brand.phone or '').strip()}")
    if (brand.address or "").strip():
        parts.append(f"Địa chỉ: {(brand.address or '').strip()}")

    if brand.key_products:
        kp = ", ".join(str(x).strip() for x in brand.key_products[:24] if x and str(x).strip())
        if kp:
            parts.append(f"Dịch vụ / sản phẩm chính (tham khảo khi viết): {kp}")
    if (brand.preferred_salutation or "").strip():
        parts.append(f"Cách chào / xưng hô ưu tiên: {brand.preferred_salutation.strip()}")
    if (brand.preferred_cta or "").strip():
        parts.append(f"CTA gợi ý (có thể dùng nhẹ nếu phù hợp): {brand.preferred_cta.strip()}")
    if brand.forbidden_words:
        fw = ", ".join(str(x).strip() for x in brand.forbidden_words[:30] if x and str(x).strip())
        if fw:
            parts.append(f"Tuyệt đối không dùng các từ/cụm: {fw}")
    sp = (brand.sample_post or "").strip()
    if sp:
        parts.append(
            "Tham khảo phong cách (viết mới theo yêu cầu mail, không copy dán):\n"
            f"{sp[:700]}",
        )
    return "\n".join(parts)


def _normalize_smart_contact_compose_output(raw: str, mode: str) -> str:
    """Bỏ fence markdown / lời dẫn thừa model hay thêm."""
    t = (raw or "").strip()
    if not t:
        return t
    if t.startswith("```"):
        lines = t.splitlines()
        if lines and lines[0].strip().startswith("```"):
            lines = lines[1:]
        while lines and lines[-1].strip() == "```":
            lines.pop()
        t = "\n".join(lines).strip()
    lower_start = t[:48].lower()
    for prefix in (
        "nội dung:",
        "nội dung gợi ý:",
        "đây là nội dung:",
        "dưới đây là nội dung",
        "email:",
        "tin nhắn:",
        "tiêu đề:",
        "subject:",
    ):
        if lower_start.startswith(prefix):
            t = t[len(prefix) :].lstrip(" \n:：-")
            break
    if mode == "sms" and len(t) > 360:
        t = t[:357].rstrip() + "…"

    # Strip placeholder signature lines LLM hay thêm thừa
    lines = t.splitlines()
    SIG_PATTERNS = (
        r"^\s*\[?\s*[Yy]our\s+[Nn]ame\s*\]?\s*$",
        r"^\s*\[?\s*[Tt]ên\s*(của\s*)?[Bb]ạn\s*\]?\s*$",
        r"^\s*\[?\s*[Hh]ọ\s*[Tt]ên\s*\]?\s*$",
        r"^\s*\[?\s*[Nn]ame\s*\]?\s*$",
        r"^\s*\[?\s*[Ss]hop\s*[Nn]ame\s*\]?\s*$",
        r"^\s*\[?\s*[Tt]ên\s*cửa\s*hàng\s*\]?\s*$",
        r"^\s*Trân trọng\s*,?\s*$",
        r"^\s*Thân ái\s*,?\s*$",
        r"^\s*Thân trọng\s*,?\s*$",
        r"^\s*Hẹn\s+gặp\s+lại\s*,?\s*$",
        r"^\s*Warmly\s*,?\s*$",
        r"^\s*Best\s*,?\s*$",
        r"^\s*Best\s+regards\s*,?\s*$",
        r"^\s*\[.*?\]\(.*?\)\s*$",  # markdown link [Name](url)
    )
    import re
    sig_re = re.compile("|".join(SIG_PATTERNS))
    while lines and sig_re.match(lines[-1].strip()):
        lines.pop()
    t = "\n".join(lines).strip()
    return t


def _smart_contact_compose_system_prompt(
    mode: str,
    context_one_liner: str | None,
    recipients_data: str | None,
    brand_context: str | None,
    brand_name_for_prompt: str = "",
) -> str:
    """Build system prompt cho smart contact compose.

    Args:
        brand_name_for_prompt: tên thương hiệu (trích từ brand_context) —
                               dùng để nhắc LLM bắt buộc dùng tên này.
    """
    channel_rules = (
        "ĐỊNH DẠNG SMS:\n"
        "- Tối đa khoảng 300 ký tự (Unicode); 1–2 câu ngắn; ít xuống dòng; không chèn URL dài.\n"
        "- Không mở đầu «Kính gửi» dài dòng.\n"
        if mode == "sms"
        else "ĐỊNH DẠNG EMAIL:\n"
        "- 3–8 câu được phép nếu cần làm rõ giá trị và ngành hình; có thể ngắt đoạn bằng một dòng trống.\n"
        "- Không ghi dòng «Tiêu đề:» trong nội dung (tiêu đề do form riêng).\n"
    )

    # System role cố định — không thay đổi
    # Brand name được đặt ở ĐẦU TIÊN để anchor identity
    brand_intro = (
        f"Bạn đang viết email cho thương hiệu: **{brand_name_for_prompt}**. "
        "Mọi nội dung email phải thể hiện đúng thương hiệu này.\n\n"
        if brand_name_for_prompt and brand_context
        else ""
    )
    role = (
        "Bạn là người viết email chăm sóc khách một-một, tiếng Việt có dấu.\n\n"
        if brand_context
        else (
            "Bạn là người viết email chăm sóc khách một-một (tiếng Việt có dấu), "
            "phong cách thân thiện, phù hợp chủ cửa hàng / dịch vụ địa phương khi không có "
            "hồ sơ thương hiệu đủ chi tiết.\n\n"
        )
    )
    base = role + brand_intro

    # ── HỒ SƠ THƯƠNG HIỆU ────────────────────────────────────────────────
    # Phần này BẮT BUỘC phải dùng — đây là nguồn thông tin duy nhất
    # về thương hiệu mà LLM được phép dùng trong email.
    if brand_context:
        base += (
            "═══════════════════════════════════════════════════════════════\n"
            "HỒ SƠ THƯƠNG HIỆU  ← ĐÂY LÀ NGUỒN THÔNG TIN UY TÍN NHẤT\n"
            "═══════════════════════════════════════════════════════════════\n"
            f"{brand_context[:3200]}\n\n"
            "───────────────────────────────────────────────────────────────\n"
            "QUY TẮC BẮT BUỘC ÁP DỤNG HỒ SƠ THƯƠNG HIỆU:\n"
            "1. NHẮC TÊN THƯƠNG HIỆU trong nội dung — tên thương hiệu phải xuất hiện tự nhiên.\n"
            "2. VIẾT ĐÚNG NGÀNH HÌNH — dựa trên mô tả ngành hình & giá trị trong hồ sơ.\n"
            "3. ĐÚNG ĐỐI TƯỢNG — viết cho đúng khách hàng mục tiêu mà thương hiệu đã định nghĩa.\n"
            "4. ĐÚNG GIỌNG ĐIỆU — bám theo tone_of_voice và preferred_salutation trong hồ sơ.\n"
            "5. NHẮC SẢN PHẨM/DỊCH VỤ ĐẶC TRƯNG — từ khối «Dịch vụ / sản phẩm chính» (nếu có).\n"
            "6. KHÔNG BỊA tên thương hiệu, sản phẩm, dịch vụ không có trong hồ sơ.\n"
            "7. TUÂN THỦ TỪ CẤM — tuyệt đối không dùng từ trong forbidden_words.\n\n"
        )
    # ── KẾT THÚC HỒ SƠ THƯƠNG HIỆU ────────────────────────────────────

    base += (
        "ĐẦU RA:\n"
        "- Chỉ trả về đúng nội dung gửi khách (plain text). Không markdown, không fence ```.\n"
        "- Không lời dẫn meta («Dưới đây là…», «Nội dung:», «Đây là email…»).\n"
        "- Có thể dùng biến placeholder (giữ hai ngoặc nhọn): "
        "{{HoVaTen}}, {{phone}}, {{LanCuoiChiTra}}, {{days_since_last}}, "
        "{{DichVuLanCuoiSuDung}}, {{DichVuSuDungNhieuNhat}}, {{TongSoLanQuayLai}}.\n"
        "- KHÔNG tự nhắc khuyến mãi, giảm giá, voucher — trừ khi trong YÊU CẦU NGƯỜI DÙNG có nói rõ.\n"
        "- Không bịa ngày, số tiền, chi nhánh không có trong dữ liệu khách (khi có khối dữ liệu khách bên dưới).\n"
        f"{channel_rules}\n"
    )
    if recipients_data:
        base += (
            "\nDỮ LIỆU KHÁCH (từ hệ thống — chỉ cá nhân hóa, không thêm khách không có trong danh sách):\n"
            f"{recipients_data[:2800]}\n"
        )
    elif context_one_liner:
        base += (
            "Ngữ cảnh một khách mẫu (chỉ tham khảo): "
            f"{context_one_liner[:500]}\n"
        )
    base += "\nTrả về một khối nội dung email hoàn chỉnh, không giải thích thêm.\n"
    return base


async def _smart_contact_compose_text(
    payload: SmartContactComposePayload,
    *,
    brand_context: str | None = None,
    brand_name_for_prompt: str = "",
) -> str:
    up = (payload.user_prompt or "").strip()
    if not up:
        raise HTTPException(400, "Nhập yêu cầu soạn nội dung.")
    if len(up) > 4500:
        raise HTTPException(400, "Yêu cầu quá dài (tối đa 4500 ký tự).")
    rd = (payload.recipients_data_context or "").strip() or None
    if rd and len(rd) > 4000:
        raise HTTPException(400, "Dữ liệu ngữ cảnh khách quá dài.")
    if brand_context and len(brand_context) > 4500:
        raise HTTPException(400, "Dữ liệu thương hiệu quá dài.")
    mode = (payload.mode or "email").strip().lower()
    if mode not in ("email", "sms"):
        mode = "email"
    ctx = (payload.context_one_liner or "").strip() or None
    sys = _smart_contact_compose_system_prompt(
        mode, ctx, rd,
        brand_context.strip() if brand_context else None,
        brand_name_for_prompt=brand_name_for_prompt,
    )
    user_block = f"YÊU CẦU CỦA NGƯỜI DÙNG:\n{up}"
    messages = [
        {"role": "system", "content": sys},
        {"role": "user", "content": user_block},
    ]
    temp = 0.32 if mode == "sms" else (0.45 if brand_context else 0.40)
    try:
        # GPT-4o cho chất lượng cao nhất — brand-aware email cần model mạnh
        resp = await asyncio.wait_for(
            _openai.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                temperature=temp,
            ),
            timeout=min(120, 120),
        )
        out = (resp.choices[0].message.content or "").strip()
        return _normalize_smart_contact_compose_output(out, mode)
    except Exception:
        try:
            # Qwen fallback — vẫn dùng local model nếu OpenAI lỗi
            resp = await asyncio.wait_for(
                _qwen.chat.completions.create(
                    model=QWEN_MODEL,
                    messages=messages,
                    temperature=temp,
                ),
                timeout=min(QWEN_TIMEOUT, 90),
            )
            out = (resp.choices[0].message.content or "").strip()
            return _normalize_smart_contact_compose_output(out, mode)
        except Exception as exc:
            raise HTTPException(
                503,
                "Không soạn được nội dung (LLM lỗi). Hãy thử lại hoặc viết tay.",
            ) from exc


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/presets")
async def list_presets():
    """Return available workflow preset definitions for the frontend."""
    return [
        {
            "preset_type": key,
            "label": val["label"],
            "description": val["description"],
            "channels": val["channels"],
        }
        for key, val in PRESETS.items()
    ]


@router.post("/trigger", status_code=202)
async def trigger_workflow(
    payload: TriggerPayload,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.preset_type not in PRESETS:
        raise HTTPException(400, f"Preset không hợp lệ: {payload.preset_type}")

    preset = PRESETS[payload.preset_type]

    # Require brand vault so the agent service has enough context
    brand_result = await db.execute(
        select(Brand)
        .where(Brand.user_id == current_user.id)
        .order_by(Brand.updated_at.desc())
        .limit(1)
    )
    brand = brand_result.scalar_one_or_none()
    if not brand:
        raise HTTPException(
            400,
            "Bạn cần thiết lập Brand Vault trước khi dùng tính năng tự động hoá",
        )

    # Use Qwen to draft the brief (GPT fallback inside _generate_brief)
    try:
        brief = await _generate_brief(preset, brand)
    except Exception:
        raise HTTPException(503, "Không thể tạo brief tự động. Vui lòng thử lại.")

    deadline = date.today() + timedelta(days=preset["deadline_days"])

    campaign = Campaign(
        user_id=current_user.id,
        brand_id=brand.id,
        campaign_name=brief.get("campaign_name", preset["label"]),
        objective=brief.get("objective", preset["objective_hint"]),
        product_or_service=brief.get("product_or_service", brand.brand_name),
        target_audience=brief.get("target_audience", brand.target_audience or ""),
        offer_or_hook=brief.get("offer_or_hook", ""),
        additional_notes=f"[AUTO:{payload.preset_type}]",
        deadline=deadline,
        channels=preset["channels"],
        status="pending_agent",
    )
    db.add(campaign)
    await db.flush()  # get campaign.id before commit

    job = WorkflowJob(
        user_id=current_user.id,
        trigger_type=payload.preset_type,
        trigger_payload={
            "preset_label": preset["label"],
            "channels": preset["channels"],
            "generated_brief": brief,
        },
        campaign_id=campaign.id,
        status="queued",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    await db.refresh(campaign)

    background_tasks.add_task(_execute_workflow_job, job.id, campaign.id)

    return {
        "job_id": str(job.id),
        "campaign_id": str(campaign.id),
        "campaign_name": campaign.campaign_name,
        "status": job.status,
    }


@router.get("/jobs")
async def list_jobs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkflowJob)
        .where(WorkflowJob.user_id == current_user.id)
        .order_by(WorkflowJob.created_at.desc())
        .limit(30)
    )
    jobs = result.scalars().all()
    return [
        {
            "id": str(j.id),
            "trigger_type": j.trigger_type,
            "preset_label": PRESETS.get(j.trigger_type, {}).get("label", j.trigger_type),
            "campaign_id": str(j.campaign_id) if j.campaign_id else None,
            "campaign_name": (j.trigger_payload or {}).get("generated_brief", {}).get("campaign_name") if j.trigger_payload else None,
            "status": j.status,
            "error_message": j.error_message,
            "created_at": j.created_at.isoformat(),
        }
        for j in jobs
    ]


def _ensure_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _compute_next_run(cron_expression: str, tz_name: str, base: datetime | None = None) -> datetime:
    base_dt = base or datetime.now(timezone.utc)
    itr = croniter(cron_expression, base_dt)
    return _ensure_aware(itr.get_next(datetime))


@router.get("/schedules")
async def list_schedules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkflowSchedule)
        .where(WorkflowSchedule.user_id == current_user.id)
        .order_by(WorkflowSchedule.created_at.desc())
    )
    schedules = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "preset_type": s.preset_type,
            "preset_label": PRESETS.get(s.preset_type, {}).get("label", s.preset_type),
            "cron_expression": s.cron_expression,
            "timezone_name": s.timezone_name,
            "is_active": s.is_active,
            "next_run_at": s.next_run_at.isoformat() if s.next_run_at else None,
            "last_run_at": s.last_run_at.isoformat() if s.last_run_at else None,
            "notes": s.notes,
            "created_at": s.created_at.isoformat(),
        }
        for s in schedules
    ]


@router.post("/schedules", status_code=201)
async def create_schedule(
    payload: ScheduleCreatePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.preset_type not in PRESETS:
        raise HTTPException(400, f"Preset không hợp lệ: {payload.preset_type}")

    try:
        next_run_at = _compute_next_run(payload.cron_expression, payload.timezone_name)
    except Exception:
        raise HTTPException(400, "Cron expression không hợp lệ")

    schedule = WorkflowSchedule(
        user_id=current_user.id,
        preset_type=payload.preset_type,
        cron_expression=payload.cron_expression,
        timezone_name=payload.timezone_name,
        notes=payload.notes,
        default_brief_template=payload.default_brief_template,
        next_run_at=next_run_at,
        is_active=True,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return {
        "id": str(schedule.id),
        "preset_type": schedule.preset_type,
        "cron_expression": schedule.cron_expression,
        "timezone_name": schedule.timezone_name,
        "is_active": schedule.is_active,
        "next_run_at": schedule.next_run_at.isoformat() if schedule.next_run_at else None,
    }


@router.patch("/schedules/{schedule_id}")
async def update_schedule(
    schedule_id: uuid.UUID,
    payload: ScheduleUpdatePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkflowSchedule).where(
            WorkflowSchedule.id == schedule_id,
            WorkflowSchedule.user_id == current_user.id,
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Schedule không tồn tại")

    if payload.cron_expression is not None:
        schedule.cron_expression = payload.cron_expression
    if payload.timezone_name is not None:
        schedule.timezone_name = payload.timezone_name
    if payload.notes is not None:
        schedule.notes = payload.notes
    if payload.default_brief_template is not None:
        schedule.default_brief_template = payload.default_brief_template
    if payload.is_active is not None:
        schedule.is_active = payload.is_active

    if payload.cron_expression is not None or payload.timezone_name is not None:
        try:
            schedule.next_run_at = _compute_next_run(schedule.cron_expression, schedule.timezone_name)
        except Exception:
            raise HTTPException(400, "Cron expression không hợp lệ")

    await db.commit()
    await db.refresh(schedule)
    return {
        "id": str(schedule.id),
        "is_active": schedule.is_active,
        "next_run_at": schedule.next_run_at.isoformat() if schedule.next_run_at else None,
    }


@router.patch("/schedules/{schedule_id}/toggle")
async def toggle_schedule(
    schedule_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkflowSchedule).where(
            WorkflowSchedule.id == schedule_id,
            WorkflowSchedule.user_id == current_user.id,
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Schedule không tồn tại")

    schedule.is_active = not schedule.is_active
    if schedule.is_active:
        schedule.next_run_at = _compute_next_run(schedule.cron_expression, schedule.timezone_name)
    await db.commit()
    return {"id": str(schedule.id), "is_active": schedule.is_active}


@router.delete("/schedules/{schedule_id}", status_code=204)
async def delete_schedule(
    schedule_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkflowSchedule).where(
            WorkflowSchedule.id == schedule_id,
            WorkflowSchedule.user_id == current_user.id,
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Schedule không tồn tại")
    await db.delete(schedule)
    await db.commit()


async def _process_customer_list_background(
    user_id: uuid.UUID,
    customer_list_id: uuid.UUID,
    csv_content: bytes,
    list_name: str,
):
    decoded = csv_content.decode("utf-8", errors="replace")
    sample = decoded[:4096]
    delimiter = ","
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;")
        delimiter = dialect.delimiter
    except Exception:
        delimiter = "," if sample.count(",") >= sample.count(";") else ";"

    reader = csv.DictReader(io.StringIO(decoded), delimiter=delimiter)
    customers: list[Customer] = []
    total = 0
    valid = 0

    for row in reader:
        total += 1
        email = (row.get("email") or "").strip() or None
        full_name = (row.get("full_name") or row.get("name") or "").strip() or None
        phone = (row.get("phone") or "").strip() or None
        extra = {k: v for k, v in row.items() if k not in {"email", "full_name", "name", "phone"}}
        customers.append(
            Customer(
                customer_list_id=customer_list_id,
                email=email,
                full_name=full_name,
                phone=phone,
                extra_fields=extra or None,
            )
        )
        if full_name and phone:
            valid += 1

    invalid = max(total - valid, 0)

    async with AsyncSessionLocal() as db:
        customer_list = await db.get(CustomerList, customer_list_id)
        if not customer_list:
            return
        db.add_all(customers)
        customer_list.total_records = total
        customer_list.valid_records = valid
        customer_list.invalid_records = invalid
        customer_list.status = "ready" if valid > 0 else "failed"

        campaign = None
        if valid > 0:
            campaign = Campaign(
                user_id=user_id,
                campaign_name=f"Email danh sách khách hàng - {list_name}",
                objective="Gửi email chăm sóc cho danh sách khách hàng đã tải lên",
                product_or_service="Danh sách khách hàng",
                target_audience="Khách hàng từ tệp CSV",
                offer_or_hook="Nội dung chăm sóc khách hàng cũ",
                additional_notes=f"[AUTO:csv_list:{customer_list_id}]",
                deadline=date.today() + timedelta(days=3),
                channels=["email"],
                status="pending_agent",
            )
            db.add(campaign)
            await db.flush()

            job = WorkflowJob(
                user_id=user_id,
                trigger_type="csv_customer_list",
                trigger_payload={"customer_list_id": str(customer_list_id), "list_name": list_name},
                campaign_id=campaign.id,
                status="queued",
            )
            db.add(job)

        await db.commit()
        if campaign:
            await dispatch_campaign(str(campaign.id))


@router.post("/customer-lists/upload", status_code=202)
async def upload_customer_list(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    list_name: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filename = file.filename or ""
    if not filename.lower().endswith(".csv"):
        raise HTTPException(400, "Chỉ hỗ trợ file CSV")

    content = await file.read()
    if not content:
        raise HTTPException(400, "File rỗng")

    os.makedirs("uploads/customer_lists", exist_ok=True)
    stored_path = f"uploads/customer_lists/{uuid.uuid4()}-{filename}"
    with open(stored_path, "wb") as f:
        f.write(content)

    upload = FileUpload(
        user_id=current_user.id,
        original_filename=filename,
        stored_path=stored_path,
        mime_type=file.content_type or "text/csv",
        file_size_bytes=len(content),
        purpose="customer_list",
    )
    db.add(upload)
    await db.flush()

    customer_list = CustomerList(
        user_id=current_user.id,
        file_upload_id=upload.id,
        list_name=list_name or filename.replace(".csv", ""),
        status="processing",
    )
    db.add(customer_list)
    await db.commit()
    await db.refresh(customer_list)

    background_tasks.add_task(
        _process_customer_list_background,
        current_user.id,
        customer_list.id,
        content,
        customer_list.list_name,
    )
    return {
        "customer_list_id": str(customer_list.id),
        "status": customer_list.status,
    }


@router.post("/customer-lists", status_code=201)
async def create_customer_list(
    payload: CustomerListCreatePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    list_name = payload.list_name.strip()
    if not list_name:
        raise HTTPException(400, "Tên bảng không được để trống")
    customer_list = CustomerList(
        user_id=current_user.id,
        list_name=list_name,
        status="draft",
        total_records=0,
        valid_records=0,
        invalid_records=0,
    )
    db.add(customer_list)
    await db.commit()
    await db.refresh(customer_list)
    return {
        "id": str(customer_list.id),
        "list_name": customer_list.list_name,
        "status": customer_list.status,
    }


@router.patch("/customer-lists/{customer_list_id}")
async def update_customer_list(
    customer_list_id: uuid.UUID,
    payload: CustomerListUpdatePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CustomerList).where(
            CustomerList.id == customer_list_id,
            CustomerList.user_id == current_user.id,
        )
    )
    customer_list = result.scalar_one_or_none()
    if not customer_list:
        raise HTTPException(404, "Customer list không tồn tại")
    list_name = payload.list_name.strip()
    if not list_name:
        raise HTTPException(400, "Tên bảng không được để trống")
    customer_list.list_name = list_name
    await db.commit()
    return {"id": str(customer_list.id), "list_name": customer_list.list_name}


@router.delete("/customer-lists/{customer_list_id}", status_code=204)
async def delete_customer_list(
    customer_list_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CustomerList).where(
            CustomerList.id == customer_list_id,
            CustomerList.user_id == current_user.id,
        )
    )
    customer_list = result.scalar_one_or_none()
    if not customer_list:
        raise HTTPException(404, "Customer list không tồn tại")
    await db.delete(customer_list)
    await db.commit()


@router.put("/customer-lists/{customer_list_id}/rows")
async def replace_customer_list_rows(
    customer_list_id: uuid.UUID,
    payload: CustomerRowsUpsertPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CustomerList).where(
            CustomerList.id == customer_list_id,
            CustomerList.user_id == current_user.id,
        )
    )
    customer_list = result.scalar_one_or_none()
    if not customer_list:
        raise HTTPException(404, "Customer list không tồn tại")

    rows = payload.rows or []
    await db.execute(
        Customer.__table__.delete().where(Customer.customer_list_id == customer_list.id)
    )

    new_customers: list[Customer] = []
    valid_records = 0
    for row in rows:
        if not isinstance(row, dict):
            continue
        email, full_name, phone, extra_fields = _row_to_customer_fields(row)
        if full_name and phone:
            valid_records += 1
        new_customers.append(
            Customer(
                customer_list_id=customer_list.id,
                email=email,
                full_name=full_name,
                phone=phone,
                extra_fields=extra_fields,
            )
        )
    if new_customers:
        db.add_all(new_customers)

    total_records = len(new_customers)
    customer_list.total_records = total_records
    customer_list.valid_records = valid_records
    customer_list.invalid_records = max(total_records - valid_records, 0)
    customer_list.status = "ready" if total_records > 0 else "draft"
    await db.commit()
    return {
        "id": str(customer_list.id),
        "total_records": customer_list.total_records,
        "valid_records": customer_list.valid_records,
        "invalid_records": customer_list.invalid_records,
        "status": customer_list.status,
    }


@router.get("/customer-lists/{customer_list_id}/rows")
async def get_customer_list_rows(
    customer_list_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CustomerList).where(
            CustomerList.id == customer_list_id,
            CustomerList.user_id == current_user.id,
        )
    )
    customer_list = result.scalar_one_or_none()
    if not customer_list:
        raise HTTPException(404, "Customer list không tồn tại")

    rows_result = await db.execute(
        select(Customer)
        .where(Customer.customer_list_id == customer_list.id)
        .order_by(Customer.created_at.asc())
    )
    customers = rows_result.scalars().all()
    rows: list[dict] = []
    for idx, customer in enumerate(customers, start=1):
        row = {
            "ID": idx,
            "HoVaTen": customer.full_name or "",
            "Tuoi": (customer.extra_fields or {}).get("tuoi", ""),
            "SDT": customer.phone or "",
            "Email": customer.email or "",
            "LinkFB": (customer.extra_fields or {}).get("link_fb", ""),
            "LanCuoiChiTra": (customer.extra_fields or {}).get("lan_cuoi_chi_tra", ""),
            "TongSoTienDaChiTra": (customer.extra_fields or {}).get("tong_so_tien_da_chi_tra", ""),
            "TongSoLanQuayLai": (customer.extra_fields or {}).get("tong_so_lan_quay_lai", ""),
            "LoaiKhachHang": (customer.extra_fields or {}).get("loai_khach_hang", ""),
            "DichVuLanCuoiSuDung": (customer.extra_fields or {}).get("dich_vu_lan_cuoi_su_dung", ""),
            "DichVuSuDungNhieuNhat": (customer.extra_fields or {}).get("dich_vu_su_dung_nhieu_nhat", ""),
        }
        # Giu them cot extra khac neu co.
        for k, v in (customer.extra_fields or {}).items():
            if k in {
                "tuoi",
                "link_fb",
                "lan_cuoi_chi_tra",
                "tong_so_tien_da_chi_tra",
                "tong_so_lan_quay_lai",
                "loai_khach_hang",
                "dich_vu_lan_cuoi_su_dung",
                "dich_vu_su_dung_nhieu_nhat",
            }:
                continue
            if k not in row:
                row[k] = v
        rows.append(row)
    return {
        "table": {
            "id": str(customer_list.id),
            "name": customer_list.list_name,
            "status": customer_list.status,
        },
        "rows": rows,
    }


@router.get("/customer-lists")
async def list_customer_lists(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CustomerList)
        .where(CustomerList.user_id == current_user.id)
        .order_by(CustomerList.created_at.desc())
    )
    items = result.scalars().all()
    payload: list[dict] = []
    for item in items:
        segment_counts = {"vip": 0, "potential": 0, "churn": 0, "unknown": 0}
        seg_result = await db.execute(
            select(Customer.extra_fields).where(Customer.customer_list_id == item.id)
        )
        for row in seg_result.scalars().all():
            segment_counts[_segment_customer(row)] += 1

        payload.append(
            {
                "id": str(item.id),
                "list_name": item.list_name,
                "status": item.status,
                "total_records": item.total_records,
                "valid_records": item.valid_records,
                "invalid_records": item.invalid_records,
                "segment_summary": segment_counts,
                "created_at": item.created_at.isoformat(),
            }
        )
    return payload


@router.get("/customer-lists/{customer_list_id}/customers")
async def list_customers(
    customer_list_id: uuid.UUID,
    segment: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    list_result = await db.execute(
        select(CustomerList).where(
            CustomerList.id == customer_list_id,
            CustomerList.user_id == current_user.id,
        )
    )
    customer_list = list_result.scalar_one_or_none()
    if not customer_list:
        raise HTTPException(404, "Customer list không tồn tại")

    result = await db.execute(
        select(Customer)
        .where(Customer.customer_list_id == customer_list.id)
        .order_by(Customer.created_at.desc())
    )
    customers = result.scalars().all()
    payload = [
        {
            "id": str(c.id),
            "email": c.email,
            "full_name": c.full_name,
            "phone": c.phone,
            "segment": _segment_customer(c.extra_fields),
        }
        for c in customers
    ]
    if segment:
        normalized_segment = segment.strip().lower()
        if normalized_segment not in {"vip", "potential", "churn", "unknown"}:
            raise HTTPException(400, f"Segment không hợp lệ: {segment}")
        payload = [item for item in payload if item["segment"] == normalized_segment]
    return payload[offset : offset + limit]


@router.post("/customer-lists/{customer_list_id}/analyze")
async def analyze_customer_list_rows(
    customer_list_id: uuid.UUID,
    payload: CustomerAnalyzePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    list_result = await db.execute(
        select(CustomerList).where(
            CustomerList.id == customer_list_id,
            CustomerList.user_id == current_user.id,
        )
    )
    customer_list = list_result.scalar_one_or_none()
    if not customer_list:
        raise HTTPException(404, "Customer list không tồn tại")
    rows = payload.rows or []
    if len(rows) == 0:
        raise HTTPException(400, "Danh sách đang trống, không thể phân tích")
    analysis = analyze_customer_rows(rows)
    narrative, ai_meta = await _generate_customer_analysis_narrative(analysis)
    analysis["narrative"] = narrative
    analysis["ai_meta"] = ai_meta

    # Lưu snapshot để outreach page có thể lấy lại
    snapshot_data = {
        "list_id": str(customer_list.id),
        "list_name": customer_list.list_name,
        "analysis": analysis,
    }
    db.add(CustomerAnalysisSnapshot(
        customer_list_id=customer_list.id,
        result_json=snapshot_data,
    ))
    await db.commit()

    return snapshot_data


@router.get("/customer-lists/{customer_list_id}/analysis")
async def get_customer_analysis(
    customer_list_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy kết quả phân tích đã lưu của customer list (nếu có)."""
    list_result = await db.execute(
        select(CustomerList).where(
            CustomerList.id == customer_list_id,
            CustomerList.user_id == current_user.id,
        )
    )
    customer_list = list_result.scalar_one_or_none()
    if not customer_list:
        raise HTTPException(404, "Customer list không tồn tại")

    snapshot_result = await db.execute(
        select(CustomerAnalysisSnapshot)
        .where(CustomerAnalysisSnapshot.customer_list_id == customer_list_id)
        .order_by(CustomerAnalysisSnapshot.created_at.desc())
        .limit(1)
    )
    snapshot = snapshot_result.scalar_one_or_none()
    if not snapshot:
        raise HTTPException(404, "Chưa có kết quả phân tích cho customer list này")

    return snapshot.result_json


@router.post("/customer-lists/{customer_list_id}/quick-outreach")
async def customer_list_quick_outreach(
    customer_list_id: uuid.UUID,
    payload: QuickOutreachPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.mode not in ("email", "sms"):
        raise HTTPException(400, "mode phải là email hoặc sms")
    if len(payload.message) > 8000:
        raise HTTPException(400, "Nội dung quá dài (tối đa 8000 ký tự).")
    if len(payload.recipients) > 150:
        raise HTTPException(400, "Tối đa 150 người nhận mỗi lần.")

    list_result = await db.execute(
        select(CustomerList).where(
            CustomerList.id == customer_list_id,
            CustomerList.user_id == current_user.id,
        )
    )
    if not list_result.scalar_one_or_none():
        raise HTTPException(404, "Customer list không tồn tại")

    # Verify campaign if provided
    campaign = None
    if payload.campaign_id:
        camp_result = await db.execute(
            select(Campaign).where(
                Campaign.id == payload.campaign_id,
                Campaign.user_id == current_user.id,
            )
        )
        campaign = camp_result.scalar_one_or_none()
        if not campaign:
            raise HTTPException(404, "Chiến dịch không tồn tại hoặc không thuộc tài khoản của bạn")

    results: list[dict[str, str | None]] = []
    sent_count = 0
    failed_count = 0

    # Generate batch_id for tracking
    batch_id = uuid.uuid4()

    if payload.mode == "email":
        if not settings.SMTP_HOST or not settings.SMTP_USER:
            raise HTTPException(
                503,
                "Chưa cấu hình SMTP (SMTP_HOST, SMTP_USER trong .env).",
            )
        from services.campaign_delivery_service import send_smtp_sync

        for r in payload.recipients:
            email_addr = (r.email or "").strip()
            name = (r.name or "").strip() or "bạn"
            phone = (r.phone or "").strip()
            if not email_addr:
                results.append({"to": name or "?", "status": "skipped", "detail": "Thiếu email"})
                continue
            text_body = _render_smart_contact_template(payload.message or "", r)
            subject = _render_smart_contact_template(payload.subject or "Thông báo", r)
            safe_html = html.escape(text_body).replace("\n", "<br>\n")
            html_body = f"<!DOCTYPE html><html><body><div>{safe_html}</div></body></html>"
            try:
                await asyncio.to_thread(send_smtp_sync, email_addr, subject, text_body, html_body)
                results.append({"to": email_addr, "status": "sent", "detail": None})
                sent_count += 1
            except Exception as exc:
                results.append({"to": email_addr, "status": "failed", "detail": str(exc)[:300]})
                failed_count += 1

            # Log to CampaignExecutionLog if campaign_id provided
            if campaign:
                from models.campaign_execution_log import CampaignExecutionLog
                log_entry = CampaignExecutionLog(
                    campaign_id=campaign.id,
                    user_id=current_user.id,
                    channel="email",
                    recipient_email=email_addr,
                    recipient_name=name,
                    recipient_phone=phone,
                    subject=subject,
                    status="delivered",
                    batch_id=batch_id,
                )
                db.add(log_entry)

    else:  # SMS
        for r in payload.recipients:
            phone = (r.phone or "").strip()
            label = phone or (r.email or "").strip() or (r.name or "?")
            if not phone:
                results.append({"to": label, "status": "skipped", "detail": "Thiếu SĐT (SMS mô phỏng)"})
                continue
            preview = _render_smart_contact_template(payload.message or "", r)
            detail_preview = preview if len(preview) <= 160 else preview[:157] + "…"
            if random.random() < 0.85:
                results.append({"to": phone, "status": "sent", "detail": f"Mô phỏng · {detail_preview}"})
                sent_count += 1
            else:
                results.append({"to": phone, "status": "failed", "detail": "Mô phỏng: lỗi gửi"})
                failed_count += 1

            # Log to CampaignExecutionLog if campaign_id provided
            if campaign:
                from models.campaign_execution_log import CampaignExecutionLog
                log_entry = CampaignExecutionLog(
                    campaign_id=campaign.id,
                    user_id=current_user.id,
                    channel="sms",
                    recipient_email=(r.email or "").strip(),
                    recipient_name=(r.name or "").strip() or "bạn",
                    recipient_phone=phone,
                    message=preview,
                    status="delivered",
                    batch_id=batch_id,
                )
                db.add(log_entry)

    # NOTE: outreach_log removed - table was deleted during cleanup
    # Previously logged to: outreach_logs table
    pass  # outreach_log feature disabled

    await db.commit()

    return {"results": results}


@router.post("/customer-lists/{customer_list_id}/smart-contact-compose")
async def customer_list_smart_contact_compose(
    customer_list_id: uuid.UUID,
    payload: SmartContactComposePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    list_result = await db.execute(
        select(CustomerList).where(
            CustomerList.id == customer_list_id,
            CustomerList.user_id == current_user.id,
        )
    )
    if not list_result.scalar_one_or_none():
        raise HTTPException(404, "Customer list không tồn tại")

    brand_row: Brand | None = None
    if payload.brand_id:
        br_one = await db.execute(
            select(Brand).where(Brand.id == payload.brand_id, Brand.user_id == current_user.id)
        )
        brand_row = br_one.scalar_one_or_none()
    else:
        br_latest = await db.execute(
            select(Brand)
            .where(Brand.user_id == current_user.id)
            .order_by(Brand.updated_at.desc())
            .limit(1)
        )
        brand_row = br_latest.scalar_one_or_none()
    brand_context: str | None = _format_brand_for_smart_contact(brand_row) if brand_row else None
    brand_name_for_prompt: str = brand_row.brand_name.strip() if brand_row else ""

    text = await _smart_contact_compose_text(
        payload,
        brand_context=brand_context,
        brand_name_for_prompt=brand_name_for_prompt,
    )
    return {"text": text}


@router.get("/customer-lists/{customer_list_id}/priority-customers")
async def list_priority_customers(
    customer_list_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    list_result = await db.execute(
        select(CustomerList).where(
            CustomerList.id == customer_list_id,
            CustomerList.user_id == current_user.id,
        )
    )
    customer_list = list_result.scalar_one_or_none()
    if not customer_list:
        raise HTTPException(404, "Customer list không tồn tại")

    rows_result = await db.execute(
        select(Customer).where(Customer.customer_list_id == customer_list.id)
    )
    customers = rows_result.scalars().all()
    payload: list[dict] = []
    for customer in customers:
        extra = customer.extra_fields or {}
        if bool(extra.get("is_priority")):
            payload.append(
                {
                    "customer_id": str(customer.id),
                    "customer_name": customer.full_name or "",
                    "email": customer.email,
                    "phone": customer.phone,
                    "priority_note": extra.get("priority_note"),
                }
            )
    return payload


@router.post("/customer-lists/{customer_list_id}/priority-customers")
async def upsert_priority_customer(
    customer_list_id: uuid.UUID,
    payload: CustomerPriorityUpsertPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    list_result = await db.execute(
        select(CustomerList).where(
            CustomerList.id == customer_list_id,
            CustomerList.user_id == current_user.id,
        )
    )
    customer_list = list_result.scalar_one_or_none()
    if not customer_list:
        raise HTTPException(404, "Customer list không tồn tại")

    rows_result = await db.execute(
        select(Customer).where(Customer.customer_list_id == customer_list.id)
    )
    candidates = rows_result.scalars().all()
    target: Customer | None = None
    email_norm = (payload.email or "").strip().lower()
    phone_norm = (payload.phone or "").strip()
    name_norm = payload.customer_name.strip().lower()

    if email_norm:
        target = next((c for c in candidates if (c.email or "").strip().lower() == email_norm), None)
    if target is None and phone_norm:
        target = next((c for c in candidates if (c.phone or "").strip() == phone_norm), None)
    if target is None:
        target = next((c for c in candidates if (c.full_name or "").strip().lower() == name_norm), None)

    if target is None:
        raise HTTPException(404, "Không tìm thấy customer để cập nhật ưu tiên")

    extra = dict(target.extra_fields or {})
    extra["is_priority"] = bool(payload.is_priority)
    target.extra_fields = extra
    await db.commit()
    return {
        "customer_id": str(target.id),
        "customer_name": target.full_name or "",
        "is_priority": bool(extra.get("is_priority")),
    }


@router.delete("/customer-lists/{customer_list_id}/priority-customers")
async def clear_priority_customers(
    customer_list_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    list_result = await db.execute(
        select(CustomerList).where(
            CustomerList.id == customer_list_id,
            CustomerList.user_id == current_user.id,
        )
    )
    customer_list = list_result.scalar_one_or_none()
    if not customer_list:
        raise HTTPException(404, "Customer list không tồn tại")

    rows_result = await db.execute(
        select(Customer).where(Customer.customer_list_id == customer_list.id)
    )
    customers = rows_result.scalars().all()
    updated_count = 0
    for customer in customers:
        extra = dict(customer.extra_fields or {})
        if not extra.get("is_priority"):
            continue
        extra["is_priority"] = False
        customer.extra_fields = extra
        updated_count += 1
    await db.commit()
    return {"cleared_count": updated_count}


# ---------------------------------------------------------------------------
# Smart Contact Batch — soạn email riêng cho từng khách theo segment
# ---------------------------------------------------------------------------


class SmartContactBatchPayload(BaseModel):
    """AI soạn song song từng email cho một nhóm khách (theo segment)."""

    brand_id: uuid.UUID | None = None
    segment: str = "churn_risk"
    purpose: str = "nhac_nhe"
    # Danh sách khách từ phân tích (tên + dịch vụ + ngày …) — frontend gửi lên
    customers: list[dict] = []  # [{name, email, phone, variables: {}}]


OUTREACH_PURPOSE_INSTRUCTION: dict[str, str] = {
    # ─── CÓ KHẢ NĂNG RỜI BỎ ───────────────────────────────────────────
    # Phản ứng: khách đã im lặng lâu → gợi FOMO + kỷ niệm tốt
    "nhac_nhe": (
        "MỤC ĐÍCH: Khách đã lâu không quay lại, email phải khơi lại cảm xúc và tạo lý do thật sự để quay lại.\n\n"
        "GIỌNG VĂN: Thân thương như người bạn cũ nhắn tin, không phải email quảng cáo. "
        "Giọng ấm, chân thành, tôn trọng — KHÔNG gây áp lực, KHÔNG FOMO ép uổng.\n\n"
        "CẤU TRÚC BẮT BUỘC (theo thứ tự):\n"
        "  1. MỞ ĐẦU: Gọi tên khách bằng biến {{HoVaTen}}, nói rõ mình là ai/từ thương hiệu nào. "
        "Ví dụ: «Minh ơi, bên mình là [Tên thương hiệu], hôm nay nhớ người quá nên viết tin nhắn này.»\n"
        "  2. BODY (PHẦN CHÍNH — viết dài, có chi tiết):\n"
        "     a. Gợi lại kỷ niệm tốt cụ thể: dịch vụ khách đã dùng, lần cuối ghé thăm là khi nào, trải nghiệm gì.\n"
        "     b. Chia sẻ ngắn về điều đã thay đổi/tốt hơn bên mình kể từ lần cuối khách đến.\n"
        "     c. Nói về dịch vụ/delta mới mà khách chưa trải nghiệm.\n"
        "  3. CTA NHẸ: Mời ghé thăm tự nhiên, KHÔNG kèm khuyến mãi/voucher.\n\n"
        "ĐỘ DÀI: 250–350 từ tiếng Việt. Viết đủ dài để email có thịt, không phải một đoạn ngắn.\n\n"
        "VÍ DỤ ĐÚNG: «Thắng ơi, bên mình là Trung tâm Anh ngữ, hôm nay nhớ mày quá nên viết tin nhắn này. "
        "Lần cuối mày đến học bài lúc tháng 3, lúc đó mình còn phòng học nhỏ. Giờ bên mình vừa mở thêm phòng máy lạnh mới, "
        "bạc thầy mới từ Mỹ về, mày phải đến thử. Tranh thủ cuối tuần ghé lại nhé.»\n\n"
        "VÍ DỤ SAI: «Xin chào quý khách, chúng tôi có nhiều ưu đãi hấp dẫn, hãy quay lại ngay!» (quá chung chung, "
        "không có tên thương hiệu, không gợi kỷ niệm)\n\n"
        "QUY TẮC: Không đề cập khuyến mãi. Nhắc dịch vụ cụ thể đã dùng. "
        "Gọi tên thương hiệu rõ ràng. Viết như người thật nhắn tin, không phải máy.\n\n"
        "QUY TẮC CHỐNG BỊA (BẮT BUỘC TUÂN THỦ):\n"
        "✗ TUYỆT ĐỐI KHÔNG bịa tên dịch vụ, sản phẩm, thầy giáo, không gian, công nghệ không có trong HỒ SƠ THƯƠNG HIỆU.\n"
        "✗ TUYỆT ĐỐI KHÔNG viết về ngành hình khác (VD: brand là trung tâm Anh ngữ → KHÔNG viết massage, spa, nha khoa…).\n"
        "✗ TUYỆT ĐỐI KHÔNG viết chi tiết cụ thể nếu HỒ SƠ THƯƠNG HIỆU trống — hãy dùng câu chung mà không bịa.\n"
        "✓ Nếu brand description trống: viết chào hỏi ấm áp + nhắc tên thương hiệu + CTA, KHÔNG bịa chi tiết.\n"
        "✓ Chỉ dùng thông tin có trong HỒ SƠ THƯƠNG HIỆU."
    ),
    # ─── TIỀM NĂNG ────────────────────────────────────────────────────
    # Phản ứng: khách dùng rồi → cảm ơn + gợi ý nâng cấp trải nghiệm
    "cham_soc": (
        "MỤC ĐÍCH: Khách đã dùng dịch vụ và có tiềm năng dùng thêm/nâng cấp. "
        "Email phải thể hiện sự trân trọng đã có, đồng thời gợi ý dịch vụ/phẩm chất khác phù hợp.\n\n"
        "GIỌNG VĂN: Ấm, trân trọng, chuyên nghiệp nhưng gần gũi. "
        "Đặt khách làm trung tâm — không bán hàng, mà đang giới thiệu bạn bè.\n\n"
        "CẤU TRÚC BẮT BUỘC (theo thứ tự):\n"
        "  1. MỞ ĐẦU: Gọi tên khách bằng biến {{HoVaTen}}, cảm ơn vì đã tin tưởng dịch vụ đã dùng.\n"
        "  2. BODY (PHẦN CHÍNH — viết dài, có chi tiết):\n"
        "     a. Nói cụ thể về dịch vụ/phẩm chất đã dùng tích cực — gọi tên dịch vụ rõ ràng.\n"
        "     b. Gợi ý dịch vụ/phẩm chất KHÁC mà khách chưa thử, phù hợp với ngành hình thương hiệu.\n"
        "     c. Chia sẻ điều đặc biệt về dịch vụ mới đó (thầy giỏi, công nghệ mới, không gian thoải mái…).\n"
        "  3. CTA NHẸ: Mời trải nghiệm dịch vụ mới, không kèm khuyến mãi.\n\n"
        "ĐỘ DÀI: 250–350 từ tiếng Việt. Viết đủ dài để email có thịt, không phải một đoạn ngắn.\n\n"
        "VÍ DỤ ĐÚNG: «Chị Linh à, em từ Trung tâm Anh ngữ gửi lời cảm ơn chị đã tin tưởng học IELTS với bọn em "
        "suốt mấy tháng qua. Chị từng học lớp Pre-IELTS, bọn em vừa mở thêm lớp IELTS Intensive với thầy từ Mỹ về, "
        "chị chắc sẽ thích. Hẹn chị cuối tuần nhé!»\n\n"
        "VÍ DỤ SAI: «Xin chào, cảm ơn đã sử dụng dịch vụ của chúng tôi.» (không cá nhân hóa)\n\n"
        "QUY TẮC: Cảm ơn bằng tên dịch vụ cụ thể đã dùng. Gợi ý dịch vụ phù hợp. "
        "Không xin lỗi, không thanh minh. Viết tự nhiên như tin nhắn từ cửa hàng.\n\n"
        "QUY TẮC CHỐNG BỊA (BẮT BUỘC TUÂN THỦ):\n"
        "✗ TUYỆT ĐỐI KHÔNG bịa tên dịch vụ, sản phẩm, thầy giáo, không gian, công nghệ không có trong HỒ SƠ THƯƠNG HIỆU.\n"
        "✗ TUYỆT ĐỐI KHÔNG viết về ngành hình khác (VD: brand là trung tâm Anh ngữ → KHÔNG viết massage, spa, nha khoa…).\n"
        "✗ TUYỆT ĐỐI KHÔNG viết chi tiết cụ thể nếu HỒ SƠ THƯƠNG HIỆU trống — hãy dùng câu chung mà không bịa.\n"
        "✓ Nếu brand description trống: viết chào hỏi ấm áp + nhắc tên thương hiệu + CTA, KHÔNG bịa chi tiết.\n"
        "✓ Chỉ dùng thông tin có trong HỒ SƠ THƯƠNG HIỆU."
    ),
    # ─── KÍCH HOẠT ────────────────────────────────────────────────────
    # Phản ứng: khách vắng bóng → tạo sự tò mò + háo hức quay lại
    "kích_hoạt": (
        "MỤC ĐÍCH: Khách đã rất lâu không quay lại (hoặc có dấu hiệu rời bỏ). "
        "Email phải tạo sự tò mò mạnh, khiến khách MUỐN quay lại ngay.\n\n"
        "GIỌNG VĂN: Hào hứng, niềm nở, như gặp lại người bạn cũ. "
        "Giọng tự hào về những gì đã thay đổi — KHÔNG tội nghiệp, KHÔNG van nài.\n\n"
        "CẤU TRÚC BẮT BUỘC (theo thứ tự):\n"
        "  1. MỞ ĐẦU: Gọi tên khách bằng biến {{HoVaTen}}, nói thẳng «lâu rồi không gặp».\n"
        "  2. BODY (PHẦN CHÍNH — viết dài, có chi tiết):\n"
        "     a. Chia sẻ 1-2 điều MỚI/THÚ VỊ đã có từ lần cuối khách đến (dịch vụ mới, thầy mới, không gian mới).\n"
        "     b. Mô tả cụ thể điều mới đó — thầy giỏi thế nào, chương trình học ra sao.\n"
        "     c. Tạo tò mò bằng thật, không bịa — khách phải CÓ LÝ DO thật sự để quay lại.\n"
        "  3. CTA HÀO HỨNG: Mời ghé thử ngay với lý do cụ thể.\n\n"
        "ĐỘ DÀI: 250–350 từ tiếng Việt. Viết đủ dài để email có thịt, không phải một đoạn ngắn.\n\n"
        "VÍ DỤ ĐÚNG: «Minh ơi, đã 3 tháng rồi không thấy mày! Bên mình là Trung tâm Anh ngữ, vừa nâng cấp toàn bộ "
        "không gian học, thêm phòng máy lạnh mới, và mình vừa có thầy từ Mỹ về. Mày phải đến thử. "
        "Cuối tuần này mình giữ chỗ cho mày nhé.»\n\n"
        "VÍ DỤ SAI: «Kính gửi quý khách hàng thân mến, chúng tôi luôn đồng hành cùng quý vị.» "
        "(không có tên, không có điều mới, không tạo tò mò)\n\n"
        "QUY TẮC: Phải nói rõ điều gì ĐÃ THAY ĐỔI (cụ thể). Không dùng «giảm giá», «voucher». "
        "Tạo tò mò bằng thật, không bịa. Tên thương hiệu phải xuất hiện tự nhiên.\n\n"
        "QUY TẮC CHỐNG BỊA (BẮT BUỘC TUÂN THỦ):\n"
        "✗ TUYỆT ĐỐI KHÔNG bịa tên dịch vụ, sản phẩm, thầy giáo, không gian, công nghệ không có trong HỒ SƠ THƯƠNG HIỆU.\n"
        "✗ TUYỆT ĐỐI KHÔNG viết về ngành hình khác (VD: brand là trung tâm Anh ngữ → KHÔNG viết massage, spa, nha khoa…).\n"
        "✗ TUYỆT ĐỐI KHÔNG viết chi tiết cụ thể nếu HỒ SƠ THƯƠNG HIỆU trống — hãy dùng câu chung mà không bịa.\n"
        "✓ Nếu brand description trống: viết chào hỏi ấm áp + nhắc tên thương hiệu + CTA, KHÔNG bịa chi tiết.\n"
        "✓ Chỉ dùng thông tin có trong HỒ SƠ THƯƠNG HIỆU."
    ),
    # ─── KHÁCH MỚI ────────────────────────────────────────────────────
    # Phản ứng: khách mới trải nghiệm → hướng dẫn + kết nối cảm xúc
    "khach_moi": (
        "MỤC ĐÍCH: Khách mới trải nghiệm lần đầu. Email phải củng cố cảm xúc tích cực, "
        "giúp khách cảm thấy đã chọn đúng chỗ, và khao khát quay lại sớm.\n\n"
        "GIỌNG VĂN: Nồng ấm, chân thành, tràn đầy năng lượng tích cực. "
        "Như lời cảm ơn từ người chủ cửa hàng tử tế — không phải email chào hàng.\n\n"
        "CẤU TRÚC BẮT BUỘC (theo thứ tự):\n"
        "  1. MỞ ĐẦU: Cảm ơn bằng tên khách ({{HoVaTen}}), nói rõ mình là thương hiệu nào, "
        "dịch vụ khách vừa dùng là gì.\n"
        "  2. BODY (PHẦN CHÍNH — viết dài, có chi tiết):\n"
        "     a. Nói về trải nghiệm tích cực cụ thể dựa trên dịch vụ đã dùng.\n"
        "     b. Gợi ý dịch vụ TIẾP THEO phù hợp — giải thích ngắn tại sao khách sẽ thích.\n"
        "     c. Chia sẻ điều đặc biệt của thương hiệu (thầy giỏi, phương pháp hay…).\n"
        "  3. CAM KẾT NHẸ: Đảm bảo chất lượng, mời gặp lại.\n\n"
        "ĐỘ DÀI: 250–350 từ tiếng Việt. Viết đủ dài để email có thịt, không phải một đoạn ngắn.\n\n"
        "VÍ DỤ ĐÚNG: «Anh Tuấn ơi, Trung tâm Anh ngữ cảm ơn anh đã thử lớp IELTS học thử bên mình! "
        "Anh hài lòng với buổi học không? Thầy của bọn em đang dạy rất nhiệt tình, bọn em có thêm "
        "tài liệu ôn tập mới mà anh có thể dùng miễn phí. Anh đừng ngại ghé lại nhé!»\n\n"
        "VÍ DỤ SAI: «Cảm ơn bạn đã mua hàng. Chúng tôi hy vọng bạn hài lòng với sản phẩm.» "
        "(không cá nhân hóa, không có CTA)\n\n"
        "QUY TẮC: Cảm ơn bằng tên dịch vụ cụ thể đã dùng. Gợi dịch vụ TIẾP THEO phù hợp. "
        "Không nói chung chung. Tên thương hiệu phải xuất hiện.\n\n"
        "QUY TẮC CHỐNG BỊA (BẮT BUỘC TUÂN THỦ):\n"
        "✗ TUYỆT ĐỐI KHÔNG bịa tên dịch vụ, sản phẩm, thầy giáo, không gian, công nghệ không có trong HỒ SƠ THƯƠNG HIỆU.\n"
        "✗ TUYỆT ĐỐI KHÔNG viết về ngành hình khác (VD: brand là trung tâm Anh ngữ → KHÔNG viết massage, spa, nha khoa…).\n"
        "✗ TUYỆT ĐỐI KHÔNG viết chi tiết cụ thể nếu HỒ SƠ THƯƠNG HIỆU trống — hãy dùng câu chung mà không bịa.\n"
        "✓ Nếu brand description trống: viết chào hỏi ấm áp + nhắc tên thương hiệu + CTA, KHÔNG bịa chi tiết.\n"
        "✓ Chỉ dùng thông tin có trong HỒ SƠ THƯƠNG HIỆU."
    ),
}


async def _compose_single_email(
    customer: dict,
    brand: Brand | None,
    purpose_instruction: str,
    purpose_key: str = "nhac_nhe",
    segment: str = "churn_risk",
) -> dict:
    """Soạn 1 email cho 1 khách, trả về dict có name/email/phone/subject/body."""
    name = (customer.get("name") or "").strip() or "khách"
    email_addr = (customer.get("email") or "").strip()
    phone = (customer.get("phone") or "").strip()
    variables: dict[str, str] = customer.get("variables") or {}

    # brand_context dạng string để đưa vào prompt
    brand_context: str | None = _format_brand_for_smart_contact(brand) if brand else None
    brand_name_for_prompt: str = brand.brand_name.strip() if brand else ""

    # Trích xuất thông tin liên hệ brand từ brand_context cho footer
    brand_contact_parts: list[str] = []
    if brand_context:
        for line in brand_context.splitlines():
            stripped = line.strip()
            low = stripped.lower()
            if any(
                low.startswith(p) for p in
                ("tên thương hiệu:", "email liên hệ:", "số điện thoại:",
                 "địa chỉ:", "website:", "fanpage:", "facebook:")
            ):
                brand_contact_parts.append(stripped)

    # Segment context — key = giá trị segment từ frontend (churn_risk / potential / new / vip)
    segment_context: dict[str, str] = {
        "churn_risk": (
            "📌 Nhóm khách: CÓ KHẢ NĂNG RỜI BỎ — đã lâu không quay lại.\n"
            "→ Phản ứng: gợi FOMO nhẹ + kỷ niệm tốt, tạo lý do thật sự để quay lại. "
            "Không van nài, không gây áp lực."
        ),
        "potential": (
            "📌 Nhóm khách: TIỀM NĂNG — dùng dịch vụ 2+ lần, chi tiêu tốt, chưa phải VIP.\n"
            "→ Phản ứng: thể hiện sự trân trọng, gợi dịch vụ khác phù hợp để nâng cấp trải nghiệm. "
            "Nhắc tên thương hiệu tự nhiên."
        ),
        "new": (
            "📌 Nhóm khách: KHÁCH MỚI — mới trải nghiệm lần đầu.\n"
            "→ Phản ứng: nồng ấm cảm ơn, củng cố cảm xúc tích cực, gợi dịch vụ tiếp theo phù hợp. "
            "Tạo cảm giác «đã chọn đúng chỗ»."
        ),
        "vip": (
            "📌 Nhóm khách: VIP — chi tiêu cao, quay lại nhiều lần.\n"
            "→ Phản ứng: trân trọng cao cấp, khiến khách cảm thấy đặc biệt, "
            "chia sẻ ưu đãi/cập nhật đặc biệt dành riêng VIP."
        ),
    }
    seg_context = segment_context.get(segment, segment_context["churn_risk"])

    # Build per-customer data context
    data_lines: list[str] = []

    # Lấy thông tin brand từ brand_context để đưa vào user prompt
    brand_name_for_prompt = ""
    brand_tagline_for_prompt = ""
    brand_products_for_prompt = ""
    if brand_context:
        for line in brand_context.splitlines():
            low = line.strip().lower()
            if low.startswith("tên thương hiệu:"):
                brand_name_for_prompt = line.strip().removeprefix("Tên thương hiệu:").removeprefix("tên thương hiệu:").strip()
            elif low.startswith("slogan"):
                brand_tagline_for_prompt = line.strip().removeprefix("Slogan / dòng phụ:").removeprefix("slogan / dòng phụ:").strip()
            elif low.startswith("dịch vụ / sản phẩm chính"):
                brand_products_for_prompt = line.strip().removeprefix("Dịch vụ / sản phẩm chính (tham khảo khi viết):").strip()

    # Chỉ thêm brand info khi có brand thật
    if brand_name_for_prompt:
        data_lines.append(f"→ VIẾT EMAIL TỪ THƯƠNG HIỆU: {brand_name_for_prompt}")
        if brand_tagline_for_prompt:
            data_lines.append(f"  Slogan: {brand_tagline_for_prompt}")
        if brand_products_for_prompt:
            data_lines.append(f"  Dịch vụ/sản phẩm chính: {brand_products_for_prompt}")
        data_lines.append("")  # blank line separator

    data_lines.append(f"- Khách: {name}")
    for k, v in variables.items():
        if k in ("name", "phone") or not v:
            continue
        k_label = {
            "HoVaTen": "Họ và tên",
            "LanCuoiChiTra": "Lần cuối chi trả",
            "DichVuLanCuoiSuDung": "Dịch vụ lần cuối",
            "DichVuSuDungNhieuNhat": "Dịch vụ dùng nhiều nhất",
            "TongSoLanQuayLai": "Số lần quay lại",
            "days_since_last": "Số ngày chưa quay lại",
        }.get(k, k)
        data_lines.append(f"  - {k_label}: {v}")
    recipients_data = "\n".join(data_lines)

    # Build user prompt
    # brand_rules chỉ thêm khi có brand
    brand_rules = ""
    brand_intro_for_body = ""
    if brand_name_for_prompt:
        brand_rules = (
            "\nQUY TẮC VIẾT BẮT BUỘC:\n"
            f"1. NHẮC TÊN THƯƠNG HIỆU «{brand_name_for_prompt}» trong 2-3 chỗ trong nội dung email — "
            f"ví dụ: «bên {brand_name_for_prompt}», «{brand_name_for_prompt} luôn chào đón bạn», "
            f"«cửa hàng {brand_name_for_prompt}».\n"
            "2. Nhắc dịch vụ/sản phẩm đặc trưng của thương hiệu (nếu có), KHÔNG bịa tên.\n"
            "3. Viết như chính chủ cửa hàng viết tay — không chung chung, có cảm xúc thật.\n"
            "4. Email gửi cho 1 khách hàng cụ thể — cá nhân hóa bằng tên khách và thông tin khách.\n"
            "5. KHÔNG dùng cụm chung chung như «bên mình», «chúng tôi», «cửa hàng của tôi» — "
            f"PHẢI thay bằng tên thương hiệu «{brand_name_for_prompt}».\n"
            "6. KHÔNG thêm placeholder signature như [Your Name], [Shop Name].\n"
        )
        brand_intro_for_body = (
            f"Bạn đang viết email chăm sóc khách cho thương hiệu: **{brand_name_for_prompt}**.\n"
            "Nội dung email PHẢI nhắc tên thương hiệu này tự nhiên trong các câu.\n\n"
        )
    user_prompt = (
        f"{brand_intro_for_body}"
        f"{purpose_instruction}\n\n"
        f"{seg_context}\n\n"
        f"Thông tin khách hàng:\n{recipients_data}\n"
        f"{brand_rules}"
    )

    payload = SmartContactComposePayload(
        user_prompt=user_prompt,
        mode="email",
        recipients_data_context=recipients_data,
        brand_id=None,
    )

    body = await _smart_contact_compose_text(
        payload,
        brand_context=brand_context,
        brand_name_for_prompt=brand_name_for_prompt,
    )

    # Generate subject line based on segment and purpose
    purpose_subject = {
        "nhac_nhe": [
            "Những kỷ niệm đẹp đang chờ bạn quay lại",
            "Đã lâu rồi bạn ơi, ghé thăm nhé",
            "Bạn ơi, chúng tôi nhớ bạn rồi!",
            "Có ai nhắn bạn gần đây không?",
            "Chúng tôi chờ bạn thôi!",
        ],
        "cham_soc": [
            "Cảm ơn bạn đã đồng hành cùng chúng tôi",
            "Hôm nay bạn thế nào?",
            "Chúng tôi luôn ở đây vì bạn",
            "Bạn ơi, khoe chút đi!",
        ],
        "kích_hoạt": [
            "Đã có gì mới ở nơi của bạn, bạn biết không?",
            "Bạn ơi, chúng tôi có điều muốn chia sẻ",
            "Lâu rồi không gặp, có nhiều thứ hay ho lắm!",
            "Bạn ơi, có người đang chờ bạn đấy!",
        ],
        "khach_moi": [
            "Chào mừng bạn đến với gia đình của chúng tôi",
            "Cảm ơn bạn đã tin tưởng",
            "Chúng tôi rất vui được gặp bạn!",
            "Chào bạn mới, rất vui được làm quen!",
        ],
    }.get(purpose_key, ["Tin nhắn từ chúng tôi"])

    import random
    subject = random.choice(purpose_subject)

    # Replace placeholders in body with actual values
    _PLACEHOLDER_MAP = {
        "{{HoVaTen}}": variables.get("HoVaTen") or variables.get("name") or name,
        "{{name}}": variables.get("name") or variables.get("HoVaTen") or name,
        "{{phone}}": variables.get("phone") or "",
        "{{LanCuoiChiTra}}": variables.get("LanCuoiChiTra") or "",
        "{{days_since_last}}": variables.get("days_since_last") or "",
        "{{DichVuLanCuoiSuDung}}": variables.get("DichVuLanCuoiSuDung") or "",
        "{{DichVuSuDungNhieuNhat}}": variables.get("DichVuSuDungNhieuNhat") or "",
        "{{TongSoLanQuayLai}}": variables.get("TongSoLanQuayLai") or "",
        "[Your Name]": "",
        "[Tên của bạn]": "",
        "[Your name]": "",
        "[Name]": "",
        "[Shop Name]": brand_name_for_prompt,
        "[Tên cửa hàng]": brand_name_for_prompt,
        # Thay thế tên brand nếu LLM ghi sai
        brand_name_for_prompt: brand_name_for_prompt,
    }
    rendered_body = body
    for placeholder, value in _PLACEHOLDER_MAP.items():
        if value:
            rendered_body = rendered_body.replace(placeholder, str(value))
    # Xóa các placeholder signature còn trống
    for ph in ["[Your Name]", "[Tên của bạn]", "[Your name]", "[Name]"]:
        rendered_body = rendered_body.replace(ph, "")

    # Gắn thông tin liên hệ brand vào cuối email
    if brand_contact_parts:
        contact_block = "\n\n" + "\n".join(brand_contact_parts)
        rendered_body += contact_block

    return {
        "name": name,
        "email": email_addr,
        "phone": phone,
        "subject": subject,
        "body": rendered_body,
    }


@router.post("/customer-lists/{customer_list_id}/smart-contact-batch")
async def smart_contact_batch(
    customer_list_id: uuid.UUID,
    payload: SmartContactBatchPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    list_result = await db.execute(
        select(CustomerList).where(
            CustomerList.id == customer_list_id,
            CustomerList.user_id == current_user.id,
        )
    )
    customer_list = list_result.scalar_one_or_none()
    if not customer_list:
        raise HTTPException(404, "Customer list không tồn tại")

    if not payload.customers:
        raise HTTPException(400, "Danh sách khách trống.")

    valid_segments = {"churn_risk", "potential", "new", "vip"}
    seg = (payload.segment or "churn_risk").strip().lower()
    if seg not in valid_segments:
        raise HTTPException(400, f"Segment không hợp lệ. Chọn: {', '.join(valid_segments)}.")

    # Lọc đúng segment
    filtered = [c for c in payload.customers if (c.get("segment") or "").strip().lower() == seg]
    if not filtered:
        raise HTTPException(400, f"Không có khách nào thuộc segment '{seg}' trong danh sách đã gửi.")

    if len(filtered) > 200:
        raise HTTPException(400, "Tối đa 200 khách mỗi lần soạn.")

    # Resolve brand — lưu cả Brand row để truyền vào _compose_single_email
    brand_row: Brand | None = None
    if payload.brand_id:
        br_one = await db.execute(
            select(Brand).where(Brand.id == payload.brand_id, Brand.user_id == current_user.id)
        )
        brand_row = br_one.scalar_one_or_none()
    else:
        br_latest = await db.execute(
            select(Brand)
            .where(Brand.user_id == current_user.id)
            .order_by(Brand.updated_at.desc())
            .limit(1)
        )
        brand_row = br_latest.scalar_one_or_none()
    brand_context: str | None = _format_brand_for_smart_contact(brand_row) if brand_row else None

    purpose_key = (payload.purpose or "nhac_nhe").strip().lower()
    if purpose_key not in OUTREACH_PURPOSE_INSTRUCTION:
        purpose_key = "nhac_nhe"
    purpose_instruction = OUTREACH_PURPOSE_INSTRUCTION[purpose_key]

    # Compose song song cho tất cả khách
    async def safe_compose(c: dict):
        try:
            return await _compose_single_email(
                c, brand_row,
                purpose_instruction,
                purpose_key=purpose_key, segment=seg
            )
        except Exception as exc:
            return {
                "name": (c.get("name") or "?").strip() or "?",
                "email": (c.get("email") or "").strip(),
                "phone": (c.get("phone") or "").strip(),
                "subject": "Lỗi soạn",
                "body": f"Lỗi: {str(exc)[:200]}",
            }

    results = await asyncio.gather(*[safe_compose(c) for c in filtered])
    return {"results": list(results)}


# ---------------------------------------------------------------------------
# Smart Contact Batch Send — gửi email từ danh sách đã soạn
# ---------------------------------------------------------------------------


class BatchSendItem(BaseModel):
    name: str = ""
    email: str | None = None
    phone: str | None = None
    subject: str = ""
    body: str = ""


class SmartContactBatchSendPayload(BaseModel):
    brand_id: uuid.UUID | None = None
    items: list[BatchSendItem]


@router.post("/customer-lists/{customer_list_id}/smart-contact-batch-send")
async def smart_contact_batch_send(
    customer_list_id: uuid.UUID,
    payload: SmartContactBatchSendPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    list_result = await db.execute(
        select(CustomerList).where(
            CustomerList.id == customer_list_id,
            CustomerList.user_id == current_user.id,
        )
    )
    if not list_result.scalar_one_or_none():
        raise HTTPException(404, "Customer list không tồn tại")

    items = payload.items or []
    if not items:
        raise HTTPException(400, "Danh sách gửi trống.")
    if len(items) > 200:
        raise HTTPException(400, "Tối đa 200 người nhận mỗi lần gửi.")

    if not settings.SMTP_HOST or not settings.SMTP_USER:
        raise HTTPException(
            503,
            "Chưa cấu hình SMTP (SMTP_HOST, SMTP_USER trong .env).",
        )
    from services.campaign_delivery_service import send_smtp_sync

    # Lấy brand info để hiển thị tên trong email
    brand_name = None
    brand_reply_to = None
    if payload.brand_id:
        brand_result = await db.execute(
            select(Brand).where(Brand.id == payload.brand_id, Brand.user_id == current_user.id)
        )
        brand = brand_result.scalar_one_or_none()
        if brand:
            brand_name = brand.brand_name
            brand_reply_to = brand.contact_email

    results: list[dict[str, str | None]] = []

    for item in items:
        email_addr = (item.email or "").strip()
        name = (item.name or "").strip() or "bạn"
        if not email_addr:
            results.append({"to": name, "status": "skipped", "detail": "Thiếu email"})
            continue

        # Render template variables
        r = QuickOutreachRecipient(
            name=name,
            email=email_addr,
            phone=(item.phone or "").strip(),
            variables={},
        )
        rendered_subject = _render_smart_contact_template(item.subject or "Thông báo", r)
        rendered_body = _render_smart_contact_template(item.body or "", r)

        safe_html = html.escape(rendered_body).replace("\n", "<br>\n")
        html_body = f"<!DOCTYPE html><html><body><div>{safe_html}</div></body></html>"
        try:
            await asyncio.to_thread(
                send_smtp_sync,
                email_addr,
                rendered_subject,
                rendered_body,
                html_body,
                from_name=brand_name,
                from_addr=brand.contact_email if brand else None,
                reply_to=brand_reply_to,
            )
            results.append({"to": email_addr, "status": "sent", "detail": None})
        except Exception as exc:
            results.append({"to": email_addr, "status": "failed", "detail": str(exc)[:300]})

    return {"results": results}
