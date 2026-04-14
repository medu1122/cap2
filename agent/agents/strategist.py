import json
import re
from agents.base import build_brand_context_block, timed_agent_call

SYSTEM = """You are a senior marketing strategist helping small businesses in Vietnam.
Your job is to analyze a campaign brief and create a structured campaign plan.
Always respond in valid JSON only. No explanation before or after the JSON."""

USER_TEMPLATE = """<brand_context>
{brand_context}
</brand_context>

<campaign_brief>
Tên chiến dịch: {campaign_name}
Mục tiêu: {objective}
Sản phẩm/Dịch vụ: {product_or_service}
Khách hàng mục tiêu: {target_audience}
Ưu đãi/Hook: {offer_or_hook}
Deadline: {deadline}
Kênh yêu cầu: {channels}
Ghi chú thêm: {additional_notes}
</campaign_brief>

Respond with exactly this JSON schema:
{{
  "campaign_summary": "2-3 câu tóm tắt chiến lược bằng tiếng Việt",
  "key_messages": ["thông điệp 1", "thông điệp 2", "thông điệp 3"],
  "deliverables": [
    {{
      "channel": "facebook_post|email|video_script",
      "content_goal": "Mục tiêu cụ thể của nội dung này",
      "tone_hint": "Hướng dẫn giọng văn cụ thể cho kênh này",
      "cta": "Call-to-action cụ thể cần sử dụng"
    }}
  ]
}}

Include one deliverable for each requested channel."""


class StrategistAgent:
    async def run(self, campaign_id: str, brief: dict, brand_vault: dict) -> dict:
        brand_context = build_brand_context_block(brand_vault)
        user_prompt = USER_TEMPLATE.format(
            brand_context=brand_context,
            campaign_name=brief.get("campaign_name", ""),
            objective=brief.get("objective", ""),
            product_or_service=brief.get("product_or_service", ""),
            target_audience=brief.get("target_audience") or brand_vault.get("target_audience", ""),
            offer_or_hook=brief.get("offer_or_hook", ""),
            deadline=brief.get("deadline", ""),
            channels=", ".join(brief.get("channels", [])),
            additional_notes=brief.get("additional_notes") or "Không có",
        )

        raw, _ = await timed_agent_call(
            agent_name="strategist",
            channel=None,
            step_order=1,
            system_prompt=SYSTEM,
            user_prompt=user_prompt,
            campaign_id=campaign_id,
            temperature=0.6,
        )

        return self._parse(raw)

    def _parse(self, raw: str) -> dict:
        raw = re.sub(r"```json\s*", "", raw)
        raw = re.sub(r"```\s*", "", raw)
        return json.loads(raw.strip())
