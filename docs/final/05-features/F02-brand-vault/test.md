# F02 — Brand Vault: Test Plan

---

## Unit Tests

### `api/tests/test_brand_validation.py`

```python
def test_valid_brand_upsert():
    data = BrandUpsert(
        brand_name="Cafe Bờ Hồ",
        brand_description="Quán cà phê truyền thống tại TP.HCM",
        tone_of_voice="warm",
        target_audience="Sinh viên 18-25 tuổi"
    )
    assert data.brand_name == "Cafe Bờ Hồ"

def test_invalid_tone_of_voice():
    with pytest.raises(ValidationError):
        BrandUpsert(brand_name="Test", brand_description="Test desc min 20 chars",
                    tone_of_voice="funny", target_audience="Target min 10 chars")

def test_invalid_hex_color():
    with pytest.raises(ValidationError):
        BrandUpsert(brand_name="Test", brand_description="Test desc min 20 chars",
                    tone_of_voice="warm", target_audience="Target min 10 chars",
                    primary_color="not-a-color")

def test_build_brand_context_includes_forbidden_words():
    brand = {
        "brand_name": "Cafe Test",
        "brand_description": "Test cafe",
        "tone_of_voice": "warm",
        "target_audience": "Students",
        "forbidden_words": ["rẻ", "bình dân"],
        "key_products": ["Cà phê"],
        "preferred_cta": "Ghé thăm",
        "preferred_salutation": "bạn"
    }
    context = build_brand_context(brand)
    assert "rẻ" in context
    assert "bình dân" in context
    assert "<brand_context>" in context
```

---

## Integration Tests

### `api/tests/test_brand_endpoints.py`

```python
@pytest.mark.asyncio
async def test_get_brand_not_found(client, auth_headers):
    """User mới chưa có brand vault"""
    response = await client.get("/brands/me", headers=auth_headers)
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_create_brand_vault(client, auth_headers):
    response = await client.put("/brands/me", json={
        "brand_name": "Cafe Bờ Hồ",
        "brand_description": "Quán cà phê truyền thống TP.HCM mở cửa từ 7am",
        "tone_of_voice": "warm",
        "target_audience": "Sinh viên và dân văn phòng 20-30 tuổi",
        "key_products": ["Cà phê sữa đá", "Bạc xỉu"],
        "forbidden_words": ["rẻ", "bình dân"]
    }, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["brand_name"] == "Cafe Bờ Hồ"
    assert "rẻ" in data["forbidden_words"]

@pytest.mark.asyncio
async def test_update_brand_vault(client, auth_headers, existing_brand):
    response = await client.put("/brands/me", json={
        **existing_brand,
        "tagline": "Ngụm cà phê, ngàn ký ức"
    }, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["tagline"] == "Ngụm cà phê, ngàn ký ức"

@pytest.mark.asyncio
async def test_brand_vault_user_isolation(client, auth_headers_user1, auth_headers_user2, brand_user1):
    """User 2 không thể đọc brand của User 1"""
    response = await client.get("/brands/me", headers=auth_headers_user2)
    assert response.status_code == 404  # User 2 chưa có brand
```

---

## Acceptance Tests

```gherkin
Feature: Brand Vault Setup

Scenario: Tạo Brand Vault lần đầu
  Given tôi đã đăng nhập và chưa có Brand Vault
  When tôi vào /brand-vault
  Then tôi thấy form trống với placeholder text
  When tôi điền đầy đủ các trường bắt buộc
    And tôi thêm "rẻ" và "bình dân" vào Forbidden Words
    And tôi click "Lưu Brand Vault"
  Then tôi thấy thông báo "Brand Vault đã lưu thành công"
    And khi tôi reload trang, tất cả data vẫn còn

Scenario: Forbidden words được AI tuân thủ
  Given Brand Vault có forbidden_words = ["rẻ", "siêu rẻ"]
  When AI Writer tạo content cho campaign
  Then không có từ "rẻ" hay "siêu rẻ" xuất hiện trong nội dung
    And prompt_preview của agent log có chứa từ cấm trong <brand_context>

Scenario: Warning khi Brand Vault chưa đầy đủ
  Given tôi chưa điền brand_description
  When tôi cố tạo campaign mới
  Then tôi thấy warning "Brand Vault chưa đầy đủ: Vui lòng điền brand_description"
    And tôi vẫn có thể tiếp tục tạo campaign (warning, không phải blocker)
```

---

## Edge Cases

| Case | Expected |
|---|---|
| key_products = [] (empty array) | Lưu empty array, không lỗi |
| Cập nhật với forbidden_words mới | Campaigns tiếp theo dùng list mới |
| brand_description < 20 chars | 422 Validation Error |
| tone_of_voice không thuộc enum | 422 Validation Error |
| Tạo brand thứ 2 cho cùng user | UNIQUE constraint → upsert (UPDATE, không tạo mới) |
