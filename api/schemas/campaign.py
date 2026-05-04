import uuid
from datetime import datetime, date
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, field_validator

VALID_CHANNELS = ["facebook_post", "email", "video_script"]
VALID_STATUSES = ["pending_agent", "running", "pending_approval", "approved", "partially_approved", "failed"]


class CampaignCreate(BaseModel):
    brand_id: uuid.UUID
    campaign_name: str
    objective: str
    product_or_service: str
    target_audience: str | None = None
    offer_or_hook: str | None = None
    deadline: date
    channels: list[str]
    additional_notes: str | None = None
    source_insight_run_id: uuid.UUID | None = None
    source_customer_segment: str | None = None

    @field_validator("deadline")
    @classmethod
    def validate_deadline(cls, value: date) -> date:
        if value < date.today():
            raise ValueError("Ngày kết thúc không được là ngày trong quá khứ")
        return value

    @field_validator("channels")
    @classmethod
    def validate_channels(cls, value: list[str]) -> list[str]:
        invalid = [channel for channel in value if channel not in VALID_CHANNELS]
        if invalid:
            raise ValueError(f"Kênh không hợp lệ: {invalid}")
        return value

    @field_validator("source_customer_segment")
    @classmethod
    def validate_source_customer_segment(cls, value: str | None) -> str | None:
        if value is None:
            return None
        allowed = {"vip", "potential", "inactive", "unknown"}
        normalized = value.strip().lower()
        if normalized not in allowed:
            raise ValueError(f"Segment không hợp lệ: {value}")
        return normalized


class CampaignListItem(BaseModel):
    id: uuid.UUID
    brand_id: uuid.UUID | None = None
    campaign_name: str
    objective: str
    status: str
    channels: list[str]
    deadline: date
    created_at: datetime
    content_count: int = 0
    pending_count: int = 0
    source_insight_run_id: str | None = None
    source_customer_segment: str | None = None

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


class ContentItemCreate(BaseModel):
    channel: str
    content_json: dict
    status: str = "draft"
    scheduled_date: date | None = None


class CampaignDetail(BaseModel):
    id: uuid.UUID
    brand_id: uuid.UUID | None = None
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


class CampaignExecuteRequest(BaseModel):
    mode: Literal["email", "sms_demo"]
    customer_list_id: uuid.UUID
    ab_test: bool = False


class ExecutionLogOut(BaseModel):
    id: uuid.UUID
    batch_id: uuid.UUID
    recipient_name: str | None
    recipient_email: str | None
    recipient_phone: str | None
    channel: str
    status: str
    opened_at: datetime | None
    clicked_at: datetime | None
    sent_at: datetime | None
    ab_variant: str | None
    error_message: str | None

    model_config = ConfigDict(from_attributes=True)


class DeliveryMetricsOut(BaseModel):
    total: int
    sent: int
    failed: int
    skipped: int
    opened: int
    clicked: int
    open_rate: float
    click_rate: float
    ab_summary: dict[str, Any] | None = None


class DeliverySummaryResponse(BaseModel):
    delivery: dict | None
    metrics: DeliveryMetricsOut
    logs: list[ExecutionLogOut]
    latest_batch_id: str | None
