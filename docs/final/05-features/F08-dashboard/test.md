# F08 — Dashboard & AI Summary: Test Plan

---

## Integration Tests

```python
@pytest.mark.asyncio
async def test_dashboard_stats_correct(client, auth_headers, seeded_data):
    """seeded_data: 2 campaigns, 5 content items (2 approved, 3 pending)"""
    response = await client.get("/dashboard/stats", headers=auth_headers)
    assert response.status_code == 200
    stats = response.json()
    assert stats["total_campaigns"] == 2
    assert stats["total_content"] == 5
    assert stats["pending_approvals"] == 3
    assert stats["approved_items"] == 2

@pytest.mark.asyncio
async def test_dashboard_ai_summary_returns_text(client, auth_headers, mock_qwen):
    mock_qwen.return_value = ("Tuần này bạn đã tạo 2 chiến dịch...", "qwen2.5:7b", 50, 80)
    response = await client.get("/dashboard/ai-summary", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert len(data["summary"]) > 10  # not empty

@pytest.mark.asyncio
async def test_by_channel_aggregation(client, auth_headers, content_by_channel):
    """content_by_channel: 3 facebook, 2 email, 1 video"""
    response = await client.get("/dashboard/stats", headers=auth_headers)
    stats = response.json()
    assert stats["by_channel"]["facebook_post"] == 3
    assert stats["by_channel"]["email"] == 2
```

---

## Acceptance Tests

```gherkin
Feature: Dashboard

Scenario: Dashboard hiển thị đúng số liệu
  Given có 2 campaigns, 4 content items (2 approved, 2 pending)
  When tôi load /dashboard
  Then widget "Campaigns" hiển thị số 2
    And widget "Chờ duyệt" hiển thị số 2 với màu cảnh báo
    And chart kênh hiển thị distribution đúng

Scenario: AI Summary được tạo từ Qwen
  Given tôi có dữ liệu campaigns
  When /dashboard/ai-summary được gọi
  Then phản hồi là câu văn tiếng Việt có nghĩa (không phải error)
    And không có "undefined" hoặc JSON syntax trong text
```
