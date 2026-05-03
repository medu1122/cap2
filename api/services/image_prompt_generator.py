"""
Service to generate high-quality, context-rich image prompts for campaign visuals.

This service analyzes ALL available campaign data (content, brand, audience, copy)
to create prompts that produce visuals truly matching the campaign's message,
not generic AI-generated stock images.
"""

import os
import json
import asyncio
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
    content_items: list[dict]  # List of {channel, subject, body, copy, hashtags}

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
        """Check if there's actual content to work with."""
        return len(self.content_items) > 0 or bool(self.offer_or_hook)

    def get_email_content(self) -> list[dict]:
        """Get email content items."""
        return [c for c in self.content_items if c.get("channel") == "email"]

    def get_social_content(self) -> list[dict]:
        """Get social media content items."""
        return [c for c in self.content_items if c.get("channel") in ("facebook_post", "video_script")]

    def build_context_summary(self) -> str:
        """Build a comprehensive context summary for the prompt generator."""
        parts = []

        # Campaign identity
        parts.append(f"CAMPAIGN: {self.campaign_name}")
        parts.append(f"GOAL: {self.objective}")
        parts.append(f"PRODUCT/SERVICE: {self.product_or_service}")

        if self.target_audience:
            parts.append(f"TARGET AUDIENCE: {self.target_audience}")

        if self.offer_or_hook:
            parts.append(f"KEY MESSAGE/OFFER: {self.offer_or_hook}")

        if self.additional_notes:
            parts.append(f"ADDITIONAL NOTES: {self.additional_notes}")

        # Brand info
        if self.brand_name:
            parts.append(f"BRAND: {self.brand_name}")

        if self.brand_description:
            parts.append(f"BRAND DESCRIPTION: {self.brand_description}")

        if self.brand_colors:
            parts.append(f"BRAND COLORS (use subtly): {', '.join(self.brand_colors)}")

        if self.brand_style:
            parts.append(f"BRAND STYLE: {self.brand_style}")

        # Actual content - THIS IS THE KEY DIFFERENTIATOR
        email_content = self.get_email_content()
        if email_content:
            parts.append("\n--- ACTUAL EMAIL CONTENT (use this to inspire the visual) ---")
            for i, email in enumerate(email_content, 1):
                subject = email.get("subject", "")
                body = email.get("body", "")
                if subject:
                    parts.append(f"Email {i} Subject: {subject}")
                if body:
                    # Take first meaningful paragraph
                    body_preview = body[:500] + "..." if len(body) > 500 else body
                    parts.append(f"Email {i} Body excerpt: {body_preview}")

        social_content = self.get_social_content()
        if social_content:
            parts.append("\n--- ACTUAL SOCIAL CONTENT (use this to inspire the visual) ---")
            for i, post in enumerate(social_content, 1):
                channel = post.get("channel", "social")
                copy = post.get("copy", "")
                hashtags = post.get("hashtags", [])

                if copy:
                    copy_preview = copy[:300] + "..." if len(copy) > 300 else copy
                    parts.append(f"{channel.upper()} {i}: {copy_preview}")

                if hashtags:
                    parts.append(f"Hashtags: {', '.join(hashtags)}")

        return "\n".join(parts)


# ── Prompt Generation ─────────────────────────────────────────────────────────

async def generate_image_prompt(
    context: CampaignContext,
    user_override: str | None = None,
) -> str:
    """
    Generate a high-quality, context-rich image prompt for DALL-E 3.

    This function uses GPT-4o to analyze ALL campaign data and produce
    a detailed prompt that:
    1. Incorporates actual copy/messaging from the campaign
    2. Matches the emotional tone and brand identity
    3. Describes exact visual composition, lighting, style
    4. Is optimized for DALL-E 3's strengths
    5. Produces campaign-specific visuals, not generic stock images

    Args:
        context: All available campaign data
        user_override: Optional user-provided prompt to refine

    Returns:
        A detailed prompt string for DALL-E 3 (500-1000+ words)
    """
    # If user provided a specific prompt, use it directly
    if user_override and len(user_override.strip()) > 20:
        return await _refine_user_prompt(user_override, context)

    # If we have meaningful content, generate a rich prompt
    if context.has_meaningful_content():
        return await _generate_from_campaign_data(context)

    # Fallback to brand-aware prompt
    return await _generate_brand_fallback(context)


async def _refine_user_prompt(user_prompt: str, context: CampaignContext) -> str:
    """Refine user's custom prompt with brand context."""
    refinement_prompt = f"""You are an expert advertising creative director specializing in Vietnamese SME marketing.

Your task is to ENHANCE a user's image prompt by incorporating the campaign's brand identity and visual style.

USER'S PROMPT:
{user_prompt}

CAMPAIGN CONTEXT:
{context.build_context_summary()}

INSTRUCTIONS:
1. Keep the user's core concept intact
2. Add brand-appropriate styling (Vietnamese context, SME aesthetic)
3. Include specific visual direction that matches the campaign's tone
4. Add technical specifications for DALL-E 3
5. Ensure the visual connects to the campaign's actual messaging

OUTPUT FORMAT:
Return ONLY the enhanced prompt text (500-800 words), no explanations or formatting."""

    try:
        response = await asyncio.wait_for(
            _openai.chat.completions.create(
                model=PROMPT_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert advertising creative director. Return ONLY the enhanced prompt text, no markdown or explanations."
                    },
                    {"role": "user", "content": refinement_prompt}
                ],
                temperature=0.7,
                max_tokens=2000,
            ),
            timeout=PROMPT_TIMEOUT,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        # Fallback to original prompt with basic enhancement
        return _basic_prompt_enhancement(user_prompt, context)


async def _generate_from_campaign_data(context: CampaignContext) -> str:
    """Generate prompt from actual campaign content (most powerful approach)."""

    generation_prompt = f"""You are an expert advertising creative director for Vietnamese SME marketing campaigns.

Your mission is to create a VISUAL STORY that tells the campaign's story through imagery.
The image should make someone who sees it FEEL the campaign's message, not just understand it intellectually.

CAMPAIGN DATA (use ALL of this):
{context.build_context_summary()}

GENERATION GUIDELINES:

1. VISUAL NARRATIVE (200+ words)
   - Describe a SPECIFIC SCENE that embodies the campaign's core message
   - Include exact emotional moments: who is in the scene, what are they doing, what expressions do they have
   - Connect directly to the actual copy/messaging from the campaign content above
   - Make it Vietnamese and relatable (local context, real situations)

2. EMOTIONAL IMPACT (50+ words)
   - What feeling should viewers get?
   - How does this visual connect to the campaign's offer/hook?
   - What story does it tell at a glance?

3. BRAND INTEGRATION (50+ words)
   - How to subtly incorporate brand elements
   - Color palette based on both brand colors AND campaign mood
   - Style consistency with brand guidelines (or create appropriate style if not specified)

4. TECHNICAL SPECIFICATIONS (for DALL-E 3):
   - Shot type: close-up, medium, wide, cinematic?
   - Lighting: natural daylight, studio, golden hour, moody?
   - Composition: rule of thirds, centered, leading lines?
   - Visual style: realistic photography, editorial, lifestyle?
   - Color grading: warm, cool, high contrast, muted?
   - Vietnam-specific visual cues (if appropriate)

5. EXPLICIT VISUAL ELEMENTS (list 10-15 specific elements to include):
   - What objects/elements MUST be in the image
   - What should be ABSENT (generic stock elements to avoid)
   - What emotional details make it authentic

OUTPUT FORMAT:
Return a SINGLE, COHERENT prompt of 600-1000 words that DALL-E 3 can understand.
The prompt should read like a creative brief, not a list.

IMPORTANT:
- Reference SPECIFIC phrases or ideas from the campaign content above
- Make the visual feel OWNED by this campaign, not generic
- Include Vietnamese context where authentic
- Do NOT add readable text, logos, or watermarks
- Prioritize emotional authenticity over technical perfection"""

    try:
        response = await asyncio.wait_for(
            _openai.chat.completions.create(
                model=PROMPT_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert advertising creative director. Return ONLY the prompt text, no explanations or formatting. The prompt should be vivid, specific, and actionable for DALL-E 3."
                    },
                    {"role": "user", "content": generation_prompt}
                ],
                temperature=0.8,
                max_tokens=3000,
            ),
            timeout=PROMPT_TIMEOUT,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        # Fallback to structured prompt
        return _generate_structured_fallback(context)


async def _generate_brand_fallback(context: CampaignContext) -> str:
    """Fallback when no campaign content is available yet."""

    prompt = f"""Expert advertising photography for Vietnamese SME marketing campaign.

CAMPAIGN: {context.campaign_name}
GOAL: {context.objective}
PRODUCT: {context.product_or_service}"""

    if context.target_audience:
        prompt += f"\nTARGET: {context.target_audience}"

    if context.offer_or_hook:
        prompt += f"\nKEY MESSAGE: {context.offer_or_hook}"

    if context.brand_name:
        prompt += f"\nBRAND: {context.brand_name}"

    if context.brand_description:
        prompt += f"\nBRAND PERSONALITY: {context.brand_description}"

    if context.brand_colors:
        prompt += f"\nBRAND COLORS (use as accent): {', '.join(context.brand_colors)}"

    if context.brand_style:
        prompt += f"\nSTYLE: {context.brand_style}"

    prompt += """

VISUAL REQUIREMENTS:
- Lifestyle photography style, authentic Vietnamese context
- Real people in relatable situations (not overly polished models)
- Warm, inviting atmosphere that matches the campaign goal
- Shot on professional camera with natural/available lighting
- Shallow depth of field, cinematic color grading
- Include subtle product/service elements integrated naturally
- NO text, logos, watermarks, or generic stock imagery
- Make viewer curious and emotionally engaged

Vietnamese SME marketing key visual, professional photography, high production quality."""

    return prompt


def _basic_prompt_enhancement(user_prompt: str, context: CampaignContext) -> str:
    """Basic enhancement when API call fails."""
    enhancement_parts = [user_prompt]

    if context.brand_name:
        enhancement_parts.append(f"Brand: {context.brand_name}")

    if context.brand_colors:
        enhancement_parts.append(f"Color palette: {', '.join(context.brand_colors)}")

    if context.target_audience:
        enhancement_parts.append(f"Target audience context: {context.target_audience}")

    enhancement_parts.extend([
        "Vietnamese SME marketing style",
        "Professional photography, authentic lifestyle",
        "Warm, inviting atmosphere",
        "No text, logos, or watermarks",
    ])

    return " | ".join(enhancement_parts)


def _generate_structured_fallback(context: CampaignContext) -> str:
    """Structured fallback when API call fails."""

    # Extract key messaging from content
    key_messages = []

    for item in context.content_items:
        if item.get("channel") == "email":
            subject = item.get("subject", "")
            if subject:
                key_messages.append(f"Email: {subject}")
        elif item.get("channel") == "facebook_post":
            copy = item.get("copy", "")
            if copy:
                key_messages.append(f"Post: {copy[:100]}...")

    messaging_str = "\n".join(f"- {m}" for m in key_messages) if key_messages else context.offer_or_hook or context.objective

    return f"""Expert Vietnamese SME marketing key visual - campaign photography

CAMPAIGN: {context.campaign_name}
OBJECTIVE: {context.objective}
PRODUCT: {context.product_or_service}

KEY MESSAGING FROM CAMPAIGN:
{messaging_str}

TARGET AUDIENCE: {context.target_audience or 'Vietnamese consumers'}

VISUAL DIRECTION:
Create a compelling key visual that tells the campaign's story at a glance.
The image should:
- Feature relatable Vietnamese people in authentic situations
- Convey the campaign's emotional core through expressions and setting
- Integrate product/service elements naturally, not artificially
- Use warm, inviting lighting that draws viewers in
- Have cinematic composition with strong focal point

PHOTOGRAPHY STYLE:
- Professional DSLR quality, not smartphone or 3D render
- Lifestyle/editorial aesthetic, not typical stock photo
- Natural daylight with subtle warm fill
- Shallow depth of field, bokeh background
- Authentic expressions, not posed smiles
- Real-world Vietnamese contexts (cafe, home, office, market)

COLOR PALETTE:
Base tones that match campaign mood, with subtle accent colors from brand if available.
Warm and inviting, professional but approachable.

BRAND CONTEXT:
{context.brand_name or 'Unbranded'} - {context.brand_description or 'SME business'}

EXCLUDE:
- Generic stock imagery feel
- Readable text, logos, watermarks, or brand marks
- Overly polished/corportate looks
- Cluttered compositions
- Unnatural poses or expressions

PRODUCTION:
High-end marketing photography, suitable for social media, email headers, and landing pages.
Vietnamese market authentic aesthetic."""


# ── Helper to build context from database models ───────────────────────────────

def build_context_from_campaign(
    campaign_data: dict,
    brand_data: dict | None = None,
    content_items: list[dict] | None = None,
) -> CampaignContext:
    """Build CampaignContext from raw database data."""

    # Extract brand info
    brand_name = None
    brand_description = None
    brand_colors = None
    brand_style = None

    if brand_data:
        brand_name = brand_data.get("brand_name")
        brand_description = brand_data.get("brand_description") or brand_data.get("description")
        brand_colors = brand_data.get("color_palette")
        brand_style = brand_data.get("visual_style") or brand_data.get("style")

    # Process content items
    processed_content = []
    if content_items:
        for item in content_items:
            try:
                processed = {
                    "channel": item.get("channel"),
                    "status": item.get("status"),
                }

                # Handle content_json - could be dict or JSON string
                content_json_raw = item.get("content_json") or {}
                if isinstance(content_json_raw, str):
                    import json
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
                # Skip malformed content items
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
