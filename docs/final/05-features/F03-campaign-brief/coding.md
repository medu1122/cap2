# F03 — Campaign Brief Intake: Coding Guide

---

## Backend

### `api/routers/campaigns.py`

```python
@router.post("", response_model=CampaignOut, status_code=201)
async def create_campaign(
    body: CampaignCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    campaign = Campaign(user_id=user.id, **body.model_dump(), status="pending_agent")
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)

    # Dispatch AI job as background task (non-blocking)
    background_tasks.add_task(agent_dispatcher.dispatch, str(campaign.id))

    return campaign


@router.get("", response_model=list[CampaignListItem])
async def list_campaigns(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Campaign, func.count(ContentItem.id).label("content_count"))
        .outerjoin(ContentItem, ContentItem.campaign_id == Campaign.id)
        .where(Campaign.user_id == user.id)
        .group_by(Campaign.id)
        .order_by(Campaign.created_at.desc())
    )
    return result.all()
```

### Campaign image storage (`api/routers/campaigns.py`)

```python
# Cloudinary first, local fallback
_CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
_CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
_CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
_CLOUDINARY_FOLDER = os.getenv("CLOUDINARY_FOLDER", "aimap/campaigns")

@router.post("/{campaign_id}/image/generate")
@router.post("/{campaign_id}/image/upload")
```

Behavior:
- Neu cau hinh du `CLOUDINARY_*`: anh duoc upload len Cloudinary va luu `secure_url` vao `campaign_plan_json.image_url`.
- Neu chua cau hinh Cloudinary: he thong fallback sang local storage (`STATIC_DIR` + `STATIC_BASE_URL`).
- Khong can doi schema DB, vi URL anh van duoc luu trong `campaign_plan_json`.

### `api/schemas/campaign.py`

```python
class CampaignCreate(BaseModel):
    campaign_name: str = Field(min_length=1, max_length=255)
    objective: str = Field(min_length=10)
    product_or_service: str = Field(min_length=5)
    target_audience: str | None = None
    offer_or_hook: str | None = None
    deadline: date
    channels: list[str] = Field(min_length=1)
    additional_notes: str | None = None

    @field_validator("deadline")
    @classmethod
    def deadline_must_be_future(cls, v):
        if v < date.today():
            raise ValueError("Deadline phải là ngày trong tương lai")
        return v

    @field_validator("channels")
    @classmethod
    def valid_channels(cls, v):
        allowed = {"facebook_post", "email", "video_script"}
        for ch in v:
            if ch not in allowed:
                raise ValueError(f"Channel không hợp lệ: {ch}")
        return v
```

### Environment variables can thiet cho image storage

```env
# Cloudinary (recommended for deploy)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=aimap/campaigns

# Local fallback (optional)
STATIC_DIR=api/static
STATIC_BASE_URL=http://localhost:8000/static/uploads
```

### `api/services/agent_dispatcher.py`

```python
async def dispatch(campaign_id: str):
    """Fire-and-forget: gọi agent service để chạy AI pipeline"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            await client.post(
                f"{settings.AGENT_SERVICE_URL}/run",
                json={"campaign_id": campaign_id}
            )
        except Exception as e:
            logger.error(f"Failed to dispatch campaign {campaign_id}: {e}")
            # Update campaign status to failed
            async with get_db_session() as db:
                await db.execute(
                    update(Campaign).where(Campaign.id == campaign_id)
                    .values(status="failed", error_message=str(e))
                )
                await db.commit()
```

---

## Frontend

### `web/app/(app)/campaigns/new/page.tsx`

```typescript
'use client';
const CHANNELS = [
  { value: 'facebook_post', label: 'Facebook Post' },
  { value: 'email', label: 'Email Marketing' },
  { value: 'video_script', label: 'Video Script' },
];

export default function NewCampaignPage() {
  const router = useRouter();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<CampaignCreate>();

  async function onSubmit(data: CampaignCreate) {
    const campaign = await apiClient.post<Campaign>('/campaigns', data);
    router.push(`/campaigns/${campaign.id}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      <Input label="Tên chiến dịch" {...register('campaign_name', { required: true })} />
      <Textarea label="Mục tiêu" placeholder="VD: Ra mắt menu mùa hè, tăng khách cuối tuần..."
               {...register('objective', { required: true, minLength: 10 })} />
      <Input label="Sản phẩm / Dịch vụ" {...register('product_or_service', { required: true })} />
      <Input label="Ưu đãi / Hook" placeholder="VD: Giảm 20% cho ly đầu tiên"
             {...register('offer_or_hook')} />
      <DatePicker label="Deadline" {...register('deadline', { required: true })} />

      <fieldset>
        <legend className="font-medium mb-2">Kênh nội dung</legend>
        {CHANNELS.map(ch => (
          <Checkbox key={ch.value} value={ch.value} label={ch.label}
                   {...register('channels')} />
        ))}
      </fieldset>

      <Button type="submit">Tạo Campaign & Chạy AI</Button>
    </form>
  );
}
```
