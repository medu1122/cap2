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

Viết kịch bản video ngắn (TikTok/Reels/YouTube Shorts) CHẤT LƯỢNG CAO cho chiến dịch.

═ CHIẾN DỊCH ═
Tóm tắt: {campaign_summary}
Thông điệp chính: {key_messages}
Mục tiêu: {content_goal}
Hướng giọng văn: {tone_hint}
CTA: {cta}

═ YÊU CẦU NGHIÊM NGẶT ═

1. HOOK (0-5 giây) — YẾU TỐ QUYẾT ĐỊNH VIRAL
   Viết 3 hook khác nhau (để người dùng chọn):
   - Hook A (Sốc/Tò mò): Dùng số liệu gây sốc, câu hỏi, hoặc thị phạm trực tiếp
   - Hook B (Cảm xúc): Kể câu chuyện cá nhân, trải nghiệm thật, khiến người xem đồng cảm
   - Hook C (Giá trị/Giáo dục): Chia sẻ mẹo hữu ích, giải đáp thắc mắc phổ biến

2. CẤU TRÚC SCENE-BY-SCENE
   Mỗi scene phải có đủ:
   - Thời lượng (giây)
   - Mô tả hình ảnh trên màn hình (visual)
   - Lời thoại/dialogue chính
   - Text overlay (dòng chữ hiển thị trên video)
   - Gợi ý B-roll
   - Âm thanh/nhạc nền gợi ý
   - Mục đích của scene (hook|tạo đau đầu|giới thiệu|chứng minh|cta)
   - Cách chuyển scene tiếp theo

   Cấu trúc khuyến nghị:
   - Scene 1 (0-5s): HOOK — gây sốc hoặc tò mò
   - Scene 2 (5-15s): VẤN ĐỀ — đặt câu hỏi, tạo đau đầu
   - Scene 3 (15-30s): GIẢI PHÁP — giới thiệu sản phẩm/dịch vụ một cách tự nhiên
   - Scene 4 (30-45s): CHỨNG MINH — testimonial, kết quả thực, số liệu
   - Scene 5 (45-55s): CTA — kêu gọi hành động kèm urgency

3. TRENDING TACTICS
   Áp dụng ít nhất 2 trong số các format đang viral:
   - "POV" (điểm nhìn ngôi thứ nhất)
   - "Day in my life" / "Quay ra trước + sau"
   - "Thử thách" (challenge)
   - "So sánh before/after"
   - "Giải thích ngắn gọn" (explainer)
   - "Storytime" (kể chuyện có plot twist)
   - "Unboxing/review"

4. TEXT OVERLAY STRATEGY
   - Tối đa 6-8 từ mỗi dòng
   - Font lớn, dễ đọc trên mobile
   - Dùng emoji để tăng engagement
   - Highlight từ khóa quan trọng

5. CTA (CALL-TO-ACTION)
   Viết 2 phiên bản:
   - Soft CTA: Gợi ý, không ép buộc (VD: "Nếu bạn thấy hữu ích, hãy...")
   - Hard CTA: Rõ ràng, kèm urgency (VD: "Đừng bỏ lỡ — ưu đãi chỉ còn...")

6. HASHTAG STRATEGY
   Gợi ý 10 hashtag phân theo tier:
   - 2 hashtag thương hiệu (brand)
   - 3 hashtag ngành/lĩnh vực
   - 3 hashtag trending (có thể không liên quan trực tiếp nhưng đang hot)
   - 2 hashtag niche/community

7. MUSIC/SOUND SUGGESTION
   - Gợi ý mood nhạc (happy, dramatic, mystery, upbeat...)
   - Gợi ý loại âm thanh phù hợp với từng scene

8. CAPTION (CHÚ THÍCH)
   Viết caption hoàn chỉnh để đăng kèm video:
   - Dòng 1: Hook caption (gây tò mò, dẫn dắt)
   - Dòng 2-3: Mô tả ngắn nội dung
   - Dòng cuối: CTA nhẹ + hashtag

═ ĐỊNH DẠNG TRẢ VỀ ═
CHỈ trả về JSON hợp lệ, KHÔNG thêm text giải thích:

{{
  "duration": "30-60 giây",
  "recommended_format": "TikTok|Reels|YouTube Shorts hoặc kết hợp",
  "trending_format_used": "Tên format trending được áp dụng (VD: POV, Before/After...)",

  "hooks": {{
    "A_type": "Sốc/Tò mò",
    "A_text": "...",
    "A_text_overlay": "...",
    "A_why_viral": "Giải thích ngắn tại sao hook này hiệu quả",
    "B_type": "Cảm xúc",
    "B_text": "...",
    "B_text_overlay": "...",
    "B_why_viral": "...",
    "C_type": "Giá trị/Giáo dục",
    "C_text": "...",
    "C_text_overlay": "...",
    "C_why_viral": "..."
  }},

  "scenes": [
    {{
      "scene_number": 1,
      "time_range": "0-5 giây",
      "visual": "Mô tả hình ảnh trên màn hình (camera angle, đối tượng, bối cảnh)",
      "dialogue": "Lời thoại/dialogue chính (nếu có)",
      "text_overlay": "Dòng chữ hiển thị trên video",
      "broll_suggestion": "Gợi ý B-roll cần quay hoặc lấy",
      "sound": "Âm thanh/nhạc cho scene này",
      "purpose": "hook|tạo đau đầu|giới thiệu|chứng minh|cta",
      "transition": "Cách chuyển sang scene tiếp theo"
    }}
  ],

  "cta": {{
    "soft": "...",
    "soft_text_overlay": "...",
    "hard": "...",
    "hard_text_overlay": "..."
  }},

  "caption": "Caption hoàn chỉnh để đăng kèm video",

  "hashtags": {{
    "brand": ["#...", "#..."],
    "industry": ["#...", "#...", "#..."],
    "trending": ["#...", "#...", "#..."],
    "niche": ["#...", "#..."]
  }},

  "music_mood": "Mô tả mood nhạc phù hợp (VD: upbeat, dramatic, calming...)",
  "music_suggestion": "Loại âm thanh/nhạc gợi ý",
  "production_tips": "2-3 mẹo quay để video đẹp và chuyên nghiệp hơn"
}}

Chỉ trả về JSON. Không thêm ```markdown, không thêm dòng giải thích."""

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
        for attempt in range(2):
            try:
                cleaned = re.sub(r"```json\s*|```\s*", "", raw).strip()
                return json.loads(cleaned)
            except json.JSONDecodeError:
                if attempt == 0:
                    last_brace = raw.rfind("}")
                    if last_brace != -1:
                        raw = raw[: last_brace + 1]
        raise ValueError(f"Không parse được JSON từ AI: {raw[:200]}")
