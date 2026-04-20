import json
import re
import uuid
import os
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update as sql_update
from openai import AsyncOpenAI
from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.campaign import Campaign
from models.content_item import ContentItem
from models.brand import Brand
from schemas.campaign import ContentItemOut
from pydantic import BaseModel

_openai = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

_WRITER_SYSTEM = """Bạn là chuyên viên viết nội dung marketing cho doanh nghiệp nhỏ Việt Nam.
Hãy viết nội dung đúng phong cách thương hiệu, tự nhiên và thu hút.
Chỉ trả về JSON hợp lệ, không thêm giải thích."""

router = APIRouter()


class ContentUpdate(BaseModel):
    content_json: dict | None = None
    scheduled_date: date | None = None


class RejectPayload(BaseModel):
    rejection_note: str


async def _get_content_item(content_id: uuid.UUID, user: User, db: AsyncSession) -> ContentItem:
    result = await db.execute(
        select(ContentItem)
        .join(Campaign, Campaign.id == ContentItem.campaign_id)
        .where(ContentItem.id == content_id, Campaign.user_id == user.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")
    return item


@router.get("", response_model=list[ContentItemOut])
async def list_content(
    campaign_id: uuid.UUID | None = None,
    channel: str | None = None,
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(ContentItem)
        .join(Campaign, Campaign.id == ContentItem.campaign_id)
        .where(Campaign.user_id == current_user.id)
        .order_by(ContentItem.created_at.desc())
    )
    if campaign_id:
        query = query.where(ContentItem.campaign_id == campaign_id)
    if channel:
        query = query.where(ContentItem.channel == channel)
    if status:
        query = query.where(ContentItem.status == status)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{content_id}", response_model=ContentItemOut)
async def get_content_item(
    content_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_content_item(content_id, current_user, db)


@router.patch("/{content_id}", response_model=ContentItemOut)
async def update_content(
    content_id: uuid.UUID,
    payload: ContentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await _get_content_item(content_id, current_user, db)
    if payload.content_json is not None:
        item.content_json = payload.content_json
        item.source = "user_edit"
        item.version += 1
    if payload.scheduled_date is not None:
        item.scheduled_date = payload.scheduled_date
    await db.commit()
    await db.refresh(item)
    return item


@router.patch("/{content_id}/approve", response_model=ContentItemOut)
async def approve_content(
    content_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await _get_content_item(content_id, current_user, db)
    if item.status not in {"pending_approval", "rejected"}:
        raise HTTPException(400, f"Không thể duyệt nội dung ở trạng thái {item.status}")
    item.status = "approved"
    await db.commit()
    await db.refresh(item)

    # Nếu tất cả nội dung của chiến dịch đã được duyệt → tự động cập nhật trạng thái chiến dịch
    pending_count_result = await db.execute(
        select(func.count()).where(
            ContentItem.campaign_id == item.campaign_id,
            ContentItem.status == "pending_approval",
        )
    )
    if pending_count_result.scalar() == 0:
        await db.execute(
            sql_update(Campaign)
            .where(Campaign.id == item.campaign_id)
            .values(status="approved")
        )
        await db.commit()

    return item


@router.patch("/{content_id}/reject", response_model=ContentItemOut)
async def reject_content(
    content_id: uuid.UUID,
    payload: RejectPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await _get_content_item(content_id, current_user, db)
    if item.status not in {"pending_approval", "approved"}:
        raise HTTPException(400, f"Không thể từ chối nội dung ở trạng thái {item.status}")
    item.status = "rejected"
    item.rejection_note = payload.rejection_note
    await db.commit()
    await db.refresh(item)
    return item


@router.patch("/{content_id}/schedule", response_model=ContentItemOut)
async def schedule_content(
    content_id: uuid.UUID,
    payload: ContentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await _get_content_item(content_id, current_user, db)
    if payload.scheduled_date:
        item.scheduled_date = payload.scheduled_date
    await db.commit()
    await db.refresh(item)
    return item


def _brand_context_block(brand: Brand | None) -> str:
    if not brand:
        return (
            "Brand: (chưa có hồ sơ)\nMô tả:\nGiọng văn:\nKhách hàng mục tiêu:\n"
            "Sản phẩm chính: chưa chỉ định\nTừ cấm: không có\nCTA ưa dùng: Liên hệ ngay\nCách xưng hô: bạn"
        )
    forbidden = ", ".join(brand.forbidden_words or []) or "không có"
    products = ", ".join(brand.key_products or []) or "chưa chỉ định"
    return (
        f"Brand: {brand.brand_name}\n"
        f"Mô tả: {brand.brand_description}\n"
        f"Giọng văn: {brand.tone_of_voice}\n"
        f"Khách hàng mục tiêu: {brand.target_audience or ''}\n"
        f"Sản phẩm chính: {products}\n"
        f"Từ cấm (KHÔNG được dùng): {forbidden}\n"
        f"CTA ưa dùng: {brand.preferred_cta or 'Liên hệ ngay'}\n"
        f"Cách xưng hô: {brand.preferred_salutation or 'bạn'}"
    )


def _parse_writer_json(raw: str) -> dict:
    for attempt in range(2):
        try:
            cleaned = re.sub(r"```json\s*|```\s*", "", raw).strip()
            return json.loads(cleaned)
        except json.JSONDecodeError:
            if attempt == 0:
                last_brace = raw.rfind("}")
                if last_brace != -1:
                    raw = raw[: last_brace + 1]
    raise ValueError("Không parse được JSON từ AI")


def _regenerate_user_prompt(
    channel: str,
    brand: Brand | None,
    plan: dict,
    deliverable: dict,
    campaign: Campaign,
) -> str:
    bc = _brand_context_block(brand)
    cs = plan.get("campaign_summary") or (
        f"{campaign.objective}\nSản phẩm/dịch vụ: {campaign.product_or_service}"
    )
    km = ", ".join(plan.get("key_messages") or [])
    cg = deliverable.get("content_goal") or campaign.objective
    th = deliverable.get("tone_hint") or (brand.tone_of_voice if brand else "") or "thân thiện"
    cta = deliverable.get("cta") or (brand.preferred_cta if brand else "") or "Liên hệ ngay"

    if channel == "facebook_post":
        return (
            f"<brand_context>\n{bc}\n</brand_context>\n\n"
            "Viết một bài đăng Facebook mới (khác nội dung cũ, đổi góc nhìn hoặc cách diễn đạt).\n\n"
            f"Tóm tắt chiến dịch: {cs}\n"
            f"Thông điệp chính: {km}\n"
            f"Mục tiêu nội dung: {cg}\n"
            f"Hướng giọng văn: {th}\n"
            f"Call-to-action: {cta}\n\n"
            'Trả về JSON:\n{\n  "copy": "...",\n  "hashtags": ["...", "...", "...", "...", "..."]\n}'
        )
    if channel == "email":
        return (
            f"<brand_context>\n{bc}\n</brand_context>\n\n"
            "Viết một email marketing mới (khác bản cũ).\n\n"
            f"Tóm tắt chiến dịch: {cs}\n"
            f"Thông điệp chính: {km}\n"
            f"Mục tiêu nội dung: {cg}\n"
            f"Hướng giọng văn: {th}\n"
            f"Call-to-action: {cta}\n\n"
            'Trả về JSON:\n{\n  "subject": "...",\n  "body": "..."\n}'
        )
    return (
        f"<brand_context>\n{bc}\n</brand_context>\n\n"
        "Viết kịch bản video ngắn mới (30–60 giây), khác bản cũ.\n\n"
        f"Tóm tắt chiến dịch: {cs}\n"
        f"Thông điệp chính: {km}\n"
        f"Mục tiêu nội dung: {cg}\n"
        f"Hướng giọng văn: {th}\n"
        f"Call-to-action: {cta}\n\n"
        'Trả về JSON:\n{\n  "hook": "...",\n  "body": "...",\n  "cta": "...",\n  "duration_estimate": "45s"\n}'
    )


@router.post("/{content_id}/regenerate", response_model=ContentItemOut)
async def regenerate_content(
    content_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Tạo lại nội dung bằng GPT (cùng kênh), chỉ khi đang chờ duyệt."""
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(503, "Chưa cấu hình OPENAI_API_KEY")

    item = await _get_content_item(content_id, current_user, db)
    if item.status != "pending_approval":
        raise HTTPException(400, "Chỉ tạo lại khi nội dung đang chờ duyệt")

    camp_result = await db.execute(select(Campaign).where(Campaign.id == item.campaign_id))
    campaign = camp_result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Chiến dịch không tồn tại")

    brand_result = await db.execute(
        select(Brand)
        .where(Brand.user_id == current_user.id)
        .order_by(Brand.updated_at.desc())
        .limit(1)
    )
    brand = brand_result.scalar_one_or_none()

    plan = campaign.campaign_plan_json or {}
    deliverable: dict | None = None
    for d in plan.get("deliverables") or []:
        if d.get("channel") == item.channel:
            deliverable = d
            break
    if deliverable is None:
        deliverable = {
            "content_goal": campaign.objective,
            "tone_hint": (brand.tone_of_voice if brand else "") or "thân thiện",
            "cta": (brand.preferred_cta if brand else "") or "Liên hệ ngay",
        }

    user_prompt = _regenerate_user_prompt(item.channel, brand, plan, deliverable, campaign)
    resp = await _openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": _WRITER_SYSTEM},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.85,
    )
    raw = (resp.choices[0].message.content or "").strip()
    try:
        new_json = _parse_writer_json(raw)
    except ValueError as exc:
        raise HTTPException(503, str(exc)) from exc

    item.content_json = new_json
    item.version += 1
    item.source = "agent"
    item.rejection_note = None
    await db.commit()
    await db.refresh(item)
    return item
