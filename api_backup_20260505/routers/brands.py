import os
import asyncio
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from openai import AsyncOpenAI
from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.brand import Brand
from models.campaign import Campaign
from schemas.brand import BrandUpsert, BrandOut

router = APIRouter()

_qwen_client = AsyncOpenAI(
    base_url=os.getenv("QWEN_BASE_URL", "http://171.238.156.10:11434/v1"),
    api_key="ollama",
)
_openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
QWEN_MODEL  = os.getenv("QWEN_MODEL", "qwen2.5:14b")
QWEN_TIMEOUT = int(os.getenv("QWEN_TIMEOUT", "180"))


class DescribeRequest(BaseModel):
    brand_name: str


async def _generate_description(brand_name: str) -> str:
    prompt = (
        f"Hãy viết một đoạn mô tả ngắn (2-3 câu, tiếng Việt) cho thương hiệu tên '{brand_name}'. "
        "Mô tả nên nêu rõ loại hình kinh doanh, giá trị nổi bật và đối tượng khách hàng chính. "
        "Chỉ trả về đoạn văn mô tả, không thêm bất kỳ nội dung nào khác."
    )
    messages = [{"role": "user", "content": prompt}]

    # Thử Qwen trước, fallback sang OpenAI nếu lỗi/timeout
    try:
        resp = await asyncio.wait_for(
            _qwen_client.chat.completions.create(
                model=QWEN_MODEL,
                messages=messages,
                temperature=0.7,
            ),
            timeout=QWEN_TIMEOUT,
        )
        return resp.choices[0].message.content.strip()
    except Exception:
        resp = await _openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
        )
        return resp.choices[0].message.content.strip()


@router.post("/ai-describe")
async def ai_describe_brand(
    payload: DescribeRequest,
    current_user: User = Depends(get_current_user),
):
    if not payload.brand_name.strip():
        raise HTTPException(400, "Tên thương hiệu không được để trống")
    description = await _generate_description(payload.brand_name.strip())
    return {"description": description}


@router.get("", response_model=list[BrandOut])
async def list_my_brands(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Brand)
        .where(Brand.user_id == current_user.id)
        .order_by(Brand.updated_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=BrandOut, status_code=201)
async def create_brand(
    payload: BrandUpsert,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    brand = Brand(user_id=current_user.id, **payload.model_dump())
    db.add(brand)
    await db.commit()
    await db.refresh(brand)
    return brand


@router.get("/id/{brand_id}", response_model=BrandOut)
async def get_brand(
    brand_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Brand).where(
            Brand.id == brand_id,
            Brand.user_id == current_user.id,
        )
    )
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    return brand


@router.put("/id/{brand_id}", response_model=BrandOut)
async def update_brand(
    brand_id: uuid.UUID,
    payload: BrandUpsert,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Brand).where(
            Brand.id == brand_id,
            Brand.user_id == current_user.id,
        )
    )
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    for field, value in payload.model_dump().items():
        setattr(brand, field, value)

    await db.commit()
    await db.refresh(brand)
    return brand


@router.get("/id/{brand_id}/campaigns/count", response_model=dict)
async def count_brand_campaigns(
    brand_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Đếm số chiến dịch liên quan đến brand trước khi xóa."""
    result = await db.execute(
        select(Brand).where(
            Brand.id == brand_id,
            Brand.user_id == current_user.id,
        )
    )
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    campaign_result = await db.execute(
        select(Campaign).where(Campaign.brand_id == brand_id)
    )
    campaigns = campaign_result.scalars().all()
    return {"count": len(campaigns), "campaigns": [{"id": str(c.id), "name": c.campaign_name} for c in campaigns]}


@router.delete("/id/{brand_id}", status_code=204)
async def delete_brand(
    brand_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Xóa brand và tất cả chiến dịch liên quan."""
    result = await db.execute(
        select(Brand).where(
            Brand.id == brand_id,
            Brand.user_id == current_user.id,
        )
    )
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    # Xóa tất cả campaign liên quan đến brand
    campaign_result = await db.execute(
        select(Campaign).where(Campaign.brand_id == brand_id)
    )
    campaigns = campaign_result.scalars().all()
    for campaign in campaigns:
        await db.delete(campaign)

    await db.delete(brand)
    await db.commit()


@router.get("/me", response_model=BrandOut)
async def get_latest_brand(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Brand)
        .where(Brand.user_id == current_user.id)
        .order_by(Brand.updated_at.desc())
        .limit(1)
    )
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not configured yet")
    return brand


@router.put("/me", response_model=BrandOut)
async def upsert_latest_brand(
    payload: BrandUpsert,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Brand)
        .where(Brand.user_id == current_user.id)
        .order_by(Brand.updated_at.desc())
        .limit(1)
    )
    brand = result.scalar_one_or_none()

    if not brand:
        brand = Brand(user_id=current_user.id, **payload.model_dump())
        db.add(brand)
    else:
        for field, value in payload.model_dump().items():
            setattr(brand, field, value)

    await db.commit()
    await db.refresh(brand)
    return brand
