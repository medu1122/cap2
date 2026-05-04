"""
Service to generate high-quality image prompts for DALL-E 3.

Optimized prompts for creating professional marketing posters WITHOUT text.
"""

import os
import json
from typing import Optional
from openai import AsyncOpenAI

# ── Clients ──────────────────────────────────────────────────────────────────

_openai = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

# Model config
PROMPT_MODEL = os.getenv("IMAGE_PROMPT_MODEL", "gpt-4o")
PROMPT_TIMEOUT = int(os.getenv("IMAGE_PROMPT_TIMEOUT", "120"))


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

    def get_brand_color_palette(self) -> str:
        if self.brand_colors:
            colors = [c for c in self.brand_colors if c]
            if colors:
                return ", ".join(colors)
        return "vibrant professional colors"

    def get_color_description(self) -> str:
        """Get detailed color guidance for DALL-E."""
        if self.brand_colors:
            colors = [c for c in self.brand_colors if c]
            if colors:
                if len(colors) == 1:
                    return f"Primary color: {colors[0]}. Use complementary and analogous colors."
                return f"Color palette: {', '.join(colors[:4])}"
        return "Bold, saturated professional colors suitable for advertising"


# ── Prompt Generation ─────────────────────────────────────────────────────────

async def generate_image_prompt(
    context: CampaignContext,
    user_override: str | None = None,
) -> str:
    """
    Generate optimized prompt for DALL-E 3 to create professional marketing poster.

    CRITICAL: No text, no Vietnamese, no readable content - only visuals!
    """
    if user_override and len(user_override.strip()) > 20:
        return _build_poster_prompt(
            subject=user_override,
            context=context,
            is_custom=True
        )

    if context.has_meaningful_content():
        return await _generate_from_campaign_content(context)

    return _build_poster_prompt(
        subject=context.product_or_service,
        context=context,
        is_custom=False
    )


async def _generate_from_campaign_content(context: CampaignContext) -> str:
    """Generate prompt from campaign content using GPT-4o for best results."""

    key_message = context.get_key_message()
    product = context.product_or_service
    brand_name = context.brand_name or ""

    prompt_request = f"""Create a detailed DALL-E 3 prompt for a professional marketing poster.

CRITICAL RULES:
- NO text, words, letters, numbers, or any readable content
- NO Vietnamese characters or any language text
- ONLY pure visual elements: shapes, colors, people, objects, scenes
- NO speech bubbles, quote marks, or any symbol representing text

CAMPAIGN:
- Name: {context.campaign_name}
- Objective: {context.objective}
- Product/Service: {product}
- Target: {context.target_audience or 'General audience'}
- Key message theme: {key_message}
- Brand: {brand_name}
- Colors: {context.get_color_description()}

EXISTING CONTENT:
{_extract_content_summary(context)}

Write a single, highly detailed DALL-E 3 prompt (200-400 words) that describes ONLY visual elements:
1. What to show (people, objects, scene, composition)
2. Exact style (modern, professional photography or digital art)
3. Colors and lighting details
4. Mood and atmosphere
5. Layout and composition

OUTPUT: Only the prompt text describing visuals, nothing else."""

    try:
        response = await _openai.chat.completions.create(
            model=PROMPT_MODEL,
            messages=[
                {"role": "system", "content": "You are an expert advertising art director. Create visual-only prompts with NO text."},
                {"role": "user", "content": prompt_request}
            ],
            temperature=0.7,
            max_tokens=1000,
        )
        return response.choices[0].message.content.strip()
    except Exception:
        return _build_poster_prompt(product, context, False)


def _build_poster_prompt(
    subject: str,
    context: CampaignContext,
    is_custom: bool = False
) -> str:
    """Build optimized poster prompt directly - NO TEXT RULE."""

    key_message = context.get_key_message() or context.objective
    brand_name = context.brand_name or ""
    colors = context.get_brand_color_palette()
    style = context.brand_style or "modern professional"

    return f"""A stunning professional marketing poster advertisement - VISUALS ONLY, NO TEXT.

IMPORTANT: This image must contain ZERO text, letters, words, numbers, or any readable content.
Do NOT include any text elements, speech bubbles, or symbols that could represent text.
Only visual elements: shapes, colors, people, objects, backgrounds, compositions.

VISUAL ELEMENTS:
- Central focal point: An elegant visual representation of {subject}
- Show happy professionals or families interacting naturally
- Display the product or service in an aspirational, professional context
- Use symbolic elements that suggest {key_message[:80] if key_message else 'excellence'}

COMPOSITION:
- Dynamic, asymmetric layout with strong visual hierarchy
- Large central hero area
- Decorative geometric shapes, lines, and patterns
- Gradient backgrounds and color blocks
- Modern flat design mixed with depth effects

COLOR PALETTE:
- Primary colors: {colors}
- Bold, saturated advertising colors
- High contrast between elements
- Gradient overlays for depth

STYLE: {style}
- Professional advertising photography OR high-quality digital illustration
- Dramatic studio lighting with rim lights and catchlights
- Magazine-quality aesthetic
- Clean, uncluttered composition

MOOD:
- Professional, trustworthy, energetic
- Aspirational and inspiring
- Suitable for Vietnamese market
- Appeals to adults and families

TECHNICAL:
- Square format 1024x1024
- High resolution, print-ready
- NO text, letters, words, numbers
- NO Vietnamese characters
- NO readable content of any kind
- Professional advertising quality

Pure visual marketing poster, no text, only shapes colors and images."""


def _extract_content_summary(context: CampaignContext) -> str:
    """Extract key content for prompt generation."""
    parts = []

    emails = context.get_email_content()
    if emails:
        parts.append("Email campaigns:")
        for email in emails[:2]:
            if email.get("subject"):
                parts.append(f"  - Theme: {email['subject']}")

    social = context.get_social_content()
    if social:
        parts.append("Social media posts:")
        for post in social[:2]:
            if post.get("copy"):
                copy = post["copy"][:150]
                parts.append(f"  - Theme: {copy}...")

    return "\n".join(parts) if parts else "No detailed content available"


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
