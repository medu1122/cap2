# F10 — Notifications & Customer Lists: Test Plan

---

## Integration Tests

```python
@pytest.mark.asyncio
async def test_campaign_complete_creates_notification(db, user_fixture, campaign_fixture):
    """Khi campaign → pending_approval, notification phải được tạo"""
    await create_notification(
        user_id=user_fixture.id,
        type="campaign_complete",
        title="Campaign xong",
        body="AI đã soạn xong",
        payload={"campaign_id": str(campaign_fixture.id)},
        db=db
    )
    await db.commit()

    result = await db.execute(
        select(Notification).where(Notification.user_id == user_fixture.id)
    )
    notifs = result.scalars().all()
    assert len(notifs) == 1
    assert notifs[0].type == "campaign_complete"

@pytest.mark.asyncio
async def test_get_notifications_ordered(client, auth_headers, multiple_notifications):
    response = await client.get("/notifications", headers=auth_headers)
    assert response.status_code == 200
    items = response.json()
    # Unread first, then by created_at desc
    unread = [n for n in items if not n["is_read"]]
    read = [n for n in items if n["is_read"]]
    assert items[:len(unread)] == unread

@pytest.mark.asyncio
async def test_unread_count(client, auth_headers):
    response = await client.get("/notifications/unread-count", headers=auth_headers)
    assert response.status_code == 200
    assert "count" in response.json()

@pytest.mark.asyncio
async def test_mark_all_read(client, auth_headers, unread_notifications):
    response = await client.patch("/notifications/read-all", headers=auth_headers)
    assert response.status_code == 200

    count_response = await client.get("/notifications/unread-count", headers=auth_headers)
    assert count_response.json()["count"] == 0

@pytest.mark.asyncio
async def test_notification_respects_settings(db, user_fixture):
    """User tắt campaign_completed notifications"""
    settings = NotificationSettings(user_id=user_fixture.id, campaign_completed=False)
    db.add(settings)
    await db.commit()

    await create_notification(user_id=user_fixture.id, type="campaign_complete",
                               title="Test", body="Test", db=db)
    await db.commit()

    result = await db.execute(
        select(func.count()).select_from(Notification)
        .where(Notification.user_id == user_fixture.id)
    )
    # Notification NOT created because setting is disabled
    assert result.scalar() == 0
```

---

## Acceptance Tests

```gherkin
Feature: In-App Notifications

Scenario: Bell icon hiển thị unread count
  Given có 3 notifications chưa đọc
  When tôi nhìn vào header của app
  Then tôi thấy bell icon với badge số "3"

Scenario: Campaign hoàn thành → notification xuất hiện
  Given tôi vừa tạo campaign mới
  When AI pipeline hoàn thành (campaign → pending_approval)
  Then trong vòng vài giây, bell icon badge tăng thêm 1
    And notification có title "Chiến dịch đã sẵn sàng để duyệt"

Scenario: Mark all as read
  Given có 5 notifications chưa đọc
  When tôi click "Đánh dấu tất cả đã đọc"
  Then badge biến mất
    And tất cả notifications có is_read=TRUE trong database
```

---

## Edge Cases

| Case | Expected |
|---|---|
| User không có notifications | GET /notifications → [] |
| Notification settings chưa được tạo | Default: nhận tất cả loại |
| Notification type không hợp lệ | Vẫn tạo (no strict validation on type) |
| Concurrent mark-read calls | Idempotent — không lỗi |
