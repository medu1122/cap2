"""Public endpoint để redirect tracking links - không cần đăng nhập."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.campaign_tracking_link import CampaignTrackingLink
from models.campaign_execution_log import CampaignExecutionLog
from models.campaign_click_log import CampaignClickLog

router = APIRouter(prefix="/r", tags=["redirect"])

# Lưu các click gần đây để chống spam (in-memory, reset khi restart)
# Key: short_code, Value: set of token đã click gần đây
_recent_clicks: dict[str, set[str]] = {}


@router.get("/{short_code}")
async def redirect_to_destination(
    request: Request,
    short_code: str,
    token: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """
    Redirect user đến destination URL và tăng click count.

    - Tăng click_count trên campaign_tracking_links
    - Nếu có token: cập nhật clicked_at trên campaign_execution_logs
    - Chống duplicate click trong cùng 1 khoảng thời gian ngắn

    Endpoint công khai - không cần đăng nhập.
    """
    result = await db.execute(
        select(CampaignTrackingLink).where(CampaignTrackingLink.short_code == short_code)
    )
    link = result.scalar_one_or_none()

    if not link:
        raise HTTPException(status_code=404, detail="Link không tồn tại hoặc đã bị xóa")

    # --- Duplicate click prevention ---
    if token:
        recent = _recent_clicks.get(short_code, set())
        if token in recent:
            # Đã click gần đây, chỉ redirect không đếm lại
            return RedirectResponse(url=link.destination_url, status_code=302)
        recent.add(token)
        _recent_clicks[short_code] = recent
        # Dọn token cũ sau 60 giây
        import asyncio
        asyncio.get_event_loop().call_later(60, lambda: _recent_clicks.get(short_code, set()).discard(token))
    # --- End duplicate prevention ---

    # Tăng click count
    link.click_count = (link.click_count or 0) + 1

    # Ghi log click với IP để đếm người dùng thật
    client_ip = request.client.host if request.client else "unknown"
    # X-Forwarded-For có thể chứa nhiều IP, lấy IP đầu tiên (thực)
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    elif request.headers.get("x-real-ip"):
        client_ip = request.headers.get("x-real-ip", client_ip)

    click_log = CampaignClickLog(
        campaign_id=link.campaign_id,
        link_id=link.id,
        ip_address=client_ip,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(click_log)
    await db.commit()

    # Nếu có token, cập nhật clicked_at trên execution log
    if token:
        exec_result = await db.execute(
            select(CampaignExecutionLog).where(
                CampaignExecutionLog.tracking_token == token,
                CampaignExecutionLog.campaign_id == link.campaign_id,
            )
        )
        exec_log = exec_result.scalar_one_or_none()
        if exec_log and exec_log.clicked_at is None:
            exec_log.clicked_at = datetime.now(timezone.utc)
            await db.commit()

    # Redirect đến destination
    return RedirectResponse(url=link.destination_url, status_code=302)
