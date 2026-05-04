"""API endpoints cho campaign tracking links - CRUD + redirect."""
import secrets
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, HttpUrl, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from models.campaign import Campaign
from models.campaign_tracking_link import CampaignTrackingLink
from models.user import User

router = APIRouter(prefix="/campaigns", tags=["tracking-links"])


def generate_short_code() -> str:
    """Tạo short code ngẫu nhiên an toàn cho URL."""
    return secrets.token_urlsafe(8)[:12]


class TrackingLinkCreate(BaseModel):
    name: str
    destination_url: str

    @field_validator("destination_url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("URL phải bắt đầu bằng http:// hoặc https://")
        return v.strip().rstrip("/")


class TrackingLinkUpdate(BaseModel):
    name: str | None = None
    destination_url: str | None = None

    @field_validator("destination_url")
    @classmethod
    def validate_url(cls, v: str | None) -> str | None:
        if v is not None:
            if not v.startswith(("http://", "https://")):
                raise ValueError("URL phải bắt đầu bằng http:// hoặc https://")
            return v.strip().rstrip("/")
        return v


class TrackingLinkResponse(BaseModel):
    id: UUID
    campaign_id: UUID
    name: str
    destination_url: str
    short_code: str
    click_count: int
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/{campaign_id}/tracking-links", response_model=list[TrackingLinkResponse])
async def list_tracking_links(
    campaign_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Lấy danh sách tracking links của một chiến dịch."""
    # Verify campaign belongs to user
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Không tìm thấy chiến dịch")

    # Get tracking links
    result = await db.execute(
        select(CampaignTrackingLink)
        .where(CampaignTrackingLink.campaign_id == campaign_id)
        .order_by(CampaignTrackingLink.created_at.desc())
    )
    links = result.scalars().all()
    return [TrackingLinkResponse.model_validate(link) for link in links]


@router.post("/{campaign_id}/tracking-links", response_model=TrackingLinkResponse, status_code=status.HTTP_201_CREATED)
async def create_tracking_link(
    campaign_id: UUID,
    data: TrackingLinkCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Tạo một tracking link mới cho chiến dịch."""
    # Verify campaign belongs to user
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Không tìm thấy chiến dịch")

    # Generate unique short code
    short_code = generate_short_code()
    while True:
        exists = await db.execute(
            select(CampaignTrackingLink).where(CampaignTrackingLink.short_code == short_code)
        )
        if not exists.scalar_one_or_none():
            break
        short_code = generate_short_code()

    # Create tracking link
    link = CampaignTrackingLink(
        campaign_id=campaign_id,
        name=data.name.strip(),
        destination_url=data.destination_url,
        short_code=short_code,
        click_count=0,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)

    return TrackingLinkResponse.model_validate(link)


@router.put("/{campaign_id}/tracking-links/{link_id}", response_model=TrackingLinkResponse)
async def update_tracking_link(
    campaign_id: UUID,
    link_id: UUID,
    data: TrackingLinkUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Cập nhật tracking link."""
    # Verify campaign belongs to user
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Không tìm thấy chiến dịch")

    # Get link
    result = await db.execute(
        select(CampaignTrackingLink).where(
            CampaignTrackingLink.id == link_id,
            CampaignTrackingLink.campaign_id == campaign_id,
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Không tìm thấy tracking link")

    # Update fields
    if data.name is not None:
        link.name = data.name.strip()
    if data.destination_url is not None:
        link.destination_url = data.destination_url

    await db.commit()
    await db.refresh(link)

    return TrackingLinkResponse.model_validate(link)


@router.delete("/{campaign_id}/tracking-links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tracking_link(
    campaign_id: UUID,
    link_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Xóa tracking link."""
    # Verify campaign belongs to user
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Không tìm thấy chiến dịch")

    # Get link
    result = await db.execute(
        select(CampaignTrackingLink).where(
            CampaignTrackingLink.id == link_id,
            CampaignTrackingLink.campaign_id == campaign_id,
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Không tìm thấy tracking link")

    await db.delete(link)
    await db.commit()
