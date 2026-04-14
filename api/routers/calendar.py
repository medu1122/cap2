from datetime import date
from calendar import monthrange
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.campaign import Campaign
from models.content_item import ContentItem
from pydantic import BaseModel
import uuid

router = APIRouter()


class ReschedulePayload(BaseModel):
    scheduled_date: date


def _extract_copy_text(content_json: dict) -> str:
    """Return the primary copyable text from a content_json payload."""
    parts = []
    for key in ["subject", "hook", "copy", "body", "caption", "script", "cta"]:
        val = content_json.get(key)
        if val and isinstance(val, str):
            parts.append(val)
    return "\n\n".join(parts) if parts else ""


@router.get("")
async def get_calendar(
    month: str = Query(..., description="Format: YYYY-MM"),
    channel: str | None = Query(default=None),
    status: str | None = Query(default="approved"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    year, m = int(month.split("-")[0]), int(month.split("-")[1])
    month_start = date(year, m, 1)
    month_end = date(year, m, monthrange(year, m)[1])

    latest_version_sq = (
        select(
            ContentItem.campaign_id.label("campaign_id"),
            ContentItem.channel.label("channel"),
            func.max(ContentItem.version).label("max_version"),
        )
        .group_by(ContentItem.campaign_id, ContentItem.channel)
        .subquery()
    )

    query = (
        select(ContentItem, Campaign.campaign_name)
        .join(Campaign, Campaign.id == ContentItem.campaign_id)
        .join(
            latest_version_sq,
            and_(
                latest_version_sq.c.campaign_id == ContentItem.campaign_id,
                latest_version_sq.c.channel == ContentItem.channel,
                latest_version_sq.c.max_version == ContentItem.version,
            ),
        )
        .where(
            Campaign.user_id == current_user.id,
            ContentItem.scheduled_date >= month_start,
            ContentItem.scheduled_date <= month_end,
        )
        .order_by(ContentItem.scheduled_date)
    )
    if channel:
        query = query.where(ContentItem.channel == channel)
    if status:
        query = query.where(ContentItem.status == status)

    result = await db.execute(query)
    rows = result.all()

    items = []
    for content_item, campaign_name in rows:
        content_json = content_item.content_json or {}
        preview = (
            content_json.get("copy")
            or content_json.get("subject")
            or content_json.get("hook")
            or ""
        )
        items.append({
            "id": str(content_item.id),
            "campaign_id": str(content_item.campaign_id),
            "campaign_name": campaign_name,
            "channel": content_item.channel,
            "status": content_item.status,
            "scheduled_date": str(content_item.scheduled_date),
            "content_preview": preview[:120],
            "copy_text": _extract_copy_text(content_json),
            "content_json": content_json,
        })

    return {"month": month, "items": items}


@router.patch("/{item_id}")
async def reschedule_item(
    item_id: uuid.UUID,
    payload: ReschedulePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Move a content item to a different publish date."""
    result = await db.execute(
        select(ContentItem)
        .join(Campaign, Campaign.id == ContentItem.campaign_id)
        .where(
            ContentItem.id == item_id,
            Campaign.user_id == current_user.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Nội dung không tìm thấy")

    item.scheduled_date = payload.scheduled_date
    await db.commit()
    return {"id": str(item.id), "scheduled_date": str(item.scheduled_date)}
