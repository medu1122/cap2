# Agent Orchestration — AIMAP

Chi tiết kỹ thuật cho agent service: prompt design, state machine, model routing, error handling.

---

## 1. Orchestrator State Machine

```python
# agent/orchestrator.py

class CampaignOrchestrator:
    """
    Sequential state machine:
      INIT → STRATEGIST → WRITER_LOOP → CRITIC_LOOP → FINALIZE → DONE | ERROR
    """

    async def run(self, campaign_id: str, brief: dict, brand_vault: dict):
        try:
            # Step 1
            plan = await self.run_strategist(campaign_id, brief, brand_vault)

            # Step 2 + 3: loop per deliverable
            for i, deliverable in enumerate(plan["deliverables"]):
                draft = await self.run_writer(campaign_id, deliverable, plan, brand_vault, step=2 + i * 2)
                await self.run_critic(campaign_id, deliverable, draft, brand_vault, plan, step=3 + i * 2)

            # Finalize
            await self.api.patch_campaign(campaign_id, status="pending_approval", plan=plan)

        except Exception as e:
            await self.api.patch_campaign(campaign_id, status="failed", error=str(e))
            raise
```

---

## 2. Strategist Agent

### Prompt Template

```python
STRATEGIST_SYSTEM = """
You are a senior marketing strategist helping small businesses in Vietnam.
Your job is to analyze a campaign brief and create a structured campaign plan.

Always respond in valid JSON matching the schema provided.
Do not add explanation outside the JSON block.
"""

STRATEGIST_USER = """
<brand_context>
Brand: {brand_name}
Description: {brand_description}
Tone of voice: {tone_of_voice}
Target audience: {target_audience}
Key products: {key_products}
Forbidden words: {forbidden_words}
Preferred CTA: {preferred_cta}
</brand_context>

<campaign_brief>
Objective: {objective}
Product/Service: {product_or_service}
Target audience override: {target_audience_override}
Offer/Hook: {offer_or_hook}
Deadline: {deadline}
Channels requested: {channels}
Additional notes: {additional_notes}
</campaign_brief>

Respond with a JSON object with this exact schema:
{{
  "campaign_summary": "2-3 sentence strategic overview in Vietnamese",
  "key_messages": ["message 1", "message 2", "message 3"],
  "deliverables": [
    {{
      "channel": "facebook_post|email|video_script",
      "content_goal": "What this piece of content should achieve",
      "tone_hint": "Specific tone direction for this channel",
      "cta": "Exact call-to-action to use"
    }}
  ]
}}

Include one deliverable per requested channel.
"""
```

### Output Parsing

```python
import json, re

def parse_strategist_output(raw: str) -> dict:
    # Strip markdown code blocks if present
    raw = re.sub(r"```json\s*", "", raw)
    raw = re.sub(r"```\s*", "", raw)
    raw = raw.strip()
    return json.loads(raw)
```

---

## 3. Writer Agent

### Channel-Specific Prompts

**Facebook Post**
```python
WRITER_FACEBOOK_USER = """
<brand_context>{brand_context_block}</brand_context>

<task>
Write a Facebook post for a Vietnamese small business.

Campaign summary: {campaign_summary}
Key messages to convey: {key_messages}
Content goal: {content_goal}
Tone direction: {tone_hint}
Call-to-action: {cta}
</task>

Respond with JSON:
{{
  "copy": "The full post text in Vietnamese, 100-200 words, uses line breaks for readability",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"]
}}
"""
```

**Email**
```python
WRITER_EMAIL_USER = """
<brand_context>{brand_context_block}</brand_context>

<task>
Write a marketing email for a Vietnamese small business.

Campaign summary: {campaign_summary}
Key messages: {key_messages}
Content goal: {content_goal}
Tone direction: {tone_hint}
Call-to-action: {cta}
</task>

Respond with JSON:
{{
  "subject": "Email subject line, 40-60 characters, in Vietnamese",
  "body": "Full email body in Vietnamese, 150-300 words, uses \\n\\n for paragraphs, includes greeting and sign-off"
}}
"""
```

**Video Script**
```python
WRITER_VIDEO_SCRIPT_USER = """
<brand_context>{brand_context_block}</brand_context>

<task>
Write a short-form video script (30-60 seconds) for a Vietnamese small business.

Campaign summary: {campaign_summary}
Key messages: {key_messages}
Content goal: {content_goal}
Tone direction: {tone_hint}
Call-to-action: {cta}
</task>

Respond with JSON:
{{
  "hook": "First 5 seconds: attention-grabbing opening line or question in Vietnamese",
  "body": "Main content 20-45 seconds: key message delivery, in Vietnamese, written as spoken words",
  "cta": "Last 5-10 seconds: clear call-to-action, in Vietnamese",
  "duration_estimate": "30s|45s|60s"
}}
"""
```

---

## 4. Critic Agent

### Prompt Template

```python
CRITIC_SYSTEM = """
You are a strict content quality reviewer for a Vietnamese small business marketing platform.
Your job is to review drafted marketing content and ensure it meets brand standards and campaign objectives.

Be concise. Fix issues rather than just listing them.
Always respond in valid JSON.
"""

CRITIC_USER = """
<brand_context>{brand_context_block}</brand_context>

<campaign_context>
Campaign summary: {campaign_summary}
Key messages: {key_messages}
Deliverable spec: {deliverable_spec}
</campaign_context>

<draft_content>
Channel: {channel}
Draft: {draft_json}
</draft_content>

Review criteria:
1. Does it match the brand tone of voice? Forbidden words used?
2. Does it clearly convey the key messages?
3. Is the CTA present and clear?
4. Is the language natural Vietnamese (not translated-feeling)?
5. Is the length appropriate for the channel?

If the draft meets all criteria: return it as-is with status "approved".
If there are issues: revise the draft to fix them, return the revised version with status "revised".

Respond with JSON:
{{
  "status": "approved|revised",
  "issues_found": ["issue 1 if any", "issue 2 if any"],
  "final_content": {{ ...same schema as the channel's draft... }}
}}
"""
```

---

## 5. LLM Router

```python
# agent/llm/router.py

from enum import Enum

class ModelProvider(str, Enum):
    OPENAI = "openai"
    QWEN = "qwen"

ROUTING_TABLE: dict[str, ModelProvider] = {
    "strategist":   ModelProvider.OPENAI,
    "writer":       ModelProvider.QWEN,
    "critic":       ModelProvider.OPENAI,
    "dashboard_ai": ModelProvider.QWEN,
}

async def call_llm(
    agent_name: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.7
) -> tuple[str, str, str]:
    """
    Returns (raw_text, model_used, provider_used)
    Falls back to OpenAI if Qwen times out or errors.
    """
    provider = ROUTING_TABLE.get(agent_name, ModelProvider.OPENAI)

    if provider == ModelProvider.QWEN:
        try:
            result = await qwen_client.complete(system_prompt, user_prompt, temperature)
            return result, "qwen2.5:7b", "qwen"
        except (TimeoutError, ConnectionError, Exception) as e:
            # Fallback to OpenAI
            result = await openai_client.complete(system_prompt, user_prompt, temperature)
            return result, "gpt-4o-mini", "openai"
    else:
        result = await openai_client.complete(system_prompt, user_prompt, temperature)
        return result, "gpt-4o-mini", "openai"
```

---

## 6. OpenAI Client

```python
# agent/llm/openai_client.py

from openai import AsyncOpenAI
import os

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

async def complete(system_prompt: str, user_prompt: str, temperature: float = 0.7) -> str:
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=temperature,
        response_format={"type": "json_object"},  # enforces JSON output
    )
    return response.choices[0].message.content
```

---

## 7. Qwen VPS Client

```python
# agent/llm/qwen_client.py

from openai import AsyncOpenAI
import os, asyncio

# Qwen via Ollama's OpenAI-compatible endpoint
client = AsyncOpenAI(
    base_url=os.getenv("QWEN_BASE_URL", "http://171.238.156.10:11434/v1"),
    api_key="ollama",      # Ollama doesn't require a real key
)

QWEN_MODEL = os.getenv("QWEN_MODEL", "qwen2.5:7b")
QWEN_TIMEOUT = int(os.getenv("QWEN_TIMEOUT", "15"))

async def complete(system_prompt: str, user_prompt: str, temperature: float = 0.7) -> str:
    response = await asyncio.wait_for(
        client.chat.completions.create(
            model=QWEN_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
        ),
        timeout=QWEN_TIMEOUT,
    )
    return response.choices[0].message.content
```

**Note**: Qwen 2.5 7B với Ollama không hỗ trợ `response_format: json_object`. Cần dùng JSON extraction thủ công hoặc thêm instruction trong prompt:
```
"You MUST respond with valid JSON only. No explanation before or after."
```

---

## 8. Brand Context Block Builder

```python
# agent/agents/base.py

def build_brand_context_block(brand: dict) -> str:
    forbidden = ", ".join(brand.get("forbidden_words", [])) or "none"
    products = ", ".join(brand.get("key_products", [])) or "not specified"
    return f"""Brand: {brand['brand_name']}
Description: {brand['brand_description']}
Tone of voice: {brand['tone_of_voice']}
Target audience: {brand['target_audience']}
Key products: {products}
Forbidden words (NEVER use): {forbidden}
Preferred CTA: {brand.get('preferred_cta', 'Contact us')}
Preferred salutation: {brand.get('preferred_salutation', 'bạn')}"""
```

---

## 9. Agent Run Log Writer

```python
# agent/agents/base.py

import time, httpx, os

API_BASE = os.getenv("INTERNAL_API_URL", "http://api:8000")

async def write_log(log: dict):
    async with httpx.AsyncClient() as client:
        await client.post(f"{API_BASE}/internal/logs", json=log)

async def timed_agent_call(agent_name: str, channel: str | None, step_order: int,
                            system: str, user: str, campaign_id: str) -> tuple[str, dict]:
    start = time.monotonic()
    raw, model, provider = await call_llm(agent_name, system, user)
    duration_ms = int((time.monotonic() - start) * 1000)

    log_entry = {
        "campaign_id": campaign_id,
        "agent_name": agent_name,
        "step_order": step_order,
        "channel": channel,
        "model_used": model,
        "model_provider": provider,
        "prompt_preview": user[:300],
        "output_preview": raw[:300],
        "duration_ms": duration_ms,
        "status": "success",
    }
    await write_log(log_entry)
    return raw, log_entry
```

---

## 10. Error Handling Strategy

| Error Type | Strategy |
|---|---|
| JSON parse error from LLM | Retry 1 time with stricter JSON instruction appended; if still fails → mark step error |
| Qwen VPS timeout | Automatic fallback to OpenAI (see router) |
| OpenAI API error (rate limit, 500) | Retry after 5s, max 2 retries; if still fails → mark campaign failed |
| Brand vault missing | Validate before enqueuing job; return 400 from FastAPI |
| Campaign already running | Return 409 from FastAPI; orchestrator checks status before starting |
