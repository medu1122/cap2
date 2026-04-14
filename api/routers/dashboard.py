from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.campaign import Campaign
from models.content_item import ContentItem
from models.agent_run_log import AgentRunLog

router = APIRouter()


@router.get("/stats")
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    total_campaigns = (await db.execute(
        select(func.count()).select_from(Campaign).where(Campaign.user_id == current_user.id)
    )).scalar() or 0

    user_campaign_ids = select(Campaign.id).where(Campaign.user_id == current_user.id)

    total_content = (await db.execute(
        select(func.count()).select_from(ContentItem).where(ContentItem.campaign_id.in_(user_campaign_ids))
    )).scalar() or 0

    pending_approvals = (await db.execute(
        select(func.count()).select_from(ContentItem)
        .where(ContentItem.campaign_id.in_(user_campaign_ids), ContentItem.status == "pending_approval")
    )).scalar() or 0

    approved_items = (await db.execute(
        select(func.count()).select_from(ContentItem)
        .where(ContentItem.campaign_id.in_(user_campaign_ids), ContentItem.status == "approved")
    )).scalar() or 0

    channel_rows = (await db.execute(
        select(ContentItem.channel, func.count().label("cnt"))
        .where(ContentItem.campaign_id.in_(user_campaign_ids))
        .group_by(ContentItem.channel)
    )).all()
    content_by_channel = {row.channel: row.cnt for row in channel_rows}

    recent_campaigns_result = await db.execute(
        select(Campaign)
        .where(Campaign.user_id == current_user.id)
        .order_by(Campaign.created_at.desc())
        .limit(5)
    )
    recent = [
        {"id": str(c.id), "campaign_name": c.campaign_name, "status": c.status, "created_at": c.created_at.isoformat()}
        for c in recent_campaigns_result.scalars().all()
    ]

    recent_logs_result = await db.execute(
        select(AgentRunLog)
        .where(AgentRunLog.campaign_id.in_(user_campaign_ids))
        .order_by(AgentRunLog.created_at.desc())
        .limit(8)
    )
    recent_logs = [
        {
            "id": str(log.id),
            "campaign_id": str(log.campaign_id),
            "agent_name": log.agent_name,
            "channel": log.channel,
            "model_used": log.model_used,
            "duration_ms": log.duration_ms,
            "status": log.status,
            "created_at": log.created_at.isoformat(),
        }
        for log in recent_logs_result.scalars().all()
    ]

    return {
        "total_campaigns": total_campaigns,
        "total_content_items": total_content,
        "pending_approvals": pending_approvals,
        "approved_items": approved_items,
        "content_by_channel": content_by_channel,
        "recent_campaigns": recent,
        "recent_agent_logs": recent_logs,
    }


@router.get("/summary")
async def get_ai_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from services.dashboard_service import generate_summary
    summary = await generate_summary(current_user.id, db)
    return {"summary": summary}
