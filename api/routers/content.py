import asyncio
import io
import json
import os
import re
import uuid
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update as sql_update
from openai import AsyncOpenAI
from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.campaign import Campaign
from models.content_item import ContentItem
from models.brand import Brand
from models.campaign_tracking_link import CampaignTrackingLink
from schemas.campaign import ContentItemOut
from core.config import settings
from pydantic import BaseModel

_openai = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

_CLOUDINARY_ENABLED = bool(settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET)
_CLOUDINARY_FOLDER = settings.CLOUDINARY_FOLDER or "aimap/campaigns"
_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static", "uploads")
_STATIC_BASE_URL = settings.STATIC_BASE_URL or "http://localhost:8000/static/uploads"


async def _upload_to_cloudinary(content: bytes, public_id: str, filename: str) -> str:
    def _do() -> dict:
        file_obj = io.BytesIO(content)
        file_obj.name = filename
        import cloudinary.uploader  # type: ignore
        return cloudinary.uploader.upload(
            file_obj,
            folder=_CLOUDINARY_FOLDER,
            public_id=public_id,
            overwrite=True,
            resource_type="image",
        )
    result = await asyncio.to_thread(_do)
    return str(result.get("secure_url") or result.get("url"))


async def _save_local_image(content_id: str, content: bytes, extension: str) -> str:
    os.makedirs(_UPLOAD_DIR, exist_ok=True)
    filename = f"{content_id}_{int(datetime.now().timestamp())}.{extension}"
    filepath = os.path.join(_UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(content)
    return f"{_STATIC_BASE_URL}/{filename}"

_openai = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

_WRITER_SYSTEM = """Bạn là chuyên viên viết nội dung marketing cho doanh nghiệp nhỏ Việt Nam.
Hãy viết nội dung đúng phong cách thương hiệu, tự nhiên và thu hút.
Chỉ trả về JSON hợp lệ, không thêm giải thích."""

router = APIRouter()


class ContentUpdate(BaseModel):
    content_json: dict | None = None
    scheduled_date: date | None = None


class SaveEditPayload(BaseModel):
    content_json: dict


class RejectPayload(BaseModel):
    rejection_note: str


async def _get_content_item(content_id: uuid.UUID, user: User, db: AsyncSession) -> ContentItem:
    result = await db.execute(
        select(ContentItem)
        .join(Campaign, Campaign.id == ContentItem.campaign_id)
        .where(ContentItem.id == content_id, Campaign.user_id == user.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")
    return item


@router.get("", response_model=list[ContentItemOut])
async def list_content(
    campaign_id: uuid.UUID | None = None,
    channel: str | None = None,
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(ContentItem)
        .join(Campaign, Campaign.id == ContentItem.campaign_id)
        .where(Campaign.user_id == current_user.id)
        .order_by(ContentItem.created_at.desc())
    )
    if campaign_id:
        query = query.where(ContentItem.campaign_id == campaign_id)
    if channel:
        query = query.where(ContentItem.channel == channel)
    if status:
        query = query.where(ContentItem.status == status)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{content_id}", response_model=ContentItemOut)
async def get_content_item(
    content_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_content_item(content_id, current_user, db)


@router.patch("/{content_id}", response_model=ContentItemOut)
async def update_content(
    content_id: uuid.UUID,
    payload: ContentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await _get_content_item(content_id, current_user, db)
    if payload.content_json is not None:
        item.content_json = payload.content_json
        item.source = "user_edit"
        item.version += 1
    if payload.scheduled_date is not None:
        item.scheduled_date = payload.scheduled_date
    await db.commit()
    await db.refresh(item)
    return item


@router.post("/{content_id}/save-edit", response_model=ContentItemOut)
async def save_content_edit(
    content_id: uuid.UUID,
    payload: SaveEditPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lưu nội dung đã chỉnh sửa trực tiếp bởi user (inline editing)."""
    item = await _get_content_item(content_id, current_user, db)
    item.content_json = payload.content_json
    item.source = "user_edit"
    item.version += 1
    await db.commit()
    await db.refresh(item)
    return item


@router.patch("/{content_id}/approve", response_model=ContentItemOut)
async def approve_content(
    content_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await _get_content_item(content_id, current_user, db)
    if item.status not in {"pending_approval", "rejected"}:
        raise HTTPException(400, f"Không thể duyệt nội dung ở trạng thái {item.status}")
    item.status = "approved"
    await db.commit()
    await db.refresh(item)

    # Nếu tất cả nội dung của chiến dịch đã được duyệt → tự động cập nhật trạng thái chiến dịch
    pending_count_result = await db.execute(
        select(func.count()).where(
            ContentItem.campaign_id == item.campaign_id,
            ContentItem.status == "pending_approval",
        )
    )
    if pending_count_result.scalar() == 0:
        await db.execute(
            sql_update(Campaign)
            .where(Campaign.id == item.campaign_id)
            .values(status="approved")
        )
        await db.commit()

    return item


@router.patch("/{content_id}/reject", response_model=ContentItemOut)
async def reject_content(
    content_id: uuid.UUID,
    payload: RejectPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await _get_content_item(content_id, current_user, db)
    if item.status not in {"pending_approval", "approved"}:
        raise HTTPException(400, f"Không thể từ chối nội dung ở trạng thái {item.status}")
    item.status = "rejected"
    item.rejection_note = payload.rejection_note
    await db.commit()
    await db.refresh(item)
    return item


@router.patch("/{content_id}/schedule", response_model=ContentItemOut)
async def schedule_content(
    content_id: uuid.UUID,
    payload: ContentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await _get_content_item(content_id, current_user, db)
    if payload.scheduled_date:
        item.scheduled_date = payload.scheduled_date
    await db.commit()
    await db.refresh(item)
    return item


def _brand_context_block(brand: Brand | None) -> str:
    if not brand:
        return (
            "Brand: (chưa có hồ sơ)\nMô tả:\nGiọng văn:\nKhách hàng mục tiêu:\n"
            "Sản phẩm chính: chưa chỉ định\nTừ cấm: không có\nCTA ưa dùng: Liên hệ ngay\nCách xưng hô: bạn"
        )
    forbidden = ", ".join(brand.forbidden_words or []) or "không có"
    products = ", ".join(brand.key_products or []) or "chưa chỉ định"
    return (
        f"Brand: {brand.brand_name}\n"
        f"Mô tả: {brand.brand_description}\n"
        f"Giọng văn: {brand.tone_of_voice}\n"
        f"Khách hàng mục tiêu: {brand.target_audience or ''}\n"
        f"Sản phẩm chính: {products}\n"
        f"Từ cấm (KHÔNG được dùng): {forbidden}\n"
        f"CTA ưa dùng: {brand.preferred_cta or 'Liên hệ ngay'}\n"
        f"Cách xưng hô: {brand.preferred_salutation or 'bạn'}"
    )


def _get_tracking_links(db: AsyncSession, campaign_id: uuid.UUID, link_type: str | None = None) -> list[dict]:
    """Lấy danh sách tracking link của chiến dịch, có thể lọc theo link_type."""
    stmt = select(CampaignTrackingLink).where(CampaignTrackingLink.campaign_id == campaign_id)
    if link_type:
        stmt = stmt.where(CampaignTrackingLink.link_type == link_type)
    result = db.execute(stmt.order_by(CampaignTrackingLink.created_at.desc()))
    links = result.scalars().all()
    base = settings.TRACKING_PUBLIC_BASE_URL or "https://aimap.vn"
    return [
        {"name": link.name, "url": f"{base}/r/{link.short_code}"}
        for link in links
    ]


def _build_tracking_links_instruction(links: list[dict]) -> str:
    """Tạo instruction text về tracking links để nhúng vào prompt."""
    if not links:
        return ""
    lines = ["\nCác link theo dõi có sẵn (CHỈ dùng một trong các link bên dưới, gắn vào vị trí phù hợp):"]
    for link in links:
        lines.append(f'  - {link["name"]}: {link["url"]}')
    lines.append("Nếu có link theo dõi, gắn link vào trong cta_url / CTA text, KHÔNG dùng link gốc.")
    return "\n".join(lines)


def _parse_writer_json(raw: str) -> dict:
    for attempt in range(2):
        try:
            cleaned = re.sub(r"```json\s*|```\s*", "", raw).strip()
            return json.loads(cleaned)
        except json.JSONDecodeError:
            if attempt == 0:
                last_brace = raw.rfind("}")
                if last_brace != -1:
                    raw = raw[: last_brace + 1]
    raise ValueError("Không parse được JSON từ AI")


def _regenerate_user_prompt(
    channel: str,
    brand: Brand | None,
    plan: dict,
    deliverable: dict,
    campaign: Campaign,
    tracking_links: list[dict] | None = None,
) -> str:
    bc = _brand_context_block(brand)
    cs = plan.get("campaign_summary") or (
        f"{campaign.objective}\nSản phẩm/dịch vụ: {campaign.product_or_service}"
    )
    km = ", ".join(plan.get("key_messages") or [])
    cg = deliverable.get("content_goal") or campaign.objective
    th = deliverable.get("tone_hint") or (brand.tone_of_voice if brand else "") or "thân thiện"
    cta = deliverable.get("cta") or (brand.preferred_cta if brand else "") or "Liên hệ ngay"
    links_hint = _build_tracking_links_instruction(tracking_links or [])

    if channel == "facebook_post":
        has_links = bool(tracking_links)
        cta_url_schema = '"cta_url": "https://..." hoặc để trống chuỗi rỗng nếu chưa có link đích' if not has_links else '"cta_url": "https://..." (DÙNG tracking link bên trên, không tự tạo link)'
        return (
            f"<brand_context>\n{bc}\n</brand_context>\n\n"
            "Viết một bài đăng Facebook mới (khác nội dung cũ, đổi góc nhìn hoặc cách diễn đạt).\n\n"
            f"Tóm tắt chiến dịch: {cs}\n"
            f"Thông điệp chính: {km}\n"
            f"Mục tiêu nội dung: {cg}\n"
            f"Hướng giọng văn: {th}\n"
            f"Call-to-action: {cta}\n"
            f"{links_hint}\n\n"
            f'Trả về JSON:\n{{\n  "copy": "...",\n  "hashtags": ["...", "...", "...", "...", "..."],\n  {cta_url_schema}\n}}'
            "\nLưu ý: cta_url là link đích (website/landing page) mà người đọc sẽ được chuyển hướng đến khi nhấn vào link bên dưới bài đăng."
            "\nTrường fb_post_url: dán link bài đăng Facebook thực tế (VD: https://www.facebook.com/.../posts/...). Nếu chưa có bài đăng, để trống chuỗi rỗng."
        )
    if channel == "email":
        return (
            f"<brand_context>\n{bc}\n</brand_context>\n\n"
            "Viết một email marketing mới (khác bản cũ).\n\n"
            f"Tóm tắt chiến dịch: {cs}\n"
            f"Thông điệp chính: {km}\n"
            f"Mục tiêu nội dung: {cg}\n"
            f"Hướng giọng văn: {th}\n"
            f"Call-to-action: {cta}\n"
            f"{links_hint}\n\n"
            'Trả về JSON:\n{\n  "subject": "...",\n  "body": "..."\n}'
        )
    return (
        f"<brand_context>\n{bc}\n</brand_context>\n\n"
        "Bạn là một đạo diễn video chuyên nghiệp. Viết kịch bản sản xuất video ngắn (30–60 giây) hoàn chỉnh, KHÁC bản cũ.\n\n"
        f"Tóm tắt chiến dịch: {cs}\n"
        f"Thông điệp chính: {km}\n"
        f"Mục tiêu nội dung: {cg}\n"
        f"Hướng giọng văn: {th}\n"
        f"Call-to-action: {cta}\n"
        f"{links_hint}\n\n"
        'Trả về JSON với cấu trúc kịch bản sản xuất:\n{\n'
        '  "scenes": [\n'
        '    {\n'
        '      "sequence": 1,\n'
        '      "setting": "...",\n'
        '      "duration": "3s",\n'
        '      "camera_angle": "...",\n'
        '      "subject_action": "...",\n'
        '      "dialog_or_narration": "...",\n'
        '      "visual_note": "..."\n'
        '    }\n'
        '  ],\n'
        '  "voice_over": "...",\n'
        '  "background_music_suggestion": "...",\n'
        '  "call_to_action": "...",\n'
        '  "total_duration_estimate": "45s"\n'
        '}'
        "\nHướng dẫn:\n"
        "- scenes: mảng các cảnh, mỗi cảnh gồm: sequence (thứ tự), setting (địa điểm/bối cảnh), duration (thời lượng), camera_angle (góc máy: wide/tracking/close-up/POV...), subject_action (hành động của nhân vật), dialog_or_narration (lời thoại/voice-over), visual_note (ghi chú hình ảnh).\n"
        "- voice_over: lời bình toàn bộ video.\n"
        "- background_music_suggestion: gợi ý nhạc nền phù hợp.\n"
        "- call_to_action: câu kêu gọi hành động cuối video.\n"
        "- total_duration_estimate: tổng thời lượng ước tính."
    )


@router.post("/{content_id}/regenerate", response_model=ContentItemOut)
async def regenerate_content(
    content_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Tạo lại nội dung bằng GPT (cùng kênh), chỉ khi đang chờ duyệt."""
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(503, "Chưa cấu hình OPENAI_API_KEY")

    item = await _get_content_item(content_id, current_user, db)
    if item.status != "pending_approval":
        raise HTTPException(400, "Chỉ tạo lại khi nội dung đang chờ duyệt")

    camp_result = await db.execute(select(Campaign).where(Campaign.id == item.campaign_id))
    campaign = camp_result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Chiến dịch không tồn tại")

    brand_result = await db.execute(
        select(Brand)
        .where(Brand.user_id == current_user.id)
        .order_by(Brand.updated_at.desc())
        .limit(1)
    )
    brand = brand_result.scalar_one_or_none()

    plan = campaign.campaign_plan_json or {}
    deliverable: dict | None = None
    for d in plan.get("deliverables") or []:
        if d.get("channel") == item.channel:
            deliverable = d
            break
    if deliverable is None:
        deliverable = {
            "content_goal": campaign.objective,
            "tone_hint": (brand.tone_of_voice if brand else "") or "thân thiện",
            "cta": (brand.preferred_cta if brand else "") or "Liên hệ ngay",
        }

    # Lấy tracking links phù hợp với kênh (email_click cho email, facebook_post cho facebook)
    lt = "email_click" if item.channel == "email" else "facebook_post"
    links_result = await db.execute(
        select(CampaignTrackingLink)
        .where(
            CampaignTrackingLink.campaign_id == campaign.id,
            CampaignTrackingLink.link_type == lt,
        )
        .order_by(CampaignTrackingLink.created_at.desc())
    )
    tracking_links = [
        {"name": link.name, "url": f"{settings.TRACKING_PUBLIC_BASE_URL}/r/{link.short_code}"}
        for link in links_result.scalars().all()
    ]

    user_prompt = _regenerate_user_prompt(item.channel, brand, plan, deliverable, campaign, tracking_links)
    resp = await _openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": _WRITER_SYSTEM},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.85,
    )
    raw = (resp.choices[0].message.content or "").strip()
    try:
        new_json = _parse_writer_json(raw)
    except ValueError as exc:
        raise HTTPException(503, str(exc)) from exc

    item.content_json = new_json
    item.version += 1
    item.source = "agent"
    item.rejection_note = None
    await db.commit()
    await db.refresh(item)
    return item


# ── Content Image Upload ────────────────────────────────────────────────────────

async def _get_content_item_or_404(content_id: uuid.UUID, db: AsyncSession) -> ContentItem:
    result = await db.execute(select(ContentItem).where(ContentItem.id == content_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")
    return item


@router.post("/{content_id}/images", response_model=dict)
async def upload_content_image(
    content_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    """Upload 1 hoặc nhiều ảnh và gắn vào content item (email hoặc facebook_post).
    Mỗi file tối đa 10MB, chỉ chấp nhận image/*."""
    item = await _get_content_item_or_404(content_id, db)
    camp_result = await db.execute(
        select(Campaign).where(Campaign.id == item.campaign_id, Campaign.user_id == current_user.id)
    )
    campaign = camp_result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Content item not found")

    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(400, "Chỉ chấp nhận file ảnh (jpg, png, webp...)")

    allowed = {"jpg", "jpeg", "png", "webp", "gif"}
    raw_name = file.filename or "upload"
    ext = raw_name.rsplit(".", 1)[-1].lower() if "." in raw_name else "jpg"
    if ext not in allowed:
        raise HTTPException(400, f"Định dạng không hỗ trợ: .{ext}")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "File ảnh tối đa 10MB")

    public_id = f"{content_id}_{int(datetime.now().timestamp())}"
    if _CLOUDINARY_ENABLED:
        image_url = await _upload_to_cloudinary(content, public_id, f"{public_id}.{ext}")
    else:
        image_url = await _save_local_image(str(content_id), content, ext)

    existing_images: list[str] = list(item.content_json.get("images") or [])
    existing_images.append(image_url)
    item.content_json["images"] = existing_images
    await db.commit()

    return {"image_url": image_url, "images": existing_images, "storage": "cloudinary" if _CLOUDINARY_ENABLED else "local"}


@router.delete("/{content_id}/images", response_model=dict)
async def delete_content_image(
    content_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Xóa toàn bộ ảnh của một content item."""
    item = await _get_content_item_or_404(content_id, db)
    camp_result = await db.execute(
        select(Campaign).where(Campaign.id == item.campaign_id, Campaign.user_id == current_user.id)
    )
    if not camp_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Content item not found")

    item.content_json["images"] = []
    await db.commit()
    return {"images": []}
