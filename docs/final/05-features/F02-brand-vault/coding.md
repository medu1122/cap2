# F02 — Brand Vault: Coding Guide

---

## Technical Approach

- **Upsert pattern**: GET /brands/me trả 404 nếu chưa có → frontend tự biết form trống. PUT /brands/me tự detect INSERT vs UPDATE.
- **PostgreSQL ARRAY**: `key_products` và `forbidden_words` lưu dạng TEXT[], không cần bảng phụ vì là danh sách đơn giản.
- **1:1 constraint**: UNIQUE constraint trên `brands.user_id` đảm bảo 1 user chỉ có 1 brand vault.

---

## Backend

### `api/models/brand.py`

```python
from sqlalchemy import Column, String, Text, ARRAY
from sqlalchemy.dialects.postgresql import UUID

class Brand(Base):
    __tablename__ = "brands"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    brand_name = Column(String(255), nullable=False)
    tagline = Column(String(512))
    brand_description = Column(Text, nullable=False)
    tone_of_voice = Column(String(50), nullable=False)
    logo_url = Column(String(1024))
    primary_color = Column(String(7))
    target_audience = Column(Text, nullable=False)
    key_products = Column(ARRAY(Text))
    forbidden_words = Column(ARRAY(Text))
    preferred_cta = Column(String(255))
    preferred_salutation = Column(String(50))
    sample_post = Column(Text)
    created_at = Column(TIMESTAMPTZ, default=func.now())
    updated_at = Column(TIMESTAMPTZ, default=func.now(), onupdate=func.now())
```

### `api/schemas/brand.py`

```python
from pydantic import BaseModel, field_validator
import re

class BrandUpsert(BaseModel):
    brand_name: str = Field(min_length=1, max_length=255)
    tagline: str | None = None
    brand_description: str = Field(min_length=20)
    tone_of_voice: str = Field(pattern="^(playful|professional|warm|bold|informative)$")
    logo_url: str | None = None
    primary_color: str | None = None
    target_audience: str = Field(min_length=10)
    key_products: list[str] = []
    forbidden_words: list[str] = []
    preferred_cta: str | None = None
    preferred_salutation: str | None = None
    sample_post: str | None = None

    @field_validator("primary_color")
    @classmethod
    def validate_hex_color(cls, v):
        if v and not re.match(r'^#[0-9A-Fa-f]{6}$', v):
            raise ValueError("primary_color phải có dạng #RRGGBB")
        return v

class BrandOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    brand_name: str
    tagline: str | None
    brand_description: str
    tone_of_voice: str
    logo_url: str | None
    primary_color: str | None
    target_audience: str
    key_products: list[str]
    forbidden_words: list[str]
    preferred_cta: str | None
    preferred_salutation: str | None
    sample_post: str | None
    created_at: datetime
    updated_at: datetime
```

### `api/routers/brands.py`

```python
@router.get("/me", response_model=BrandOut)
async def get_my_brand(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Brand).where(Brand.user_id == user.id))
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(404, "Brand Vault chưa được thiết lập")
    return brand


@router.put("/me", response_model=BrandOut)
async def upsert_my_brand(
    body: BrandUpsert,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Brand).where(Brand.user_id == user.id))
    brand = result.scalar_one_or_none()

    if brand:
        # Update existing
        for field, value in body.model_dump(exclude_none=False).items():
            setattr(brand, field, value)
        brand.updated_at = datetime.utcnow()
    else:
        # Create new
        brand = Brand(user_id=user.id, **body.model_dump())
        db.add(brand)

    await db.commit()
    await db.refresh(brand)
    return brand
```

---

## Frontend

### `web/app/(app)/brand-vault/page.tsx`

```typescript
'use client';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

export default function BrandVaultPage() {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<Brand>('/brands/me')
      .then(setBrand)
      .catch(() => setBrand(null))  // 404 → empty form
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(formData: BrandUpsert) {
    const updated = await apiClient.put<Brand>('/brands/me', formData);
    setBrand(updated);
    toast.success('Brand Vault đã lưu thành công');
  }

  if (loading) return <Skeleton />;
  return <BrandVaultForm initialData={brand} onSave={handleSave} />;
}
```

### Tag Input Component (for key_products, forbidden_words)

```typescript
// TagInput: nhập text + Enter để thêm, click X để xóa
function TagInput({ value, onChange, placeholder }: TagInputProps) {
  const [input, setInput] = useState('');

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && input.trim()) {
      onChange([...value, input.trim()]);
      setInput('');
      e.preventDefault();
    }
  }

  return (
    <div className="flex flex-wrap gap-1 border rounded p-2">
      {value.map(tag => (
        <span key={tag} className="bg-gray-100 px-2 py-0.5 rounded text-sm flex items-center gap-1">
          {tag}
          <button onClick={() => onChange(value.filter(t => t !== tag))}>×</button>
        </span>
      ))}
      <input value={input} onChange={e => setInput(e.target.value)}
             onKeyDown={handleKeyDown} placeholder={placeholder}
             className="outline-none flex-1 min-w-24 text-sm" />
    </div>
  );
}
```

---

## Agent Context Builder

### `agent/orchestrator.py` — Brand context injection

```python
def build_brand_context(brand: dict) -> str:
    """Build <brand_context> block để inject vào mọi agent prompt"""
    forbidden = ', '.join(brand.get('forbidden_words', []) or [])
    products = ', '.join(brand.get('key_products', []) or [])

    return f"""<brand_context>
Thương hiệu: {brand['brand_name']}
Mô tả: {brand['brand_description']}
Giọng văn: {brand['tone_of_voice']}
Khách hàng mục tiêu: {brand['target_audience']}
Sản phẩm chính: {products or 'Không có'}
Từ ngữ KHÔNG được dùng: {forbidden or 'Không có'}
CTA ưa thích: {brand.get('preferred_cta', 'Liên hệ ngay')}
Cách xưng hô: {brand.get('preferred_salutation', 'bạn')}
{f"Bài mẫu tham khảo: {brand['sample_post']}" if brand.get('sample_post') else ''}
</brand_context>"""
```
