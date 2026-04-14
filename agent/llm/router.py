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
) -> tuple[str, str, str, int | None, int | None]:
    """Returns (raw_text, model_name, provider_name, input_tokens, output_tokens)"""
    provider = ROUTING_TABLE.get(agent_name, "openai")

    if provider == "qwen":
        try:
            raw, model, in_tok, out_tok = await qwen_complete(system_prompt, user_prompt, temperature)
            return raw, model, "qwen", in_tok, out_tok
        except Exception:
            raw, model, in_tok, out_tok = await openai_complete(system_prompt, user_prompt, temperature)
            return raw, model, "openai", in_tok, out_tok
    else:
        raw, model, in_tok, out_tok = await openai_complete(system_prompt, user_prompt, temperature)
        return raw, model, "openai", in_tok, out_tok
