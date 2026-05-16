from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import get_current_user
from models.agent_run_log import AgentRunLog
from models.campaign import Campaign
from models.campaign_execution_log import CampaignExecutionLog
from models.content_item import ContentItem
from models.insight_report_run import InsightReportRun
from models.user import User

router = APIRouter()
ADMIN_ROLES = {"super_admin", "admin", "staff"}
ASSIGNABLE_ROLES = {"super_admin", "admin", "staff", "user"}


class AccountStatusUpdate(BaseModel):
    is_active: bool


class UserRoleUpdate(BaseModel):
    role: str


async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _user_payload(user: User, campaign_count: int = 0) -> dict[str, Any]:
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
        "status": user.status,
        "avatar_url": user.avatar_url,
        "campaign_count": campaign_count,
        "created_at": _iso(user.created_at),
        "updated_at": _iso(user.updated_at),
    }


@router.get("/dashboard")
async def admin_dashboard(
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    total_users = await db.scalar(select(func.count()).select_from(User))
    active_users = await db.scalar(
        select(func.count()).select_from(User).where(User.is_active.is_(True))
    )
    inactive_users = await db.scalar(
        select(func.count()).select_from(User).where(User.is_active.is_(False))
    )
    admin_users = await db.scalar(select(func.count()).select_from(User).where(User.role.in_(ADMIN_ROLES)))
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    recently_created = await db.scalar(
        select(func.count()).select_from(User).where(User.created_at >= cutoff)
    )
    active_campaigns = await db.scalar(
        select(func.count()).select_from(Campaign).where(Campaign.status.in_(("running", "pending_agent", "pending_approval")))
    )
    total_campaigns = await db.scalar(select(func.count()).select_from(Campaign))
    total_generations = await db.scalar(select(func.count()).select_from(ContentItem).where(ContentItem.source == "agent"))
    pending_content = await db.scalar(
        select(func.count()).select_from(ContentItem).where(ContentItem.status == "pending_approval")
    )
    token_usage = await db.scalar(
        select(func.coalesce(func.sum(func.coalesce(AgentRunLog.input_tokens, 0) + func.coalesce(AgentRunLog.output_tokens, 0)), 0))
    )
    delivered = await db.scalar(
        select(func.count()).select_from(CampaignExecutionLog).where(CampaignExecutionLog.status.in_(("sent", "delivered")))
    )
    touched = await db.scalar(
        select(func.count()).select_from(CampaignExecutionLog).where(
            or_(CampaignExecutionLog.opened_at.is_not(None), CampaignExecutionLog.clicked_at.is_not(None))
        )
    )
    engagement_rate = round(((touched or 0) / delivered) * 100, 1) if delivered else 0

    return {
        "total_users": int(total_users or 0),
        "active_users": int(active_users or 0),
        "inactive_users": int(inactive_users or 0),
        "admin_users": int(admin_users or 0),
        "new_users_30d": int(recently_created or 0),
        "active_campaigns": int(active_campaigns or 0),
        "total_campaigns": int(total_campaigns or 0),
        "ai_token_usage": int(token_usage or 0),
        "total_ai_generations": int(total_generations or 0),
        "pending_ai_content": int(pending_content or 0),
        "campaign_engagement_rate": engagement_rate,
        "system_status": [
            {"name": "API", "status": "operational", "detail": "FastAPI is responding"},
            {"name": "Database", "status": "operational", "detail": "PostgreSQL queries are healthy"},
            {"name": "AI pipeline", "status": "watch", "detail": f"{int(pending_content or 0)} content items pending approval"},
        ],
    }


@router.get("/overview")
async def admin_overview(
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    data = await admin_dashboard(current_admin, db)
    return {
        "total_business_owners": data["total_users"],
        "active_business_owners": data["active_users"],
        "inactive_business_owners": data["inactive_users"],
        "admin_users": data["admin_users"],
        "new_users_30d": data["new_users_30d"],
    }


@router.get("/users")
async def list_admin_users(
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    q: str | None = Query(default=None),
    role: str | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    filters = []
    text = (q or "").strip().lower()
    if text:
        filters.append(or_(func.lower(User.email).contains(text), func.lower(func.coalesce(User.full_name, "")).contains(text)))
    if role and role != "all":
        filters.append(User.role == role)
    if status and status != "all":
        filters.append(User.status == status)

    base = select(User).where(*filters)
    total = await db.scalar(select(func.count()).select_from(User).where(*filters))
    rows = (
        await db.execute(
            base.order_by(desc(User.created_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()
    return {
        "items": [_user_payload(user) for user in rows],
        "total": int(total or 0),
        "page": page,
        "page_size": page_size,
    }


@router.get("/business-owners")
async def list_business_owners(
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    data = await list_admin_users(current_admin, db, role="user", page_size=100)
    return data["items"]


@router.get("/users/{user_id}")
async def get_admin_user(
    user_id: uuid.UUID,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    campaign_count = await db.scalar(select(func.count()).select_from(Campaign).where(Campaign.user_id == user.id))
    return _user_payload(user, int(campaign_count or 0))


@router.patch("/users/{user_id}/status")
async def update_admin_user_status(
    user_id: uuid.UUID,
    payload: AccountStatusUpdate,
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own account status")

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = payload.is_active
    user.status = "active" if payload.is_active else "inactive"
    await db.commit()
    await db.refresh(user)
    return _user_payload(user)


@router.patch("/users/{user_id}/role")
async def update_admin_user_role(
    user_id: uuid.UUID,
    payload: UserRoleUpdate,
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    role = payload.role.strip().lower()
    if role not in ASSIGNABLE_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    if role == "super_admin" and current_admin.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only Super Admin can assign Super Admin role")

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = role
    await db.commit()
    await db.refresh(user)
    return _user_payload(user)


@router.delete("/users/{user_id}", status_code=204)
async def delete_admin_user(
    user_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.delete(user)
    await db.commit()


@router.patch("/business-owners/{user_id}/status")
async def update_business_owner_status(
    user_id: uuid.UUID,
    payload: AccountStatusUpdate,
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await update_admin_user_status(user_id, payload, current_admin, db)


@router.get("/activity-logs")
async def list_activity_logs(
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    limit: int = 60,
):
    safe_limit = max(10, min(limit, 100))

    agent_logs = (
        await db.execute(
            select(AgentRunLog, Campaign.campaign_name, User.email)
            .join(Campaign, Campaign.id == AgentRunLog.campaign_id)
            .join(User, User.id == Campaign.user_id)
            .order_by(desc(AgentRunLog.created_at))
            .limit(safe_limit)
        )
    ).all()
    delivery_logs = (
        await db.execute(
            select(CampaignExecutionLog, Campaign.campaign_name, User.email)
            .join(Campaign, Campaign.id == CampaignExecutionLog.campaign_id)
            .join(User, User.id == Campaign.user_id)
            .order_by(desc(CampaignExecutionLog.created_at))
            .limit(safe_limit)
        )
    ).all()
    insight_runs = (
        await db.execute(
            select(InsightReportRun, User.email)
            .join(User, User.id == InsightReportRun.user_id)
            .order_by(desc(InsightReportRun.created_at))
            .limit(safe_limit)
        )
    ).all()

    items: list[dict[str, Any]] = []
    for log, campaign_name, email in agent_logs:
        items.append(
            {
                "id": str(log.id),
                "type": "agent",
                "title": f"{log.agent_name} - {campaign_name}",
                "actor_email": email,
                "status": log.status,
                "detail": log.error_detail or log.output_preview or log.prompt_preview,
                "created_at": _iso(log.created_at),
            }
        )
    for log, campaign_name, email in delivery_logs:
        items.append(
            {
                "id": str(log.id),
                "type": "delivery",
                "title": f"{log.channel.upper()} - {campaign_name}",
                "actor_email": email,
                "status": log.status,
                "detail": log.error_message or log.recipient_email or log.recipient_phone,
                "created_at": _iso(log.created_at),
            }
        )
    for run, email in insight_runs:
        items.append(
            {
                "id": str(run.id),
                "type": "insight",
                "title": f"AI Analyst - {run.business_name}",
                "actor_email": email,
                "status": run.status,
                "detail": run.fallback_reason or run.source_filename or run.report_type,
                "created_at": _iso(run.created_at),
            }
        )

    items.sort(key=lambda item: item.get("created_at") or "", reverse=True)
    return items[:safe_limit]
