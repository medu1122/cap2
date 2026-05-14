import uuid
import json
import asyncio
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from openai import AsyncOpenAI
import httpx
import os

from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.brand import Brand
from models.campaign_idea import CampaignIdea
from schemas.campaign_idea import (
    CampaignIdeaSuggestRequest,
    CampaignIdeaSuggestMoreRequest,
    CampaignIdeaSuggestResponse,
    CampaignIdeaSuggestionItem,
    CampaignIdeaCreateFromSuggestion,
    CampaignIdeaGenerateBriefRequest,
    BriefGenerated,
    CampaignIdeaUpdateRequest,
    CampaignIdeaOut,
    CampaignIdeaBuildEmailRequest,
    CampaignIdeaBuildPostRequest,
    CampaignIdeaBuildVideoRequest,
    CampaignIdeaBuildImagePromptRequest,
)

router = APIRouter()

# ── AI Clients ────────────────────────────────────────────────────────────────
_qwen = AsyncOpenAI(
    base_url=os.getenv("QWEN_BASE_URL", "http://171.238.156.10:11434/v1"),
    api_key="ollama",
)
_openai = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
QWEN_MODEL = os.getenv("QWEN_MODEL", "qwen2.5:14b")
QWEN_TIMEOUT = int(os.getenv("QWEN_TIMEOUT", "180"))

# ── Upcoming events for Vietnamese market ───────────────────────────────────
_UPCOMING_EVENTS = [
    {"name": "Tết Nguyên Đán", "month": 1, "theme": "mùa lễ hội, quà tặng, sum vầy, đoàn tụ"},
    {"name": "Valentine", "month": 2, "theme": "tình yêu, lãng mạn, quà tặng, cặp đôi"},
    {"name": "Women's Day", "month": 3, "theme": "phái đẹp, tôn vinh, ưu đãi nữ giới"},
    {"name": "Giỗ Tổ Hùng Vương", "month": 3, "theme": "lịch sử, yêu nước, truyền thống"},
    {"name": "Mùa hè", "month": 6, "theme": "du lịch, nghỉ mát, gia đình, trẻ em"},
    {"name": "Back to school", "month": 8, "theme": "học tập,文具, khóa học mới"},
    {"name": "Quốc khánh", "month": 9, "theme": "yêu nước, ưu đãi lớn, đặc biệt"},
    {"name": "Mid-Autumn", "month": 9, "theme": "bánh trung thu, sum vầy, trẻ em, trăng tròn"},
    {"name": "Halloween", "month": 10, "theme": "ma quái, trick-or-treat, ưu đãi, trẻ em"},
    {"name": "Black Friday", "month": 11, "theme": "giảm giá lớn, mua sắm, deal khủng"},
    {"name": "Christmas", "month": 12, "theme": "giáng sinh, quà tặng, ấm áp, gia đình"},
    {"name": "Year End Sale", "month": 12, "theme": "cuối năm, tổng kết, ưu đãi cuối năm"},
]

# Marketing patterns theo ngành
_INDUSTRY_PATTERNS = {
    "fnb": [  # Food & Beverage - quán ăn, cafe, trà sữa
        {"pattern": "Win-back khách cũ", "description": "Nhắm vào khách đã lâu không quay lại, gửi ưu đãi cá nhân hóa"},
        {"pattern": "Combo tiết kiệm", "description": "Gói combo giá tốt để tăng đơn hàng trung bình"},
        {"pattern": "Chương trình tích điểm", "description": "Khách thân thiết tích điểm đổi quà"},
        {"pattern": "Hậu mãi sau mua", "description": "Chăm sóc sau khi mua để tăng tái mua"},
        {"pattern": "Flash sale giờ vàng", "description": "Giảm giá giới hạn trong khung giờ nhất định"},
        {"pattern": "Mời bạn cùng thử", "description": "Khách giới thiệu bạn bè, cả hai đều được giảm"},
    ],
    "education": [  # Trung tâm dạy học, khóa học
        {"pattern": "Học thử miễn phí", "description": "Cho học viên tiềm năng trải nghiệm buổi học đầu tiên"},
        {"pattern": "Referral bạn bè", "description": "Học viên cũ giới thiệu bạn bè, cả hai đều được ưu đãi"},
        {"pattern": "Khóa học mới", "description": "Ra mắt khóa học mới với early-bird discount"},
        {"pattern": "Nâng cấp khóa", "description": "Upsell khóa cao hơn cho học viên đang học"},
        {"pattern": "Mùa thi", "description": "Chiến dịch cổ vũ, hỗ trợ học viên mùa thi"},
        {"pattern": "Tết sum họp - học cùng gia đình", "description": "Khóa học cho cả gia đình dịp lễ"},
    ],
    "spa_beauty": [  # Spa, làm đẹp, salon
        {"pattern": "Thẻ VIP", "description": "Thẻ thành viên vip với nhiều ưu đãi đặc biệt"},
        {"pattern": "Mùa cưới", "description": "Gói dịch vụ cho cô dâu chú rể, dịp cưới hỏi"},
        {"pattern": "Làm đẹp sau Tết", "description": "Chiến dịch đầu năm, lấy lại phong độ"},
        {"pattern": "Mùa hè skincare", "description": "Sản phẩm/dịch vụ chống nắng, dưỡng mùa hè"},
        {"pattern": "Geschenk (quà tặng)", "description": "Voucher làm đẹp - quà tặng dịp lễ"},
    ],
    "retail": [  # Bán lẻ, shop quần áo, điện thoại
        {"pattern": "New arrival", "description": "Ra mắt sản phẩm mới với ưu đãi đặc biệt"},
        {"pattern": "Flash sale", "description": "Giảm giá cực mạnh trong thời gian ngắn"},
        {"pattern": "Mua 2 giảm 1", "description": "Khuyến mãi mua nhiều giảm nhiều"},
        {"pattern": "Hậu mãi", "description": "Chương trình bảo hành, chăm sóc sau mua"},
        {"pattern": "Cross-sell", "description": "Bán kèm sản phẩm liên quan để tăng giỏ hàng"},
    ],
    "default": [  # Mặc định cho ngành khác
        {"pattern": "Win-back khách cũ", "description": "Nhắm vào khách đã lâu không tương tác"},
        {"pattern": "Loyalty program", "description": "Chương trình tích điểm cho khách thân thiết"},
        {"pattern": "Seasonal sale", "description": "Khuyến mãi theo mùa hoặc dịp lễ"},
        {"pattern": "Referral", "description": "Khách giới thiệu khách mới"},
        {"pattern": "Content marketing", "description": "Chiến dịch nội dung để tăng nhận diện"},
    ],
}


def _get_industry_patterns(business_type: str | None) -> str:
    """Lấy danh sách marketing patterns phù hợp với ngành."""
    patterns = _INDUSTRY_PATTERNS.get("default", [])
    if business_type:
        btype = business_type.lower()
        if any(k in btype for k in ["f&b", "food", "cafe", "coffee", "restaurant", "quán", "ăn", "trà sữa"]):
            patterns = _INDUSTRY_PATTERNS["fnb"]
        elif any(k in btype for k in ["edu", "học", "dạy", "trung tâm", "khoá", "khóa", "school", "course"]):
            patterns = _INDUSTRY_PATTERNS["education"]
        elif any(k in btype for k in ["spa", "beauty", "làm đẹp", "salon", "móng", "skincare"]):
            patterns = _INDUSTRY_PATTERNS["spa_beauty"]
        elif any(k in btype for k in ["retail", "shop", "bán lẻ", "cửa hàng", "store"]):
            patterns = _INDUSTRY_PATTERNS["retail"]

    lines = [f"- {p['pattern']}: {p['description']}" for p in patterns]
    return "\n".join(lines)


# ── Helpers ──────────────────────────────────────────────────────────────────
def _build_calendar_context() -> str:
    today = date.today()
    current_month = today.month
    current_year = today.year
    upcoming = [e for e in _UPCOMING_EVENTS if e["month"] >= current_month]
    upcoming += [e for e in _UPCOMING_EVENTS if e["month"] < current_month]
    upcoming = upcoming[:5]
    lines = [f"- {e['name']} (tháng {e['month']}): {e['theme']}" for e in upcoming]
    return "\n".join(lines)


async def _call_qwen(messages: list[dict], timeout: int | None = None) -> str:
    resp = await asyncio.wait_for(
        _qwen.chat.completions.create(
            model=QWEN_MODEL,
            messages=messages,
            temperature=0.8,
        ),
        timeout=timeout or QWEN_TIMEOUT,
    )
    raw = resp.choices[0].message.content.strip()
    return raw


async def _call_openai(messages: list[dict]) -> str:
    resp = await _openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.8,
    )
    return resp.choices[0].message.content.strip()


async def _call_openai_primary(messages: list[dict]) -> str:
    """OpenAI GPT-4o — model mạnh nhất cho video script chất lượng cao."""
    resp = await _openai.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        temperature=0.85,
    )
    return resp.choices[0].message.content.strip()


async def _call_ai_safe(messages: list[dict], timeout: int | None = None) -> str:
    try:
        return await _call_qwen(messages, timeout)
    except Exception:
        try:
            return await _call_openai(messages)
        except Exception as exc:
            raise HTTPException(503, f"AI service unavailable: {exc}")


def _parse_json_flexible(raw: str) -> dict | list:
    """Parse JSON flexibly - try extract from text if needed."""
    raw = raw.strip()

    # Remove markdown code blocks
    raw = raw.replace("```json", "").replace("```", "").strip()

    # Try direct parse first
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Try to find JSON in text (find first { or [ and last } or ])
    for start_char in ['{', '[']:
        start_idx = raw.find(start_char)
        if start_idx != -1:
            # Find matching closing bracket
            end_char = ']' if start_char == '[' else '}'
            depth = 0
            end_idx = -1
            for i, ch in enumerate(raw[start_idx:], start=start_idx):
                if ch == start_char:
                    depth += 1
                elif ch == end_char:
                    depth -= 1
                    if depth == 0:
                        end_idx = i + 1
                        break
            if end_idx > start_idx:
                try:
                    return json.loads(raw[start_idx:end_idx])
                except json.JSONDecodeError:
                    pass

    # Fallback: return empty structure based on context
    if '{' in raw:
        return {}
    return []


# ── Routes ───────────────────────────────────────────────────────────────────
@router.get("", response_model=list[CampaignIdeaOut])
async def list_campaign_ideas(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CampaignIdea)
        .where(CampaignIdea.user_id == current_user.id)
        .order_by(CampaignIdea.created_at.desc())
    )
    return result.scalars().all()


@router.post("/suggest", response_model=CampaignIdeaSuggestResponse)
async def suggest_campaign_ideas(
    payload: CampaignIdeaSuggestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI gợi ý 4 ý tưởng chiến dịch dựa trên thương hiệu + sự kiện + patterns ngành."""
    brand = None
    if payload.brand_id:
        result = await db.execute(
            select(Brand).where(
                Brand.id == payload.brand_id,
                Brand.user_id == current_user.id,
            )
        )
        brand = result.scalar_one_or_none()

    calendar_ctx = _build_calendar_context()

    brand_info = ""
    business_type = ""
    if brand:
        business_type = brand.tone_of_voice or ""
        brand_info = f"""Thương hiệu: {brand.brand_name}
Mô tả: {brand.brand_description}
Tone: {brand.tone_of_voice}
Khách hàng mục tiêu: {brand.target_audience}
Sản phẩm chính: {', '.join(brand.key_products or [])}
"""

    industry_patterns = _get_industry_patterns(business_type)

    prompt = f"""Bạn là chuyên gia marketing cho doanh nghiệp nhỏ Việt Nam.
Hãy gợi ý 4 ý tưởng chiến dịch marketing ĐA DẠNG, mỗi ý tưởng phải khác nhau về hướng tiếp cận.

Thương hiệu:
{brand_info}
Các dịp lễ/sự kiện sắp tới:
{calendar_ctx}

Các pattern marketing phổ biến theo ngành (chọn và áp dụng sáng tạo):
{industry_patterns}

YÊU CẦU QUAN TRỌNG:
1. Mỗi ý tưởng phải KHÁC NHAU: 1 cái theo dịp lễ, 1 cái win-back khách cũ, 1 cái referral/giới thiệu, 1 cái theo mùa/trend.
2. KHÔNG lặp lại cùng 1 hướng tiếp cận.
3. Mỗi ý tưởng PHẢI có đủ 8 trường: id, title, description, category, channels, hook, timing, customer_segment, urgency_level

Trả về JSON hợp lệ:
{{
  "suggestions": [
    {{
      "id": "1",
      "title": "Tên chiến dịch NGẮN (dưới 10 từ, hấp dẫn, có emoji nếu phù hợp)",
      "description": "Mô tả 2-3 câu: chiến dịch làm gì, tại sao hiệu quả, ai được lợi",
      "category": "retention|acquisition|awareness|upsell|seasonal",
      "channels": ["facebook_post", "email", "video_script"],
      "hook": "Ưu đãi chính cực kỳ hấp dẫn (1-2 dòng, gây FOMO)",
      "timing": "Tháng X - chạy Y tuần trước dịp. Lý do tại sao timing này tốt",
      "customer_segment": "Nhắm vào ai? (VD: khách cũ 3-6 tháng, khách VIP, khách chưa từng mua...)",
      "urgency_level": "high|medium|low"
    }}
  ]
}}

Chỉ trả về JSON, không thêm text khác."""

    messages = [{"role": "user", "content": prompt}]
    raw = await _call_ai_safe(messages, timeout=240)

    try:
        data = _parse_json_flexible(raw)
        suggestions = [
            CampaignIdeaSuggestionItem(**item)
            for item in (data.get("suggestions") or [])
        ]
        return CampaignIdeaSuggestResponse(suggestions=suggestions)
    except Exception:
        raise HTTPException(503, "AI trả về dữ liệu không hợp lệ. Vui lòng thử lại.")


class CampaignIdeaSuggestMoreRequest(BaseModel):
    brand_id: uuid.UUID | None = None
    existing_titles: list[str] = []


@router.post("/suggest-more", response_model=CampaignIdeaSuggestResponse)
async def suggest_more_campaign_ideas(
    payload: CampaignIdeaSuggestMoreRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI gợi ý thêm 4 ý tưởng khác biệt với các ý tưởng đã có."""
    brand = None
    if payload.brand_id:
        result = await db.execute(
            select(Brand).where(
                Brand.id == payload.brand_id,
                Brand.user_id == current_user.id,
            )
        )
        brand = result.scalar_one_or_none()

    calendar_ctx = _build_calendar_context()

    brand_info = ""
    business_type = ""
    if brand:
        business_type = brand.tone_of_voice or ""
        brand_info = f"""Thương hiệu: {brand.brand_name}
Mô tả: {brand.brand_description}
Tone: {brand.tone_of_voice}
Khách hàng mục tiêu: {brand.target_audience}
Sản phẩm chính: {', '.join(brand.key_products or [])}
"""

    industry_patterns = _get_industry_patterns(business_type)
    existing_list = "\n".join([f"- {t}" for t in payload.existing_titles])

    prompt = f"""Bạn là chuyên gia marketing cho doanh nghiệp nhỏ Việt Nam.
Hãy gợi ý thêm 4 ý tưởng chiến dịch marketing ĐA DẠNG và KHÁC BIỆT với các ý tưởng đã có.

Các ý tưởng đã có (KHÔNG gợi ý trùng):
{existing_list}

Thương hiệu:
{brand_info}
Các dịp lễ/sự kiện sắp tới:
{calendar_ctx}

Các pattern marketing phổ biến theo ngành (chọn và áp dụng sáng tạo):
{industry_patterns}

YÊU CẦU QUAN TRỌNG:
1. 4 ý tưởng phải hoàn toàn KHÁC với các ý tưởng đã có
2. Mỗi ý tưởng phải KHÁC NHAU về hướng tiếp cận
3. Ưu tiên các hướng chưa được dùng: khuyến mãi theo mùa, chương trình tích điểm, content viral, partnership/collab
4. Mỗi ý tưởng PHẢI có đủ 8 trường: id, title, description, category, channels, hook, timing, customer_segment, urgency_level

Trả về JSON hợp lệ:
{{
  "suggestions": [
    {{
      "id": "extra_1",
      "title": "Tên chiến dịch NGẮN (dưới 10 từ, hấp dẫn, có emoji nếu phù hợp)",
      "description": "Mô tả 2-3 câu: chiến dịch làm gì, tại sao hiệu quả, ai được lợi",
      "category": "retention|acquisition|awareness|upsell|seasonal",
      "channels": ["facebook_post", "email", "video_script"],
      "hook": "Ưu đãi chính cực kỳ hấp dẫn (1-2 dòng, gây FOMO)",
      "timing": "Tháng X - chạy Y tuần trước dịp. Lý do tại sao timing này tốt",
      "customer_segment": "Nhắm vào ai? (VD: khách cũ 3-6 tháng, khách VIP, khách chưa từng mua...)",
      "urgency_level": "high|medium|low"
    }}
  ]
}}

Chỉ trả về JSON, không thêm text khác."""

    messages = [{"role": "user", "content": prompt}]
    raw = await _call_ai_safe(messages, timeout=240)

    try:
        data = _parse_json_flexible(raw)
        suggestions = [
            CampaignIdeaSuggestionItem(**item)
            for item in (data.get("suggestions") or [])
        ]
        return CampaignIdeaSuggestResponse(suggestions=suggestions)
    except Exception:
        raise HTTPException(503, "AI trả về dữ liệu không hợp lệ. Vui lòng thử lại.")


@router.post("/generate-brief", response_model=BriefGenerated)
async def generate_campaign_brief(
    payload: CampaignIdeaGenerateBriefRequest,
    current_user: User = Depends(get_current_user),
):
    """AI tự viết đầy đủ brief cho chiến dịch dựa trên suggestion + user preferences."""
    target_label = {
        "existing": "khách cũ",
        "new": "khách mới",
        "all": "tất cả khách hàng",
    }.get(payload.target_customer, "tất cả khách hàng")

    budget_label = {
        "low": "ngân sách thấp (<5 triệu)",
        "medium": "ngân sách trung bình (5-20 triệu)",
        "high": "ngân sách cao (>20 triệu)",
        "unknown": "ngân sách linh hoạt",
    }.get(payload.budget, "ngân sách linh hoạt")

    duration_label = {
        "1_week": "1 tuần",
        "2_4_weeks": "2-4 tuần",
        "1_month": "cả tháng",
    }.get(payload.duration, "2-4 tuần")

    prompt = f"""Bạn là chuyên gia marketing viết brief cho chiến dịch marketing của doanh nghiệp nhỏ Việt Nam.
Dựa trên ý tưởng chiến dịch bên dưới và thông tin khách hàng, hãy viết 1 brief đầy đủ.

Ý TƯỞNG CHIẾN DỊCH:
- Tên: {payload.suggestion_title}
- Mô tả: {payload.suggestion_description}
- Category: {payload.suggestion_category}
- Thời gian gợi ý: {payload.suggestion_timing or "linh hoạt"}
- Đối tượng gợi ý: {payload.suggestion_segment or "tùy chọn"}
- Hook gợi ý: {payload.suggestion_hook or "tự đề xuất"}

THÔNG TIN KHÁCH HÀNG:
- Đối tượng mục tiêu: {target_label}
- Ngân sách: {budget_label}
- Thời gian chạy: {duration_label}

YÊU CẦU:
1. Viết title ngắn gọn, hấp dẫn (dưới 10 từ, có emoji nếu phù hợp)
2. Viết objective/mục tiêu rõ ràng, cụ thể (1-2 câu)
3. Viết hook/ưu đãi chính cực kỳ hấp dẫn, tạo FOMO (1-2 dòng)
4. Chọn 1-2 kênh phù hợp nhất với ngân sách và đối tượng

Trả về JSON hợp lệ:
{{
  "title": "Tên chiến dịch ngắn, hấp dẫn",
  "objective": "Mục tiêu rõ ràng, cụ thể",
  "hook": "Ưu đãi hấp dẫn, gây FOMO",
  "channels": ["email", "facebook_post"]
}}

Chỉ trả về JSON, không thêm text khác."""

    messages = [{"role": "user", "content": prompt}]
    raw = await _call_ai_safe(messages, timeout=120)

    try:
        data = _parse_json_flexible(raw)
        return BriefGenerated(**data)
    except Exception:
        raise HTTPException(503, "AI trả về dữ liệu không hợp lệ. Vui lòng thử lại.")


@router.post("", response_model=CampaignIdeaOut, status_code=201)
async def create_campaign_idea(
    payload: CampaignIdeaCreateFromSuggestion,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import logging; logging.info(f"[DEBUG] create_campaign_idea: {payload}")
    idea = CampaignIdea(
        user_id=current_user.id,
        title=payload.title,
        objective=payload.objective,
        channels=payload.channels,
        timing=payload.timing,
        customer_segment=payload.customer_segment,
        brand_id=payload.brand_id,
        status="draft",
    )
    db.add(idea)
    await db.commit()
    await db.refresh(idea)
    return idea


@router.get("/{idea_id}", response_model=CampaignIdeaOut)
async def get_campaign_idea(
    idea_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CampaignIdea).where(
            CampaignIdea.id == idea_id,
            CampaignIdea.user_id == current_user.id,
        )
    )
    idea = result.scalar_one_or_none()
    if not idea:
        raise HTTPException(404, "Không tìm thấy ý tưởng")
    return idea


@router.patch("/{idea_id}", response_model=CampaignIdeaOut)
async def update_campaign_idea(
    idea_id: uuid.UUID,
    payload: CampaignIdeaUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CampaignIdea).where(
            CampaignIdea.id == idea_id,
            CampaignIdea.user_id == current_user.id,
        )
    )
    idea = result.scalar_one_or_none()
    if not idea:
        raise HTTPException(404, "Không tìm thấy ý tưởng")

    for field, value in payload.model_dump(exclude_unset=True).items():
        if hasattr(idea, field):
            setattr(idea, field, value)

    await db.commit()
    await db.refresh(idea)
    return idea


@router.delete("/{idea_id}", status_code=204)
async def delete_campaign_idea(
    idea_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CampaignIdea).where(
            CampaignIdea.id == idea_id,
            CampaignIdea.user_id == current_user.id,
        )
    )
    idea = result.scalar_one_or_none()
    if not idea:
        raise HTTPException(404, "Không tìm thấy ý tưởng")
    await db.delete(idea)
    await db.commit()


# ── Build Content Blocks ──────────────────────────────────────────────────────
async def _get_brand_context(db: AsyncSession, idea: CampaignIdea) -> str:
    brand = None
    if idea.brand_id:
        result = await db.execute(
            select(Brand).where(Brand.id == idea.brand_id)
        )
        brand = result.scalar_one_or_none()
    if not brand:
        result = await db.execute(
            select(Brand)
            .where(Brand.user_id == idea.user_id)
            .order_by(Brand.updated_at.desc())
            .limit(1)
        )
        brand = result.scalar_one_or_none()

    if not brand:
        return ""

    return f"""
Thương hiệu: {brand.brand_name}
Mô tả: {brand.brand_description}
Tone giọng: {brand.tone_of_voice}
Khách hàng mục tiêu: {brand.target_audience}
Sản phẩm chính: {', '.join(brand.key_products or [])}
Từ cấm: {', '.join(brand.forbidden_words or [])}
Preferred CTA: {brand.preferred_cta or ''}
Preferred Salutation: {brand.preferred_salutation or 'bạn'}
"""


@router.post("/{idea_id}/build/email")
async def build_email_content(
    idea_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CampaignIdea).where(
            CampaignIdea.id == idea_id,
            CampaignIdea.user_id == current_user.id,
        )
    )
    idea = result.scalar_one_or_none()
    if not idea:
        raise HTTPException(404, "Không tìm thấy ý tưởng")

    brand_ctx = await _get_brand_context(db, idea)

    prompt = f"""Bạn là chuyên gia email marketing cho doanh nghiệp nhỏ Việt Nam.
Viết nội dung email cá nhân hóa, chuyên nghiệp cho chiến dịch sau:

Thương hiệu:
{brand_ctx}

Chiến dịch:
- Tên: {idea.title}
- Mục tiêu: {idea.objective or ''}
- Hook/Ưu đãi: {idea.hook or ''}

YÊU CẦU NGHIÊM NGẶT:
1. Subject line: DƯỚI 50 ký tự, gây tò mò hoặc FOMO, KHÔNG spam-like
2. Body email: 150-250 từ, có cấu trúc:
   - Personal greeting (chào bằng tên nếu có)
   - Mở đầu gây chú ý (hook)
   - Body 2-3 đoạn ngắn, mỗi đoạn 1-3 câu
   - Điểm nhấn ưu đãi
   - CTA rõ ràng
   - Signature/closing
3. Giọng văn: Thân thiện, chuyên nghiệp, phù hợp brand tone
4. KHÔNG viết all caps, KHÔNG quá nhiều exclamation marks
5. CTA phải hấp dẫn, kèm urgency

Trả về JSON hợp lệ (KHÔNG thêm text khác ngoài JSON):
{{
  "subject": "Tiêu đề email dưới 50 ký tự, gây tò mò",
  "preheader": "Dòng preview 80-100 ký tự, hấp dẫn",
  "body": "Nội dung email đầy đủ với greeting, body paragraphs, closing. Độ dài 150-250 từ. Dùng \\n\\n để phân cách đoạn.",
  "cta_text": "Nút kêu gọi hành động (5-10 từ, gây FOMO)",
  "cta_url": "#"
}}

CHỈ trả về JSON, không thêm text khác."""

    messages = [{"role": "user", "content": prompt}]
    raw = await _call_ai_safe(messages, timeout=240)
    data = _parse_json_flexible(raw)

    idea.email_content = data
    idea.updated_at = idea.updated_at
    await db.commit()
    await db.refresh(idea)
    return {"email_content": data}


@router.post("/{idea_id}/build/post")
async def build_post_content(
    idea_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CampaignIdea).where(
            CampaignIdea.id == idea_id,
            CampaignIdea.user_id == current_user.id,
        )
    )
    idea = result.scalar_one_or_none()
    if not idea:
        raise HTTPException(404, "Không tìm thấy ý tưởng")

    brand_ctx = await _get_brand_context(db, idea)

    prompt = f"""Bạn là chuyên gia content marketing cho doanh nghiệp nhỏ Việt Nam.
Viết nội dung bài đăng Facebook hấp dẫn, viral-friendly cho chiến dịch sau:

Thương hiệu:
{brand_ctx}

Chiến dịch:
- Tên: {idea.title}
- Mục tiêu: {idea.objective or ''}
- Hook/Ưu đãi: {idea.hook or ''}

YÊU CẦU NGHIÊM NGẶT:
1. Hook (dòng 1): GÂY CHÚ Ý NGAY từ giây đầu - dùng shock nhẹ, câu hỏi, hoặc số liệu
2. Body: 3-5 đoạn ngắn, mỗi đoạn 1-2 câu, có xuống dòng. Tạo engagement.
3. Giọng văn: Tự nhiên như đang chat với bạn bè, KHÔNG formal quá
4. Hashtags: 3-5 tags phù hợp, có cả brand tag và topic tag
5. KHÔNG copy-paste template, phải ĐỘC ĐÁO và SÁNG TẠO
6. Độ dài: 100-200 từ

Trả về JSON hợp lệ (KHÔNG thêm text khác ngoài JSON):
{{
  "copy": "Nội dung bài đăng đầy đủ. Dùng \\n\\n để xuống dòng giữa các đoạn. Dòng 1 phải gây CHÚ Ý NGAY.",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"],
  "image_style": "Mô tả phong cách ảnh đi kèm (1-2 câu, rõ ràng)"
}}

CHỈ trả về JSON, không thêm text khác."""

    messages = [{"role": "user", "content": prompt}]
    raw = await _call_ai_safe(messages, timeout=240)
    try:
        data = _parse_json_flexible(raw)
    except Exception:
        raise HTTPException(503, "AI trả về dữ liệu không hợp lệ. Vui lòng thử lại.")

    idea.post_content = data
    await db.commit()
    await db.refresh(idea)
    return {"post_content": data}


@router.post("/{idea_id}/build/video")
async def build_video_script(
    idea_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate video script using GPT-4o (OpenAI) for maximum quality."""
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(503, "Chưa cấu hình OPENAI_API_KEY")

    result = await db.execute(
        select(CampaignIdea).where(
            CampaignIdea.id == idea_id,
            CampaignIdea.user_id == current_user.id,
        )
    )
    idea = result.scalar_one_or_none()
    if not idea:
        raise HTTPException(404, "Không tìm thấy ý tưởng")

    brand_ctx = await _get_brand_context(db, idea)

    system_prompt = """Bạn là chuyên gia sản xuất video ngắn (TikTok/Reels/YouTube Shorts) hàng đầu Việt Nam.
Bạn hiểu sâu về xu hướng viral, tâm lý khán giả Gen Z/Millennial, cơ chế thuật toán và các format video phổ biến.
Nhiệm vụ của bạn: viết kịch bản video KHỦNG, có sức lan tỏa cao, phù hợp 100% với thương hiệu."""

    user_prompt = f"""Viết kịch bản video ngắn (TikTok/Reels) CHẤT LƯỢNG CAO cho chiến dịch dưới đây.

═ ĐỊNH HƯỚNG CHIẾN DỊCH ═
Thương hiệu:
{brand_ctx}

Chiến dịch:
- Tên: {idea.title}
- Mục tiêu: {idea.objective or ''}
- Hook/Ưu đãi chính: {idea.hook or ''}

═ YÊU CẦU NGHIÊM NGẶT ═

1. HOOK (0-5 giây) — ĐÂY LÀ YẾU TỐ QUYẾT ĐỊNH VIRAL
   Viết 3 hook khác nhau (để người dùng chọn):
   - Hook A (Sốc/Tò mò): Dùng số liệu gây sốc, câu hỏi để người xem tò mò, hoặc thị phạm trực tiếp
   - Hook B (Cảm xúc): Kể câu chuyện cá nhân, trải nghiệm thật, khiến người xem đồng cảm
   - Hook C (Giá trị/Giáo dục): Chia sẻ mẹo hữu ích, giải đáp thắc mắc phổ biến

2. CẤU TRÚC SCENE-BY-SCENE
   Mỗi scene phải có đủ:
   - Thời lượng (giây)
   - Mô tả hình ảnh trên màn hình (visual)
   - Lời thoại/dialogue chính
   - Text overlay (dòng chữ hiển thị trên video)
   - Gợi ý B-roll (hình ảnh/video bổ sung)
   - Âm thanh/nhạc nền gợi ý
   - Mục đích của scene này (tạo tò mò / tạo tin tưởng / tạo urgency / chuyển đổi)

   Cấu trúc khuyến nghị:
   - Scene 1 (0-5s): HOOK — gây sốc hoặc tò mò
   - Scene 2 (5-15s): VẤN ĐỀ — đặt câu hỏi, tạo đau đầu
   - Scene 3 (15-30s): GIẢI PHÁP — giới thiệu sản phẩm/dịch vụ một cách tự nhiên
   - Scene 4 (30-45s): CHỨNG MINH — testimonial, kết quả thực, số liệu
   - Scene 5 (45-55s): CTA — kêu gọi hành động kèm urgency

3. TRENDING TACTICS
   Áp dụng ít nhất 2 trong số các format đang viral:
   - "POV" (điểm nhìn ngôi thứ nhất)
   - "Day in my life" / "Quay ra trước + sau"
   - "Thử thách" (challenge)
   - "So sánh before/after"
   - "Giải thích ngắn gọn" (explainer)
   - "Storytime" (kể chuyện có plot twist)
   - "Unboxing/review"

4. TEXT OVERLAY STRATEGY
   - Tối đa 6-8 từ mỗi dòng
   - Font lớn, dễ đọc trên mobile
   - Dùng emoji để tăng engagement
   - Highlight từ khóa quan trọng

5. CTA (CALL-TO-ACTION)
   Viết 2 phiên bản:
   - Soft CTA: Gợi ý, không ép buộc (VD: "Nếu bạn thấy hữu ích, hãy...")
   - Hard CTA: Rõ ràng, kèm urgency (VD: "Đừng bỏ lỡ — ưu đãi chỉ còn...")

6. HASHTAG STRATEGY
   Gợi ý 10 hashtag phân theo tier:
   - 2 hashtag thương hiệu (brand)
   - 3 hashtag ngành/lĩnh vực
   - 3 hashtag trending (có thể không liên quan trực tiếp nhưng đang hot)
   - 2 hashtag niche/community

7. MUSIC/SOUND SUGGESTION
   - Gợi ý mood nhạc (happy, dramatic, mystery, upbeat...)
   - Gợi ý loại âm thanh phù hợp với từng scene

8. CAPTION (CHÚ THÍCH)
   Viết caption hoàn chỉnh để đăng kèm video:
   - Dòng 1: Hook caption (gây tò mò, dẫn dắt)
   - Dòng 2-3: Mô tả ngắn nội dung
   - Dòng cuối: CTA nhẹ + hashtag

═ ĐỊNH DẠNG TRẢ VỀ ═
CHỈ trả về JSON hợp lệ, KHÔNG thêm text giải thích:

{{
  "duration": "30-60 giây",
  "recommended_format": "TikTok|Reels|YouTube Shorts hoặc kết hợp",
  "trending_format_used": "Tên format trending được áp dụng (VD: POV, Before/After...)",

  "hooks": {{
    "A_type": "Sốc/Tò mò",
    "A_text": "...",
    "A_text_overlay": "...",
    "A_why_viral": "Giải thích ngắn tại sao hook này hiệu quả",
    "B_type": "Cảm xúc",
    "B_text": "...",
    "B_text_overlay": "...",
    "B_why_viral": "...",
    "C_type": "Giá trị/Giáo dục",
    "C_text": "...",
    "C_text_overlay": "...",
    "C_why_viral": "..."
  }},

  "scenes": [
    {{
      "scene_number": 1,
      "time_range": "0-5 giây",
      "visual": "Mô tả hình ảnh trên màn hình (camera angle, đối tượng, bối cảnh)",
      "dialogue": "Lời thoại/dialogue chính (nếu có)",
      "text_overlay": "Dòng chữ hiển thị trên video",
      "broll_suggestion": "Gợi ý B-roll cần quay hoặc lấy",
      "sound": "Âm thanh/nhạc cho scene này",
      "purpose": "hook|tạo đau đầu|giới thiệu|chứng minh|cta",
      "transition": "Cách chuyển sang scene tiếp theo"
    }}
  ],

  "cta": {{
    "soft": "...",
    "soft_text_overlay": "...",
    "hard": "...",
    "hard_text_overlay": "..."
  }},

  "caption": "Caption hoàn chỉnh để đăng kèm video",

  "hashtags": {{
    "brand": ["#...", "#..."],
    "industry": ["#...", "#...", "#..."],
    "trending": ["#...", "#...", "#..."],
    "niche": ["#...", "#..."]
  }},

  "music_mood": "Mô tả mood nhạc phù hợp (VD: upbeat, dramatic, calming...)",
  "music_suggestion": "Loại âm thanh/nhạc gợi ý",
  "production_tips": "2-3 mẹo quay để video đẹp và chuyên nghiệp hơn"
}}

CHỉ trả về JSON. Không thêm ```markdown, không thêm dòng giải thích."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    try:
        raw = await _call_openai_primary(messages)
    except Exception as exc:
        raise HTTPException(503, f"Không thể gọi OpenAI: {exc}")

    try:
        data = _parse_json_flexible(raw)
    except Exception:
        raise HTTPException(503, "AI trả về dữ liệu không hợp lệ. Vui lòng thử lại.")

    idea.video_script = data
    await db.commit()
    await db.refresh(idea)
    return {"video_script": data}


@router.post("/{idea_id}/build/image-prompt")
async def build_image_prompt(
    idea_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CampaignIdea).where(
            CampaignIdea.id == idea_id,
            CampaignIdea.user_id == current_user.id,
        )
    )
    idea = result.scalar_one_or_none()
    if not idea:
        raise HTTPException(404, "Không tìm thấy ý tưởng")

    brand_ctx = await _get_brand_context(db, idea)

    prompt = f"""Bạn là chuyên gia prompt engineering cho DALL-E/Midjourney.
Tạo prompt để tạo hình ảnh chiến dịch marketing:

Thương hiệu:
{brand_ctx}

Chiến dịch:
- Tên: {idea.title}
- Mục tiêu: {idea.objective or ''}

Trả về JSON hợp lệ:
{{
  "prompt": "Prompt chi tiết bằng tiếng Anh, mô tả rõ subject, setting, lighting, style, composition. Không có text/typography trong ảnh. Phong cách: photorealistic campaign visual."
}}

Chỉ trả về JSON, không thêm text khác."""

    messages = [{"role": "user", "content": prompt}]
    raw = await _call_ai_safe(messages, timeout=180)
    try:
        data = _parse_json_flexible(raw)
    except Exception:
        raise HTTPException(503, "AI trả về dữ liệu không hợp lệ. Vui lòng thử lại.")

    prompt_text = data.get("prompt", "") if isinstance(data, dict) else str(data)
    idea.image_prompt = prompt_text
    await db.commit()
    await db.refresh(idea)
    return {"image_prompt": prompt_text}
