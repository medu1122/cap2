"""Public endpoint để redirect tracking links - không cần đăng nhập."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.campaign_tracking_link import CampaignTrackingLink

router = APIRouter(prefix="/r", tags=["redirect"])


@router.get("/{short_code}")
async def redirect_to_destination(
    short_code: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Redirect user đến destination URL và tăng click count.
    
    Endpoint công khai - không cần đăng nhập.
    """
    result = await db.execute(
        select(CampaignTrackingLink).where(CampaignTrackingLink.short_code == short_code)
    )
    link = result.scalar_one_or_none()
    
    if not link:
        raise HTTPException(status_code=404, detail="Link không tồn tại hoặc đã bị xóa")
    
    # Tăng click count
    link.click_count = (link.click_count or 0) + 1
    await db.commit()
    
    # Redirect đến destination
    return RedirectResponse(url=link.destination_url, status_code=302)
