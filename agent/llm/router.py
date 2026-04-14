from llm.openai_client import complete as openai_complete
from llm.qwen_client import complete as qwen_complete

ROUTING_TABLE: dict[str, str] = {
    "strategist":   "openai",
    "writer":       "qwen",
    "critic":       "openai",
    "dashboard_ai": "qwen",
}


async def call_llm(
    agent_name: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.7,
) -> tuple[str, str, str]:
    """Returns (raw_text, model_name, provider_name)"""
    provider = ROUTING_TABLE.get(agent_name, "openai")

    if provider == "qwen":
        try:
            raw, model = await qwen_complete(system_prompt, user_prompt, temperature)
            return raw, model, "qwen"
        except Exception:
            raw, model = await openai_complete(system_prompt, user_prompt, temperature)
            return raw, model, "openai"
    else:
        raw, model = await openai_complete(system_prompt, user_prompt, temperature)
        return raw, model, "openai"
