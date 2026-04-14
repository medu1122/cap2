# F06 — Human Approval Flow: Coding Guide

---

## Backend

```python
@router.patch("/{content_id}/approve", response_model=ContentItemOut)
async def approve_content(
    content_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    item = await get_user_content(content_id, user.id, db)
    if item.status not in ("pending_approval", "rejected"):
        raise HTTPException(400, "Chỉ có thể approve content đang pending hoặc bị rejected")

    item.status = "approved"
    item.updated_at = datetime.utcnow()

    history = ApprovalHistory(content_item_id=item.id, user_id=user.id,
                              action="approved", content_version=item.version)
    db.add(history)

    # Check if all campaign content items are approved
    campaign_items = await db.execute(
        select(ContentItem).where(ContentItem.campaign_id == item.campaign_id)
    )
    all_items = campaign_items.scalars().all()
    if all(i.status == "approved" for i in all_items):
        await db.execute(
            update(Campaign).where(Campaign.id == item.campaign_id)
            .values(status="approved")
        )
    await db.commit()
    return item


@router.patch("/{content_id}/reject", response_model=ContentItemOut)
async def reject_content(
    content_id: UUID,
    body: RejectRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    item = await get_user_content(content_id, user.id, db)
    item.status = "rejected"
    item.rejection_note = body.note
    item.updated_at = datetime.utcnow()

    history = ApprovalHistory(content_item_id=item.id, user_id=user.id,
                              action="rejected", note=body.note, content_version=item.version)
    db.add(history)
    await db.commit()
    return item
```

---

## Frontend: Approve Page

```typescript
function ContentCard({ item, onAction }: ContentCardProps) {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionNote, setRejectionNote] = useState('');

  return (
    <div className="border rounded p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Badge>{item.channel}</Badge>
        <span className="text-sm text-gray-500">{item.campaign_name}</span>
      </div>

      <ContentPreview channel={item.channel} content={item.content_json} />

      <div className="flex gap-2">
        <Button onClick={() => onAction(item.id, 'approve')} variant="default">
          Approve
        </Button>
        <Button onClick={() => setShowRejectModal(true)} variant="destructive">
          Reject
        </Button>
        <Button onClick={() => router.push(`/content/${item.id}/edit`)} variant="outline">
          Edit
        </Button>
      </div>

      <RejectModal open={showRejectModal} note={rejectionNote}
                  onChange={setRejectionNote}
                  onConfirm={() => onAction(item.id, 'reject', rejectionNote)} />
    </div>
  );
}
```
