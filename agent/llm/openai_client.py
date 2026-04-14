import os
from openai import AsyncOpenAI

MODEL = "gpt-4o-mini"
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))


async def complete(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.7,
    json_mode: bool = True,
) -> tuple[str, str, int | None, int | None]:
    request_payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
    }
    if json_mode:
        request_payload["response_format"] = {"type": "json_object"}

    response = await client.chat.completions.create(
        **request_payload,
    )
    usage = response.usage
    return (
        response.choices[0].message.content,
        MODEL,
        usage.prompt_tokens if usage else None,
        usage.completion_tokens if usage else None,
    )
