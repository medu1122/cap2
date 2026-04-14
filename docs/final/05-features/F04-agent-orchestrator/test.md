# F04 — Multi-Agent Orchestrator: Test Plan

---

## Unit Tests

```python
# agent/tests/test_llm_router.py
@pytest.mark.asyncio
async def test_strategy_routes_to_openai(mock_openai, mock_qwen):
    content, model, _, _ = await call_llm("strategy", [{"role": "user", "content": "test"}])
    assert "gpt" in model.lower()
    mock_openai.assert_called_once()
    mock_qwen.assert_not_called()

@pytest.mark.asyncio
async def test_writer_routes_to_qwen(mock_openai, mock_qwen):
    content, model, _, _ = await call_llm("writer", [{"role": "user", "content": "test"}])
    assert "qwen" in model.lower()
    mock_qwen.assert_called_once()

@pytest.mark.asyncio
async def test_qwen_timeout_fallback_to_openai(mock_openai, mock_qwen_timeout):
    """Khi Qwen timeout > 15s, phải fallback sang OpenAI"""
    content, model, _, _ = await call_llm("writer", [{"role": "user", "content": "test"}])
    assert "gpt" in model.lower()  # fallback
    mock_openai.assert_called_once()

# agent/tests/test_strategist.py
@pytest.mark.asyncio
async def test_strategist_returns_valid_plan(mock_openai_response):
    mock_openai_response.return_value = (
        json.dumps({
            "campaign_summary": "Test summary",
            "key_messages": ["msg1", "msg2"],
            "deliverables": [{"channel": "facebook_post", "content_goal": "test", "tone_hint": "warm", "cta": "test"}]
        }),
        "gpt-4o-mini", 100, 80
    )
    agent = StrategistAgent()
    plan, model, _, _ = await agent.run(sample_brief, sample_brand_context)
    assert "campaign_summary" in plan
    assert len(plan["key_messages"]) >= 1
    assert all("channel" in d for d in plan["deliverables"])

# agent/tests/test_brand_context.py
def test_brand_context_includes_forbidden_words():
    brand = {"brand_name": "Test", "forbidden_words": ["rẻ", "bình dân"],
             "tone_of_voice": "warm", ...}
    ctx = build_brand_context(brand)
    assert "rẻ" in ctx
    assert "bình dân" in ctx

def test_brand_context_empty_arrays():
    brand = {"brand_name": "Test", "forbidden_words": None, "key_products": [], ...}
    ctx = build_brand_context(brand)  # Should not raise
    assert "<brand_context>" in ctx
```

---

## Integration Tests

```python
# api/tests/test_agent_pipeline.py
@pytest.mark.asyncio
async def test_full_orchestration_creates_content(
    campaign_fixture, brand_fixture, mock_openai, mock_qwen
):
    """End-to-end test với mock LLM responses"""
    # Setup mock responses
    mock_openai.side_effect = [strategist_mock_response, critic_mock_response]
    mock_qwen.return_value = writer_mock_response

    # Run orchestration
    await run_orchestration(str(campaign_fixture.id))

    # Verify: campaign status updated
    async with get_db_session() as db:
        campaign = await db.get(Campaign, campaign_fixture.id)
        assert campaign.status == "pending_approval"

        # Verify: content items created
        content = await db.execute(
            select(ContentItem).where(ContentItem.campaign_id == campaign_fixture.id)
        )
        items = content.scalars().all()
        assert len(items) == len(campaign_fixture.channels)

        # Verify: agent logs created
        logs = await db.execute(
            select(AgentRunLog).where(AgentRunLog.campaign_id == campaign_fixture.id)
        )
        log_list = logs.scalars().all()
        assert len(log_list) >= 3  # At least: strategist + writer + critic

@pytest.mark.asyncio
async def test_orchestration_handles_llm_failure(campaign_fixture):
    """Khi LLM thất bại, campaign phải về status='failed'"""
    with patch("agent.llm.router.call_llm", side_effect=Exception("LLM Error")):
        await run_orchestration(str(campaign_fixture.id))

    async with get_db_session() as db:
        campaign = await db.get(Campaign, campaign_fixture.id)
        assert campaign.status == "failed"
        assert campaign.error_message is not None
```

---

## Acceptance Tests

```gherkin
Feature: Multi-Agent Campaign Orchestration

Scenario: Orchestration hoàn thành trong < 90 giây
  Given tôi đã tạo campaign với channels ['facebook_post', 'email']
  When AI pipeline bắt đầu chạy
  Then trong vòng 90 giây, campaign status = 'pending_approval'
    And có đúng 2 content items (1 per channel)
    And có ít nhất 5 agent_run_logs (strategist + 2 writer + 2 critic)

Scenario: Brand context được inject vào prompt
  Given Brand Vault có forbidden_words = ['rẻ']
  When campaign được orchestrate
  Then agent_run_logs[0].prompt_preview chứa '<brand_context>'
    And agent_run_logs[0].prompt_preview chứa 'rẻ' (từ forbidden_words)

Scenario: Hybrid model routing
  Given Qwen VPS đang hoạt động
  When orchestration chạy
  Then agent_run_logs với agent_name='writer' có model_provider='qwen'
    And agent_run_logs với agent_name='strategist' có model_provider='openai'
    And agent_run_logs với agent_name='critic' có model_provider='openai'

Scenario: Fallback khi Qwen không available
  Given Qwen VPS đang down
  When writer agent cố gọi Qwen
    And không nhận response sau 15 giây
  Then writer fallback sang OpenAI
    And campaign vẫn hoàn thành thành công
    And agent log ghi nhận model_provider='openai' cho writer step
```

---

## Performance Benchmarks

| Metric | Target | Measurement |
|---|---|---|
| 1 campaign, 2 channels | < 60s | End-to-end timing |
| 1 campaign, 3 channels | < 90s | End-to-end timing |
| Strategist latency | < 20s | Per-step timing |
| Writer latency (Qwen) | < 15s | Per-step timing |
| Critic latency | < 20s | Per-step timing |
