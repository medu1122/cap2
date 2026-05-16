import uuid
import os
import asyncio
import json
import io
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from openai import AsyncOpenAI
import httpx
try:
    import cloudinary
    import cloudinary.uploader
except Exception:  # pragma: no cover - optional dependency
    cloudinary = None
from core.config import settings
from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.brand import Brand
from models.campaign import Campaign
from models.content_item import ContentItem
from models.agent_run_log import AgentRunLog
from models.customer_list import CustomerList
from models.campaign_execution_log import CampaignExecutionLog
from models.campaign_revenue import CampaignRevenue
from models.campaign_tracking_link import CampaignTrackingLink
from schemas.campaign import (
    CampaignCreate,
    CampaignListItem,
    CampaignDetail,
    ContentItemOut,
    ContentItemCreate,
    AgentLogOut,
    VALID_CHANNELS,
    CampaignExecuteRequest,
    DeliverySummaryResponse,
    DeliveryMetricsOut,
    ExecutionLogOut,
)
from schemas.campaign_revenue import (
    CampaignRevenueCreate,
    CampaignRevenueUpdate,
    CampaignRevenueOut,
    CampaignPerformanceMetrics,
    CampaignPerformanceResponse,
    ChannelMetrics,
)
from services.agent_dispatcher import dispatch_campaign
from services.campaign_delivery_service import (
    merge_campaign_delivery,
    run_email_delivery,
    run_sms_simulation,
)
from services.image_prompt_generator import (
    generate_image_prompt,
    build_context_from_campaign,
)

router = APIRouter()

# Image storage paths — images saved locally and served via /static
_STATIC_DIR = os.getenv("STATIC_DIR", os.path.join(os.path.dirname(__file__), "..", "static"))
_UPLOAD_DIR = os.path.join(_STATIC_DIR, "uploads")
_STATIC_BASE_URL = os.getenv("STATIC_BASE_URL", "http://localhost:8000/static/uploads")
_CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
_CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
_CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
_CLOUDINARY_FOLDER = os.getenv("CLOUDINARY_FOLDER", "aimap/campaigns")

_CLOUDINARY_ENABLED = bool(
    cloudinary
    and _CLOUDINARY_CLOUD_NAME
    and _CLOUDINARY_API_KEY
    and _CLOUDINARY_API_SECRET
)

if _CLOUDINARY_ENABLED:
    cloudinary.config(
        cloud_name=_CLOUDINARY_CLOUD_NAME,
        api_key=_CLOUDINARY_API_KEY,
        api_secret=_CLOUDINARY_API_SECRET,
        secure=True,
    )

_qwen = AsyncOpenAI(
    base_url=os.getenv("QWEN_BASE_URL", "http://171.238.156.10:11434/v1"),
    api_key="ollama",
)
_openai = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
QWEN_MODEL   = os.getenv("QWEN_MODEL", "qwen2.5:14b")
QWEN_TIMEOUT = int(os.getenv("QWEN_TIMEOUT", "180"))


class SuggestRequest(BaseModel):
    campaign_name: str


@router.post("/ai-suggest")
async def ai_suggest_campaign(
    payload: SuggestRequest,
    current_user: User = Depends(get_current_user),
):
    if not payload.campaign_name.strip():
        raise HTTPException(400, "Tên chiến dịch không được để trống")

    prompt = f"""Bạn là chuyên gia marketing cho doanh nghiệp nhỏ Việt Nam.
Dựa vào tên chiến dịch sau, hãy đề xuất thông tin chi tiết cho bản kế hoạch chiến dịch.

Tên chiến dịch: "{payload.campaign_name.strip()}"

Trả về JSON hợp lệ với đúng các trường sau (tiếng Việt):
{{
  "objective": "Mục tiêu chiến dịch, 1-2 câu ngắn gọn",
  "product_or_service": "Sản phẩm hoặc dịch vụ chính của chiến dịch",
  "target_audience": "Đối tượng khách hàng mục tiêu, mô tả cụ thể",
  "offer_or_hook": "Ưu đãi hoặc điểm thu hút chính để kéo khách hàng",
  "additional_notes": "Gợi ý thêm về góc độ truyền thông hoặc thông điệp nổi bật"
}}

Chỉ trả về JSON, không thêm bất kỳ nội dung nào khác."""

    messages = [{"role": "user", "content": prompt}]

    async def _call_qwen() -> dict:
        resp = await asyncio.wait_for(
            _qwen.chat.completions.create(
                model=QWEN_MODEL,
                messages=messages,
                temperature=0.7,
            ),
            timeout=QWEN_TIMEOUT,
        )
        raw = resp.choices[0].message.content.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        return json.loads(raw)

    async def _call_openai() -> dict:
        resp = await _openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
            response_format={"type": "json_object"},
        )
        return json.loads(resp.choices[0].message.content)

    try:
        data = await _call_qwen()
    except Exception:
        try:
            data = await _call_openai()
        except Exception:
            raise HTTPException(503, "Không thể kết nối AI. Vui lòng thử lại.")

    return data


@router.get("", response_model=list[CampaignListItem])
async def list_campaigns(
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Campaign).where(Campaign.user_id == current_user.id).order_by(Campaign.created_at.desc())
    if status:
        query = query.where(Campaign.status == status)
    result = await db.execute(query)
    campaigns = result.scalars().all()

    items = []
    for c in campaigns:
        content_result = await db.execute(
            select(func.count()).where(ContentItem.campaign_id == c.id)
        )
        pending_result = await db.execute(
            select(func.count()).where(ContentItem.campaign_id == c.id, ContentItem.status == "pending_approval")
        )
        item = CampaignListItem.model_validate(c)
        item.content_count = content_result.scalar() or 0
        item.pending_count = pending_result.scalar() or 0
        source_context = (c.campaign_plan_json or {}).get("source_context") if isinstance(c.campaign_plan_json, dict) else None
        if isinstance(source_context, dict):
            source_run = source_context.get("source_insight_run_id")
            source_segment = source_context.get("source_customer_segment")
            item.source_insight_run_id = str(source_run) if source_run else None
            item.source_customer_segment = str(source_segment) if source_segment else None
        items.append(item)
    return items


@router.post("", status_code=201)
async def create_campaign(
    payload: CampaignCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    brand_result = await db.execute(
        select(Brand).where(Brand.id == payload.brand_id, Brand.user_id == current_user.id)
    )
    brand = brand_result.scalar_one_or_none()
    if not brand:
        raise HTTPException(400, "Thương hiệu không hợp lệ hoặc không thuộc tài khoản hiện tại")

    if not payload.channels:
        raise HTTPException(400, "Phải chọn ít nhất 1 kênh nội dung")
    invalid = [c for c in payload.channels if c not in VALID_CHANNELS]
    if invalid:
        raise HTTPException(400, f"Kênh không hợp lệ: {invalid}")
    if payload.deadline < date.today():
        raise HTTPException(400, "Ngày kết thúc không được là ngày trong quá khứ")

    payload_data = payload.model_dump()
    source_insight_run_id = payload_data.pop("source_insight_run_id", None)
    source_customer_segment = payload_data.pop("source_customer_segment", None)

    source_context: dict[str, str] = {}
    if source_insight_run_id:
        source_context["source_insight_run_id"] = str(source_insight_run_id)
    if source_customer_segment:
        source_context["source_customer_segment"] = source_customer_segment

    campaign_plan_json: dict = {}
    if source_context:
        campaign_plan_json["source_context"] = source_context

    # Set initial status to pending_approval (chưa duyệt)
    payload_data["status"] = "pending_approval"

    campaign = Campaign(
        user_id=current_user.id,
        **payload_data,
        campaign_plan_json=campaign_plan_json or None,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return {"id": str(campaign.id), "campaign_name": campaign.campaign_name, "status": campaign.status, "created_at": campaign.created_at}


@router.post("/{campaign_id}/content-items", status_code=201)
async def create_campaign_content_item(
    campaign_id: uuid.UUID,
    payload: ContentItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Tạo content item mới cho campaign."""
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Campaign not found")

    item = ContentItem(
        campaign_id=campaign_id,
        channel=payload.channel,
        content_json=payload.content_json,
        status=payload.status,
        scheduled_date=payload.scheduled_date,
        version=1,
        source="ai_generated",
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return {"id": str(item.id), "channel": item.channel, "status": item.status}


@router.get("/{campaign_id}", response_model=CampaignDetail)
async def get_campaign(
    campaign_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    content_result = await db.execute(
        select(ContentItem)
        .where(ContentItem.campaign_id == campaign_id)
        .order_by(ContentItem.channel, ContentItem.version.desc())
    )
    raw_content = content_result.scalars().all()
    seen_channels = set()
    content_items = []
    for ci in raw_content:
        if ci.channel not in seen_channels:
            seen_channels.add(ci.channel)
            content_items.append(ContentItemOut.model_validate(ci))

    log_result = await db.execute(
        select(AgentRunLog).where(AgentRunLog.campaign_id == campaign_id).order_by(AgentRunLog.step_order)
    )
    agent_logs = [AgentLogOut.model_validate(log) for log in log_result.scalars().all()]
    agent_logs = [AgentLogOut.model_validate(log) for log in log_result.scalars().all()]

    detail = CampaignDetail.model_validate({
        "id": campaign.id,
        "brand_id": campaign.brand_id,
        "customer_list_id": campaign.customer_list_id,
        "campaign_name": campaign.campaign_name,
        "objective": campaign.objective,
        "product_or_service": campaign.product_or_service,
        "target_audience": campaign.target_audience,
        "offer_or_hook": campaign.offer_or_hook,
        "start_date": campaign.start_date,
        "deadline": campaign.deadline,
        "channels": campaign.channels,
        "additional_notes": campaign.additional_notes,
        "status": campaign.status,
        "error_message": campaign.error_message,
        "campaign_plan_json": campaign.campaign_plan_json,
        "created_at": campaign.created_at,
        "content_items": content_items,
        "agent_logs": agent_logs,
    })
    return detail


class UpdateCustomerListPayload(BaseModel):
    customer_list_id: uuid.UUID


@router.patch("/{campaign_id}/customer-list", response_model=CampaignDetail)
async def update_campaign_customer_list(
    campaign_id: uuid.UUID,
    body: UpdateCustomerListPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật danh sách khách hàng gắn với chiến dịch."""
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Không tìm thấy chiến dịch")

    # Verify customer list belongs to user
    list_r = await db.execute(
        select(CustomerList).where(
            CustomerList.id == body.customer_list_id,
            CustomerList.user_id == current_user.id,
        )
    )
    if not list_r.scalar_one_or_none():
        raise HTTPException(400, "Danhh sách khách không hợp lệ")

    campaign.customer_list_id = body.customer_list_id
    await db.commit()

    # Return full campaign detail
    content_result = await db.execute(
        select(ContentItem).where(ContentItem.campaign_id == campaign_id).order_by(ContentItem.channel, ContentItem.version.desc())
    )
    log_result = await db.execute(
        select(AgentRunLog).where(AgentRunLog.campaign_id == campaign_id).order_by(AgentRunLog.step_order)
    )
    content_items = [ContentItemOut.model_validate(ci) for ci in content_result.scalars().all()]
    agent_logs = [AgentLogOut.model_validate(log) for log in log_result.scalars().all()]

    return CampaignDetail.model_validate({
        "id": campaign.id,
        "brand_id": campaign.brand_id,
        "customer_list_id": campaign.customer_list_id,
        "campaign_name": campaign.campaign_name,
        "objective": campaign.objective,
        "product_or_service": campaign.product_or_service,
        "target_audience": campaign.target_audience,
        "offer_or_hook": campaign.offer_or_hook,
        "start_date": campaign.start_date,
        "deadline": campaign.deadline,
        "channels": campaign.channels,
        "additional_notes": campaign.additional_notes,
        "status": campaign.status,
        "error_message": campaign.error_message,
        "campaign_plan_json": campaign.campaign_plan_json,
        "created_at": campaign.created_at,
        "content_items": content_items,
        "agent_logs": agent_logs,
    })


@router.post("/{campaign_id}/execute", status_code=202)
async def execute_campaign_delivery(
    campaign_id: uuid.UUID,
    body: CampaignExecuteRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Chạy gửi: email thật (SMTP) hoặc SMS mô phỏng. Tracking: GET /campaigns/{id}/delivery-summary."""
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Không tìm thấy chiến dịch")

    delivery = (campaign.campaign_plan_json or {}).get("delivery") or {}
    if delivery.get("status") == "sending":
        raise HTTPException(409, "Đang gửi, vui lòng chờ hoàn tất.")

    # Validate all customer lists exist and belong to user
    if not body.customer_list_ids:
        raise HTTPException(400, "Phải chọn ít nhất 1 danh sách khách hàng.")
    for list_id in body.customer_list_ids:
        list_r = await db.execute(
            select(CustomerList).where(
                CustomerList.id == list_id,
                CustomerList.user_id == current_user.id,
            )
        )
        if not list_r.scalar_one_or_none():
            raise HTTPException(400, f"Danh sách không hợp lệ: {list_id}")

    if body.mode == "email":
        if "email" not in (campaign.channels or []):
            raise HTTPException(400, "Chiến dịch chưa có kênh Email.")
        if not settings.SMTP_HOST or not settings.SMTP_USER:
            raise HTTPException(
                503,
                "Chưa cấu hình SMTP. Điền SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL trong .env.",
            )

    batch_ids: list[str] = []
    for list_id in body.customer_list_ids:
        batch_id = uuid.uuid4()
        batch_ids.append(str(batch_id))
        now = datetime.now(timezone.utc).isoformat()
        await merge_campaign_delivery(
            db,
            campaign,
            {
                "status": "sending",
                "mode": body.mode,
                "customer_list_id": str(list_id),
                "last_batch_id": str(batch_id),
                "started_at": now,
                "last_error": None,
            },
        )

        if body.mode == "email":
            background_tasks.add_task(
                run_email_delivery,
                campaign_id,
                list_id,
                current_user.id,
                batch_id,
                body.ab_test,
            )
        else:
            hint = (
                (campaign.offer_or_hook or "")
                or (campaign.objective or "")
                or (campaign.campaign_name or "")
            )[:200]
            background_tasks.add_task(
                run_sms_simulation,
                campaign_id,
                list_id,
                current_user.id,
                batch_id,
                hint,
            )

    return {
        "message": "Đã bắt đầu gửi",
        "campaign_id": str(campaign_id),
        "batch_ids": batch_ids,
        "status": "sending",
    }


class SendEmailRequest(BaseModel):
    to: str
    subject: str
    body: str


@router.post("/{campaign_id}/send-email", status_code=202)
async def send_single_email(
    campaign_id: uuid.UUID,
    body: SendEmailRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Gửi một email trực tiếp cho khách hàng (dùng brand_name làm sender)."""
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Không tìm thấy chiến dịch")

    brand_name = None
    brand_reply_to = None
    if campaign.brand_id:
        brand_r = await db.execute(select(Brand).where(Brand.id == campaign.brand_id))
        brand = brand_r.scalar_one_or_none()
        if brand:
            brand_name = brand.brand_name
            brand_reply_to = brand.contact_email

    import secrets
    from services.campaign_delivery_service import send_smtp_sync, build_email_html, tracking_urls

    if not settings.SMTP_HOST or not settings.SMTP_USER:
        raise HTTPException(503, "Chưa cấu hình SMTP.")

    # Generate tracking token
    token = secrets.token_urlsafe(24)
    from services.campaign_delivery_service import tracking_urls
    open_u, click_u = tracking_urls(token, None)
    text_part, html_part = build_email_html(body.body, open_u, click_u, None, "Xem chi tiết")

    await asyncio.to_thread(
        send_smtp_sync,
        body.to,
        body.subject,
        text_part,
        html_part,
        from_name=brand_name,
        from_addr=brand_reply_to,
        reply_to=brand_reply_to,
    )

    return {"status": "sent", "to": body.to}


@router.get("/{campaign_id}/delivery-summary", response_model=DeliverySummaryResponse)
async def get_campaign_delivery_summary(
    campaign_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Không tìm thấy chiến dịch")

    batch_sub = await db.execute(
        select(CampaignExecutionLog.batch_id)
        .where(CampaignExecutionLog.campaign_id == campaign_id)
        .order_by(CampaignExecutionLog.created_at.desc())
        .limit(1)
    )
    latest_batch_id = batch_sub.scalar_one_or_none()
    plan = campaign.campaign_plan_json if isinstance(campaign.campaign_plan_json, dict) else {}
    delivery_info = plan.get("delivery") if isinstance(plan.get("delivery"), dict) else None

    if not latest_batch_id:
        return DeliverySummaryResponse(
            delivery=delivery_info,
            metrics=DeliveryMetricsOut(
                total=0,
                sent=0,
                failed=0,
                skipped=0,
                opened=0,
                clicked=0,
                open_rate=0.0,
                click_rate=0.0,
                ab_summary=None,
            ),
            logs=[],
            latest_batch_id=None,
        )

    log_result = await db.execute(
        select(CampaignExecutionLog)
        .where(
            CampaignExecutionLog.campaign_id == campaign_id,
            CampaignExecutionLog.batch_id == latest_batch_id,
        )
        .order_by(CampaignExecutionLog.created_at.asc())
    )
    rows = list(log_result.scalars().all())
    logs_out = [ExecutionLogOut.model_validate(r) for r in rows]

    total = len(rows)
    sent = sum(1 for r in rows if r.status == "sent")
    failed = sum(1 for r in rows if r.status == "failed")
    skipped = sum(
        1 for r in rows if r.status in ("skipped_no_email", "skipped_no_phone")
    )
    opened = sum(1 for r in rows if r.opened_at is not None)
    clicked = sum(1 for r in rows if r.clicked_at is not None)
    email_sent = sum(1 for r in rows if r.channel == "email" and r.status == "sent")
    open_rate = round((opened / email_sent) * 100, 1) if email_sent else 0.0
    click_rate = round((clicked / email_sent) * 100, 1) if email_sent else 0.0

    ab_summary = None
    ab_rows = [r for r in rows if r.ab_variant and r.channel == "email"]
    if ab_rows:
        ab_summary = {}
        for v in ("A", "B"):
            sub = [r for r in ab_rows if r.ab_variant == v]
            if not sub:
                continue
            es = sum(1 for x in sub if x.status == "sent")
            ab_summary[v] = {
                "sent": es,
                "opened": sum(1 for x in sub if x.opened_at),
                "clicked": sum(1 for x in sub if x.clicked_at),
                "open_rate_pct": round((sum(1 for x in sub if x.opened_at) / es) * 100, 1)
                if es
                else 0.0,
                "click_rate_pct": round((sum(1 for x in sub if x.clicked_at) / es) * 100, 1)
                if es
                else 0.0,
            }

    return DeliverySummaryResponse(
        delivery=delivery_info,
        metrics=DeliveryMetricsOut(
            total=total,
            sent=sent,
            failed=failed,
            skipped=skipped,
            opened=opened,
            clicked=clicked,
            open_rate=open_rate,
            click_rate=click_rate,
            ab_summary=ab_summary,
        ),
        logs=logs_out,
        latest_batch_id=str(latest_batch_id),
    )


@router.post("/{campaign_id}/run", status_code=202)
async def run_campaign(
    campaign_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status == "running":
        raise HTTPException(status_code=409, detail="Campaign is already running")

    if campaign.brand_id:
        brand_result = await db.execute(
            select(Brand).where(Brand.id == campaign.brand_id, Brand.user_id == current_user.id)
        )
    else:
        # Compatibility for old campaigns created before brand_id was introduced.
        brand_result = await db.execute(
            select(Brand)
            .where(Brand.user_id == current_user.id)
            .order_by(Brand.updated_at.desc())
            .limit(1)
        )
    brand = brand_result.scalar_one_or_none()
    if not brand:
        raise HTTPException(status_code=400, detail="Brand Vault not configured. Please set up your brand first.")

    campaign.status = "running"
    await db.commit()

    background_tasks.add_task(dispatch_campaign, str(campaign_id))
    return {"message": "Orchestration started", "campaign_id": str(campaign_id), "status": "running"}


@router.delete("/{campaign_id}", status_code=204)
async def delete_campaign(
    campaign_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Xóa các bản ghi liên quan trước
    from models.workflow_job import WorkflowJob

    # Xóa workflow_jobs liên quan
    wf_result = await db.execute(
        select(WorkflowJob).where(WorkflowJob.campaign_id == campaign_id)
    )
    for wf in wf_result.scalars().all():
        await db.delete(wf)

    # Xóa campaign (cascade sẽ xóa content_items, agent_run_logs, campaign_execution_logs)
    await db.delete(campaign)
    await db.commit()


class ScheduleAutoRequest(BaseModel):
    enabled: bool


@router.post("/{campaign_id}/schedule-auto")
async def toggle_auto_schedule(
    campaign_id: uuid.UUID,
    body: ScheduleAutoRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    plan = dict(campaign.campaign_plan_json or {})
    plan["auto_schedule_enabled"] = body.enabled
    campaign.campaign_plan_json = plan
    await db.commit()

    return {"message": "Auto schedule updated", "enabled": body.enabled}


# ── Image helpers ──────────────────────────────────────────────────────────────

async def _save_campaign_image_url(campaign: Campaign, url: str, db: AsyncSession) -> None:
    """Persist image_url into campaign_plan_json without losing existing keys."""
    current = dict(campaign.campaign_plan_json or {})
    current["image_url"] = url
    campaign.campaign_plan_json = current
    await db.commit()


async def _upload_to_cloudinary(content: bytes, public_id: str, filename: str) -> str:
    if not _CLOUDINARY_ENABLED:
        raise RuntimeError("Cloudinary is not configured")

    def _do_upload() -> dict:
        file_obj = io.BytesIO(content)
        file_obj.name = filename
        return cloudinary.uploader.upload(  # type: ignore[union-attr]
            file_obj,
            folder=_CLOUDINARY_FOLDER,
            public_id=public_id,
            overwrite=True,
            resource_type="image",
        )

    result = await asyncio.to_thread(_do_upload)
    secure_url = result.get("secure_url") or result.get("url")
    if not secure_url:
        raise RuntimeError("Cloudinary upload did not return URL")
    return str(secure_url)


async def _save_local_image(campaign_id: uuid.UUID, content: bytes, extension: str) -> str:
    os.makedirs(_UPLOAD_DIR, exist_ok=True)
    filename = f"{campaign_id}_{int(datetime.now().timestamp())}.{extension}"
    filepath = os.path.join(_UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(content)
    return f"{_STATIC_BASE_URL}/{filename}"


class GenerateImagePayload(BaseModel):
    prompt: str | None = None


def _fallback_dalle_prompt(
    campaign: Campaign,
    plan: dict,
    brand_contact: dict | None = None,
) -> str:
    """Khi chưa có image_prompt từ agent — tránh prompt chung chung, hướng ảnh thật / poster key visual cho ads VN."""
    channels = ", ".join(campaign.channels or [])
    audience = (campaign.target_audience or "").strip()
    offer = (campaign.offer_or_hook or "").strip()
    notes = (campaign.additional_notes or "").strip()
    vd = (plan.get("visual_direction") or "").strip()
    summary = (plan.get("campaign_summary") or "").strip()
    parts = [
        "Photorealistic campaign key visual / poster-style photograph for Vietnamese SME social marketing, "
        "not illustration, not 3D render, not anime.",
        f"Campaign: {campaign.campaign_name}.",
        f"Business goal: {campaign.objective}.",
        f"Product or service (scene must match this): {campaign.product_or_service}.",
    ]
    if brand_contact:
        bn = (brand_contact.get("brand_name") or "").strip()
        em = (brand_contact.get("contact_email") or "").strip()
        ph = (brand_contact.get("phone") or "").strip()
        ad = (brand_contact.get("address") or "").strip()
        if bn or em or ph or ad:
            parts.append(
                "Brand context for believable setting only (no readable phone numbers, addresses, or text in frame): "
                f"brand {bn or 'n/a'}; locality cues {ad or 'n/a'}."
            )
    if audience:
        parts.append(f"Target audience: {audience}.")
    if offer:
        parts.append(
            "Convey promotion energy through authentic expressions and setting only — "
            f"no readable text in frame (hook: {offer})."
        )
    if channels:
        parts.append(f"Primary channels: {channels}.")
    if summary:
        parts.append(f"Strategy summary: {summary[:400]}.")
    if vd:
        parts.append(f"Visual direction from strategist: {vd[:400]}.")
    if notes:
        parts.append(f"Extra brief: {notes[:220]}.")
    parts.extend(
        [
            "Setting: believable Vietnam-relevant real interior or everyday context when it fits "
            "(classroom, office, cafe, retail) with natural daylight or soft practical lighting.",
            "Camera: DSLR candid moment, 35mm lens feel, shallow depth of field, natural skin texture, "
            "avoid glossy plastic skin and overcooked saturation.",
            "Composition: one strong focal subject; avoid cluttered crowd shots typical of weak ad visuals.",
            "Do not include readable text, signage typography, whiteboards with words, logos, watermarks, or UI overlays.",
        ]
    )
    return " ".join(parts)


@router.post("/{campaign_id}/image/generate")
async def generate_campaign_image(
    campaign_id: uuid.UUID,
    payload: GenerateImagePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate campaign image using GPT-4o to create context-rich prompts, then DALL-E 3 for final image."""
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Không tìm thấy chiến dịch")

    plan = campaign.campaign_plan_json or {}

    # Get brand info
    brand_row = await db.execute(
        select(Brand)
        .where(Brand.user_id == current_user.id)
        .order_by(Brand.updated_at.desc())
        .limit(1)
    )
    brand = brand_row.scalar_one_or_none()
    brand_data = None
    if brand:
        brand_data = {
            "brand_name": brand.brand_name,
            "description": brand.brand_description,  # Use brand_description
            "brand_description": brand.brand_description,
            "color_palette": [brand.primary_color] if brand.primary_color else None,  # Use primary_color as list
            "visual_style": brand.tone_of_voice,  # Use tone_of_voice as visual style hint
            "sample_post": brand.sample_post,
            "tagline": brand.tagline,
            "contact_email": brand.contact_email,
            "phone": brand.phone,
            "address": brand.address,
        }

    # Get content items
    content_result = await db.execute(
        select(ContentItem).where(ContentItem.campaign_id == campaign_id)
    )
    content_items = []
    for ci in content_result.scalars().all():
        content_items.append({
            "channel": ci.channel,
            "status": ci.status,
            "content_json": ci.content_json,
        })

    # Build campaign context
    campaign_data = {
        "campaign_name": campaign.campaign_name,
        "objective": campaign.objective,
        "product_or_service": campaign.product_or_service,
        "target_audience": getattr(campaign, "target_audience", None),
        "offer_or_hook": getattr(campaign, "offer_or_hook", None),
        "additional_notes": getattr(campaign, "additional_notes", None),
        "channels": campaign.channels,
    }

    context = build_context_from_campaign(campaign_data, brand_data, content_items)

    # Generate high-quality prompt using GPT-4o
    dalle_prompt = await generate_image_prompt(context, payload.prompt)

    # Optionally save the generated prompt
    if dalle_prompt != payload.prompt:  # Only save if not user override
        current_plan = dict(plan)
        current_plan["image_prompt_final"] = dalle_prompt
        campaign.campaign_plan_json = current_plan
        await db.commit()

    # Generate image with DALL-E 3 (HD quality for best results)
    try:
        dall_e_response = await _openai.images.generate(
            model="dall-e-3",
            prompt=dalle_prompt,
            size="1024x1024",
            quality="hd",
            n=1,
        )
        temp_url = dall_e_response.data[0].url
        model_used = "dall-e-3"

        # Download image
        async with httpx.AsyncClient(timeout=60) as client:
            img_resp = await client.get(temp_url)
            image_bytes = img_resp.content
    except Exception as exc:
        raise HTTPException(503, f"Không thể tạo ảnh: {exc}")

    # Save image to storage
    public_id = f"{campaign_id}_{int(datetime.now().timestamp())}"
    if _CLOUDINARY_ENABLED:
        image_url = await _upload_to_cloudinary(
            image_bytes,
            public_id=public_id,
            filename=f"{public_id}.png",
        )
    else:
        image_url = await _save_local_image(campaign_id, image_bytes, "png")

    await _save_campaign_image_url(campaign, image_url, db)
    storage = "cloudinary" if _CLOUDINARY_ENABLED else "local"
    return {"image_url": image_url, "prompt_used": dalle_prompt, "storage": storage, "model": model_used}


@router.post("/{campaign_id}/image/upload")
async def upload_campaign_image(
    campaign_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload an image from the user's device and attach it to the campaign."""
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(400, "Chỉ chấp nhận file ảnh (jpg, png, webp...)")

    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Không tìm thấy chiến dịch")

    raw_name = file.filename or "upload"
    ext = raw_name.rsplit(".", 1)[-1].lower() if "." in raw_name else "jpg"
    allowed = {"jpg", "jpeg", "png", "webp", "gif"}
    if ext not in allowed:
        raise HTTPException(400, f"Định dạng không hỗ trợ: .{ext}")

    content = await file.read()
    public_id = f"{campaign_id}_{int(datetime.now().timestamp())}"
    if _CLOUDINARY_ENABLED:
        image_url = await _upload_to_cloudinary(
            content,
            public_id=public_id,
            filename=f"{public_id}.{ext}",
        )
    else:
        image_url = await _save_local_image(campaign_id, content, ext)

    await _save_campaign_image_url(campaign, image_url, db)
    storage = "cloudinary" if _CLOUDINARY_ENABLED else "local"
    return {"image_url": image_url, "storage": storage}


# ── Performance & Revenue APIs ──────────────────────────────────────────────────

@router.get("/{campaign_id}/performance", response_model=CampaignPerformanceResponse)
async def get_campaign_performance(
    campaign_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy KPIs tổng hợp của 1 chiến dịch — không dùng tiền bạc."""
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Không tìm thấy chiến dịch")

    # Execution logs
    logs_result = await db.execute(
        select(CampaignExecutionLog).where(CampaignExecutionLog.campaign_id == campaign_id)
    )
    logs = list(logs_result.scalars().all())

    # Tracking links — tách theo link_type
    tracking_result = await db.execute(
        select(CampaignTrackingLink).where(CampaignTrackingLink.campaign_id == campaign_id)
    )
    tracking_links = list(tracking_result.scalars().all())
    email_link_clicks = sum(t.click_count for t in tracking_links if t.link_type == "email_click")
    fb_link_clicks = sum(t.click_count for t in tracking_links if t.link_type == "facebook_post")

    # Revenue records (vẫn giữ để không break frontend, không dùng tính toán)
    revenue_result = await db.execute(
        select(CampaignRevenue)
        .where(CampaignRevenue.campaign_id == campaign_id)
        .order_by(CampaignRevenue.created_at.desc())
    )
    revenues = [CampaignRevenueOut.model_validate(r) for r in revenue_result.scalars().all()]

    # ── Breakdown theo kênh ──────────────────────────────────────
    email_logs = [r for r in logs if r.channel == "email"]
    fb_logs = [r for r in logs if r.channel == "facebook"]

    def channel_stats(rows):
        sent = len(rows)
        opened = sum(1 for r in rows if r.opened_at)
        clicked = sum(1 for r in rows if r.clicked_at)
        return sent, opened, clicked

    def channel_rates(sent, opened, clicked):
        open_r = round((opened / sent) * 100, 1) if sent else 0.0
        click_r = round((clicked / sent) * 100, 1) if sent else 0.0
        return open_r, click_r

    email_sent, email_opened, email_clicked = channel_stats(email_logs)
    fb_sent, fb_opened, fb_clicked = channel_stats(fb_logs)

    email_open_r, email_click_r = channel_rates(email_sent, email_opened, email_clicked)
    fb_open_r, fb_click_r = channel_rates(fb_sent, fb_opened, fb_clicked)

    total_sent = email_sent + fb_sent
    total_opened = email_opened + fb_opened
    total_clicked = email_clicked + email_link_clicks + fb_link_clicks  # email click + email_link_clicks + fb link opens
    total_delivered = sum(1 for r in logs if r.status in ("sent", "delivered"))
    total_bounced = sum(1 for r in logs if r.status == "bounced")

    overall_open_r = round((total_opened / total_sent) * 100, 1) if total_sent else 0.0
    overall_click_r = round((total_clicked / total_sent) * 100, 1) if total_sent else 0.0

    metrics = CampaignPerformanceMetrics(
        campaign_id=campaign.id,
        campaign_name=campaign.campaign_name,
        status=campaign.status,
        total_sent=total_sent,
        total_delivered=total_delivered,
        total_opened=total_opened,
        total_clicked=total_clicked,
        total_bounced=total_bounced,
        open_rate=overall_open_r,
        click_rate=overall_click_r,
        email=ChannelMetrics(
            sent=email_sent,
            opened=email_opened,
            clicked=email_clicked,
            open_rate=email_open_r,
            click_rate=email_click_r,
            link_clicks=email_link_clicks,
        ),
        facebook=ChannelMetrics(
            sent=fb_sent,
            opened=fb_link_clicks,  # lượt mở post = clicks trên tracking link facebook_post
            clicked=fb_clicked,
            open_rate=fb_open_r,
            click_rate=fb_click_r,
            link_clicks=fb_link_clicks,
        ),
    )

    return CampaignPerformanceResponse(metrics=metrics, revenues=revenues)


@router.post("/{campaign_id}/revenue", status_code=201)
async def create_campaign_revenue(
    campaign_id: uuid.UUID,
    payload: CampaignRevenueCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Nhập doanh thu cho chiến dịch."""
    # Verify campaign belongs to user
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Không tìm thấy chiến dịch")

    # Also update campaign cost if provided
    if payload.cost and payload.cost > 0:
        campaign.cost = payload.cost
        await db.commit()

    # Create revenue record
    revenue = CampaignRevenue(
        campaign_id=campaign_id,
        user_id=current_user.id,
        revenue=payload.revenue,
        order_count=payload.order_count,
        cost=payload.cost or 0,
        source=payload.source,
        notes=payload.notes,
        recorded_date=payload.recorded_date,
    )
    db.add(revenue)
    await db.commit()
    await db.refresh(revenue)

    return CampaignRevenueOut.model_validate(revenue)


@router.put("/{campaign_id}/revenue/{revenue_id}", response_model=CampaignRevenueOut)
async def update_campaign_revenue(
    campaign_id: uuid.UUID,
    revenue_id: uuid.UUID,
    payload: CampaignRevenueUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật doanh thu đã nhập."""
    result = await db.execute(
        select(CampaignRevenue)
        .where(
            CampaignRevenue.id == revenue_id,
            CampaignRevenue.campaign_id == campaign_id,
            CampaignRevenue.user_id == current_user.id,
        )
    )
    revenue = result.scalar_one_or_none()
    if not revenue:
        raise HTTPException(404, "Không tìm thấy bản ghi doanh thu")

    # Update fields
    if payload.revenue is not None:
        revenue.revenue = payload.revenue
    if payload.order_count is not None:
        revenue.order_count = payload.order_count
    if payload.cost is not None:
        revenue.cost = payload.cost
    if payload.notes is not None:
        revenue.notes = payload.notes
    if payload.recorded_date is not None:
        revenue.recorded_date = payload.recorded_date

    await db.commit()
    await db.refresh(revenue)

    return CampaignRevenueOut.model_validate(revenue)


@router.delete("/{campaign_id}/revenue/{revenue_id}", status_code=204)
async def delete_campaign_revenue(
    campaign_id: uuid.UUID,
    revenue_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Xóa bản ghi doanh thu."""
    result = await db.execute(
        select(CampaignRevenue)
        .where(
            CampaignRevenue.id == revenue_id,
            CampaignRevenue.campaign_id == campaign_id,
            CampaignRevenue.user_id == current_user.id,
        )
    )
    revenue = result.scalar_one_or_none()
    if not revenue:
        raise HTTPException(404, "Không tìm thấy bản ghi doanh thu")

    await db.delete(revenue)
    await db.commit()


@router.put("/{campaign_id}/cost")
async def update_campaign_cost(
    campaign_id: uuid.UUID,
    cost: float,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật chi phí chiến dịch để tính ROI."""
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Không tìm thấy chiến dịch")

    campaign.cost = cost
    await db.commit()

    return {"message": "Đã cập nhật chi phí", "cost": cost}
