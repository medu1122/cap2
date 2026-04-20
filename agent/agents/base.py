import time
import httpx
import os
from llm.router import call_llm

API_BASE = os.getenv("INTERNAL_API_URL", "http://api:8000")


def build_brand_context_block(brand: dict) -> str:
    forbidden = ", ".join(brand.get("forbidden_words") or []) or "không có"
    products = ", ".join(brand.get("key_products") or []) or "chưa chỉ định"
    email = (brand.get("contact_email") or "").strip() or "chưa có"
    phone = (brand.get("phone") or "").strip() or "chưa có"
    addr = (brand.get("address") or "").strip() or "chưa có"
    return (
        f"Brand: {brand.get('brand_name', '')}\n"
        f"Mô tả: {brand.get('brand_description', '')}\n"
        f"Giọng văn: {brand.get('tone_of_voice', '')}\n"
        f"Khách hàng mục tiêu: {brand.get('target_audience', '')}\n"
        f"Sản phẩm chính: {products}\n"
        f"Từ cấm (KHÔNG được dùng): {forbidden}\n"
        f"CTA ưa dùng: {brand.get('preferred_cta', 'Liên hệ ngay')}\n"
        f"Cách xưng hô: {brand.get('preferred_salutation', 'bạn')}\n"
        f"Email liên hệ: {email}\n"
        f"SĐT: {phone}\n"
        f"Địa chỉ: {addr}"
    )


async def _post_log(payload: dict) -> None:
    """Fire-and-forget log post to internal API."""
    async with httpx.AsyncClient(timeout=5) as client:
        try:
            await client.post(f"{API_BASE}/internal/logs", json=payload)
        except Exception:
            pass


async def timed_agent_call(
    agent_name: str,
    channel: str | None,
    step_order: int,
    system_prompt: str,
    user_prompt: str,
    campaign_id: str,
    temperature: float = 0.7,
) -> tuple[str, dict]:
    # Emit "running" signal so frontend can show the active step in realtime
    await _post_log({
        "campaign_id": campaign_id,
        "agent_name": agent_name,
        "step_order": step_order,
        "channel": channel,
        "model_used": "pending",
        "model_provider": "pending",
        "status": "running",
    })

    start = time.monotonic()
    raw, model, provider, in_tokens, out_tokens = await call_llm(agent_name, system_prompt, user_prompt, temperature)
    duration_ms = int((time.monotonic() - start) * 1000)

    log_entry = {
        "campaign_id": campaign_id,
        "agent_name": agent_name,
        "step_order": step_order,
        "channel": channel,
        "model_used": model,
        "model_provider": provider,
        "prompt_preview": user_prompt[:300],
        "output_preview": raw[:300],
        "duration_ms": duration_ms,
        "input_tokens": in_tokens,
        "output_tokens": out_tokens,
        "status": "success",
    }
    await _post_log(log_entry)

    return raw, log_entry
