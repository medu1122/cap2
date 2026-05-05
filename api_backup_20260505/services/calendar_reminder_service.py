from __future__ import annotations

import asyncio
import smtplib
from collections import defaultdict
from datetime import date
from email.mime.text import MIMEText

from sqlalchemy import select

from core.config import settings
from core.database import AsyncSessionLocal
from models.campaign import Campaign
from models.content_item import ContentItem
from models.user import User

CHANNEL_LABELS = {
    "facebook_post": "Facebook Post",
    "email": "Email",
    "video_script": "Video Script",
}


def _extract_preview(content_json: dict) -> str:
    return (
        content_json.get("subject")
        or content_json.get("copy")
        or content_json.get("hook")
        or content_json.get("body")
        or ""
    )


def _send_email_sync(to_email: str, subject: str, body: str) -> None:
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM_EMAIL
    msg["To"] = to_email

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())


async def send_today_calendar_reminders() -> None:
    if not settings.CALENDAR_REMINDER_ENABLED:
        return
    if not (settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD and settings.SMTP_FROM_EMAIL):
        return

    today = date.today()

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ContentItem, Campaign.campaign_name, User.email, User.full_name)
            .join(Campaign, Campaign.id == ContentItem.campaign_id)
            .join(User, User.id == Campaign.user_id)
            .where(
                ContentItem.scheduled_date == today,
                ContentItem.status.in_(["approved", "pending_approval"]),
                User.email_reminder_enabled == True,
            )
            .order_by(User.email, Campaign.campaign_name)
        )
        rows = result.all()

    grouped: dict[str, dict] = defaultdict(lambda: {"name": "", "items": [], "email": ""})
    for item, campaign_name, email, full_name in rows:
        if not email:
            continue
        # Đọc preference từ DB — nếu chưa load user thì skip
        # Note: user preference đã join ở query bên trên (User.email_reminder_enabled)
        grouped[email]["name"] = full_name or "bạn"
        grouped[email]["email"] = email
        grouped[email]["items"].append({
            "campaign_name": campaign_name,
            "channel": item.channel,
            "preview": _extract_preview(item.content_json or {}),
        })

    for to_email, payload in grouped.items():
        lines = [
            f"Chào {payload['name']},",
            "",
            f"Hôm nay ({today.strftime('%d/%m/%Y')}) bạn có {len(payload['items'])} việc cần xử lý:",
            "",
        ]
        for idx, it in enumerate(payload["items"], start=1):
            channel = CHANNEL_LABELS.get(it["channel"], it["channel"])
            preview = (it["preview"] or "").strip().replace("\n", " ")
            lines.append(f"{idx}. [{channel}] {it['campaign_name']}")
            if preview:
                lines.append(f"   Nội dung: {preview[:120]}")
        lines.extend([
            "",
            "Mở mục Lịch marketing trong AIMAP để xem chi tiết.",
            "",
            "Cảm ơn.",
        ])
        subject = f"Nhắc lịch công việc {today.strftime('%d/%m/%Y')}"
        await asyncio.to_thread(_send_email_sync, to_email, subject, "\n".join(lines))
