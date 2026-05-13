"""Gửi email qua SMTP + mô phỏng SMS; tracking token cho pixel và click."""
from __future__ import annotations

import asyncio
import html
import logging
import random
import secrets
import smtplib
import uuid
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import AsyncSessionLocal
from models.campaign import Campaign
from models.brand import Brand
from models.campaign_execution_log import CampaignExecutionLog
from models.campaign_tracking_link import CampaignTrackingLink
from models.content_item import ContentItem
from models.customer import Customer
from models.customer_list import CustomerList

logger = logging.getLogger(__name__)

def tracking_urls(token: str, short_code: str | None = None) -> tuple[str, str]:
    base = settings.TRACKING_PUBLIC_BASE_URL.rstrip("/")
    # Ưu tiên dùng /r/{short_code}?token= để redirect đi qua tracking link
    # (cho phép đếm click trên campaign_tracking_links ĐỒNG THỜI ghi clicked_at vào execution_log)
    if short_code:
        return f"{base}/track/open/{token}", f"{base}/r/{short_code}?token={token}"
    return f"{base}/track/open/{token}", f"{base}/track/click/{token}"


def build_email_html(
    body_text: str,
    open_url: str,
    click_url: str,
    ab_variant: str | None,
    cta_text: str = "Xem chi tiết ưu đãi",
) -> tuple[str, str]:
    safe_body = html.escape(body_text or "")
    safe_body_html = safe_body.replace("\n", "<br>\n")
    ab_note = ""
    if ab_variant == "A":
        ab_note = "<p><em>Phiên bản A</em></p>"
    elif ab_variant == "B":
        ab_note = "<p><em>Phiên bản B</em></p>"
    cta = f'<p><a href="{html.escape(click_url)}">{html.escape(cta_text)}</a></p>'
    pixel = f'<img src="{html.escape(open_url)}" width="1" height="1" alt="" style="display:block;border:0" />'
    html_part = f"""<!DOCTYPE html>
<html><body>
{ab_note}
<div>{safe_body_html}</div>
{cta}
{pixel}
</body></html>"""
    plain = (body_text or "").strip()
    if plain:
        plain += "\n\n"
    plain += f"{cta_text}: {click_url}\n"
    return plain, html_part


def send_smtp_sync(
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str,
    from_name: str | None = None,
    from_addr: str | None = None,
    reply_to: str | None = None,
) -> None:
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        raise RuntimeError("Chưa cấu hình SMTP (SMTP_HOST / SMTP_USER).")
    default_from = (settings.SMTP_FROM_EMAIL or settings.SMTP_USER).strip()
    sender_addr = (from_addr or default_from).strip()
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    # Custom display name: "Brand Name" <system@email.com>
    if from_name:
        msg["From"] = f'"{from_name}" <{sender_addr}>'
    else:
        msg["From"] = sender_addr
    msg["To"] = to_email
    # Reply-To = email thật của user (để khách reply đúng chỗ)
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=60) as smtp:
        smtp.starttls()
        if settings.SMTP_PASSWORD:
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        smtp.sendmail(sender_addr, [to_email], msg.as_string())


async def merge_campaign_delivery(db: AsyncSession, campaign: Campaign, patch: dict[str, Any]) -> None:
    plan = dict(campaign.campaign_plan_json or {})
    delivery = dict(plan.get("delivery") or {})
    delivery.update(patch)
    plan["delivery"] = delivery
    campaign.campaign_plan_json = plan
    await db.commit()


async def latest_email_content(db: AsyncSession, campaign_id: uuid.UUID) -> ContentItem | None:
    r = await db.execute(
        select(ContentItem)
        .where(
            ContentItem.campaign_id == campaign_id,
            ContentItem.channel == "email",
            ContentItem.status.in_(("approved", "pending_approval")),
        )
        .order_by(ContentItem.version.desc())
        .limit(1)
    )
    return r.scalar_one_or_none()


async def run_email_delivery(
    campaign_id: uuid.UUID,
    customer_list_id: uuid.UUID,
    user_id: uuid.UUID,
    batch_id: uuid.UUID,
    ab_test: bool,
) -> None:
    async with AsyncSessionLocal() as db:
        try:
            camp_r = await db.execute(
                select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == user_id)
            )
            campaign = camp_r.scalar_one_or_none()
            if not campaign:
                return

            # Lấy brand để có tên hiển thị trong email
            brand = None
            brand_name = None
            brand_reply_to = None
            if campaign.brand_id:
                brand_r = await db.execute(select(Brand).where(Brand.id == campaign.brand_id))
                brand = brand_r.scalar_one_or_none()
                if brand:
                    brand_name = brand.brand_name
                    brand_reply_to = brand.contact_email

            list_r = await db.execute(
                select(CustomerList).where(
                    CustomerList.id == customer_list_id, CustomerList.user_id == user_id
                )
            )
            clist = list_r.scalar_one_or_none()
            if not clist:
                await merge_campaign_delivery(
                    db,
                    campaign,
                    {
                        "status": "failed",
                        "last_error": "Danh sách khách không hợp lệ.",
                        "finished_at": datetime.now(timezone.utc).isoformat(),
                    },
                )
                return

            content = await latest_email_content(db, campaign_id)
            if not content:
                await merge_campaign_delivery(
                    db,
                    campaign,
                    {
                        "status": "failed",
                        "last_error": "Chưa có nội dung email (đã duyệt hoặc chờ duyệt).",
                        "finished_at": datetime.now(timezone.utc).isoformat(),
                    },
                )
                return

            cj = content.content_json or {}
            subject = str(cj.get("subject") or campaign.campaign_name or "Thông báo từ AIMAP")
            body = str(cj.get("body") or "")
            cta_text = str(cj.get("cta_text") or "Xem chi tiết ưu đãi")
            cta_url = str(cj.get("cta_url") or "").strip()

            # Lấy tracking links của campaign (ưu tiên dùng link đầu tiên nếu có)
            tracking_links_r = await db.execute(
                select(CampaignTrackingLink)
                .where(CampaignTrackingLink.campaign_id == campaign_id)
                .order_by(CampaignTrackingLink.created_at.asc())
                .limit(1)
            )
            tracking_link = tracking_links_r.scalar_one_or_none()

            # Ưu tiên dùng tracking link nếu có, không thì dùng cta_url từ AI
            if tracking_link:
                # Dùng tracking link - sẽ redirect đến destination_url và đếm clicks
                redirect_base = f"{settings.TRACKING_PUBLIC_BASE_URL.rstrip('/')}/r/{tracking_link.short_code}"
                cta_text = tracking_link.name
            elif cta_url:
                redirect_base = cta_url
            else:
                redirect_base = settings.TRACKING_DEFAULT_REDIRECT_URL or "http://localhost:3000"

            cust_r = await db.execute(
                select(Customer).where(Customer.customer_list_id == customer_list_id)
            )
            customers = list(cust_r.scalars().all())

            for cust in customers:
                email_addr = (cust.email or "").strip()
                if not email_addr:
                    token = secrets.token_urlsafe(24)
                    db.add(
                        CampaignExecutionLog(
                            batch_id=batch_id,
                            campaign_id=campaign_id,
                            customer_id=cust.id,
                            channel="email",
                            status="skipped_no_email",
                            tracking_token=token,
                            recipient_name=cust.full_name,
                            click_target_url=redirect_base,
                        )
                    )
                    await db.commit()
                    continue

                ab_var = None
                body_use = body
                if ab_test:
                    ab_var = "A" if random.random() < 0.5 else "B"
                    if ab_var == "B":
                        body_use = body + "\n\n[Gợi ý B] Ưu đãi dành riêng cho bạn — đừng bỏ lỡ!"

                token = secrets.token_urlsafe(24)
                open_u, click_u = tracking_urls(token, tracking_link.short_code if tracking_link else None)
                text_part, html_part = build_email_html(body_use, open_u, click_u, ab_var, cta_text)

                log = CampaignExecutionLog(
                    batch_id=batch_id,
                    campaign_id=campaign_id,
                    customer_id=cust.id,
                    channel="email",
                    status="pending",
                    tracking_token=token,
                    recipient_email=email_addr,
                    recipient_name=cust.full_name,
                    click_target_url=redirect_base,
                    ab_variant=ab_var,
                )
                db.add(log)
                await db.commit()
                await db.refresh(log)

                try:
                    await asyncio.to_thread(
                        send_smtp_sync,
                        email_addr,
                        subject,
                        text_part,
                        html_part,
                        from_name=brand_name,
                        reply_to=brand_reply_to,
                    )
                    log.status = "sent"
                    log.sent_at = datetime.now(timezone.utc)
                    log.error_message = None
                except Exception as exc:
                    logger.exception("SMTP gửi thất bại: %s", email_addr)
                    log.status = "failed"
                    log.error_message = str(exc)[:500]
                await db.commit()

            await merge_campaign_delivery(
                db,
                campaign,
                {
                    "status": "completed",
                    "finished_at": datetime.now(timezone.utc).isoformat(),
                },
            )
        except Exception as exc:
            logger.exception("run_email_delivery")
            async with AsyncSessionLocal() as db2:
                r = await db2.execute(
                    select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == user_id)
                )
                c = r.scalar_one_or_none()
                if c:
                    await merge_campaign_delivery(
                        db2,
                        c,
                        {
                            "status": "failed",
                            "last_error": str(exc)[:500],
                            "finished_at": datetime.now(timezone.utc).isoformat(),
                        },
                    )


async def run_sms_simulation(
    campaign_id: uuid.UUID,
    customer_list_id: uuid.UUID,
    user_id: uuid.UUID,
    batch_id: uuid.UUID,
    message_hint: str,
) -> None:
    async with AsyncSessionLocal() as db:
        try:
            camp_r = await db.execute(
                select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == user_id)
            )
            campaign = camp_r.scalar_one_or_none()
            if not campaign:
                return

            list_r = await db.execute(
                select(CustomerList).where(
                    CustomerList.id == customer_list_id, CustomerList.user_id == user_id
                )
            )
            clist = list_r.scalar_one_or_none()
            if not clist:
                await merge_campaign_delivery(
                    db,
                    campaign,
                    {
                        "status": "failed",
                        "last_error": "Danh sách khách không hợp lệ.",
                        "finished_at": datetime.now(timezone.utc).isoformat(),
                    },
                )
                return

            preview = (message_hint or "")[:200]

            cust_r = await db.execute(
                select(Customer).where(Customer.customer_list_id == customer_list_id)
            )
            customers = list(cust_r.scalars().all())

            for cust in customers:
                phone = (cust.phone or "").strip()
                if not phone:
                    token = secrets.token_urlsafe(24)
                    db.add(
                        CampaignExecutionLog(
                            batch_id=batch_id,
                            campaign_id=campaign_id,
                            customer_id=cust.id,
                            channel="sms_simulated",
                            status="skipped_no_phone",
                            tracking_token=token,
                            recipient_name=cust.full_name,
                        )
                    )
                    await db.commit()
                    continue

                token = secrets.token_urlsafe(24)
                db.add(
                    CampaignExecutionLog(
                        batch_id=batch_id,
                        campaign_id=campaign_id,
                        customer_id=cust.id,
                        channel="sms_simulated",
                        status="pending",
                        tracking_token=token,
                        recipient_phone=phone,
                        recipient_name=cust.full_name,
                    )
                )
                await db.commit()

            pending_r = await db.execute(
                select(CampaignExecutionLog).where(
                    CampaignExecutionLog.batch_id == batch_id,
                    CampaignExecutionLog.channel == "sms_simulated",
                    CampaignExecutionLog.status == "pending",
                )
            )
            for log in pending_r.scalars().all():
                await asyncio.sleep(random.uniform(0.08, 0.35))
                ok = random.random() < 0.82
                log.status = "sent" if ok else "failed"
                log.sent_at = datetime.now(timezone.utc) if ok else None
                if not ok:
                    log.error_message = "Mô phỏng: từ chối (demo)."
                await db.commit()

            await merge_campaign_delivery(
                db,
                campaign,
                {
                    "status": "completed",
                    "finished_at": datetime.now(timezone.utc).isoformat(),
                    "sms_preview": preview,
                },
            )
        except Exception as exc:
            logger.exception("run_sms_simulation")
            async with AsyncSessionLocal() as db2:
                r = await db2.execute(
                    select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == user_id)
                )
                c = r.scalar_one_or_none()
                if c:
                    await merge_campaign_delivery(
                        db2,
                        c,
                        {
                            "status": "failed",
                            "last_error": str(exc)[:500],
                            "finished_at": datetime.now(timezone.utc).isoformat(),
                        },
                    )
