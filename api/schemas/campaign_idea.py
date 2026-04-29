import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


VALID_CHANNELS = ["facebook_post", "email", "video_script"]
IDEA_STATUSES = ["draft", "suggesting", "building", "complete"]


class EmailContentIn(BaseModel):
    subject: str
    preheader: str | None = None
    body: str
    cta_text: str | None = None
    cta_url: str | None = None


class PostContentIn(BaseModel):
    hook: str
    body: str
    hashtags: list[str] = []
    image_style: str | None = None


class VideoSceneIn(BaseModel):
    seconds: str
    description: str
    text_overlay: str | None = None
    audio_suggestion: str | None = None


class VideoScriptIn(BaseModel):
    duration: str = "30s"
    hook_seconds: str | None = None
    scenes: list[VideoSceneIn] = []


class CampaignIdeaSuggestRequest(BaseModel):
    brand_id: uuid.UUID | None = None


class CampaignIdeaSuggestionItem(BaseModel):
    id: str
    title: str
    description: str
    category: str
    channels: list[str]
    hook: str | None = None
    timing: str | None = None  # VD: "Tháng 9 - chạy 1-2 tuần trước dịp"
    customer_segment: str | None = None  # VD: "Khách cũ 3-6 tháng"
    urgency_level: str | None = None  # "high", "medium", "low"


class CampaignIdeaSuggestResponse(BaseModel):
    suggestions: list[CampaignIdeaSuggestionItem]


class CampaignIdeaCreateFromSuggestion(BaseModel):
    suggestion_id: str
    title: str
    objective: str | None = None
    channels: list[str] = []
    hook: str | None = None
    timing: str | None = None
    customer_segment: str | None = None


class CampaignIdeaBuildEmailRequest(BaseModel):
    idea_id: uuid.UUID


class CampaignIdeaBuildPostRequest(BaseModel):
    idea_id: uuid.UUID


class CampaignIdeaBuildVideoRequest(BaseModel):
    idea_id: uuid.UUID


class CampaignIdeaBuildImagePromptRequest(BaseModel):
    idea_id: uuid.UUID


class CampaignIdeaUpdateRequest(BaseModel):
    title: str | None = None
    objective: str | None = None
    channels: list[str] | None = None
    email_content: dict | None = None
    post_content: dict | None = None
    video_script: dict | None = None
    image_prompt: str | None = None


class CampaignIdeaOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    brand_id: uuid.UUID | None = None
    title: str
    objective: str | None = None
    channels: list[str] | None = None
    timing: str | None = None
    customer_segment: str | None = None
    email_content: dict | None = None
    post_content: dict | None = None
    video_script: dict | None = None
    image_prompt: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
