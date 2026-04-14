import os
from openai import AsyncOpenAI

MODEL = "gpt-4o-mini"
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))


async def complete(system_prompt: str, user_prompt: str, temperature: float = 0.7) -> tuple[str, str]:
    response = await client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=temperature,
        response_format={"type": "json_object"},
    )
    return response.choices[0].message.content, MODEL
