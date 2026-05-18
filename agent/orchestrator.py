import httpx
import os
from datetime import date, timedelta
from agents.strategist import StrategistAgent
from agents.writer import WriterAgent
from agents.critic import CriticAgent
from agents.base import timed_agent_call
from demo_shortcut import check_and_run_demo


_VN_FIXED_HOLIDAYS = {
    (1, 1),   # New Year
    (4, 30),  # Reunification Day
    (5, 1),   # Labor Day
    (9, 2),   # National Day
}

_CHANNEL_WEEKDAY_PREFERENCE = {
    "facebook_post": {1, 3, 5},  # Tue/Thu/Sat
    "email": {1, 3},             # Tue/Thu
    "video_script": {2, 4, 5},   # Wed/Fri/Sat
}


def _is_vn_fixed_holiday(d: date) -> bool:
    return (d.month, d.day) in _VN_FIXED_HOLIDAYS


def _plan_publish_dates(deadline_str: str | None, channels: list[str]) -> list[str | None]:
    """
    Plan campaign publish dates with simple deterministic scoring:
    - spread evenly in [today, deadline]
    - prioritize channel-friendly weekdays
    - avoid major fixed holidays and avoid weekend for email
    (Khi đổi rules, đồng bộ với api/services/publish_schedule.py.)
    """
    num_channels = len(channels)
    if not deadline_str or num_channels == 0:
        return [deadline_str] * num_channels

    try:
        today = date.today()
        deadline = date.fromisoformat(deadline_str)
    except ValueError:
        return [deadline_str] * num_channels

    if deadline < today:
        deadline = today

    horizon_days = max((deadline - today).days, 0)
    candidates = [today + timedelta(days=i) for i in range(horizon_days + 1)]
    used_dates: set[date] = set()
    planned: list[str | None] = []

    for idx, channel in enumerate(channels):
        preferred = _CHANNEL_WEEKDAY_PREFERENCE.get(channel, {1, 2, 3, 4, 5})
        # target position for even spread across the available window
        target_offset = round((idx + 1) * (horizon_days + 1) / (num_channels + 1)) - 1
        target_offset = max(0, min(horizon_days, target_offset))
        target_day = today + timedelta(days=target_offset)

        def score(d: date) -> tuple[int, int, int, int]:
            distance_penalty = abs((d - target_day).days)
            weekday_penalty = 0 if d.weekday() in preferred else 2
            holiday_penalty = 4 if _is_vn_fixed_holiday(d) else 0
            weekend_penalty = 2 if channel == "email" and d.weekday() >= 5 else 0
            return (
                distance_penalty + weekday_penalty + holiday_penalty + weekend_penalty,
                abs((deadline - d).days),
                1 if d in used_dates else 0,
                (d - today).days,
            )

        best = min(candidates, key=score)
        used_dates.add(best)
        planned.append(str(best))

    return planned


def _format_written_content(channel: str, content_json: dict) -> str:
    """Format a single channel's written content for Qwen's context block."""
    label = {
        "facebook_post": "Facebook Post",
        "email": "Email",
        "video_script": "Video Script",
    }.get(channel, channel)

    lines = [f"[{label}]"]
    if channel == "facebook_post":
        copy_text = content_json.get("copy", "")
        # Trim to avoid bloating the prompt — first 400 chars is enough for context
        lines.append(f"Copy: {copy_text[:400]}")
        hashtags = content_json.get("hashtags", [])
        if hashtags:
            lines.append(f"Hashtags: {' '.join(f'#{h}' for h in hashtags[:5])}")
    elif channel == "email":
        lines.append(f"Subject: {content_json.get('subject', '')}")
        body = content_json.get("body", "")
        lines.append(f"Body (excerpt): {body[:300]}")
    elif channel == "video_script":
        lines.append(f"Hook: {content_json.get('hook', '')}")
        body = content_json.get("body", "")
        lines.append(f"Body (excerpt): {body[:200]}")
        lines.append(f"CTA: {content_json.get('cta', '')}")
    return "\n".join(lines)


API_BASE = os.getenv("INTERNAL_API_URL", "http://api:8000")


class CampaignOrchestrator:
    def __init__(self):
        self.strategist = StrategistAgent()
        self.writer = WriterAgent()
        self.critic = CriticAgent()

    async def run(self, campaign_id: str):
        async with httpx.AsyncClient(timeout=60) as client:
            try:
                # Fetch campaign + brand vault from API
                campaign_resp = await client.get(f"{API_BASE}/internal/campaigns/{campaign_id}/detail")
                campaign_resp.raise_for_status()
                data = campaign_resp.json()

                brief = data["brief"]
                brand_vault = data["brand_vault"]
                channels = brief.get("channels", [])
                additional_notes = (brief.get("additional_notes") or "").lower()
                image_required = "[image_required]" in additional_notes

                # ── Demo shortcut check ─────────────────────────────────────────
                # Nếu input khớp demo pattern → tạo content ngay, không chạy AI
                if await check_and_run_demo(campaign_id, brief, brand_vault):
                    return  # Demo đã tự xử lý hết

                # ── Step 1: Strategist ─────────────────────────────────────────
                plan = await self.strategist.run(campaign_id, brief, brand_vault)
                await client.patch(
                    f"{API_BASE}/internal/campaigns/{campaign_id}",
                    json={"status": "running", "campaign_plan_json": plan},
                )

                # ── Steps 2+: Writer + Critic per channel ──────────────────────
                active_deliverables = [
                    d for d in plan.get("deliverables", []) if d["channel"] in channels
                ]
                publish_dates = _plan_publish_dates(
                    brief.get("deadline"),
                    [d["channel"] for d in active_deliverables],
                )
                step = 2

                # Collect all final content so we can feed it to Qwen later
                written_content: list[tuple[str, dict]] = []  # (channel, content_json)

                # Lấy tracking links của chiến dịch
                try:
                    tracking_resp = await client.get(f"{API_BASE}/internal/campaigns/{campaign_id}/tracking-links")
                    tracking_resp.raise_for_status()
                    all_tracking_links = tracking_resp.json()
                except Exception:
                    all_tracking_links = []

                for idx, deliverable in enumerate(active_deliverables):
                    channel = deliverable["channel"]

                    # Lọc tracking links theo kênh
                    if channel == "email":
                        links = [l for l in all_tracking_links if l["link_type"] in ("email_click", None)]
                    elif channel == "facebook_post":
                        links = [l for l in all_tracking_links if l["link_type"] == "facebook_post"]
                    else:
                        links = []

                    draft = await self.writer.run(
                        campaign_id, deliverable, plan, brand_vault, step,
                        tracking_links=links,
                    )
                    step += 1

                    final = await self.critic.run(campaign_id, deliverable, draft, brand_vault, plan, step)
                    step += 1

                    final_content = final["final_content"]
                    written_content.append((channel, final_content))

                    await client.post(
                        f"{API_BASE}/internal/content",
                        json={
                            "campaign_id": campaign_id,
                            "channel": channel,
                            "version": 1,
                            "status": "pending_approval",
                            "content_json": final_content,
                            "scheduled_date": publish_dates[idx],
                        },
                    )

                # ── Image prompt A2A (after writing, so Qwen sees full content) ─
                if image_required:
                    # Assemble the richest possible context for Qwen
                    brand_name    = brand_vault.get("brand_name", "")
                    brand_desc    = brand_vault.get("brand_description", "")
                    tone          = brand_vault.get("tone_of_voice", "")
                    preferred_cta = brand_vault.get("preferred_cta", "")
                    contact_email = (brand_vault.get("contact_email") or "").strip()
                    phone         = (brand_vault.get("phone") or "").strip()
                    address       = (brand_vault.get("address") or "").strip()
                    key_products  = ", ".join(brand_vault.get("key_products") or [])
                    target        = brief.get("target_audience") or brand_vault.get("target_audience", "")
                    campaign_title = brief.get("campaign_name", "")
                    key_messages  = "\n".join(f"- {m}" for m in (plan.get("key_messages") or []))
                    visual_dir    = plan.get("visual_direction", "")
                    campaign_summary = plan.get("campaign_summary", "")

                    content_blocks = "\n\n".join(
                        _format_written_content(ch, cj) for ch, cj in written_content
                    )

                    qwen_user_prompt = (
                        "=== THÔNG TIN THƯƠNG HIỆU ===\n"
                        f"Tên thương hiệu: {brand_name}\n"
                        f"Mô tả: {brand_desc}\n"
                        f"Giọng văn / phong cách: {tone}\n"
                        f"Sản phẩm/dịch vụ chính: {key_products}\n"
                        f"Đối tượng khách hàng: {target}\n"
                        f"CTA thường dùng: {preferred_cta}\n"
                        "=== LIÊN HỆ & ĐỊA ĐIỂM (infer bối cảnh thật — cửa hàng, phố, khu vực; "
                        "KHÔNG mô tả chữ số/SĐT/email lên ảnh) ===\n"
                        f"Email: {contact_email or '—'}\n"
                        f"SĐT: {phone or '—'}\n"
                        f"Địa chỉ: {address or '—'}\n\n"
                        "=== THÔNG TIN CHIẾN DỊCH ===\n"
                        f"Tên chiến dịch: {campaign_title}\n"
                        f"Mục tiêu: {brief.get('objective', '')}\n"
                        f"Sản phẩm/Dịch vụ: {brief.get('product_or_service', '')}\n"
                        f"Ưu đãi / Hook: {brief.get('offer_or_hook', '')}\n"
                        f"Kênh: {', '.join(channels)}\n\n"
                        "=== KẾT QUẢ PHÂN TÍCH TỪ AI STRATEGIST ===\n"
                        f"Tóm tắt chiến lược: {campaign_summary}\n"
                        f"Thông điệp chính:\n{key_messages}\n"
                        f"Định hướng hình ảnh từ strategist: {visual_dir}\n\n"
                        "=== NỘI DUNG ĐÃ ĐƯỢC AI VIẾT (tham khảo để ảnh khớp với copy) ===\n"
                        f"{content_blocks}\n\n"
                        "Nhiệm vụ — poster / key visual chiến dịch:\n"
                        "Bạn là creative director. Hãy TỰ PHÂN TÍCH (im lặng, không xuất phân tích) xem với "
                        f"tên chiến dịch «{campaign_title}», thương hiệu «{brand_name}», mục tiêu và manh mối địa lý "
                        "(địa chỉ/SĐT/email chỉ để suy ra không gian/cửa hàng điển hình, không vẽ chữ), "
                        "đâu là MỘT ý poster một thông điệp mạnh, dễ nhớ, đúng campaign.\n"
                        "Sau đó chỉ XUẤT DUY NHẤT một image generation prompt bằng tiếng Anh, tối đa ~180 từ, cho DALL-E 3 — "
                        "không tiêu đề, không bullet, không giải thích, không JSON.\n"
                        "Mô tả trong prompt: một chủ thể tiêu điểm rõ ràng, bối cảnh thật (VN khi hợp lý), cảm xúc, palette, ánh sáng.\n\n"
                        "Ràng buộc bắt buộc (marketing-aware):\n"
                        "- Mặc định: ảnh chụp thực tế (photorealistic documentary / lifestyle), ánh sáng tự nhiên hoặc "
                        "đèn thực tế trong không gian, candid, máy ảnh DSLR cảm giác 35mm, da và chi tiết tự nhiên, "
                        "tránh da bóng nhựa / render 3D / phong cách hoạt hình trừ khi strategist visual_direction "
                        "yêu cầu minh họa rõ ràng.\n"
                        "- Khớp đúng loại hình dịch vụ và mục tiêu (ads cần một thông điệp thị giác rõ, ít người chen "
                        "chúc; tránh crowd mơ hồ).\n"
                        "- KHÔNG mô tả chữ đọc được, bảng viết chữ, logo, watermark hay UI — DALL-E hay sai chữ; "
                        "headline/CTA để designer thêm sau.\n"
                        "- Tránh stock smile cứng; ưu tiên khoảnh khắc chân thật.\n"
                        "Chỉ trả về prompt text, không giải thích."
                    )

                    qwen_system = (
                        "You are a world-class marketing visual director and AI image prompt engineer "
                        "for Vietnamese SME and consumer campaigns, specializing in single strong campaign poster key visuals.\n"
                        "You reason internally about brand, campaign name, objective, and locality cues (address/phone/email "
                        "inform setting and vibe only), then output exactly one English DALL-E prompt with no analysis text.\n"
                        "Match campaign objective and channel (conversion ads need trustworthy real-life photography).\n"
                        "Unless the strategist explicitly requests illustration, default to photorealistic "
                        "documentary or lifestyle photography with believable Vietnam-relevant settings when appropriate.\n"
                        "Never instruct readable typography, phone numbers, addresses, logos, or whiteboard text in the image.\n"
                        "Output: only the English prompt text, no preamble."
                    )

                    qwen_raw, _ = await timed_agent_call(
                        agent_name="image_prompt_qwen",
                        channel="image_prompt",
                        step_order=step,
                        system_prompt=qwen_system,
                        user_prompt=qwen_user_prompt,
                        campaign_id=campaign_id,
                        temperature=0.75,
                    )
                    step += 1

                    # GPT refines Qwen's draft into production-ready DALL-E 3 prompt
                    refined_raw, _ = await timed_agent_call(
                        agent_name="image_prompt_refiner",
                        channel="image_prompt",
                        step_order=step,
                        system_prompt=(
                            "You are a senior prompt engineer for DALL-E 3 in Vietnamese SME marketing, "
                            "optimizing a single campaign poster / key visual prompt.\n"
                            "Rules:\n"
                            "- Preserve the core concept, product, campaign goal, and brand name energy from the draft\n"
                            "- Add precise descriptors: camera angle, lens feel (e.g. 35mm), lighting (natural window light, "
                            "soft bounce), color grading (natural, not neon oversaturation)\n"
                            "- Prefer believable real-world photography; reject glossy CGI, 3D render, anime, or "
                            "plastic 'AI portrait' looks unless the draft explicitly needs illustration\n"
                            "- One clear focal subject; poster-like clarity; simplify busy backgrounds for ad-style compositions\n"
                            "- Explicitly forbid readable text, phone numbers, addresses, signage, logos, watermarks, UI overlays\n"
                            "- Avoid empty hype tokens like '8K award-winning hyperreal' that encourage synthetic polish\n"
                            "- Max 200 words; output only the final English prompt, no explanation."
                        ),
                        user_prompt=(
                            f"Campaign name: {campaign_title}\n"
                            f"Brand name: {brand_name}\n"
                            f"Brand phone (scene mood / local business context only, never as legible text): {phone or 'n/a'}\n"
                            f"Brand address (infer typical storefront or neighborhood vibe only): {address or 'n/a'}\n"
                            f"Brand contact email (never render as text in image): {contact_email or 'n/a'}\n"
                            f"Product: {brief.get('product_or_service', '')}\n"
                            f"Objective: {brief.get('objective', '')}\n"
                            f"Offer/hook: {brief.get('offer_or_hook', '')}\n"
                            f"Channels: {', '.join(channels)}\n"
                            f"Target audience: {target}\n"
                            f"Tone: {tone}\n\n"
                            f"Qwen draft prompt:\n{qwen_raw.strip()}\n\n"
                            "Refine into one production-ready DALL-E 3 prompt: a strong campaign poster key visual, "
                            "on-brand and not generic stock."
                        ),
                        campaign_id=campaign_id,
                        temperature=0.35,
                    )
                    step += 1

                    plan["image_prompt_qwen"] = qwen_raw.strip()
                    plan["image_prompt_final"] = refined_raw.strip()
                    await client.patch(
                        f"{API_BASE}/internal/campaigns/{campaign_id}",
                        json={"status": "running", "campaign_plan_json": plan},
                    )

                # ── Finalize ───────────────────────────────────────────────────
                await client.patch(
                    f"{API_BASE}/internal/campaigns/{campaign_id}",
                    json={"status": "pending_approval"},
                )

            except Exception as e:
                async with httpx.AsyncClient(timeout=10) as err_client:
                    await err_client.patch(
                        f"{API_BASE}/internal/campaigns/{campaign_id}",
                        json={"status": "failed", "error_message": str(e)},
                    )
                raise
