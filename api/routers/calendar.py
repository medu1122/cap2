from datetime import date
from calendar import monthrange
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.campaign import Campaign
from models.content_item import ContentItem
from pydantic import BaseModel
import uuid

router = APIRouter()


class CalendarItem(BaseModel):
    id: uuid.UUID
    campaign_id: uuid.UUID
    campaign_name: str
    channel: str
    status: str
    scheduled_date: date
    content_preview: str

    model_config = {"from_attributes": True}


@router.get("")
async def get_calendar(
    month: str = Query(..., description="Format: YYYY-MM"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    year, m = int(month.split("-")[0]), int(month.split("-")[1])
    month_start = date(year, m, 1)
    month_end = date(year, m, monthrange(year, m)[1])

    result = await db.execute(
        select(ContentItem, Campaign.campaign_name)
        .join(Campaign, Campaign.id == ContentItem.campaign_id)
        .where(
            Campaign.user_id == current_user.id,
            ContentItem.scheduled_date >= month_start,
            ContentItem.scheduled_date <= month_end,
        )
        .order_by(ContentItem.scheduled_date)
    )
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
            "content_preview": preview[:100],
        })

    return {"month": month, "items": items}
