# F07 — Marketing Calendar: Test Plan

---

## Integration Tests

```python
@pytest.mark.asyncio
async def test_calendar_returns_items_in_month(client, auth_headers, approved_content):
    """Content với scheduled_date trong tháng này phải xuất hiện"""
    this_month = date.today()
    response = await client.get(
        f"/calendar?month={this_month.month}&year={this_month.year}",
        headers=auth_headers
    )
    assert response.status_code == 200
    items = response.json()
    assert len(items) >= 1
    for item in items:
        item_date = date.fromisoformat(item["scheduled_date"])
        assert item_date.month == this_month.month

@pytest.mark.asyncio
async def test_calendar_filter_by_channel(client, auth_headers):
    response = await client.get(
        f"/calendar?month=4&year=2025&channel=facebook_post",
        headers=auth_headers
    )
    items = response.json()
    assert all(item["channel"] == "facebook_post" for item in items)

@pytest.mark.asyncio
async def test_update_schedule_date(client, auth_headers, content_item):
    new_date = (date.today() + timedelta(days=5)).isoformat()
    response = await client.patch(
        f"/content/{content_item['id']}/schedule-date",
        json={"scheduled_date": new_date},
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["scheduled_date"] == new_date
```

---

## Acceptance Tests

```gherkin
Feature: Marketing Calendar

Scenario: Approved content xuất hiện trên calendar
  Given content item với status='approved' và scheduled_date='2025-04-15'
  When tôi xem calendar tháng 4 năm 2025
  Then tôi thấy dot màu tại ngày 15
    And click vào ngày 15 hiển thị nội dung của item đó

Scenario: Thay đổi ngày đăng
  Given content item với scheduled_date='2025-04-15'
  When tôi click item và chọn ngày mới '2025-04-20'
  Then item di chuyển sang ngày 20 trên calendar
    And database cập nhật scheduled_date='2025-04-20'

Scenario: Pending items hiển thị mờ
  Given content item với status='pending_approval'
  When tôi xem calendar
  Then dot của item đó có opacity thấp hơn so với approved items
```
