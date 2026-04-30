"""
Internal routes called only by the agent service — not exposed to the browser.
No auth middleware on these routes (agent service runs in the same Docker network).
"""
import uuid
from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from core.database import get_db
from models.campaign import Campaign
from models.content_item import ContentItem
from models.agent_run_log import AgentRunLog
from pydantic import BaseModel

router = APIRouter()

# ── Helpers ───────────────────────────────────────────────────────────────────

DAYS_BEFORE_DEADLINE = 2  # luôn kết thúc trước deadline 2 ngày


def _is_good_posting_day(d: date) -> bool:
    """Email: T2-T6, Social: T2-CN (tránh CN sáng sớm)."""
    return d.weekday() < 5  # T2-T6 tốt cho email


def _calculate_scheduled_date(
    campaign_deadline: date | None,
    campaign_start: date,
    channel: str,
    existing_dates: list[date],
) -> date | None:
    """Tính ngày đăng tối ưu: dàn đều trong khoảng campaign, tránh trùng."""
    if not campaign_deadline:
        return None

    # Khoảng hợp lệ: start → deadline - 2 ngày
    valid_start = campaign_start
    valid_end = campaign_deadline - timedelta(days=DAYS_BEFORE_DEADLINE)
    if valid_end <= valid_start:
        valid_end = campaign_deadline - timedelta(days=1)

    total_days = (valid_end - valid_start).days
    if total_days < 1:
        return valid_end  # chỉ còn 1 ngày → đăng ngày cuối

    # Số content hợp lý: dàn đều
    existing_count = len(existing_dates)
    target_count = existing_count + 1

    # Vị trí lý tưởng cho content mới (theo thứ tự 1-based)
    ideal_slot = target_count  # content mới luôn là slot cuối trong timeline hiện tại

    # Tính ideal_date dựa trên chia đều
    # Để content mới vào cuối, chia khoảng thành target_count phần
    ideal_date = valid_start + timedelta(days=int(total_days * (ideal_slot - 1) / max(target_count, 1)))
    ideal_date = valid_start + timedelta(days=int(total_days * ideal_slot / max(target_count + 1, 1)))

    # Làm tròn đến ngày tốt gần nhất
    step = 1 if ideal_date <= valid_end else -1
    candidate = ideal_date
    for _ in range(7):  # tìm trong 7 ngày
        if _is_good_posting_day(candidate) and candidate not in existing_dates:
            return candidate
        candidate += timedelta(days=step)
        if candidate > valid_end:
            candidate = valid_start
        elif candidate < valid_start:
            candidate = valid_end

    # Fallback: ngày cuối cùng hợp lệ không trùng
    fallback = valid_end
    while fallback >= valid_start:
        if fallback not in existing_dates:
            return fallback
        fallback -= timedelta(days=1)
    return valid_end  # fallback cuối cùng


class CampaignUpdate(BaseModel):
    status: str
    campaign_plan_json: dict | None = None
    error_message: str | None = None


class ContentCreate(BaseModel):
    campaign_id: uuid.UUID
    channel: str
    version: int = 1
    status: str = "pending_approval"
    content_json: dict
    agent_run_id: uuid.UUID | None = None
    scheduled_date: date | None = None


class LogCreate(BaseModel):
    campaign_id: uuid.UUID
    agent_name: str
    step_order: int
    channel: str | None = None
    model_used: str
    model_provider: str
    prompt_preview: str | None = None
    output_preview: str | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    duration_ms: int | None = None
    status: str = "success"
    error_detail: str | None = None


@router.get("/campaigns/{campaign_id}/detail")
async def get_campaign_detail_internal(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Used by agent service to fetch all data needed for orchestration."""
    from models.brand import Brand

    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.brand_id:
        brand_result = await db.execute(
            select(Brand).where(Brand.id == campaign.brand_id, Brand.user_id == campaign.user_id)
        )
    else:
        # Compatibility for old campaigns without explicit brand_id.
        brand_result = await db.execute(
            select(Brand)
            .where(Brand.user_id == campaign.user_id)
            .order_by(Brand.updated_at.desc())
            .limit(1)
        )
    brand = brand_result.scalar_one_or_none()

    return {
        "brief": {
            "campaign_name": campaign.campaign_name,
            "objective": campaign.objective,
            "product_or_service": campaign.product_or_service,
            "target_audience": campaign.target_audience,
            "offer_or_hook": campaign.offer_or_hook,
            "deadline": str(campaign.deadline),
            "channels": campaign.channels,
            "additional_notes": campaign.additional_notes,
        },
        "brand_vault": {
            "brand_name": brand.brand_name if brand else "",
            "brand_description": brand.brand_description if brand else "",
            "tone_of_voice": brand.tone_of_voice if brand else "warm",
            "target_audience": brand.target_audience if brand else "",
            "key_products": brand.key_products if brand else [],
            "forbidden_words": brand.forbidden_words if brand else [],
            "preferred_cta": brand.preferred_cta if brand else "Liên hệ ngay",
            "preferred_salutation": brand.preferred_salutation if brand else "bạn",
            "contact_email": brand.contact_email if brand else None,
            "phone": brand.phone if brand else None,
            "address": brand.address if brand else None,
        } if brand else {},
    }


@router.patch("/campaigns/{campaign_id}")
async def update_campaign_internal(
    campaign_id: uuid.UUID,
    payload: CampaignUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if campaign:
        campaign.status = payload.status
        if payload.campaign_plan_json:
            campaign.campaign_plan_json = payload.campaign_plan_json
        if payload.error_message:
            campaign.error_message = payload.error_message
        await db.commit()
    return {"ok": True}


@router.post("/content", status_code=201)
async def create_content_internal(
    payload: ContentCreate,
    db: AsyncSession = Depends(get_db),
):
    # Nếu chưa có scheduled_date → tự tính
    scheduled_date = payload.scheduled_date
    if scheduled_date is None:
        # Lấy campaign để biết deadline và start
        campaign_result = await db.execute(
            select(Campaign).where(Campaign.id == payload.campaign_id)
        )
        campaign = campaign_result.scalar_one_or_none()

        if campaign:
            # Lấy các ngày đã có của campaign này
            existing_result = await db.execute(
                select(ContentItem.scheduled_date)
                .where(
                    ContentItem.campaign_id == payload.campaign_id,
                    ContentItem.scheduled_date.is_not(None),
                )
            )
            existing_dates = [r[0] for r in existing_result.fetchall() if r[0]]

            # Tính ngày tạo campaign (hoặc dùng today nếu không có)
            campaign_start = campaign.created_at.date() if hasattr(campaign, "created_at") else date.today()

            scheduled_date = _calculate_scheduled_date(
                campaign.deadline,
                campaign_start,
                payload.channel,
                existing_dates,
            )

    item = ContentItem(
        campaign_id=payload.campaign_id,
        channel=payload.channel,
        version=payload.version,
        status=payload.status,
        content_json=payload.content_json,
        agent_run_id=payload.agent_run_id,
        scheduled_date=scheduled_date,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return {"id": str(item.id), "scheduled_date": str(scheduled_date) if scheduled_date else None}


@router.post("/logs", status_code=201)
async def create_log_internal(
    payload: LogCreate,
    db: AsyncSession = Depends(get_db),
):
    log = AgentRunLog(**payload.model_dump())
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return {"id": str(log.id)}
