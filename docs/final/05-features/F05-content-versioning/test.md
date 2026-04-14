# F05 — Content Storage & Versioning: Test Plan

---

## Integration Tests

```python
@pytest.mark.asyncio
async def test_edit_content_creates_new_version(client, auth_headers, pending_content):
    response = await client.put(f"/content/{pending_content['id']}", json={
        "content_json": {"copy": "Edited content", "hashtags": ["edited"]}
    }, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["version"] == pending_content["version"] + 1
    assert data["source"] == "user_edit"
    assert data["status"] == "pending_approval"

@pytest.mark.asyncio
async def test_original_version_preserved_after_edit(client, auth_headers, pending_content):
    # Edit content
    await client.put(f"/content/{pending_content['id']}", json={
        "content_json": {"copy": "New version"}
    }, headers=auth_headers)

    # Original version still exists
    versions_response = await client.get(
        f"/content/{pending_content['id']}/versions", headers=auth_headers
    )
    versions = versions_response.json()
    assert len(versions) == 2
    assert versions[0]["version"] == 1
    assert versions[0]["source"] == "agent"

@pytest.mark.asyncio
async def test_get_content_list_filter_by_channel(client, auth_headers):
    response = await client.get("/content?channel=facebook_post", headers=auth_headers)
    assert response.status_code == 200
    items = response.json()
    assert all(item["channel"] == "facebook_post" for item in items)
```

---

## Acceptance Tests

```gherkin
Feature: Content Versioning

Scenario: User chỉnh sửa content tạo ra version mới
  Given có 1 content item version 1 (source='agent')
  When user chỉnh sửa nội dung và save
  Then version 2 được tạo với source='user_edit'
    And version 1 vẫn còn trong database (không bị xóa)
    And version 2 có status='pending_approval'

Scenario: Xem lịch sử versions
  Given content item đã được edit 2 lần (versions 1, 2, 3)
  When user click "Xem lịch sử" trên content item
  Then thấy 3 versions với timestamps và source labels
    And version 1: "AI Generated", version 2: "User Edit", version 3: "User Edit"
```
