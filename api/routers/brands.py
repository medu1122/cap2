from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.brand import Brand
from schemas.brand import BrandUpsert, BrandOut

router = APIRouter()


@router.get("/me", response_model=BrandOut)
async def get_my_brand(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Brand).where(Brand.user_id == current_user.id))
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not configured yet")
    return brand


@router.put("/me", response_model=BrandOut)
async def upsert_my_brand(
    payload: BrandUpsert,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Brand).where(Brand.user_id == current_user.id))
    brand = result.scalar_one_or_none()

    if brand:
        for field, value in payload.model_dump().items():
            setattr(brand, field, value)
    else:
        brand = Brand(user_id=current_user.id, **payload.model_dump())
        db.add(brand)

    await db.commit()
    await db.refresh(brand)
    return brand
