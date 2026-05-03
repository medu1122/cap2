# Đề xuất cải tiến Chiến dịch - AIMAP

> **Ngày tạo:** 03/05/2026
> **Phạm vi:** Phần Chiến dịch (Campaign Module) + Performance Tracking
> **Dựa trên:** Phân tích hệ thống hiện tại + gợi ý từ AI Advisor

---

## 1. TỔNG QUAN TÍNH NĂNG MỚI

### 1.1 Những gì đã có

| Tính năng | Trạng thái | Ghi chú |
|------------|------------|---------|
| Tạo chiến dịch với AI | ✅ Hoàn thành | Agent tạo nội dung |
| Gửi email/SMS | ✅ Hoàn thành | qua campaign_execution_logs |
| AI Tools Menu | ✅ Hoàn thành | Dropdown với 2 chức năng |
| Tracking mở/click | ✅ Đã có dữ liệu | opened_at, clicked_at trong logs |

### 1.2 Những gì CẦN THÊM

| Tính năng | Mức ưu tiên | Ghi chú |
|------------|-------------|---------|
| **Nhập doanh thu** | 🔴 Cao | Để tính ROI |
| **AI Tools: Gợi ý chiến dịch** | 🔴 Cao | Modal AI tạo ý tưởng |
| **AI Tools: Phân tích chiến dịch** | 🔴 Cao | Xem KPI + ROI |
| **Bảng tổng hợp Performance** | 🟡 Trung bình | View tổng hợp metrics |

---

## 2. AI TOOLS MENU

### 2.1 Vị trí

| Trang | Vị trí nút AI Tools |
|-------|---------------------|
| `/campaigns` | Header, gần nút "Tạo chiến dịch" |
| `/dashboard` | Header, gần nút Hướng dẫn |
| Mọi trang | Nút floating cố định góc phải dưới |

### 2.2 Dropdown Menu

```
┌────────────────────────────┐
│  Công cụ AI                │
├────────────────────────────┤
│  ┌──────────────────────┐  │
│  │ ✨ Gợi ý chiến dịch  │  │
│  │    AI tạo ý tưởng mới│  │
│  └──────────────────────┘  │
│  ┌──────────────────────┐  │
│  │ 📊 Phân tích chiến   │  │
│  │    Xem kết quả & ROI │  │
│  └──────────────────────┘  │
└────────────────────────────┘
```

### 2.3 Component đã tạo

- **File:** `web/components/campaign-assistant/AIToolsMenu.tsx`
- **Style:** Windows Desktop (icon + text bên dưới)
- **Icons:** Sparkles (gợi ý), BarChart3 (phân tích)

---

## 3. NHẬP DOANH THU

### 3.1 Tại sao cần nhập doanh thu?

Hệ thống email **KHÔNG thể tự biết** bạn bán được bao nhiêu tiền.

```
Bạn gửi email cho 100 khách
→ 50 người mở email (Open Rate: 50%)
→ 10 người click vào link "Mua hàng"
→ 3 người thực sự mua hàng

NHƯNG hệ thống email KHÔNG biết:
→ 3 người mua đó tổng cộng mua bao nhiêu tiền?
→ Chiến dịch này lời hay lỗ?
→ ROI là bao nhiêu %?
```

### 3.2 Form nhập doanh thu (ĐƠN GIẢN)

```
┌─────────────────────────────────────────────────────────┐
│  Nhập Doanh thu từ chiến dịch                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Chiến dịch: [Summer Sale 2026              ▼]        │
│                                                         │
│  Tổng doanh thu (VNĐ): [____9,500,000____]           │
│  Số đơn hàng:            [____________8________]      │
│                                                         │
│  Chi phí (VNĐ):          [_______________] (tuỳ chọn) │
│                                                         │
│  Hoặc upload file chi tiết đơn hàng:                  │
│  ┌─────────────────────────────────────────────────┐  │
│  │  📁 Kéo file .csv, .xlsx vào đây               │  │
│  │  (Export từ Shopee/Lazada/Tiki)                │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  Preview sau khi upload:                               │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Tổng: 18 đơn hàng | 9,500,000 VNĐ            │  │
│  │  [Xem chi tiết]                                │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│                           [Hủy]  [Cập nhật]            │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Sau khi bấm "Cập nhật"

```
┌─────────────────────────────────────────────────────────┐
│  ✅ Cập nhật thành công!                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Summer Sale 2026:                                     │
│                                                         │
│  📊 Số đơn hàng:        8 → 18 (+10)                 │
│  💰 Doanh thu:    9,500,000 → 18,750,000 VNĐ         │
│  📈 Conversion rate:    1.6% → 2.5%                   │
│  💵 Tiền/email:    19,547 → 27,456 VNĐ               │
│  📊 ROI:                  --- → 650%                  │
│                                                         │
│  [Xem chi tiết chiến dịch]                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 3.4 Lưu ý về CSV upload

**File CSV thực tế từ các sàn:**

| Platform | Các cột có sẵn |
|----------|---------------|
| Shopee | order_id, order_date, total_amount, product_name |
| Lazada | Order Number, Created At, Grand Total, Items |
| Tiki | Mã đơn, Ngày đặt, Tổng tiền, Sản phẩm |

**→ Khuyến nghị:** Dùng form nhập tay đơn giản thay vì yêu cầu user chỉnh sửa file CSV.

---

## 4. PHÂN TÍCH CHIẾN DỊCH

### 4.1 KPI hiển thị

| Chỉ số | Nguồn | Công thức |
|---------|-------|-----------|
| Email gửi | campaign_execution_logs | COUNT(*) |
| Gửi thành công | campaign_execution_logs | COUNT WHERE status='delivered' |
| Gửi thất bại | campaign_execution_logs | COUNT WHERE status='bounced' |
| Mở email | campaign_execution_logs | COUNT WHERE opened_at IS NOT NULL |
| Click | campaign_execution_logs | COUNT WHERE clicked_at IS NOT NULL |
| Doanh thu | campaign_revenue | SUM(revenue) |
| Số đơn hàng | campaign_revenue | SUM(order_count) |
| ROI | Tính toán | (Doanh thu - Chi phí) / Chi phí × 100% |

### 4.2 So sánh với mức trung bình ngành

| Chỉ số | Trung bình ngành | AIMAP |
|--------|-----------------|-------|
| Tỷ lệ mở | 21% | 24.6% |
| Tỷ lệ click | 2.6% | 6.0% |
| Tỷ lệ chuyển đổi | 1-3% | 1.3% |

---

## 5. THAY ĐỔI CẦN LÀM

### 5.1 Database

**Bảng mới: `campaign_revenue`**

```sql
CREATE TABLE IF NOT EXISTS campaign_revenue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    revenue DECIMAL(15, 2) NOT NULL DEFAULT 0,
    order_count INTEGER NOT NULL DEFAULT 0,
    cost DECIMAL(15, 2) DEFAULT 0,
    
    source VARCHAR(20) DEFAULT 'manual',
    file_upload_id UUID REFERENCES file_uploads(id) ON DELETE SET NULL,
    
    notes TEXT,
    recorded_date DATE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_campaign_revenue_campaign_id ON campaign_revenue(campaign_id);
CREATE INDEX ix_campaign_revenue_user_id ON campaign_revenue(user_id);
```

**Cột mới trong `campaigns`:**

```sql
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cost DECIMAL(15, 2) DEFAULT 0;
```

**View tổng hợp: `v_campaign_performance`**

```sql
CREATE OR REPLACE VIEW v_campaign_performance AS
SELECT 
    c.id AS campaign_id,
    c.campaign_name,
    c.status,
    c.cost,
    
    COUNT(DISTINCT cel.id) AS total_sent,
    COUNT(DISTINCT CASE WHEN cel.status = 'delivered' THEN cel.id END) AS delivered,
    COUNT(DISTINCT CASE WHEN cel.opened_at IS NOT NULL THEN cel.id END) AS opened,
    COUNT(DISTINCT CASE WHEN cel.clicked_at IS NOT NULL THEN cel.id END) AS clicked,
    
    COALESCE(SUM(cr.revenue), 0) AS total_revenue,
    COALESCE(SUM(cr.order_count), 0) AS total_orders,
    
    ROUND(
        COUNT(DISTINCT CASE WHEN cel.opened_at IS NOT NULL THEN cel.id END)::NUMERIC / 
        NULLIF(COUNT(DISTINCT CASE WHEN cel.status = 'delivered' THEN cel.id END), 0) * 100, 
        2
    ) AS open_rate,
    
    ROUND(
        COUNT(DISTINCT CASE WHEN cel.clicked_at IS NOT NULL THEN cel.id END)::NUMERIC / 
        NULLIF(COUNT(DISTINCT CASE WHEN cel.status = 'delivered' THEN cel.id END), 0) * 100, 
        2
    ) AS click_rate,
    
    CASE 
        WHEN c.cost > 0 
        THEN ROUND((COALESCE(SUM(cr.revenue), 0) - c.cost) / c.cost * 100, 2)
        ELSE NULL 
    END AS roi_percent

FROM campaigns c
LEFT JOIN campaign_execution_logs cel ON cel.campaign_id = c.id
LEFT JOIN campaign_revenue cr ON cr.campaign_id = c.id
GROUP BY c.id, c.campaign_name, c.status, c.cost;
```

### 5.2 Backend API Endpoints

| Method | Endpoint | Chức năng |
|--------|----------|-----------|
| GET | `/campaigns/{id}/performance` | Lấy KPIs của 1 chiến dịch |
| POST | `/campaigns/{id}/revenue` | Nhập doanh thu |
| PUT | `/campaigns/{id}/revenue/{revenue_id}` | Cập nhật doanh thu |
| DELETE | `/campaigns/{id}/revenue/{revenue_id}` | Xóa doanh thu |
| POST | `/campaigns/{id}/revenue/import` | Import từ CSV |

### 5.3 Frontend Components

| File | Chức năng |
|------|-----------|
| `AIToolsMenu.tsx` | ✅ Đã tạo |
| `RevenueUploadModal.tsx` | Modal nhập doanh thu |
| `PerformanceSection.tsx` | Hiển thị KPIs |
| `CampaignAnalyticsPage.tsx` | Trang phân tích chiến dịch |

---

## 6. FILES ĐÃ TẠO/SỬA

### 6.1 Components

| File | Action |
|------|--------|
| `components/campaign-assistant/AIToolsMenu.tsx` | **Tạo mới** |
| `components/campaign-assistant/CampaignAssistantButton.tsx` | Giữ nguyên |

### 6.2 Pages

| File | Action |
|------|--------|
| `app/(app)/campaigns/page.tsx` | Thêm AIToolsMenu |
| `app/(app)/dashboard/page.tsx` | Thêm AIToolsMenu |

### 6.3 Demo Files

| File | Mô tả |
|------|--------|
| `docs/demo-campaigns-ai-tools.html` | Demo UI AI Tools + Form nhập doanh thu |
| `docs/demo-performance-tracking.html` | Demo báo cáo phân tích đầy đủ |

---

## 7. SQL ĐỂ CHẠY TRÊN DATABASE

```sql
-- =====================================================
-- BẢNG MỚI: campaign_revenue
-- =====================================================
CREATE TABLE IF NOT EXISTS campaign_revenue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    revenue DECIMAL(15, 2) NOT NULL DEFAULT 0,
    order_count INTEGER NOT NULL DEFAULT 0,
    cost DECIMAL(15, 2) DEFAULT 0,
    source VARCHAR(20) DEFAULT 'manual',
    file_upload_id UUID REFERENCES file_uploads(id) ON DELETE SET NULL,
    notes TEXT,
    recorded_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_campaign_revenue_campaign_id ON campaign_revenue(campaign_id);
CREATE INDEX IF NOT EXISTS ix_campaign_revenue_user_id ON campaign_revenue(user_id);
CREATE INDEX IF NOT EXISTS ix_campaign_revenue_recorded_date ON campaign_revenue(recorded_date DESC);

CREATE TRIGGER update_campaign_revenue_updated_at BEFORE UPDATE ON campaign_revenue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- CỘT MỚI: campaigns.cost
-- =====================================================
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cost DECIMAL(15, 2) DEFAULT 0;

-- =====================================================
-- VIEW: v_campaign_performance
-- =====================================================
CREATE OR REPLACE VIEW v_campaign_performance AS
SELECT 
    c.id AS campaign_id,
    c.campaign_name,
    c.status,
    c.cost,
    COUNT(DISTINCT cel.id) AS total_sent,
    COUNT(DISTINCT CASE WHEN cel.status = 'delivered' THEN cel.id END) AS delivered,
    COUNT(DISTINCT CASE WHEN cel.status = 'bounced' THEN cel.id END) AS bounced,
    COUNT(DISTINCT CASE WHEN cel.opened_at IS NOT NULL THEN cel.id END) AS opened,
    COUNT(DISTINCT CASE WHEN cel.clicked_at IS NOT NULL THEN cel.id END) AS clicked,
    COALESCE(SUM(cr.revenue), 0) AS total_revenue,
    COALESCE(SUM(cr.order_count), 0) AS total_orders,
    CASE WHEN COUNT(DISTINCT CASE WHEN cel.status = 'delivered' THEN cel.id END) > 0 
        THEN ROUND(COUNT(DISTINCT CASE WHEN cel.opened_at IS NOT NULL THEN cel.id END)::NUMERIC / 
        COUNT(DISTINCT CASE WHEN cel.status = 'delivered' THEN cel.id END) * 100, 2) ELSE 0 END AS open_rate,
    CASE WHEN COUNT(DISTINCT CASE WHEN cel.status = 'delivered' THEN cel.id END) > 0 
        THEN ROUND(COUNT(DISTINCT CASE WHEN cel.clicked_at IS NOT NULL THEN cel.id END)::NUMERIC / 
        COUNT(DISTINCT CASE WHEN cel.status = 'delivered' THEN cel.id END) * 100, 2) ELSE 0 END AS click_rate,
    CASE WHEN c.cost > 0 THEN ROUND((COALESCE(SUM(cr.revenue), 0) - c.cost) / c.cost * 100, 2) ELSE NULL END AS roi_percent
FROM campaigns c
LEFT JOIN campaign_execution_logs cel ON cel.campaign_id = c.id
LEFT JOIN campaign_revenue cr ON cr.campaign_id = c.id
GROUP BY c.id, c.campaign_name, c.status, c.cost;
```

---

## 8. TRIỂN KHAI

### 8.1 Thứ tự ưu tiên

| Bước | Nội dung | Thời gian ước tính |
|------|----------|-------------------|
| 1 | Chạy SQL tạo bảng mới | 10 phút |
| 2 | Tạo API endpoints | 2-3 giờ |
| 3 | Component RevenueUploadModal | 2 giờ |
| 4 | Component PerformanceSection | 2 giờ |
| 5 | Integration vào trang campaigns | 1 giờ |

### 8.2 Người phụ trách

| Thành phần | Phụ trách |
|------------|-----------|
| Database SQL | User tự chạy |
| Backend API | API team |
| Frontend components | Web team |

---

*Tài liệu cập nhật ngày 03/05/2026*
