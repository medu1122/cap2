"""Tracking mở email / click — không cần đăng nhập (trình đọc mail gọi trực tiếp)."""
import base64
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from models.campaign_execution_log import CampaignExecutionLog

router = APIRouter()

_PIXEL = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")


@router.get("/open/{token}")
async def track_open(token: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        select(CampaignExecutionLog).where(CampaignExecutionLog.tracking_token == token)
    )
    row = r.scalar_one_or_none()
    if row and row.opened_at is None and row.channel == "email":
        row.opened_at = datetime.now(timezone.utc)
        await db.commit()
    return Response(
        content=_PIXEL,
        media_type="image/gif",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache"},
    )


@router.get("/click/{token}")
async def track_click(token: str, db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        select(CampaignExecutionLog).where(CampaignExecutionLog.tracking_token == token)
    )
    row = r.scalar_one_or_none()
    url = settings.TRACKING_DEFAULT_REDIRECT_URL or "http://localhost:3000"
    if row:
        if row.clicked_at is None and row.channel == "email":
            row.clicked_at = datetime.now(timezone.utc)
            await db.commit()
        if row.click_target_url:
            url = row.click_target_url
    return RedirectResponse(url=url, status_code=302)
