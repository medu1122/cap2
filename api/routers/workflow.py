import asyncio
import csv
import io
import json
import os
import uuid
import re
import unicodedata
from datetime import date, datetime, timedelta, timezone

from croniter import croniter
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile
from openai import AsyncOpenAI
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import AsyncSessionLocal, get_db
from core.deps import get_current_user
from models.brand import Brand
from models.campaign import Campaign
from models.customer import Customer
from models.customer_list import CustomerList
from models.file_upload import FileUpload
from models.user import User
from models.workflow_job import WorkflowJob
from models.workflow_schedule import WorkflowSchedule
from services.agent_dispatcher import dispatch_campaign

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
    - inactive: days_since_last_purchase >= 60
    - vip: total_spend >= 10_000_000 hoac order_count >= 10
    - potential: con lai va co du lieu co ban
    """
    extra = extra_fields or {}
    days_since_last_purchase = _to_int_or_none(extra.get("days_since_last_purchase"))
    total_spend = _to_float_or_none(extra.get("total_spend"))
    order_count = _to_int_or_none(extra.get("order_count"))

    if days_since_last_purchase is not None and days_since_last_purchase >= 60:
        return "inactive"
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
        if email:
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
        if email:
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
        segment_counts = {"vip": 0, "potential": 0, "inactive": 0, "unknown": 0}
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
        if normalized_segment not in {"vip", "potential", "inactive", "unknown"}:
            raise HTTPException(400, f"Segment không hợp lệ: {segment}")
        payload = [item for item in payload if item["segment"] == normalized_segment]
    return payload[offset : offset + limit]
