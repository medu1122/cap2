import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from models.campaign import Campaign
from models.content_item import ContentItem


async def generate_summary(user_id: uuid.UUID, db: AsyncSession) -> str:
    user_campaign_ids = select(Campaign.id).where(Campaign.user_id == user_id)

    total_campaigns = (await db.execute(
        select(func.count()).select_from(Campaign).where(Campaign.user_id == user_id)
    )).scalar() or 0

    pending = (await db.execute(
        select(func.count()).select_from(ContentItem)
        .where(ContentItem.campaign_id.in_(user_campaign_ids), ContentItem.status == "pending_approval")
    )).scalar() or 0

    approved = (await db.execute(
        select(func.count()).select_from(ContentItem)
        .where(ContentItem.campaign_id.in_(user_campaign_ids), ContentItem.status == "approved")
    )).scalar() or 0

    channel_rows = (await db.execute(
        select(ContentItem.channel, func.count().label("cnt"))
        .where(ContentItem.campaign_id.in_(user_campaign_ids))
        .group_by(ContentItem.channel)
        .order_by(func.count().desc())
        .limit(1)
    )).first()
    top_channel = channel_rows.channel if channel_rows else None

    try:
        from core.config import settings
        from openai import AsyncOpenAI

        client = AsyncOpenAI(
            base_url=settings.QWEN_BASE_URL,
            api_key="ollama",
        )

        stats_context = (
            f"Tổng số chiến dịch: {total_campaigns}. "
            f"Nội dung đã duyệt: {approved}. "
            f"Nội dung chờ duyệt: {pending}. "
            f"Kênh được sử dụng nhiều nhất: {top_channel or 'chưa có'}."
        )

        response = await client.chat.completions.create(
            model=settings.QWEN_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "Bạn là trợ lý marketing AI. Hãy đưa ra nhận xét ngắn gọn (2-3 câu) bằng tiếng Việt dựa trên dữ liệu hoạt động marketing được cung cấp. Không dùng markdown.",
                },
                {
                    "role": "user",
                    "content": f"Dữ liệu: {stats_context}\n\nHãy nhận xét và đưa ra gợi ý ngắn gọn.",
                },
            ],
            temperature=0.5,
        )
        return response.choices[0].message.content.strip()
    except Exception:
        # Fallback to rule-based summary
        parts = []
        if total_campaigns == 0:
            return "Chưa có chiến dịch nào. Hãy tạo chiến dịch đầu tiên để bắt đầu."
        parts.append(f"Bạn có {total_campaigns} chiến dịch trong hệ thống.")
        if pending > 0:
            parts.append(f"Hiện có {pending} nội dung đang chờ bạn duyệt — hãy xem lại nhé.")
        if top_channel:
            parts.append(f"Kênh {top_channel.replace('_', ' ')} đang được sử dụng nhiều nhất.")
        return " ".join(parts)
