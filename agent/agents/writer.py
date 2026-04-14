import json
import re
from agents.base import build_brand_context_block, timed_agent_call

SYSTEM = """Bạn là chuyên viên viết nội dung marketing cho doanh nghiệp nhỏ Việt Nam.
Hãy viết nội dung đúng phong cách thương hiệu, tự nhiên và thu hút.
Chỉ trả về JSON hợp lệ, không thêm giải thích."""

FACEBOOK_TEMPLATE = """<brand_context>
{brand_context}
</brand_context>

Viết một bài đăng Facebook cho chiến dịch marketing.

Tóm tắt chiến dịch: {campaign_summary}
Thông điệp chính: {key_messages}
Mục tiêu nội dung: {content_goal}
Hướng giọng văn: {tone_hint}
Call-to-action: {cta}

Trả về JSON:
{{
  "copy": "Nội dung bài đăng đầy đủ bằng tiếng Việt, 100-200 từ, dùng xuống dòng cho dễ đọc",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"]
}}"""

EMAIL_TEMPLATE = """<brand_context>
{brand_context}
</brand_context>

Viết email marketing cho chiến dịch.

Tóm tắt chiến dịch: {campaign_summary}
Thông điệp chính: {key_messages}
Mục tiêu nội dung: {content_goal}
Hướng giọng văn: {tone_hint}
Call-to-action: {cta}

Trả về JSON:
{{
  "subject": "Tiêu đề email, 40-60 ký tự, tiếng Việt",
  "body": "Nội dung email đầy đủ tiếng Việt, 150-300 từ, dùng \\n\\n để xuống đoạn, có lời chào và ký tên"
}}"""

VIDEO_SCRIPT_TEMPLATE = """<brand_context>
{brand_context}
</brand_context>

Viết kịch bản video ngắn (30-60 giây) cho chiến dịch.

Tóm tắt chiến dịch: {campaign_summary}
Thông điệp chính: {key_messages}
Mục tiêu nội dung: {content_goal}
Hướng giọng văn: {tone_hint}
Call-to-action: {cta}

Trả về JSON:
{{
  "hook": "5 giây đầu: câu mở đầu gây chú ý hoặc câu hỏi tiếng Việt",
  "body": "Nội dung chính 20-45 giây: truyền tải thông điệp, tiếng Việt, viết như lời nói",
  "cta": "5-10 giây cuối: kêu gọi hành động rõ ràng tiếng Việt",
  "duration_estimate": "30s|45s|60s"
}}"""

TEMPLATES = {
    "facebook_post": FACEBOOK_TEMPLATE,
    "email": EMAIL_TEMPLATE,
    "video_script": VIDEO_SCRIPT_TEMPLATE,
}


class WriterAgent:
    async def run(self, campaign_id: str, deliverable: dict, plan: dict, brand_vault: dict, step: int) -> dict:
        channel = deliverable["channel"]
        template = TEMPLATES.get(channel, FACEBOOK_TEMPLATE)
        brand_context = build_brand_context_block(brand_vault)

        user_prompt = template.format(
            brand_context=brand_context,
            campaign_summary=plan.get("campaign_summary", ""),
            key_messages=", ".join(plan.get("key_messages", [])),
            content_goal=deliverable.get("content_goal", ""),
            tone_hint=deliverable.get("tone_hint", ""),
            cta=deliverable.get("cta", ""),
        )

        raw, _ = await timed_agent_call(
            agent_name="writer",
            channel=channel,
            step_order=step,
            system_prompt=SYSTEM,
            user_prompt=user_prompt,
            campaign_id=campaign_id,
            temperature=0.8,
        )

        return self._parse(raw)

    def _parse(self, raw: str) -> dict:
        raw = re.sub(r"```json\s*", "", raw)
        raw = re.sub(r"```\s*", "", raw)
        return json.loads(raw.strip())
