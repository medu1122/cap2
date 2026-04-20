import os
import asyncio
from openai import AsyncOpenAI

QWEN_BASE_URL = os.getenv("QWEN_BASE_URL", "http://171.238.156.10:11434/v1")
QWEN_MODEL = os.getenv("QWEN_MODEL", "qwen2.5:14b")
QWEN_TIMEOUT = int(os.getenv("QWEN_TIMEOUT", "180"))

client = AsyncOpenAI(
    base_url=QWEN_BASE_URL,
    api_key="ollama",
)


async def complete(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.7,
    json_mode: bool = True,
) -> tuple[str, str, int | None, int | None]:
    final_system_prompt = system_prompt
    if json_mode:
        final_system_prompt = (
            system_prompt + "\n\nYou MUST respond with valid JSON only. No explanation before or after."
        )

    response = await asyncio.wait_for(
        client.chat.completions.create(
            model=QWEN_MODEL,
            messages=[
                {"role": "system", "content": final_system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
        ),
        timeout=QWEN_TIMEOUT,
    )
    usage = response.usage
    return (
        response.choices[0].message.content,
        QWEN_MODEL,
        usage.prompt_tokens if usage else None,
        usage.completion_tokens if usage else None,
    )
