# F09 — Workflow Automation: Test Plan

---

## Integration Tests

```python
@pytest.mark.asyncio
async def test_create_workflow_schedule(client, auth_headers):
    response = await client.post("/workflow/schedules", json={
        "schedule_name": "Weekly Campaign",
        "trigger_type": "schedule_trigger",
        "cron_expression": "0 8 * * 1",
        "default_brief_template": {
            "campaign_name": "Campaign tuần này",
            "objective": "Marketing hàng tuần",
            "channels": ["facebook_post"]
        }
    }, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["is_active"] == True
    assert data["next_run_at"] is not None

@pytest.mark.asyncio
async def test_toggle_schedule(client, auth_headers, schedule_fixture):
    response = await client.patch(
        f"/workflow/schedules/{schedule_fixture['id']}/toggle",
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["is_active"] == False  # was True, now False

@pytest.mark.asyncio
async def test_schedule_trigger_creates_campaign(db, user_fixture):
    """Simulate cron job running"""
    schedule = WorkflowSchedule(
        user_id=user_fixture.id,
        cron_expression="0 8 * * 1",
        is_active=True,
        next_run_at=datetime.utcnow() - timedelta(minutes=1),  # due
        default_brief_template={"channels": ["facebook_post"], ...}
    )
    db.add(schedule)
    await db.commit()

    await check_and_run_schedules()

    campaigns = await db.execute(
        select(Campaign).where(Campaign.user_id == user_fixture.id)
    )
    assert campaigns.scalars().first() is not None

@pytest.mark.asyncio
async def test_csv_upload_creates_customers(client, auth_headers):
    csv_content = b"email,full_name,phone\ntest@example.com,Test User,0901234567"
    response = await client.post("/files/upload",
        data={"purpose": "customer_list"},
        files={"file": ("customers.csv", csv_content, "text/csv")},
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["status"] == "uploaded"
```

---

## Acceptance Tests

```gherkin
Feature: Workflow Automation

Scenario: Schedule tự động tạo campaign hàng tuần
  Given tôi tạo schedule "Mỗi thứ Hai 8am" với template brief
  When thứ Hai 8 giờ sáng đến
  Then 1 campaign mới được tạo tự động với brief từ template
    And orchestrator chạy tự động
    And tôi nhận notification "Campaign tuần này đã sẵn sàng duyệt"

Scenario: Upload CSV tạo email campaign tự động
  Given tôi upload file CSV với 50 khách hàng
  When upload hoàn thành
  Then customer_list được tạo với status='ready', valid_records=50
    And 1 email campaign được tạo tự động
    And orchestrator chạy tự động tạo nội dung email
```
