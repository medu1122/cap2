import uuid
from datetime import datetime
from pydantic import BaseModel

class BrandUpsert(BaseModel):
    brand_name: str
    tagline: str | None = None
    brand_description: str
    tone_of_voice: str | None = "warm"  # legacy, không còn bắt buộc trong UI
    logo_url: str | None = None
    primary_color: str | None = None
    target_audience: str
    key_products: list[str] | None = None
    forbidden_words: list[str] | None = None  # legacy, không còn trong UI mới
    preferred_cta: str | None = None
    preferred_salutation: str | None = None
    sample_post: str | None = None
    contact_email: str | None = None
    phone: str | None = None
    address: str | None = None


class BrandOut(BrandUpsert):
    id: uuid.UUID
    user_id: uuid.UUID
    updated_at: datetime

    model_config = {"from_attributes": True}
