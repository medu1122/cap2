"""
Service to generate high-quality image prompts for DALL-E 3.

Marketing-style prompts: Focus on selling, not just illustrating.
"""

import os
import json
from openai import AsyncOpenAI

_openai = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
PROMPT_MODEL = os.getenv("IMAGE_PROMPT_MODEL", "gpt-4o")


# ── Data structures ───────────────────────────────────────────────────────────

class CampaignContext:
    """All available campaign data for prompt generation."""
    campaign_name: str
    objective: str
    product_or_service: str
    target_audience: str | None
    offer_or_hook: str | None
    additional_notes: str | None
    channels: list[str]
    brand_name: str | None
    brand_description: str | None
    brand_colors: list[str] | None
    brand_style: str | None
    content_items: list[dict]

    def __init__(
        self,
        campaign_name: str,
        objective: str,
        product_or_service: str,
        target_audience: str | None = None,
        offer_or_hook: str | None = None,
        additional_notes: str | None = None,
        channels: list[str] | None = None,
        brand_name: str | None = None,
        brand_description: str | None = None,
        brand_colors: list[str] | None = None,
        brand_style: str | None = None,
        content_items: list[dict] | None = None,
    ):
        self.campaign_name = campaign_name
        self.objective = objective
        self.product_or_service = product_or_service
        self.target_audience = target_audience
        self.offer_or_hook = offer_or_hook
        self.additional_notes = additional_notes
        self.channels = channels or []
        self.brand_name = brand_name
        self.brand_description = brand_description
        self.brand_colors = brand_colors
        self.brand_style = brand_style
        self.content_items = content_items or []

    def has_meaningful_content(self) -> bool:
        return len(self.content_items) > 0 or bool(self.offer_or_hook)

    def get_email_content(self) -> list[dict]:
        return [c for c in self.content_items if c.get("channel") == "email"]

    def get_social_content(self) -> list[dict]:
        return [c for c in self.content_items if c.get("channel") in ("facebook_post", "video_script")]

    def get_key_message(self) -> str:
        if self.offer_or_hook:
            return self.offer_or_hook
        for email in self.get_email_content():
            if email.get("subject"):
                return email["subject"]
        for social in self.get_social_content():
            if social.get("copy"):
                return social["copy"][:150]
        return self.objective

    def get_content_copy(self) -> str:
        """Get main copy text from content items for marketing context."""
        for social in self.get_social_content():
            if social.get("copy"):
                return social["copy"]
        for email in self.get_email_content():
            if email.get("body"):
                return email["body"][:300]
        return ""

    def get_target_audience_desc(self) -> str:
        """Describe ideal customer visually."""
        audience = self.target_audience or ""
        if "trẻ" in audience.lower() or "em" in audience.lower():
            return "children or young students"
        elif "doanh nghiệp" in audience.lower() or "người đi làm" in audience.lower():
            return "professional adults or working professionals"
        return "families and adults"

    def get_brand_color_palette(self) -> str:
        if self.brand_colors:
            colors = [c for c in self.brand_colors if c]
            if colors:
                return ", ".join(colors)
        return "bold blue and vibrant accent colors"

    def get_commercial_colors(self) -> str:
        """Get commercial advertising color palette."""
        if self.brand_colors:
            colors = [c for c in self.brand_colors if c]
            if colors:
                return f"dominant {colors[0]}, with {colors[1] if len(colors) > 1 else 'contrast accent'} highlights"
        return "deep professional blue with bright yellow or orange accents for energy"


# ── Marketing Concept Extraction ──────────────────────────────────────────────

def _extract_marketing_concept(context: CampaignContext) -> dict:
    """Extract marketing DNA from campaign for creative direction."""
    concept = {
        "hero_action": "",
        "emotion": "",
        "visual_metaphor": "",
        "transformation": "",
        "aspiration": ""
    }

    obj_lower = context.objective.lower()
    product = context.product_or_service.lower()

    # Hero action based on objective
    if "doanh thu" in obj_lower or "bán" in obj_lower:
        concept["hero_action"] = "happy customer experiencing the product with satisfaction"
        concept["emotion"] = "excitement, satisfaction, desire to purchase"
    elif "nhận diện" in obj_lower or "thương hiệu" in obj_lower:
        concept["hero_action"] = "brand logo or product displayed prominently with prestige"
        concept["emotion"] = "trust, prestige, recognition"
    elif "thu hút" in obj_lower or "tuyển" in obj_lower:
        concept["hero_action"] = "excited new customers joining with enthusiasm"
        concept["emotion"] = "excitement, welcome, opportunity"
    else:
        concept["hero_action"] = "confident person benefiting from the service"
        concept["emotion"] = "confidence, success, achievement"

    # Visual metaphor
    if "tiếng anh" in product or "học" in product:
        concept["visual_metaphor"] = "fluent communication, global connection, bright future"
        concept["transformation"] = "growth from beginner to confident speaker"
        concept["aspiration"] = "speaking confidently, doors opening, international opportunities"
    else:
        concept["visual_metaphor"] = "quality, reliability, premium value"
        concept["transformation"] = "before and after improvement"
        concept["aspiration"] = "better version of themselves"

    return concept


# ── Prompt Generation ─────────────────────────────────────────────────────────

async def generate_image_prompt(
    context: CampaignContext,
    user_override: str | None = None,
) -> str:
    """
    Generate marketing-style prompt: SELL not describe.

    Focus: Hero + Emotion + Commercial Design + Negative Space for text
    """
    if user_override and len(user_override.strip()) > 20:
        return _build_marketing_prompt(
            subject=user_override,
            context=context,
            is_custom=True
        )

    if context.has_meaningful_content():
        return await _generate_from_content(context)

    return _build_marketing_prompt(
        subject=context.product_or_service,
        context=context,
        is_custom=False
    )


async def _generate_from_content(context: CampaignContext) -> str:
    """Generate marketing prompt from campaign content."""

    key_message = context.get_key_message()
    product = context.product_or_service
    copy = context.get_content_copy()
    concept = _extract_marketing_concept(context)

    prompt_request = f"""Create a HIGH-IMPACT marketing visual prompt for an advertising campaign.

CAMPAIGN BRIEF:
- Product: {product}
- Objective: {context.objective}
- Target: {context.target_audience or 'General audience'}
- Key message: {key_message}
- Brand: {context.brand_name or 'Professional brand'}
- Colors: {context.get_commercial_colors()}

MARKETING COPY REFERENCE:
{copy[:200] if copy else 'No specific copy available'}

CRITICAL RULES - Follow these EXACTLY:
1. NO text, words, letters, numbers in the image
2. NO Vietnamese characters
3. Focus on ONE hero subject only (1-3 people max)
4. Create strong negative space for headline text placement
5. The image must SELL, not just illustrate
6. Show transformation or aspiration, not just a scene

OUTPUT FORMAT - Write ONLY the prompt, nothing else:
Start with: "A high-impact advertising visual..."
Describe: hero subject, composition, emotion, colors, lighting, commercial design elements
End with: emphasis on advertising photography style, not illustration"""

    try:
        response = await _openai.chat.completions.create(
            model=PROMPT_MODEL,
            messages=[
                {"role": "system", "content": "You are a senior art director at a top advertising agency. Create marketing briefs that sell, not descriptions that illustrate."},
                {"role": "user", "content": prompt_request}
            ],
            temperature=0.8,
            max_tokens=800,
        )
        return response.choices[0].message.content.strip()
    except Exception:
        return _build_marketing_prompt(product, context, False)


def _build_marketing_prompt(
    subject: str,
    context: CampaignContext,
    is_custom: bool = False
) -> str:
    """Build marketing-style prompt - SELLING not describing."""

    concept = _extract_marketing_concept(context)
    target = context.get_target_audience_desc()
    colors = context.get_commercial_colors()
    key_message = context.get_key_message()

    # Build prompt following marketing DNA
    prompt = f"""A high-impact advertising visual for: {subject}

HERO SUBJECT (1-3 people maximum):
A single {target} as the hero, shown in a moment of success or aspiration.
The subject should have confident body language, direct eye contact with camera.
This is the focal point - everything else supports this.

COMMERCIAL COMPOSITION:
- 60% of frame: hero subject with strong presence
- 40% of frame: negative space OR clean background for headline text placement
- Strong visual hierarchy: hero dominates immediately
- Clean, uncluttered design - no competing elements
- Layout ready for text overlay: headline space on one side

EMOTION & MESSAGE:
- Primary emotion: {concept['emotion']}
- Visual concept: {concept['visual_metaphor']}
- Transformation shown: {concept['transformation']}
- Aspiration: {concept['aspiration']}

COLOR PALETTE (commercial advertising):
- {colors}
- High contrast between subject and background
- Bold, saturated colors that pop
- Professional brand-driven palette

LIGHTING:
- Dramatic studio lighting or golden hour natural light
- High contrast with rim lighting on subject
- Creates depth and draws attention to hero
- Professional advertising quality

STYLE:
- Commercial advertising photography (NOT illustration, NOT stock photo style)
- Bold, direct, confident
- Magazine ad quality
- Minimalist commercial design

TECHNICAL:
- Square format 1024x1024
- NO text, letters, words, numbers
- NO Vietnamese characters
- NO generic stock photo aesthetics
- Only visual elements that communicate value

The image must make viewers want to learn more - it SELLS, it doesn't just show."""

    return prompt


def _extract_content_summary(context: CampaignContext) -> str:
    """Extract key content for marketing context."""
    parts = []

    for social in context.get_social_content():
        if social.get("copy"):
            parts.append(f"Social copy: {social['copy'][:150]}...")

    for email in context.get_email_content():
        if email.get("subject"):
            parts.append(f"Email theme: {email['subject']}")

    return "\n".join(parts) if parts else "Create compelling marketing visual"


# ── Helper to build context from database models ───────────────────────────────

def build_context_from_campaign(
    campaign_data: dict,
    brand_data: dict | None = None,
    content_items: list[dict] | None = None,
) -> CampaignContext:
    """Build CampaignContext from raw database data."""

    brand_name = None
    brand_description = None
    brand_colors = None
    brand_style = None

    if brand_data:
        brand_name = brand_data.get("brand_name")
        brand_description = brand_data.get("brand_description") or brand_data.get("description")
        brand_colors = brand_data.get("color_palette")
        brand_style = brand_data.get("visual_style") or brand_data.get("style")

    processed_content = []
    if content_items:
        for item in content_items:
            try:
                processed = {"channel": item.get("channel"), "status": item.get("status")}

                content_json_raw = item.get("content_json") or {}
                if isinstance(content_json_raw, str):
                    content_json = json.loads(content_json_raw)
                elif isinstance(content_json_raw, dict):
                    content_json = content_json_raw
                else:
                    content_json = {}

                if item.get("channel") == "email":
                    processed["subject"] = content_json.get("subject")
                    processed["body"] = content_json.get("body")
                elif item.get("channel") == "facebook_post":
                    processed["copy"] = content_json.get("copy")
                    processed["hashtags"] = content_json.get("hashtags", [])
                elif item.get("channel") == "video_script":
                    processed["hook"] = content_json.get("hook")
                    processed["body"] = content_json.get("body")
                    processed["cta"] = content_json.get("cta")

                processed_content.append(processed)
            except Exception:
                continue

    return CampaignContext(
        campaign_name=campaign_data.get("campaign_name", ""),
        objective=campaign_data.get("objective", ""),
        product_or_service=campaign_data.get("product_or_service", ""),
        target_audience=campaign_data.get("target_audience"),
        offer_or_hook=campaign_data.get("offer_or_hook"),
        additional_notes=campaign_data.get("additional_notes"),
        channels=campaign_data.get("channels", []),
        brand_name=brand_name,
        brand_description=brand_description,
        brand_colors=brand_colors,
        brand_style=brand_style,
        content_items=processed_content,
    )
