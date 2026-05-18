"""
Demo shortcut service — pre-built content for known demo patterns.

Khi user nhập đúng pattern (brand + campaign name + channels + deadline),
hệ thống trả content ngay lập tức thay vì chạy AI ~2-3 phút.

Cách thêm demo pattern mới:
1. Thêm function detect_xxx() trả True nếu input khớp pattern
2. Thêm get_xxx_content() trả dict content theo đúng schema
3. Thêm vào DEMO_PATTERNS trong check_and_run_demo()
"""

import httpx
import os
from datetime import date, timedelta

API_BASE = os.getenv("INTERNAL_API_URL", "http://api:8000")

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _parse_deadline(deadline_str: str | None) -> str:
    """Trả deadline đã tính publish dates tương tự orchestrator."""
    if not deadline_str:
        return str(date.today() + timedelta(days=30))
    try:
        d = date.fromisoformat(deadline_str)
        return str(d)
    except ValueError:
        return str(date.today() + timedelta(days=30))


def _days_from_today(deadline_str: str | None) -> int:
    try:
        d = date.fromisoformat(deadline_str) if deadline_str else date.today() + timedelta(days=30)
        return max((d - date.today()).days, 1)
    except ValueError:
        return 30


def _spread_dates(deadline_str: str | None, count: int) -> list[str]:
    """Tạo list ngày publish cách đều trong khoảng deadline."""
    days = _days_from_today(deadline_str)
    step = max(days // (count + 1), 1)
    return [str(date.today() + timedelta(days=i)) for i in range(step, step * count + 1, step)][:count]


# ─────────────────────────────────────────────────────────────────────────────
# Detect functions — trả True nếu input khớp pattern
# ─────────────────────────────────────────────────────────────────────────────

def _is_dana_english_center(brief: dict, brand_vault: dict | None) -> bool:
    """Pattern: Trung tâm anh ngữ Dana / giảm giá học phí / tháng 6."""
    brand_name = (brand_vault.get("brand_name", "") or "").lower() if brand_vault else ""
    campaign_name = (brief.get("campaign_name", "") or "").lower()
    objective = (brief.get("objective", "") or "").lower()
    offer = (brief.get("offer_or_hook", "") or "").lower()
    product = (brief.get("product_or_service", "") or "").lower()

    keywords_brand = ["dana", "trung tâm anh ngữ dana"]
    keywords_offer = ["5%", "giảm giá", "giảm", "học phí"]
    keywords_product = ["toeic", "ielts", "chứng chỉ", "anh ngữ", "học"]

    has_brand = any(k in brand_name for k in keywords_brand)
    has_offer = any(k in offer for k in keywords_offer) or any(k in objective for k in keywords_offer)
    has_product = any(k in product for k in keywords_product)

    return has_brand or (has_offer and has_product)


# ─────────────────────────────────────────────────────────────────────────────
# Pre-built content cho Trung tâm anh ngữ Dana
# ─────────────────────────────────────────────────────────────────────────────

def _build_dana_content(brief: dict, channels: list[str], brand_vault: dict | None) -> dict:
    """Content pre-built cho chiến dịch Trung tâm anh ngữ Dana - giảm 5% học phí tháng 6."""
    brand_name = brand_vault.get("brand_name", "Trung tâm Anh Ngữ Dana") if brand_vault else "Trung tâm Anh Ngữ Dana"
    deadline = brief.get("deadline")

    dates = _spread_dates(deadline, len(channels))

    content = {}

    if "facebook_post" in channels:
        idx = channels.index("facebook_post")
        content["facebook_post"] = {
            "copy": (
                "Hè này, chinh phục TOEIC không lo về giá!\n\n"
                "Trung tâm Anh Ngữ Dana tung ưu đãi GIẢM 5% HỌC PHÍ toàn bộ khóa học TOEIC, "
                "dành cho tất cả học viên đăng ký trong tháng 6.\n\n"
                "📚 TOEIC Foundation — nền tảng vững chắc từ đầu\n"
                "📈 TOEIC Intensive — luyện đề chuyên sâu\n"
                "🗣️ TOEIC Speaking & Writing — nâng cao phản xạ thực tế\n\n"
                "🎁 Ưu đãi chỉ áp dụng tháng 6 — đăng ký ngay, không bỏ lỡ!\n\n"
                "Liên hệ ngay để được tư vấn lộ trình phù hợp với trình độ của bạn."
            ),
            "hashtags": [
                "toeic", "hoctoeic", "luyenthiToeic", "anhngudan",
                "trungtamanhngu", "ielts", "chungchiquocte",
                "học tiếng anh", "giarefnhathcm", "kmthang6",
            ],
            "image_prompt": (
                "A motivated young Vietnamese student, 18-25 years old, sitting confidently "
                "at a modern language school desk in Ho Chi Minh City, smiling while studying "
                "TOEIC textbooks and practice tests. Natural window light, candid lifestyle "
                "photography, 35mm lens feel, realistic documentary style. The atmosphere is "
                "warm, focused, and aspirational. No text overlay, no logos, no readable signs."
            ),
        }

    if "email" in channels:
        idx = channels.index("email")
        content["email"] = {
            "subject": (
                "Tháng 6 rực rỡ — Giảm ngay 5% học phí TOEIC tại Trung tâm Anh Ngữ Dana!"
            ),
            "body": (
                "Xin chào bạn,\n\n"
                "Trung tâm Anh ngữ Dana gửi đến bạn tin vui: GIẢM 5% học phí cho toàn bộ các khóa TOEIC "
                "dành cho học viên đăng ký trong tháng 6 này!\n\n"
                "Tại sao nên chọn Dana?\n"
                "• Đội ngũ giáo viên giàu kinh nghiệm, tận tâm hỗ trợ học viên\n"
                "• Lộ trình học được cá nhân hóa theo trình độ và mục tiêu của bạn\n"
                "• Lớp học quy mô nhỏ, tối đa 12 học viên/lớp\n"
                "• Tỷ lệ học viên đạt mục tiêu điểm TOEIC cao\n"
                "• Học phí hợp lý cùng nhiều chương trình ưu đãi hấp dẫn mỗi tháng\n\n"
                "Các khóa học đang được áp dụng ưu đãi:\n"
                "• TOEIC Foundation — Dành cho người mới bắt đầu, xây dựng nền tảng tiếng Anh vững chắc\n"
                "• TOEIC Intensive — Luyện đề chuyên sâu, phù hợp với người cần tăng điểm nhanh\n"
                "• TOEIC Speaking & Writing — Nâng cao kỹ năng giao tiếp và phản xạ thực tế\n\n"
                "Ưu đãi chỉ áp dụng trong tháng 6 — Đăng ký ngay hôm nay để không bỏ lỡ!\n\n"
                "Đừng bỏ lỡ cơ hội này! Liên hệ ngay với chúng tôi qua số điện thoại hoặc gửi email "
                "để đăng ký và nhận ưu đãi nhé!\n\n"
                "Chúng tôi rất mong được đồng hành cùng bạn trên hành trình chinh phục mục tiêu TOEIC.\n\n"
                "Thân ái,\n"
                "Đội ngũ Trung tâm Anh ngữ Dana"
            ),
        }

    if "video_script" in channels:
        idx = channels.index("video_script")
        content["video_script"] = {
            "duration": "45-60 giây",
            "recommended_format": "TikTok / Reels",
            "trending_format_used": "POV + Giải thích ngắn gọn",
            "hooks": {
                "A_type": "Sốc/Tò mò",
                "A_text": "Bạn có biết chỉ cần đăng ký TOEIC trong tháng 6 này, bạn đã tiết kiệm được cả triệu đồng không?",
                "A_text_overlay": "😱 TIẾT KIỆM CẢ TRIỆU ĐỒNG!",
                "A_why_viral": "Số liệu cụ thể gây tò mò, kích thích click",
            },
            "scenes": [
                {
                    "scene_number": 1,
                    "time_range": "0-5 giây",
                    "visual": "Close-up khuôn mặt bất ngờ của một bạn trẻ khi nhìn điện thoại (POV shot), "
                              "ánh sáng tự nhiên từ cửa sổ, background phòng học hiện đại",
                    "dialogue": "Bạn có biết chỉ cần đăng ký TOEIC trong tháng 6 này, "
                                "bạn đã tiết kiệm được cả triệu đồng không?",
                    "text_overlay": "😱 TIẾT KIỆM CẢ TRIỆU ĐỒNG!",
                    "broll_suggestion": "Close-up màn hình điện thoại hiển thị thông báo ưu đãi",
                    "sound": "Nhạc nền nhẹ nhàng, có tiếng 'wow' nhẹ ở cuối",
                    "purpose": "hook",
                    "transition": "Cắt nhanh sang scene tiếp theo",
                },
                {
                    "scene_number": 2,
                    "time_range": "5-15 giây",
                    "visual": "Phỏng vấn nhanh một bạn học viên đang ngồi học tại Trung tâm, "
                              "camera di chuyển chậm quanh không gian lớp học sáng sủa",
                    "dialogue": "Mình đã đăng ký khóa TOEIC Intensive tại Trung tâm Anh Ngữ Dana "
                                "và được giảm ngay 5% học phí. Quá tuyệt phải không!",
                    "text_overlay": "🎓 TOEIC Intensive — GIẢM 5% ngay!",
                    "broll_suggestion": "Shots lớp học thực tế, học viên đang làm bài tập, "
                                        "giáo viên hướng dẫn",
                    "sound": "Nhạc nền upbeat nhẹ, tạo cảm giác tích cực",
                    "purpose": "giới thiệu",
                    "transition": "Zoom in nhẹ vào poster ưu đãi trên tường",
                },
                {
                    "scene_number": 3,
                    "time_range": "15-30 giây",
                    "visual": "Montage nhanh: (1) Giáo viên giảng bài, (2) Học viên thực hành speaking, "
                              "(3) Khu vực tự học hiện đại, (4) Thành tích học viên đạt điểm cao",
                    "dialogue": "Trung tâm Anh Ngữ Dana có đội ngũ giáo viên giàu kinh nghiệm, "
                                "lớp học nhỏ tối đa 12 người, và tỷ lệ học viên đạt mục tiêu điểm TOEIC cực cao. "
                                "Mà học phí lại rất hợp lý!",
                    "text_overlay": "🏆 Tỷ lệ đạt mục tiêu TOEIC cao",
                    "broll_suggestion": "Montage ngắn: giáo viên giảng bài, học viên speaking, "
                                        "kết quả thi TOEIC",
                    "sound": "Nhạc chuyển đoạn, tạo động lực",
                    "purpose": "chứng minh",
                    "transition": "Cắt sang scene CTA với background đẹp",
                },
                {
                    "scene_number": 4,
                    "time_range": "30-45 giây",
                    "visual": "GV hoặc admin đứng trước bảng thông tin Trung tâm, "
                              "năng động, thân thiện, có thể mặc đồng phục nếu có",
                    "dialogue": "Nhưng ưu đãi này CHỈ áp dụng trong tháng 6 thôi nhé! "
                                "Đăng ký ngay để nhận giảm 5%, không bỏ lỡ! "
                                "Link đăng ký ở bio, inbox cho Trung tâm hoặc comment bên dưới.",
                    "text_overlay": "⚡ CHỈ CÒN THÁNG 6 — ĐĂNG KÝ NGAY!",
                    "broll_suggestion": "Shot Trung tâm từ ngoài vào, không gian chuyên nghiệp",
                    "sound": "Nhạc kết thúc, build urgency, có tiếng 'đồng hồ tích tắc' nhẹ",
                    "purpose": "cta",
                    "transition": "Freeze frame vào logo/poster ưu đãi",
                },
            ],
            "cta": {
                "soft": "Nếu bạn thấy hữu ích, hãy lưu lại và chia sẻ cho bạn bè nhé!",
                "soft_text_overlay": "💾 Lưu lại — Chia sẻ ngay!",
                "hard": "ĐĂNG KÝ NGAY — Ưu đãi giảm 5% học phí TOEIC chỉ áp dụng tháng 6! "
                        "Đừng bỏ lỡ cơ hội này!",
                "hard_text_overlay": "🔥 ĐĂNG KÝ NGAY — CÒN ƯU ĐÃI!",
            },
            "caption": (
                "Hè này học TOEIC không lo về giá!\n\n"
                "Trung tâm Anh Ngữ Dana GIẢM NGAY 5% HỌC PHÍ toàn bộ khóa TOEIC cho "
                "học viên đăng ký trong tháng 6.\n\n"
                "📚 TOEIC Foundation | 📈 TOEIC Intensive | 🗣️ TOEIC Speaking & Writing\n"
                "— Đội ngũ giáo viên giàu kinh nghiệm\n"
                "— Lớp nhỏ tối đa 12 học viên\n"
                "— Tỷ lệ đạt mục tiêu TOEIC cao\n\n"
                "⚡ Ưu đãi chỉ áp dụng tháng 6 — Đăng ký ngay!\n\n"
                "#toeic #hoctoeic #anhngudan #trungtamanhngu #ielts "
                "#chungchiquocte #họctiếnganh #hcm #kmthang6"
            ),
            "hashtags": {
                "brand": ["#anhngudan", "#trungtamanhngudan"],
                "industry": ["#toeic", "#hoctoeic", "#luyenthiToeic", "#chungchiquocte", "#họctiếnganh"],
                "trending": ["#hcm", "#studygram", "#learnenglish", "#englishlearning"],
                "niche": ["#giarefnhathcm", "#kmthang6", "#toeicvietnam"],
            },
            "music_mood": "Upbeat, tích cực, tạo động lực — phù hợp gen Z và sinh viên",
            "music_suggestion": "Trending TikTok study beats, nhạc upbeat nhẹ nhàng tạo cảm hứng",
            "production_tips": [
                "Quay ở không gian thật của Trung tâm (phòng học, khu vực tự học) để tăng độ tin cậy",
                "Dùng ánh sáng tự nhiên từ cửa sổ, tránh đèn huỳnh quang gây shadow xấu trên mặt",
                "Thêm subtitles/caption trên video vì nhiều người xem không bật tiếng",
            ],
        }

    return content


# ─────────────────────────────────────────────────────────────────────────────
# Pre-built strategist plan
# ─────────────────────────────────────────────────────────────────────────────

def _build_dana_plan(brief: dict, channels: list[str]) -> dict:
    """Strategist plan pre-built cho Dana English Center."""
    return {
        "campaign_summary": (
            "Chiến dịch 'Giảm 5% học phí TOEIC tháng 6' của Trung tâm Anh Ngữ Dana nhắm đến "
            "học sinh, sinh viên và người đi làm muốn chinh phục chứng chỉ TOEIC. "
            "Mục tiêu chính là tạo urgency bằng ưu đãi giới hạn thời gian, "
            "thuyết phục khách hàng đăng ký sớm trong tháng 6."
        ),
        "target_audience": (
            "Học sinh lớp 11-12 chuẩn bị xin việc hoặc du học, sinh viên năm 2-4 "
            "cần chứng chỉ để xin việc, người đi làm muốn nâng điểm TOEIC để thăng tiến."
        ),
        "key_messages": [
            "Giảm 5% học phí — ưu đãi chỉ trong tháng 6",
            "Đội ngũ giáo viên giàu kinh nghiệm, tận tâm hỗ trợ",
            "Tỷ lệ học viên đạt mục tiêu điểm TOEIC cao",
            "Lớp học nhỏ, cá nhân hóa theo trình độ",
        ],
        "visual_direction": (
            "Hình ảnh thật tại Trung tâm, phong cách documentary-lifestyle. "
            "Màu sắc tươi sáng, năng động, phù hợp gen Z. "
            "Tránh ảnh stock quá hoàn hảo — ưu tiên khoảnh khắc chân thật của học viên."
        ),
        "deliverables": [
            {"channel": "facebook_post", "content_goal": "Tạo FOMO — urgency mua ngay tháng 6"},
            {"channel": "email", "content_goal": "Thuyết phục đăng ký qua email cá nhân hóa"},
            {"channel": "video_script", "content_goal": "Viral TikTok/Reels với hook gây tò mò và CTA rõ ràng"},
        ],
        "tone_of_voice": "Nhiệt tình, gần gũi, tạo cảm giác khuyến khích — không ép buộc.",
        "demo_shortcut": True,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Pre-built image prompt
# ─────────────────────────────────────────────────────────────────────────────

def _build_dana_image_prompt() -> dict:
    return {
        "image_prompt_qwen": (
            "A motivated young Vietnamese woman, 20 years old, sitting at a modern "
            "language school desk in Ho Chi Minh City, smiling confidently while "
            "studying IELTS books and practice tests. She wears casual student outfit, "
            "natural lighting from large windows, candid documentary photography style, "
            "35mm lens, warm and aspirational atmosphere. The background shows a clean "
            "modern classroom with English books on shelves."
        ),
        "image_prompt_final": (
            "A motivated young Vietnamese woman, 20 years old, sitting at a modern "
            "language school desk in Ho Chi Minh City, smiling confidently while "
            "studying IELTS books and practice tests. She wears casual student outfit, "
            "natural lighting from large windows, candid documentary photography style, "
            "35mm lens, warm and aspirational atmosphere. The background shows a clean "
            "modern classroom with English books on shelves. Photorealistic, natural "
            "window light, no text, no logos, no watermarks."
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Main: check pattern and run demo
# ─────────────────────────────────────────────────────────────────────────────

async def check_and_run_demo(campaign_id: str, brief: dict, brand_vault: dict | None) -> bool:
    """
    Kiểm tra xem input có khớp demo pattern không.
    Nếu khớp → tạo content ngay, emit SSE events, trả True.
    Không khớp → trả False (orchestrator sẽ chạy AI bình thường).
    """
    channels = brief.get("channels", [])

    if not channels:
        return False

    # Pattern 1: Trung tâm anh ngữ Dana
    if _is_dana_english_center(brief, brand_vault):
        await _run_dana_demo(campaign_id, brief, brand_vault, channels)
        return True

    return False


async def _emit_sse(client: httpx.AsyncClient, campaign_id: str, payload: dict):
    """Emit SSE event cho frontend."""
    try:
        await client.post(
            f"{API_BASE}/internal/campaigns/{campaign_id}/sse-event",
            json=payload,
        )
    except Exception:
        pass  # Non-blocking


async def _save_content_item(client: httpx.AsyncClient, campaign_id: str, channel: str, content_json: dict, scheduled_date: str | None):
    """Lưu content item vào DB qua internal API."""
    try:
        await client.post(
            f"{API_BASE}/internal/content",
            json={
                "campaign_id": campaign_id,
                "channel": channel,
                "version": 1,
                "status": "pending_approval",
                "content_json": content_json,
                "scheduled_date": scheduled_date,
            },
        )
    except Exception:
        pass


async def _run_dana_demo(campaign_id: str, brief: dict, brand_vault: dict | None, channels: list[str]):
    """Chạy demo shortcut cho Trung tâm Anh Ngữ Dana."""
    async with httpx.AsyncClient(timeout=60) as client:
        # Bước 1: Emit plan done
        plan = _build_dana_plan(brief, channels)
        await client.patch(
            f"{API_BASE}/internal/campaigns/{campaign_id}",
            json={"status": "running", "campaign_plan_json": plan},
        )
        await _emit_sse(client, campaign_id, {
            "type": "step_done",
            "step": "strategist",
            "message": "Phân tích chiến lược xong! Bắt đầu viết nội dung...",
            "plan_summary": plan.get("campaign_summary", ""),
        })

        # Bước 2: Generate content cho từng channel
        content = _build_dana_content(brief, channels, brand_vault)
        publish_dates = _spread_dates(brief.get("deadline"), len(channels))

        for idx, channel in enumerate(channels):
            if channel not in content:
                continue

            await _emit_sse(client, campaign_id, {
                "type": "writing_started",
                "channel": channel,
                "message": f"AI đang viết nội dung {channel}...",
            })

            # Giả lập thời gian viết (1-2 giây mỗi channel)
            import asyncio
            await asyncio.sleep(0.5)

            await _save_content_item(
                client, campaign_id, channel, content[channel], publish_dates[idx]
            )

            await _emit_sse(client, campaign_id, {
                "type": "content_progress",
                "channel": channel,
                "content_json": content[channel],
                "scheduled_date": publish_dates[idx],
            })

            await _emit_sse(client, campaign_id, {
                "type": "step_done",
                "step": f"content_{channel}",
                "message": f"Nội dung {channel} đã hoàn thành!",
            })

        # Bước 3: Image prompt nếu cần
        additional_notes = (brief.get("additional_notes") or "").lower()
        image_required = "[image_required]" in additional_notes

        if image_required:
            await _emit_sse(client, campaign_id, {
                "type": "step_done",
                "step": "content_writing",
                "message": "Tất cả nội dung viết xong! Bắt đầu tạo ảnh chiến dịch...",
            })

            import asyncio
            await asyncio.sleep(0.3)

            image_prompts = _build_dana_image_prompt()
            plan.update(image_prompts)
            await client.patch(
                f"{API_BASE}/internal/campaigns/{campaign_id}",
                json={"status": "running", "campaign_plan_json": plan},
            )

            await _emit_sse(client, campaign_id, {
                "type": "step_done",
                "step": "image_prompt_draft",
                "message": "Đang tinh chỉnh prompt cho ảnh...",
            })

            await asyncio.sleep(0.3)

            await _emit_sse(client, campaign_id, {
                "type": "step_done",
                "step": "image_prompt_final",
                "message": "Tạo ảnh chiến dịch xong!",
            })
        else:
            await _emit_sse(client, campaign_id, {
                "type": "step_done",
                "step": "content_writing",
                "message": "Tất cả nội dung viết xong!",
            })

        # Bước 4: Finalize
        await client.patch(
            f"{API_BASE}/internal/campaigns/{campaign_id}",
            json={"status": "pending_approval"},
        )

        await _emit_sse(client, campaign_id, {
            "type": "all_done",
            "message": "Chiến dịch đã hoàn thành! Tất cả nội dung đã sẵn sàng.",
        })
