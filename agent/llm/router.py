from llm.openai_client import complete as openai_complete
from llm.qwen_client import complete as qwen_complete

ROUTING_TABLE: dict[str, str] = {
    "strategist":   "openai",
    "writer":       "qwen",
    "critic":       "openai",
    "dashboard_ai": "qwen",
    "image_prompt_qwen": "qwen",
    "image_prompt_refiner": "openai",
}

JSON_AGENTS: set[str] = {
    "strategist",
    "writer",
    "critic",
    "dashboard_ai",
}


async def call_llm(
    agent_name: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.7,
) -> tuple[str, str, str, int | None, int | None]:
    """Returns (raw_text, model_name, provider_name, input_tokens, output_tokens)"""
    provider = ROUTING_TABLE.get(agent_name, "openai")
    json_mode = agent_name in JSON_AGENTS

    if provider == "qwen":
        try:
            raw, model, in_tok, out_tok = await qwen_complete(
                system_prompt,
                user_prompt,
                temperature,
                json_mode=json_mode,
            )
            return raw, model, "qwen", in_tok, out_tok
        except Exception:
            # Qwen unavailable — fall back to OpenAI; mark provider so UI can flag it
            raw, model, in_tok, out_tok = await openai_complete(
                system_prompt,
                user_prompt,
                temperature,
                json_mode=json_mode,
            )
            return raw, model, "qwen→gpt", in_tok, out_tok
    else:
        raw, model, in_tok, out_tok = await openai_complete(
            system_prompt,
            user_prompt,
            temperature,
            json_mode=json_mode,
        )
        return raw, model, "openai", in_tok, out_tok
