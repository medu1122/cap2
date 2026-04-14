# F10 — Notifications & Customer Lists: Coding Guide

---

## Backend

### `api/services/notification_service.py`

```python
async def create_notification(
    user_id: UUID,
    type: str,
    title: str,
    body: str,
    payload: dict | None = None,
    db: AsyncSession = None
):
    """Utility để tạo notification từ bất kỳ service nào"""
    # Check user settings
    settings = await db.execute(
        select(NotificationSettings).where(NotificationSettings.user_id == user_id)
    )
    user_settings = settings.scalar_one_or_none()

    # Check if user wants this type
    type_to_setting = {
        "campaign_complete": "campaign_completed",
        "content_pending": "content_pending",
        "workflow_done": "workflow_triggered",
    }
    setting_field = type_to_setting.get(type)
    if user_settings and setting_field:
        if not getattr(user_settings, setting_field, True):
            return  # User disabled this type

    notif = Notification(user_id=user_id, type=type, title=title, body=body,
                         payload=payload or {})
    db.add(notif)
    # Note: commit is caller's responsibility


# Called from orchestrator callback
await create_notification(
    user_id=campaign.user_id,
    type="campaign_complete",
    title="Chiến dịch đã sẵn sàng để duyệt",
    body=f'Chiến dịch "{campaign.campaign_name}" đã được AI soạn xong. Bạn có {content_count} nội dung chờ duyệt.',
    payload={"campaign_id": str(campaign.id), "content_count": content_count},
    db=db
)
```

### `api/routers/notifications.py`

```python
@router.get("", response_model=list[NotificationOut])
async def get_notifications(
    limit: int = Query(default=20, le=50),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.is_read.asc(), Notification.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()

@router.get("/unread-count")
async def get_unread_count(user: User = Depends(get_current_user), db=...):
    count = await db.scalar(
        select(func.count()).select_from(Notification)
        .where(Notification.user_id == user.id, Notification.is_read == False)
    )
    return {"count": count}

@router.patch("/read-all")
async def mark_all_read(user: User = Depends(get_current_user), db=...):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.is_read == False)
        .values(is_read=True, read_at=datetime.utcnow())
    )
    await db.commit()
    return {"message": "Tất cả thông báo đã được đánh dấu đã đọc"}
```

---

## Frontend: Notification Bell

```typescript
'use client';
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: { count } = { count: 0 } } = useSWR('/notifications/unread-count',
    apiClient.get, { refreshInterval: 30000 });  // Poll every 30s
  const { data: notifications } = useSWR(open ? '/notifications?limit=5' : null, apiClient.get);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative">
        <BellIcon className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs
                          rounded-full w-4 h-4 flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-8 w-80 bg-white border rounded shadow-lg z-50">
          <div className="flex justify-between p-3 border-b">
            <span className="font-medium text-sm">Thông báo</span>
            <button onClick={() => markAllRead()} className="text-xs text-blue-500">
              Đánh dấu tất cả đã đọc
            </button>
          </div>
          {notifications?.map(n => (
            <NotificationItem key={n.id} notification={n} />
          ))}
          <Link href="/notifications" className="block text-center p-2 text-xs text-blue-500 border-t">
            Xem tất cả
          </Link>
        </div>
      )}
    </div>
  );
}
```
