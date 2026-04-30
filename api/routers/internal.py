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
MIN_GAP_DAYS = 2  # tối thiểu 2 ngày giữa 2 bài cùng kênh

# Thứ tự ưu tiên kênh: email trước, social sau
CHANNEL_PRIORITY = {"email": 0, "facebook_post": 1, "video_script": 2}


def _good_days_in_range(start: date, end: date) -> list[date]:
    """Trả về các ngày T2-T6 trong khoảng start→end."""
    days = []
    current = start
    while current <= end:
        if current.weekday() < 5:  # T2-T6
            days.append(current)
        current += timedelta(days=1)
    return days


def _date_distance(a: date, b: date) -> int:
    return abs((b - a).days)


def _calculate_smart_schedule(
    campaign_deadline: date | None,
    campaign_start: date,
    all_channels: list[str],
    existing_items: list[tuple[str, date]],
) -> dict[str, date]:
    """
    Tính lịch thông minh cho tất cả kênh.
    - Ưu tiên email đăng trước (email là kênh chính thức)
    - Các kênh social dàn đều, cách nhau ít nhất MIN_GAP_DAYS ngày
    - Tất cả nằm trong khoảng start → deadline - 2 ngày
    """
    if not campaign_deadline:
        return {}

    valid_end = campaign_deadline - timedelta(days=DAYS_BEFORE_DEADLINE)
    if valid_end <= campaign_start:
        valid_end = campaign_deadline - timedelta(days=1)

    # Các ngày T2-T6 có thể dùng
    good_days = _good_days_in_range(campaign_start, valid_end)
    if not good_days:
        return {}

    # Ghép kênh đã có với kênh cần thêm
    existing_map = {ch: d for ch, d in existing_items}
    needed_channels = [ch for ch in all_channels if ch not in existing_map]

    # Sắp xếp theo priority
    sorted_needed = sorted(needed_channels, key=lambda ch: CHANNEL_PRIORITY.get(ch, 99))
    all_sorted = sorted(
        [(ch, existing_map[ch]) for ch in all_channels if ch in existing_map]
        + [(ch, None) for ch in sorted_needed],
        key=lambda x: CHANNEL_PRIORITY.get(x[0], 99),
    )

    # Gán ngày cho từng kênh còn thiếu
    schedule: dict[str, date] = {ch: d for ch, d in existing_items}

    for ch, _ in all_sorted:
        if ch in schedule:
            continue

        # Tìm ngày tốt nhất cho kênh này:
        # - Không trùng với kênh khác (với social: cách nhau MIN_GAP_DAYS)
        # - Ưu tiên gần đầu cho email, gần cuối cho video
        is_social = ch in ("facebook_post", "video_script")
        target_pos = (CHANNEL_PRIORITY.get(ch, 0) + 1) / max(len(all_channels), 1)
        ideal_date = good_days[int(len(good_days) * target_pos)] if good_days else valid_end

        best_date = None
        best_score = 999_999

        for day in good_days:
            if day in schedule.values():
                continue

            # Kiểm tra khoảng cách với social channels
            too_close = False
            for sched_ch, sched_date in schedule.items():
                if sched_ch in ("facebook_post", "video_script"):
                    if _date_distance(day, sched_date) < MIN_GAP_DAYS:
                        too_close = True
                        break

            if too_close:
                continue

            # Tính score: ưu tiên gần ideal_date
            score = abs((day - ideal_date).days)
            if score < best_score:
                best_score = score
                best_date = day

        if best_date:
            schedule[ch] = best_date
        else:
            # Fallback: ngày trống đầu tiên
            for day in good_days:
                if day not in schedule.values():
                    schedule[ch] = day
                    break

    return schedule


def _calculate_scheduled_date(
    campaign_deadline: date | None,
    campaign_start: date,
    channel: str,
    all_channels: list[str],
    existing_dates: list[tuple[str, date]],
) -> date | None:
    """Tính ngày đăng cho một content mới, dùng smart schedule."""
    schedule = _calculate_smart_schedule(
        campaign_deadline, campaign_start, all_channels, existing_dates
    )
    if channel in schedule:
        return schedule[channel]

    # Fallback cũ: tìm ngày T2-T6 gần nhất không trùng
    if not campaign_deadline:
        return None

    valid_end = campaign_deadline - timedelta(days=DAYS_BEFORE_DEADLINE)
    if valid_end <= campaign_start:
        valid_end = campaign_deadline - timedelta(days=1)

    good_days = _good_days_in_range(campaign_start, valid_end)
    existing_set = set(d for _, d in existing_dates)

    for day in reversed(good_days):
        if day not in existing_set:
            return day
    return valid_end


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
            # Lấy các ngày đã có của campaign này (kênh + ngày)
            existing_result = await db.execute(
                select(ContentItem.channel, ContentItem.scheduled_date)
                .where(
                    ContentItem.campaign_id == payload.campaign_id,
                    ContentItem.scheduled_date.is_not(None),
                )
            )
            existing_items: list[tuple[str, date]] = [
                (r[0], r[1]) for r in existing_result.fetchall() if r[1]
            ]

            # Tính ngày tạo campaign (hoặc dùng today nếu không có)
            campaign_start = campaign.created_at.date() if hasattr(campaign, "created_at") else date.today()

            scheduled_date = _calculate_scheduled_date(
                campaign.deadline,
                campaign_start,
                payload.channel,
                list(campaign.channels) if campaign.channels else [payload.channel],
                existing_items,
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
