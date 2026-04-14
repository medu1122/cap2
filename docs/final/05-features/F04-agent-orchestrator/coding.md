# F04 — Multi-Agent Orchestrator: Coding Guide

---

## Agent Service Structure

```
agent/
├── main.py              FastAPI app, POST /run endpoint
├── orchestrator.py      State machine — điều phối 3 agents
├── agents/
│   ├── base.py          BaseAgent abstract class
│   ├── strategist.py    Strategist implementation
│   ├── writer.py        Writer implementation (3 channel templates)
│   └── critic.py        Critic implementation
└── llm/
    ├── router.py        Route task → model
    ├── openai_client.py OpenAI API wrapper
    └── qwen_client.py   Qwen VPS wrapper
```

---

## LLM Router

### `agent/llm/router.py`

```python
import httpx, asyncio

ROUTING_TABLE = {
    "strategy": "openai",
    "critic": "openai",
    "writer": "qwen",
    "summary": "qwen",
}

async def call_llm(task: str, messages: list[dict], **kwargs) -> tuple[str, str, int, int]:
    """Returns: (content, model_used, input_tokens, output_tokens)"""
    provider = ROUTING_TABLE.get(task, "openai")

    if provider == "qwen":
        try:
            return await asyncio.wait_for(
                qwen_client.complete(messages, **kwargs),
                timeout=15.0
            )
        except asyncio.TimeoutError:
            logger.warning(f"Qwen timeout for task={task}, falling back to OpenAI")
            provider = "openai"

    return await openai_client.complete(messages, **kwargs)
```

### `agent/llm/openai_client.py`

```python
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

async def complete(messages, model="gpt-4o-mini", **kwargs):
    response = await client.chat.completions.create(
        model=model, messages=messages,
        response_format={"type": "json_object"} if kwargs.get("json_mode") else None
    )
    choice = response.choices[0]
    return (
        choice.message.content,
        model,
        response.usage.prompt_tokens,
        response.usage.completion_tokens
    )
```

### `agent/llm/qwen_client.py`

```python
QWEN_BASE_URL = f"http://{settings.QWEN_VPS_HOST}:{settings.QWEN_VPS_PORT}/v1"

async def complete(messages, model="qwen2.5:7b", **kwargs):
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(f"{QWEN_BASE_URL}/chat/completions", json={
            "model": model,
            "messages": messages,
        })
        response.raise_for_status()
        data = response.json()
        choice = data["choices"][0]
        usage = data.get("usage", {})
        return (
            choice["message"]["content"],
            model,
            usage.get("prompt_tokens", 0),
            usage.get("completion_tokens", 0)
        )
```

---

## Orchestrator

### `agent/orchestrator.py`

```python
async def run_orchestration(campaign_id: str):
    """Main state machine"""
    api = ApiCallbackClient(settings.API_BASE_URL)
    step = 0

    try:
        # Load brief + brand
        detail = await api.get_campaign_detail(campaign_id)
        brief = detail["campaign"]
        brand = detail["brand"]
        brand_context = build_brand_context(brand)

        await api.update_campaign_status(campaign_id, "running")

        # Step 1: Strategist
        step += 1
        start = time.time()
        strategist = StrategistAgent()
        plan, model, in_tok, out_tok = await strategist.run(brief, brand_context)
        duration = int((time.time() - start) * 1000)

        await api.save_agent_log(campaign_id, {
            "agent_name": "strategist", "step_order": step,
            "model_used": model, "model_provider": get_provider(model),
            "input_tokens": in_tok, "output_tokens": out_tok,
            "duration_ms": duration, "status": "success",
            "output_preview": json.dumps(plan)[:300]
        })

        # Steps 2-N: Writer + Critic per channel
        writer = WriterAgent()
        critic = CriticAgent()

        for deliverable in plan["deliverables"]:
            channel = deliverable["channel"]

            # Writer
            step += 1
            start = time.time()
            draft, model, in_tok, out_tok = await writer.run(
                deliverable, brand_context, plan["campaign_summary"], plan["key_messages"]
            )
            await api.save_agent_log(campaign_id, {
                "agent_name": "writer", "step_order": step, "channel": channel,
                "model_used": model, "model_provider": get_provider(model),
                "input_tokens": in_tok, "output_tokens": out_tok,
                "duration_ms": int((time.time()-start)*1000), "status": "success"
            })

            # Critic
            step += 1
            start = time.time()
            result, model, in_tok, out_tok = await critic.run(
                deliverable, draft, brand_context, plan["key_messages"]
            )
            log_id = await api.save_agent_log(campaign_id, {
                "agent_name": "critic", "step_order": step, "channel": channel,
                "model_used": model, "model_provider": get_provider(model),
                "input_tokens": in_tok, "output_tokens": out_tok,
                "duration_ms": int((time.time()-start)*1000), "status": "success"
            })

            # Save final content
            await api.save_content(campaign_id, {
                "channel": channel,
                "content_json": result["final_content"],
                "agent_run_id": log_id,
                "scheduled_date": brief["deadline"]
            })

        await api.update_campaign_status(campaign_id, "pending_approval")

    except Exception as e:
        logger.exception(f"Orchestration failed for campaign {campaign_id}")
        await api.update_campaign_status(campaign_id, "failed", str(e))
```

---

## Agent Prompts

### Strategist Prompt Template

```python
STRATEGIST_PROMPT = """
{brand_context}

Bạn là chuyên gia chiến lược marketing. Phân tích brief dưới đây và tạo kế hoạch chiến dịch.

BRIEF:
- Tên: {campaign_name}
- Mục tiêu: {objective}
- Sản phẩm: {product_or_service}
- Ưu đãi: {offer_or_hook}
- Khách hàng: {target_audience}
- Kênh: {channels}

Trả về JSON với schema:
{{
  "campaign_summary": "2-3 câu tóm tắt chiến lược",
  "key_messages": ["msg1", "msg2", "msg3"],
  "deliverables": [
    {{"channel": "facebook_post", "content_goal": "...", "tone_hint": "...", "cta": "..."}}
  ]
}}
"""
```

### Writer Facebook Template

```python
WRITER_FACEBOOK_PROMPT = """
{brand_context}

Viết bài đăng Facebook cho chiến dịch này:
- Mục tiêu nội dung: {content_goal}
- Tone: {tone_hint}
- CTA: {cta}
- Thông điệp chính: {key_messages}

Trả về JSON: {{"copy": "nội dung bài đăng", "hashtags": ["tag1", "tag2"]}}
"""
```

---

## Frontend: Agent Log Timeline

```typescript
function AgentLogTimeline({ logs }: { logs: AgentRunLog[] }) {
  return (
    <div className="space-y-2">
      {logs.sort((a,b) => a.step_order - b.step_order).map(log => (
        <div key={log.id} className="border rounded p-3 text-sm">
          <div className="flex items-center gap-2">
            <AgentIcon name={log.agent_name} />
            <span className="font-medium capitalize">{log.agent_name}</span>
            {log.channel && <Badge>{log.channel}</Badge>}
            <Badge variant="outline">{log.model_used}</Badge>
            <span className="ml-auto text-gray-500">{log.duration_ms}ms</span>
          </div>
          <div className="text-gray-500 text-xs mt-1">
            Tokens: {log.input_tokens} in / {log.output_tokens} out
          </div>
          {log.output_preview && (
            <details className="mt-2">
              <summary className="cursor-pointer text-gray-500">Xem output</summary>
              <pre className="text-xs mt-1 bg-gray-50 p-2 rounded overflow-auto">
                {log.output_preview}
              </pre>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}
```
