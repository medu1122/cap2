import uuid
import os
import asyncio
import json
import io
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from openai import AsyncOpenAI
import httpx
try:
    import cloudinary
    import cloudinary.uploader
except Exception:  # pragma: no cover - optional dependency
    cloudinary = None
from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.brand import Brand
from models.campaign import Campaign
from models.content_item import ContentItem
from models.agent_run_log import AgentRunLog
from schemas.campaign import CampaignCreate, CampaignListItem, CampaignDetail, ContentItemOut, AgentLogOut, VALID_CHANNELS
from services.agent_dispatcher import dispatch_campaign

router = APIRouter()

# Image storage paths — images saved locally and served via /static
_STATIC_DIR = os.getenv("STATIC_DIR", os.path.join(os.path.dirname(__file__), "..", "static"))
_UPLOAD_DIR = os.path.join(_STATIC_DIR, "uploads")
_STATIC_BASE_URL = os.getenv("STATIC_BASE_URL", "http://localhost:8000/static/uploads")
_CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
_CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
_CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
_CLOUDINARY_FOLDER = os.getenv("CLOUDINARY_FOLDER", "aimap/campaigns")

_CLOUDINARY_ENABLED = bool(
    cloudinary
    and _CLOUDINARY_CLOUD_NAME
    and _CLOUDINARY_API_KEY
    and _CLOUDINARY_API_SECRET
)

if _CLOUDINARY_ENABLED:
    cloudinary.config(
        cloud_name=_CLOUDINARY_CLOUD_NAME,
        api_key=_CLOUDINARY_API_KEY,
        api_secret=_CLOUDINARY_API_SECRET,
        secure=True,
    )

_qwen = AsyncOpenAI(
    base_url=os.getenv("QWEN_BASE_URL", "http://171.238.156.10:11434/v1"),
    api_key="ollama",
)
_openai = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
QWEN_MODEL   = os.getenv("QWEN_MODEL", "qwen2.5:7b")
QWEN_TIMEOUT = int(os.getenv("QWEN_TIMEOUT", "15"))


class SuggestRequest(BaseModel):
    campaign_name: str


@router.post("/ai-suggest")
async def ai_suggest_campaign(
    payload: SuggestRequest,
    current_user: User = Depends(get_current_user),
):
    if not payload.campaign_name.strip():
        raise HTTPException(400, "Tên chiến dịch không được để trống")

    prompt = f"""Bạn là chuyên gia marketing cho doanh nghiệp nhỏ Việt Nam.
Dựa vào tên chiến dịch sau, hãy đề xuất thông tin chi tiết cho bản kế hoạch chiến dịch.

Tên chiến dịch: "{payload.campaign_name.strip()}"

Trả về JSON hợp lệ với đúng các trường sau (tiếng Việt):
{{
  "objective": "Mục tiêu chiến dịch, 1-2 câu ngắn gọn",
  "product_or_service": "Sản phẩm hoặc dịch vụ chính của chiến dịch",
  "target_audience": "Đối tượng khách hàng mục tiêu, mô tả cụ thể",
  "offer_or_hook": "Ưu đãi hoặc điểm thu hút chính để kéo khách hàng",
  "additional_notes": "Gợi ý thêm về góc độ truyền thông hoặc thông điệp nổi bật"
}}

Chỉ trả về JSON, không thêm bất kỳ nội dung nào khác."""

    messages = [{"role": "user", "content": prompt}]

    async def _call_qwen() -> dict:
        resp = await asyncio.wait_for(
            _qwen.chat.completions.create(
                model=QWEN_MODEL,
                messages=messages,
                temperature=0.7,
            ),
            timeout=QWEN_TIMEOUT,
        )
        raw = resp.choices[0].message.content.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        return json.loads(raw)

    async def _call_openai() -> dict:
        resp = await _openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
            response_format={"type": "json_object"},
        )
        return json.loads(resp.choices[0].message.content)

    try:
        data = await _call_qwen()
    except Exception:
        try:
            data = await _call_openai()
        except Exception:
            raise HTTPException(503, "Không thể kết nối AI. Vui lòng thử lại.")

    return data


@router.get("", response_model=list[CampaignListItem])
async def list_campaigns(
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Campaign).where(Campaign.user_id == current_user.id).order_by(Campaign.created_at.desc())
    if status:
        query = query.where(Campaign.status == status)
    result = await db.execute(query)
    campaigns = result.scalars().all()

    items = []
    for c in campaigns:
        content_result = await db.execute(
            select(func.count()).where(ContentItem.campaign_id == c.id)
        )
        pending_result = await db.execute(
            select(func.count()).where(ContentItem.campaign_id == c.id, ContentItem.status == "pending_approval")
        )
        item = CampaignListItem.model_validate(c)
        item.content_count = content_result.scalar() or 0
        item.pending_count = pending_result.scalar() or 0
        items.append(item)
    return items


@router.post("", status_code=201)
async def create_campaign(
    payload: CampaignCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not payload.channels:
        raise HTTPException(400, "Phải chọn ít nhất 1 kênh nội dung")
    invalid = [c for c in payload.channels if c not in VALID_CHANNELS]
    if invalid:
        raise HTTPException(400, f"Kênh không hợp lệ: {invalid}")
    if payload.deadline < date.today():
        raise HTTPException(400, "Ngày kết thúc không được là ngày trong quá khứ")

    campaign = Campaign(user_id=current_user.id, **payload.model_dump())
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return {"id": str(campaign.id), "campaign_name": campaign.campaign_name, "status": campaign.status, "created_at": campaign.created_at}


@router.get("/{campaign_id}", response_model=CampaignDetail)
async def get_campaign(
    campaign_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    content_result = await db.execute(
        select(ContentItem).where(ContentItem.campaign_id == campaign_id).order_by(ContentItem.channel, ContentItem.version.desc())
    )
    log_result = await db.execute(
        select(AgentRunLog).where(AgentRunLog.campaign_id == campaign_id).order_by(AgentRunLog.step_order)
    )

    content_items = [ContentItemOut.model_validate(ci) for ci in content_result.scalars().all()]
    agent_logs = [AgentLogOut.model_validate(log) for log in log_result.scalars().all()]

    detail = CampaignDetail.model_validate({
        "id": campaign.id,
        "campaign_name": campaign.campaign_name,
        "objective": campaign.objective,
        "product_or_service": campaign.product_or_service,
        "target_audience": campaign.target_audience,
        "offer_or_hook": campaign.offer_or_hook,
        "deadline": campaign.deadline,
        "channels": campaign.channels,
        "additional_notes": campaign.additional_notes,
        "status": campaign.status,
        "error_message": campaign.error_message,
        "campaign_plan_json": campaign.campaign_plan_json,
        "created_at": campaign.created_at,
        "content_items": content_items,
        "agent_logs": agent_logs,
    })
    return detail


@router.post("/{campaign_id}/run", status_code=202)
async def run_campaign(
    campaign_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status == "running":
        raise HTTPException(status_code=409, detail="Campaign is already running")

    brand_result = await db.execute(
        select(Brand)
        .where(Brand.user_id == current_user.id)
        .order_by(Brand.updated_at.desc())
        .limit(1)
    )
    brand = brand_result.scalar_one_or_none()
    if not brand:
        raise HTTPException(status_code=400, detail="Brand Vault not configured. Please set up your brand first.")

    campaign.status = "running"
    await db.commit()

    background_tasks.add_task(dispatch_campaign, str(campaign_id))
    return {"message": "Orchestration started", "campaign_id": str(campaign_id), "status": "running"}


@router.delete("/{campaign_id}", status_code=204)
async def delete_campaign(
    campaign_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    await db.delete(campaign)
    await db.commit()


# ── Image helpers ──────────────────────────────────────────────────────────────

async def _save_campaign_image_url(campaign: Campaign, url: str, db: AsyncSession) -> None:
    """Persist image_url into campaign_plan_json without losing existing keys."""
    current = dict(campaign.campaign_plan_json or {})
    current["image_url"] = url
    campaign.campaign_plan_json = current
    await db.commit()


async def _upload_to_cloudinary(content: bytes, public_id: str, filename: str) -> str:
    if not _CLOUDINARY_ENABLED:
        raise RuntimeError("Cloudinary is not configured")

    def _do_upload() -> dict:
        file_obj = io.BytesIO(content)
        file_obj.name = filename
        return cloudinary.uploader.upload(  # type: ignore[union-attr]
            file_obj,
            folder=_CLOUDINARY_FOLDER,
            public_id=public_id,
            overwrite=True,
            resource_type="image",
        )

    result = await asyncio.to_thread(_do_upload)
    secure_url = result.get("secure_url") or result.get("url")
    if not secure_url:
        raise RuntimeError("Cloudinary upload did not return URL")
    return str(secure_url)


async def _save_local_image(campaign_id: uuid.UUID, content: bytes, extension: str) -> str:
    os.makedirs(_UPLOAD_DIR, exist_ok=True)
    filename = f"{campaign_id}_{int(datetime.now().timestamp())}.{extension}"
    filepath = os.path.join(_UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(content)
    return f"{_STATIC_BASE_URL}/{filename}"


class GenerateImagePayload(BaseModel):
    prompt: str | None = None


@router.post("/{campaign_id}/image/generate")
async def generate_campaign_image(
    campaign_id: uuid.UUID,
    payload: GenerateImagePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate campaign image and persist on Cloudinary/local storage."""
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Không tìm thấy chiến dịch")

    plan = campaign.campaign_plan_json or {}
    prompt = (
        payload.prompt
        or plan.get("image_prompt_final")
        or plan.get("image_prompt_qwen")
        or (
            f"Professional marketing image for a Vietnamese small business. "
            f"Campaign: {campaign.campaign_name}. "
            f"Product: {campaign.product_or_service}. "
            f"Clean, modern, vibrant style."
        )
    )

    try:
        response = await _openai.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            n=1,
        )
        temp_url: str = response.data[0].url  # type: ignore
    except Exception as exc:
        raise HTTPException(503, f"Không thể tạo ảnh: {exc}")

    async with httpx.AsyncClient(timeout=30) as client:
        img_resp = await client.get(temp_url)
        image_bytes = img_resp.content

    public_id = f"{campaign_id}_{int(datetime.now().timestamp())}"
    if _CLOUDINARY_ENABLED:
        image_url = await _upload_to_cloudinary(
            image_bytes,
            public_id=public_id,
            filename=f"{public_id}.png",
        )
    else:
        image_url = await _save_local_image(campaign_id, image_bytes, "png")

    await _save_campaign_image_url(campaign, image_url, db)
    storage = "cloudinary" if _CLOUDINARY_ENABLED else "local"
    return {"image_url": image_url, "prompt_used": prompt, "storage": storage}


@router.post("/{campaign_id}/image/upload")
async def upload_campaign_image(
    campaign_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload an image from the user's device and attach it to the campaign."""
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(400, "Chỉ chấp nhận file ảnh (jpg, png, webp...)")

    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == current_user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Không tìm thấy chiến dịch")

    raw_name = file.filename or "upload"
    ext = raw_name.rsplit(".", 1)[-1].lower() if "." in raw_name else "jpg"
    allowed = {"jpg", "jpeg", "png", "webp", "gif"}
    if ext not in allowed:
        raise HTTPException(400, f"Định dạng không hỗ trợ: .{ext}")

    content = await file.read()
    public_id = f"{campaign_id}_{int(datetime.now().timestamp())}"
    if _CLOUDINARY_ENABLED:
        image_url = await _upload_to_cloudinary(
            content,
            public_id=public_id,
            filename=f"{public_id}.{ext}",
        )
    else:
        image_url = await _save_local_image(campaign_id, content, ext)

    await _save_campaign_image_url(campaign, image_url, db)
    storage = "cloudinary" if _CLOUDINARY_ENABLED else "local"
    return {"image_url": image_url, "storage": storage}
