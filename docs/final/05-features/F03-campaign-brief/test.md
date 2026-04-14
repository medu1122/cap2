# F03 — Campaign Brief Intake: Test Plan

---

## Integration Tests

```python
@pytest.mark.asyncio
async def test_create_campaign_success(client, auth_headers):
    response = await client.post("/campaigns", json={
        "campaign_name": "Test Campaign",
        "objective": "Ra mắt sản phẩm mới mùa hè",
        "product_or_service": "Trà đào cam sả",
        "deadline": (date.today() + timedelta(days=7)).isoformat(),
        "channels": ["facebook_post", "email"]
    }, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "pending_agent"
    assert "facebook_post" in data["channels"]

@pytest.mark.asyncio
async def test_create_campaign_past_deadline(client, auth_headers):
    response = await client.post("/campaigns", json={
        "campaign_name": "Past Deadline",
        "objective": "Test objective with enough length",
        "product_or_service": "Test product",
        "deadline": "2020-01-01",  # past date
        "channels": ["facebook_post"]
    }, headers=auth_headers)
    assert response.status_code == 422

@pytest.mark.asyncio
async def test_create_campaign_no_channels(client, auth_headers):
    response = await client.post("/campaigns", json={
        "campaign_name": "No Channels",
        "objective": "Test objective with enough length",
        "product_or_service": "Test product",
        "deadline": (date.today() + timedelta(days=7)).isoformat(),
        "channels": []  # empty
    }, headers=auth_headers)
    assert response.status_code == 422

@pytest.mark.asyncio
async def test_list_campaigns(client, auth_headers, campaign_fixture):
    response = await client.get("/campaigns", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(c["id"] == str(campaign_fixture.id) for c in data)
```

---

## Acceptance Tests

```gherkin
Feature: Campaign Brief Creation

Scenario: Tạo campaign thành công và AI bắt đầu chạy
  Given tôi đã đăng nhập và có Brand Vault
  When tôi vào /campaigns/new
    And tôi điền "Khai trương menu mùa hè" làm tên chiến dịch
    And tôi chọn channels: Facebook Post và Email
    And tôi đặt deadline là 7 ngày từ hôm nay
    And tôi click "Tạo Campaign & Chạy AI"
  Then tôi được redirect tới /campaigns/{id}
    And tôi thấy status badge "Đang xử lý..."
    And sau tối đa 90 giây tôi thấy "Chờ duyệt" với 2 content items

Scenario: Validation deadline trong quá khứ
  Given tôi đang ở form tạo campaign
  When tôi chọn deadline là ngày hôm qua
    And tôi click submit
  Then tôi thấy lỗi "Deadline phải là ngày trong tương lai"
    And campaign không được tạo

Scenario: Warning khi không có Brand Vault
  Given tôi chưa thiết lập Brand Vault
  When tôi tạo campaign
  Then tôi thấy warning banner "Brand Vault chưa được thiết lập — AI sẽ dùng thông tin mặc định"
    And tôi vẫn có thể submit form
```

---

## Edge Cases

| Case | Expected |
|---|---|
| channels = ['invalid_channel'] | 422 Validation Error |
| deadline = today | 422 (must be future) |
| objective < 10 chars | 422 Validation Error |
| Agent service không available | Campaign status = 'failed' với error_message |
| 2 campaigns chạy đồng thời | Cả 2 đều chạy độc lập, không conflict |
