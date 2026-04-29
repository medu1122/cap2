import uuid
import json
import asyncio
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
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
    CampaignIdeaSuggestResponse,
    CampaignIdeaSuggestionItem,
    CampaignIdeaCreateFromSuggestion,
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
    {"name": "Tết Nguyên Đán", "month": 1, "theme": "mùa lễ hội, quà tặng, sum vầy"},
    {"name": "Valentine", "month": 2, "theme": "tình yêu, lãng mạn, quà tặng"},
    {"name": "Quốc khánh", "month": 9, "theme": "yêu nước, khuyến mãi lớn"},
    {"name": "Halloween", "month": 10, "theme": "ma quái, ưu đãi, trick-or-treat"},
    {"name": "Black Friday", "month": 11, "theme": "giảm giá lớn, mua sắm"},
    {"name": "Christmas", "month": 12, "theme": "giáng sinh, quà tặng, ấm áp"},
    {"name": "Mùa hè", "month": 6, "theme": "du lịch, nghỉ mát, khuyến mãi"},
    {"name": "Back to school", "month": 9, "theme": "回到学校,文具,培训"},
    {"name": " Women's Day", "month": 3, "theme": "ưu đãi cho phái nữ, tôn vinh"},
    {"name": "Mid-Autumn Festival", "month": 9, "theme": "bánh trung thu, sum vầy"},
]


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


async def _call_ai_safe(messages: list[dict], timeout: int | None = None) -> str:
    try:
        return await _call_qwen(messages, timeout)
    except Exception:
        try:
            return await _call_openai(messages)
        except Exception as exc:
            raise HTTPException(503, f"AI service unavailable: {exc}")


def _parse_json_flexible(raw: str) -> dict | list:
    raw = raw.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    return json.loads(raw)


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
    """AI gợi ý 3-4 ý tưởng chiến dịch dựa trên thương hiệu + sự kiện."""
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
    if brand:
        brand_info = f"""
Thương hiệu: {brand.brand_name}
Mô tả: {brand.brand_description}
Tone: {brand.tone_of_voice}
Khách hàng mục tiêu: {brand.target_audience}
Sản phẩm chính: {', '.join(brand.key_products or [])}
Ngành: {brand.tone_of_voice}
"""

    prompt = f"""Bạn là chuyên gia marketing cho doanh nghiệp nhỏ Việt Nam.
Dựa vào thông tin thương hiệu bên dưới và các sự kiện sắp tới, hãy gợi ý 3-4 ý tưởng chiến dịch marketing.

{brand_info}
Các sự kiện sắp tới:
{calendar_ctx}

Trả về JSON hợp lệ với đúng format:
{{
  "suggestions": [
    {{
      "id": "1",
      "title": "Tên chiến dịch (ngắn gọn, hấp dẫn)",
      "description": "Mô tả 2-3 câu về chiến dịch, giải thích tại sao hiệu quả",
      "category": "retention|acquisition|awareness|upsell",
      "channels": ["facebook_post", "email", "video_script"],
      "hook": "Ưu đãi chính hoặc điểm thu hút (1 dòng)"
    }}
  ]
}}

Quy tắc:
- Mỗi gợi ý nên khác nhau về hướng tiếp cận
- Ưu tiên các chiến dịch Retention (giữ chân khách cũ) vì hiệu quả cao nhất
- Chỉ trả về JSON, không thêm text khác"""

    messages = [{"role": "user", "content": prompt}]
    raw = await _call_ai_safe(messages, timeout=200)

    try:
        data = _parse_json_flexible(raw)
        suggestions = [
            CampaignIdeaSuggestionItem(**item)
            for item in (data.get("suggestions") or [])
        ]
        return CampaignIdeaSuggestResponse(suggestions=suggestions)
    except Exception:
        raise HTTPException(503, "AI trả về dữ liệu không hợp lệ. Vui lòng thử lại.")


@router.post("", response_model=CampaignIdeaOut, status_code=201)
async def create_campaign_idea(
    payload: CampaignIdeaCreateFromSuggestion,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    idea = CampaignIdea(
        user_id=current_user.id,
        title=payload.title,
        objective=payload.objective,
        channels=payload.channels,
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
Viết nội dung email cá nhân hóa cho chiến dịch sau:

Thương hiệu:
{brand_ctx}

Chiến dịch:
- Tên: {idea.title}
- Mục tiêu: {idea.objective or ''}
- Ưu đãi: {idea.objective or ''}

Trả về JSON hợp lệ:
{{
  "subject": "Tiêu đề email (dưới 60 ký tự, gây tò mò)",
  "preheader": "Dòng preview (dưới 100 ký tự)",
  "body": "Nội dung email HTML-friendly, có personal greeting, body paragraphs, closing. Giọng văn phù hợp với tone của thương hiệu. Độ dài vừa phải (150-300 từ).",
  "cta_text": "Nút kêu gọi hành động (5-10 từ)",
  "cta_url": "#"
}}

Chỉ trả về JSON, không thêm text khác."""

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
Viết nội dung bài đăng Facebook cho chiến dịch sau:

Thương hiệu:
{brand_ctx}

Chiến dịch:
- Tên: {idea.title}
- Mục tiêu: {idea.objective or ''}

Trả về JSON hợp lệ:
{{
  "hook": "Dòng đầu gây chú ý ngay (1-2 câu, gây tò mò hoặc shock nhẹ)",
  "body": "Nội dung bài đăng (3-5 đoạn ngắn, mỗi đoạn 1-2 câu, có xuống dòng). Giọng văn phù hợp brand tone.",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"],
  "image_style": "Mô tả phong cách ảnh đi kèm (1-2 câu)"
}}

Chỉ trả về JSON, không thêm text khác."""

    messages = [{"role": "user", "content": prompt}]
    raw = await _call_ai_safe(messages, timeout=240)
    data = _parse_json_flexible(raw)

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

    prompt = f"""Bạn là chuyên gia sản xuất video ngắn cho TikTok/短视频.
Viết kịch bản video TikTok cho chiến dịch sau:

Thương hiệu:
{brand_ctx}

Chiến dịch:
- Tên: {idea.title}
- Mục tiêu: {idea.objective or ''}

Trả về JSON hợp lệ:
{{
  "duration": "30s",
  "hook_seconds": "3-5 giây đầu tiên: mô tả cách gây chú ý ngay từ giây đầu",
  "scenes": [
    {{
      "seconds": "0-5s",
      "description": "Mô tả hành động / cảnh quay",
      "text_overlay": "Text hiển thị trên màn hình (nếu có)",
      "audio_suggestion": "Gợi ý âm thanh/nhạc nền"
    }},
    {{
      "seconds": "5-15s",
      "description": "Mô tả hành động / cảnh quay",
      "text_overlay": "Text hiển thị",
      "audio_suggestion": ""
    }},
    {{
      "seconds": "15-30s",
      "description": "CTA cuối video",
      "text_overlay": "Text kêu gọi hành động",
      "audio_suggestion": ""
    }}
  ]
}}

Chỉ trả về JSON, không thêm text khác."""

    messages = [{"role": "user", "content": prompt}]
    raw = await _call_ai_safe(messages, timeout=240)
    data = _parse_json_flexible(raw)

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
    data = _parse_json_flexible(raw)

    prompt_text = data.get("prompt", "") if isinstance(data, dict) else str(data)
    idea.image_prompt = prompt_text
    await db.commit()
    await db.refresh(idea)
    return {"image_prompt": prompt_text}
