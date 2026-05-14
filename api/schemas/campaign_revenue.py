from pydantic import BaseModel, Field
from datetime import date, datetime
from uuid import UUID
from typing import Optional


class CampaignRevenueCreate(BaseModel):
    revenue: float = Field(..., ge=0)
    order_count: int = Field(default=0, ge=0)
    cost: Optional[float] = Field(default=0, ge=0)
    source: str = Field(default="manual")
    notes: Optional[str] = Field(default=None)
    recorded_date: Optional[date] = Field(default=None)


class CampaignRevenueUpdate(BaseModel):
    revenue: Optional[float] = Field(default=None, ge=0)
    order_count: Optional[int] = Field(default=None, ge=0)
    cost: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = None
    recorded_date: Optional[date] = None


class CampaignRevenueOut(BaseModel):
    id: UUID
    campaign_id: UUID
    revenue: float
    order_count: int
    cost: Optional[float] = 0
    source: str
    notes: Optional[str] = None
    recorded_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChannelMetrics(BaseModel):
    """Metrics cho từng kênh."""
    sent: int = 0
    opened: int = 0
    clicked: int = 0
    open_rate: float = 0.0
    click_rate: float = 0.0
    link_clicks: int = 0  # từ tracking_links (Facebook)


class CampaignPerformanceMetrics(BaseModel):
    """Metrics tổng hợp của chiến dịch."""
    campaign_id: UUID
    campaign_name: str
    status: str

    # Tổng hợp
    total_sent: int = 0
    total_delivered: int = 0
    total_opened: int = 0
    total_clicked: int = 0
    total_bounced: int = 0

    # Tổng rates (weighted average hoặc overall)
    open_rate: float = 0.0
    click_rate: float = 0.0

    # Breakdown theo kênh
    email: ChannelMetrics = Field(default_factory=ChannelMetrics)
    facebook: ChannelMetrics = Field(default_factory=ChannelMetrics)


class CampaignPerformanceResponse(BaseModel):
    """Response cho API lấy performance của 1 chiến dịch."""
    metrics: CampaignPerformanceMetrics
    revenues: list[CampaignRevenueOut] = []
