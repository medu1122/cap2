import uuid
from datetime import datetime, date
from pydantic import BaseModel, ConfigDict

VALID_CHANNELS = ["facebook_post", "email", "video_script"]
VALID_STATUSES = ["pending_agent", "running", "pending_approval", "approved", "partially_approved", "failed"]


class CampaignCreate(BaseModel):
    campaign_name: str
    objective: str
    product_or_service: str
    target_audience: str | None = None
    offer_or_hook: str | None = None
    deadline: date
    channels: list[str]
    additional_notes: str | None = None


class CampaignListItem(BaseModel):
    id: uuid.UUID
    campaign_name: str
    objective: str
    status: str
    channels: list[str]
    deadline: date
    created_at: datetime
    content_count: int = 0
    pending_count: int = 0

    model_config = {"from_attributes": True}


class AgentLogOut(BaseModel):
    id: uuid.UUID
    agent_name: str
    step_order: int
    channel: str | None
    model_used: str
    model_provider: str
    prompt_preview: str | None
    output_preview: str | None
    input_tokens: int | None
    output_tokens: int | None
    duration_ms: int | None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())


class ContentItemOut(BaseModel):
    id: uuid.UUID
    channel: str
    version: int
    status: str
    content_json: dict
    scheduled_date: date | None
    source: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CampaignDetail(BaseModel):
    id: uuid.UUID
    campaign_name: str
    objective: str
    product_or_service: str
    target_audience: str | None
    offer_or_hook: str | None
    deadline: date
    channels: list[str]
    additional_notes: str | None
    status: str
    error_message: str | None
    campaign_plan_json: dict | None
    content_items: list[ContentItemOut]
    agent_logs: list[AgentLogOut]
    created_at: datetime

    model_config = {"from_attributes": True}
