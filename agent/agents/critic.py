import json
import re
from agents.base import build_brand_context_block, timed_agent_call

SYSTEM = """Bạn là người kiểm soát chất lượng nội dung marketing nghiêm khắc cho doanh nghiệp nhỏ Việt Nam.
Nhiệm vụ của bạn là xem lại nội dung và đảm bảo nó đúng chuẩn thương hiệu và mục tiêu chiến dịch.
Chỉ trả về JSON hợp lệ, không thêm giải thích."""

USER_TEMPLATE = """<brand_context>
{brand_context}
</brand_context>

<campaign_context>
Tóm tắt chiến dịch: {campaign_summary}
Thông điệp chính: {key_messages}
Yêu cầu deliverable: {deliverable_spec}
</campaign_context>

<draft_content>
Kênh: {channel}
Nội dung nháp: {draft_json}
</draft_content>

Tiêu chí đánh giá:
1. Có đúng giọng văn thương hiệu không? Có dùng từ cấm không?
2. Có truyền tải đủ các thông điệp chính không?
3. Có CTA rõ ràng không?
4. Ngôn ngữ tiếng Việt có tự nhiên không (không có cảm giác dịch máy)?
5. Độ dài có phù hợp với kênh không?

Nếu nội dung đạt yêu cầu: trả về nguyên bản với status "approved".
Nếu có vấn đề: sửa lại và trả về với status "revised".

Trả về JSON:
{{
  "status": "approved|revised",
  "issues_found": ["vấn đề 1 nếu có"],
  "final_content": {{ ...cùng cấu trúc với draft... }}
}}"""


class CriticAgent:
    async def run(self, campaign_id: str, deliverable: dict, draft: dict, brand_vault: dict, plan: dict, step: int) -> dict:
        brand_context = build_brand_context_block(brand_vault)
        channel = deliverable["channel"]

        user_prompt = USER_TEMPLATE.format(
            brand_context=brand_context,
            campaign_summary=plan.get("campaign_summary", ""),
            key_messages=", ".join(plan.get("key_messages", [])),
            deliverable_spec=json.dumps(deliverable, ensure_ascii=False),
            channel=channel,
            draft_json=json.dumps(draft, ensure_ascii=False),
        )

        raw, _ = await timed_agent_call(
            agent_name="critic",
            channel=channel,
            step_order=step,
            system_prompt=SYSTEM,
            user_prompt=user_prompt,
            campaign_id=campaign_id,
            temperature=0.3,
        )

        return self._parse(raw)

    def _parse(self, raw: str) -> dict:
        raw = re.sub(r"```json\s*", "", raw)
        raw = re.sub(r"```\s*", "", raw)
        return json.loads(raw.strip())
