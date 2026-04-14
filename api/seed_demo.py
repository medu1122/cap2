"""
Demo seed script. Run inside Docker:
  docker compose exec api python seed_demo.py
"""
import asyncio
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from core.config import settings
from core.security import hash_password
from models import User, Brand, Campaign, ContentItem, AgentRunLog
from core.database import Base
import uuid

engine = create_async_engine(settings.DATABASE_URL)
Session = async_sessionmaker(engine, expire_on_commit=False)


async def seed():
    async with Session() as db:
        # User
        user = User(
            id=uuid.uuid4(),
            email="demo@cafebohho.vn",
            hashed_pw=hash_password("demo1234"),
            full_name="Chủ quán Demo",
            role="owner",
        )
        db.add(user)
        await db.flush()

        # Brand Vault
        brand = Brand(
            user_id=user.id,
            brand_name="Cafe Bờ Hồ",
            tagline="Ngụm cà phê, ngàn ký ức",
            brand_description="Quán cà phê nhỏ ở trung tâm TP.HCM, phục vụ cà phê truyền thống Việt Nam. Mở cửa từ 7 giờ sáng.",
            tone_of_voice="warm",
            target_audience="Học sinh sinh viên 18-25 tuổi và dân văn phòng trẻ",
            key_products=["Cà phê sữa đá", "Bạc xỉu", "Trà đào", "Cà phê trứng"],
            forbidden_words=["rẻ", "bình dân", "giảm sốc"],
            preferred_cta="Ghé thăm ngay",
            preferred_salutation="bạn",
            primary_color="#7B5B3A",
        )
        db.add(brand)
        await db.flush()

        # Campaign 1 — approved
        c1 = Campaign(
            user_id=user.id,
            campaign_name="Khai trương menu mùa hè",
            objective="Ra mắt các thức uống mới mùa hè",
            product_or_service="Trà đào cam sả và Cà phê đá xay",
            deadline=date.today() + timedelta(days=7),
            channels=["facebook_post", "email"],
            status="approved",
        )
        db.add(c1)
        await db.flush()

        log1 = AgentRunLog(
            campaign_id=c1.id, agent_name="strategist", step_order=1,
            model_used="gpt-4o-mini", model_provider="openai",
            duration_ms=2340, input_tokens=412, output_tokens=280, status="success",
        )
        log2 = AgentRunLog(
            campaign_id=c1.id, agent_name="writer", step_order=2, channel="facebook_post",
            model_used="qwen2.5:7b", model_provider="qwen",
            duration_ms=4120, input_tokens=540, output_tokens=320, status="success",
        )
        log3 = AgentRunLog(
            campaign_id=c1.id, agent_name="critic", step_order=3, channel="facebook_post",
            model_used="gpt-4o-mini", model_provider="openai",
            duration_ms=3210, input_tokens=620, output_tokens=290, status="success",
        )
        db.add_all([log1, log2, log3])
        await db.flush()

        ci1 = ContentItem(
            campaign_id=c1.id, channel="facebook_post", version=1, status="approved",
            content_json={
                "copy": "Mùa hè đã đến rồi bạn ơi! ☀️\n\nCafe Bờ Hồ vừa ra mắt menu mùa hè với hai thức uống mới:\n🍑 Trà đào cam sả — Vị thanh mát, thơm nhẹ\n☕ Cà phê đá xay — Đậm vị, mịn màng\n\nGhé thăm ngay để trải nghiệm nhé!",
                "hashtags": ["CafeBờHồ", "MenuMùaHè", "CàPhê", "TràĐào", "Refreshing"]
            },
            scheduled_date=date.today() + timedelta(days=3),
            agent_run_id=log3.id,
        )
        ci2 = ContentItem(
            campaign_id=c1.id, channel="email", version=1, status="approved",
            content_json={
                "subject": "Menu mùa hè mới đã có mặt tại Cafe Bờ Hồ!",
                "body": "Xin chào bạn,\n\nMùa hè năm nay, Cafe Bờ Hồ mang đến cho bạn những thức uống mới thật mát lành...\n\nGhé thăm chúng mình nhé!\n\nTrân trọng,\nCafe Bờ Hồ"
            },
            scheduled_date=date.today() + timedelta(days=4),
        )
        db.add_all([ci1, ci2])

        # Campaign 2 — pending approval
        c2 = Campaign(
            user_id=user.id,
            campaign_name="Khuyến mãi cuối tuần",
            objective="Tăng lượng khách vào cuối tuần",
            product_or_service="Toàn bộ thức uống trong menu",
            offer_or_hook="Giảm 15% cho tất cả đơn từ 2 ly",
            deadline=date.today() + timedelta(days=10),
            channels=["facebook_post", "email", "video_script"],
            status="pending_approval",
        )
        db.add(c2)
        await db.flush()

        db.add_all([
            ContentItem(campaign_id=c2.id, channel="facebook_post", status="pending_approval",
                content_json={"copy": "Cuối tuần thư giãn tại Cafe Bờ Hồ!\n\nGiảm 15% khi order từ 2 ly bất kỳ. Mang theo bạn bè và tận hưởng nhé!", "hashtags": ["CafeBờHồ", "Weekend", "Giảmgiá"]},
                scheduled_date=date.today() + timedelta(days=8)),
            ContentItem(campaign_id=c2.id, channel="email", status="pending_approval",
                content_json={"subject": "Cuối tuần này - Giảm 15% tại Cafe Bờ Hồ", "body": "Xin chào bạn,\n\nCuối tuần này hãy cùng chúng tôi..."},
                scheduled_date=date.today() + timedelta(days=9)),
            ContentItem(campaign_id=c2.id, channel="video_script", status="pending_approval",
                content_json={"hook": "Bạn đã có kế hoạch cho cuối tuần chưa?", "body": "Cafe Bờ Hồ đang có chương trình giảm 15%...", "cta": "Ghé thăm ngay nhé!", "duration_estimate": "30s"},
                scheduled_date=date.today() + timedelta(days=10)),
        ])

        await db.commit()
        print("✓ Seed data created successfully")
        print(f"  Login: demo@cafebohho.vn / demo1234")

asyncio.run(seed())
