import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update as sql_update
from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.campaign import Campaign
from models.content_item import ContentItem
from schemas.campaign import ContentItemOut
from pydantic import BaseModel

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
