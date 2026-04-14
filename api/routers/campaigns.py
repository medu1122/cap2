import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.brand import Brand
from models.campaign import Campaign
from models.content_item import ContentItem
from models.agent_run_log import AgentRunLog
from schemas.campaign import CampaignCreate, CampaignListItem, CampaignDetail, ContentItemOut, AgentLogOut, VALID_CHANNELS
from services.agent_dispatcher import dispatch_campaign

router = APIRouter()


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
        items.append(item)
    return items


@router.post("", status_code=201)
async def create_campaign(
    payload: CampaignCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not payload.channels:
        raise HTTPException(400, "Phải chọn ít nhất 1 kênh nội dung")
    invalid = [c for c in payload.channels if c not in VALID_CHANNELS]
    if invalid:
        raise HTTPException(400, f"Kênh không hợp lệ: {invalid}")
    if payload.deadline < date.today():
        raise HTTPException(400, "Ngày kết thúc không được là ngày trong quá khứ")

    campaign = Campaign(user_id=current_user.id, **payload.model_dump())
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return {"id": str(campaign.id), "campaign_name": campaign.campaign_name, "status": campaign.status, "created_at": campaign.created_at}


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
        select(ContentItem).where(ContentItem.campaign_id == campaign_id).order_by(ContentItem.channel, ContentItem.version.desc())
    )
    log_result = await db.execute(
        select(AgentRunLog).where(AgentRunLog.campaign_id == campaign_id).order_by(AgentRunLog.step_order)
    )

    detail = CampaignDetail.model_validate(campaign)
    detail.content_items = [ContentItemOut.model_validate(ci) for ci in content_result.scalars().all()]
    detail.agent_logs = [AgentLogOut.model_validate(log) for log in log_result.scalars().all()]
    return detail


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

    brand_result = await db.execute(select(Brand).where(Brand.user_id == current_user.id))
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
    await db.delete(campaign)
    await db.commit()
