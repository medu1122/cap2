# F06 — Human Approval Flow: Test Plan

---

## Integration Tests

```python
@pytest.mark.asyncio
async def test_approve_content(client, auth_headers, pending_content):
    response = await client.patch(f"/content/{pending_content['id']}/approve",
                                  headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "approved"

@pytest.mark.asyncio
async def test_reject_content_with_note(client, auth_headers, pending_content):
    response = await client.patch(f"/content/{pending_content['id']}/reject",
        json={"note": "Tone quá cứng nhắc, cần ấm áp hơn"}, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "rejected"
    assert data["rejection_note"] == "Tone quá cứng nhắc, cần ấm áp hơn"

@pytest.mark.asyncio
async def test_all_approved_updates_campaign(client, auth_headers, campaign_with_2_pending):
    item1_id, item2_id = campaign_with_2_pending
    await client.patch(f"/content/{item1_id}/approve", headers=auth_headers)
    await client.patch(f"/content/{item2_id}/approve", headers=auth_headers)

    campaign_id = campaign_with_2_pending.campaign_id
    campaign = await client.get(f"/campaigns/{campaign_id}", headers=auth_headers)
    assert campaign.json()["status"] == "approved"

@pytest.mark.asyncio
async def test_approval_history_recorded(client, auth_headers, pending_content):
    await client.patch(f"/content/{pending_content['id']}/approve", headers=auth_headers)
    history = await client.get(f"/content/{pending_content['id']}/approval-history",
                                headers=auth_headers)
    assert history.status_code == 200
    records = history.json()
    assert len(records) >= 1
    assert records[0]["action"] == "approved"
```

---

## Acceptance Tests

```gherkin
Feature: Content Approval Flow

Scenario: Approve content → xuất hiện trên calendar
  Given có 1 content item với status='pending_approval' và scheduled_date = ngày mai
  When tôi click "Approve" trên trang /approve
  Then status thay đổi thành 'approved'
    And approval_history ghi lại action='approved', user_id, content_version
    And item xuất hiện trên Marketing Calendar vào ngày mai

Scenario: Reject content với rejection note
  Given có 1 content item đang pending
  When tôi click "Reject" và nhập "Tone quá cứng nhắc"
    And click "Xác nhận từ chối"
  Then status thay đổi thành 'rejected'
    And rejection_note = "Tone quá cứng nhắc" được lưu
    And approval_history ghi action='rejected' với note

Scenario: Tất cả content approved → campaign approved
  Given campaign có 3 content items đều pending_approval
  When tôi approve tất cả 3 items
  Then campaign.status thay đổi thành 'approved'
```

---

## Edge Cases

| Case | Expected |
|---|---|
| Approve đã-approved item | 400 Bad Request |
| Reject không có note | note = null, vẫn thành công |
| User khác approve content | 403 Forbidden |
