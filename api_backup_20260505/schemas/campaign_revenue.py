from pydantic import BaseModel, Field
from datetime import date, datetime
from uuid import UUID
from typing import Optional


class CampaignRevenueCreate(BaseModel):
    """Schema để tạo mới doanh thu cho chiến dịch."""
    revenue: float = Field(..., ge=0, description="Tổng doanh thu (VNĐ)")
    order_count: int = Field(default=0, ge=0, description="Số đơn hàng")
    cost: Optional[float] = Field(default=0, ge=0, description="Chi phí chiến dịch")
    source: str = Field(default="manual", description="Nguồn: 'manual', 'csv_upload', 'xlsx_upload'")
    notes: Optional[str] = Field(default=None, description="Ghi chú")
    recorded_date: Optional[date] = Field(default=None, description="Ngày ghi nhận doanh thu")


class CampaignRevenueUpdate(BaseModel):
    """Schema để cập nhật doanh thu."""
    revenue: Optional[float] = Field(default=None, ge=0)
    order_count: Optional[int] = Field(default=None, ge=0)
    cost: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = None
    recorded_date: Optional[date] = None


class CampaignRevenueOut(BaseModel):
    """Schema trả về khi đọc doanh thu."""
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


class CampaignPerformanceMetrics(BaseModel):
    """Metrics tổng hợp của chiến dịch."""
    campaign_id: UUID
    campaign_name: str
    status: str
    
    # Email metrics
    total_sent: int = 0
    delivered: int = 0
    bounced: int = 0
    opened: int = 0
    clicked: int = 0
    unsubscribed: int = 0
    
    # Revenue
    total_revenue: float = 0
    total_orders: int = 0
    
    # Rates
    open_rate: float = 0.0
    click_rate: float = 0.0
    conversion_rate: float = 0.0
    
    # ROI
    cost: float = 0
    roi_percent: Optional[float] = None
    revenue_per_email: float = 0.0


class CampaignPerformanceResponse(BaseModel):
    """Response cho API lấy performance của 1 chiến dịch."""
    metrics: CampaignPerformanceMetrics
    revenues: list[CampaignRevenueOut] = []
