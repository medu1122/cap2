# F05 — Content Storage & Versioning: Coding Guide

---

## Backend

### `api/routers/content.py` — Edit creates new version

```python
@router.put("/{content_id}", response_model=ContentItemOut)
async def edit_content(
    content_id: UUID,
    body: ContentEdit,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Get current item
    result = await db.execute(
        select(ContentItem).join(Campaign)
        .where(ContentItem.id == content_id, Campaign.user_id == user.id)
    )
    current = result.scalar_one_or_none()
    if not current:
        raise HTTPException(404)

    # Create new version (do NOT modify existing)
    new_version = ContentItem(
        campaign_id=current.campaign_id,
        channel=current.channel,
        version=current.version + 1,
        status="pending_approval",
        content_json=body.content_json,
        source="user_edit",
        scheduled_date=current.scheduled_date
    )
    db.add(new_version)
    await db.commit()
    await db.refresh(new_version)
    return new_version


@router.get("/{content_id}/versions", response_model=list[ContentItemOut])
async def get_versions(
    content_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Get campaign_id + channel from the given content_id
    current = await db.get(ContentItem, content_id)
    if not current:
        raise HTTPException(404)

    result = await db.execute(
        select(ContentItem)
        .join(Campaign)
        .where(
            ContentItem.campaign_id == current.campaign_id,
            ContentItem.channel == current.channel,
            Campaign.user_id == user.id
        )
        .order_by(ContentItem.version)
    )
    return result.scalars().all()
```

### `api/schemas/campaign.py` — ContentItem schemas

```python
class ContentItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
    id: UUID
    campaign_id: UUID
    channel: str
    version: int
    status: str
    content_json: dict
    source: str
    rejection_note: str | None
    scheduled_date: date | None
    created_at: datetime

class ContentEdit(BaseModel):
    content_json: dict  # Validated against channel-specific schema in service layer
```

---

## Internal API (for Agent Service)

```python
@router.post("/internal/content", response_model=ContentItemOut)
async def save_content(body: InternalContentCreate, db: AsyncSession = Depends(get_db)):
    """Called by Agent Service to save generated content"""
    item = ContentItem(
        campaign_id=body.campaign_id,
        channel=body.channel,
        version=1,
        status="pending_approval",
        content_json=body.content_json,
        source="agent",
        agent_run_id=body.agent_run_id,
        scheduled_date=body.scheduled_date
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item
```
