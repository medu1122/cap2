# Tính năng Danh Sách Customer - Tài liệu kỹ thuật

**Ngày tạo:** 29/4/2026
**Phiên bản:** 1.0

---

## 1. Tổng quan kiến trúc

### 1.1 Các thành phần chính

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
├─────────────────────────────────────────────────────────────────┤
│  /customer-lists     │  /outreach/[segment]                   │
│  - Quản lý danh sách │  - Gửi email theo segment              │
│  - Bảng dữ liệu      │  - Soạn & gửi từng email               │
│  - Phân tích         │                                        │
└───────────┬───────────┴────────────────────┬────────────────────┘
            │                                │
            ▼                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend API (FastAPI)                        │
├─────────────────────────────────────────────────────────────────┤
│  /workflow/customer-lists/*    - CRUD, phân tích               │
│  /workflow/customer-lists/{id}/smart-contact-batch             │
│  /workflow/customer-lists/{id}/smart-contact-batch-send        │
└───────────┬─────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Database (PostgreSQL)                         │
├─────────────────────────────────────────────────────────────────┤
│  customer_lists          │  customers                           │
│  customer_analysis_      │  campaign_execution_logs             │
│  snapshots               │                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema

### 2.1 Bảng `customer_lists`

| Cột | Kiểu | Mô tả |
|-----|------|--------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key đến `users` |
| `file_upload_id` | UUID | Foreign key đến `file_uploads` (nullable) |
| `list_name` | VARCHAR(255) | Tên danh sách |
| `status` | VARCHAR(30) | Trạng thái: `draft`, `processing`, `ready`, `failed` |
| `total_records` | INTEGER | Tổng số dòng |
| `valid_records` | INTEGER | Số dòng hợp lệ (có Họ tên + SĐT) |
| `invalid_records` | INTEGER | Số dòng không hợp lệ |
| `created_at` | TIMESTAMP | Thời điểm tạo |
| `updated_at` | TIMESTAMP | Thời điểm cập nhật cuối |

### 2.2 Bảng `customers`

| Cột | Kiểu | Mô tả |
|-----|------|--------|
| `id` | UUID | Primary key |
| `customer_list_id` | UUID | Foreign key đến `customer_lists` |
| `email` | VARCHAR(255) | Email khách hàng (nullable, indexed) |
| `full_name` | VARCHAR(255) | Họ và tên (nullable) |
| `phone` | VARCHAR(50) | Số điện thoại (nullable) |
| `extra_fields` | JSONB | Lưu các cột bổ sung từ file import |

### 2.3 Bảng `customer_analysis_snapshots` (MỚI)

| Cột | Kiểu | Mô tả |
|-----|------|--------|
| `id` | UUID | Primary key |
| `customer_list_id` | UUID | Foreign key đến `customer_lists` |
| `result_json` | JSONB | Lưu kết quả phân tích đầy đủ |
| `created_at` | TIMESTAMP | Thời điểm tạo snapshot |

**Cấu trúc JSON trong `result_json`:**

```json
{
  "list_id": "uuid",
  "list_name": "Tên danh sách",
  "analysis": {
    "overview": {
      "total_customers": 100,
      "total_revenue": 50000000,
      "recent_activity_30d_percent": 45.5
    },
    "segmentation": {
      "summary": { "vip": 10, "potential": 30, "churn_risk": 20, "new": 40 },
      "customers": [{ "customer_name": "Nguyễn Văn A", "segment": "vip" }]
    },
    "churn_risk": {
      "inactive_over_30_days": 15,
      "inactive_over_60_days": 5,
      "high_risk_customers": [],
      "medium_risk_customers": []
    }
  }
}
```

---

## 3. Phân loại Customer (Segment)

### 3.1 Logic phân loại (runtime, trong `extra_fields`)

```python
def _segment_customer(extra_fields: dict | None) -> str:
    """
    - inactive: days_since_last_purchase >= 60
    - vip: total_spend >= 10_000_000 hoặc order_count >= 10
    - potential: còn lại và có dữ liệu cơ bản
    - new: không đủ dữ liệu
    """
    if days_since_last_purchase is not None and days >= 60:
        return "inactive"
    if total_spend >= 10_000_000 or order_count >= 10:
        return "vip"
    if days_since_last_purchase or total_spend or order_count:
        return "potential"
    return "unknown"
```

### 3.2 Các segment

| Segment | Mã | Điều kiện |
|---------|-----|------------|
| Khách có khả năng rời bỏ | `churn_risk` | inactive > 30 ngày (trong analysis) |
| VIP | `vip` | total_spend >= 10M hoặc order_count >= 10 |
| Tiềm năng | `potential` | Có dữ liệu nhưng không phải VIP/inactive |
| Khách mới | `new` | Không đủ dữ liệu để phân loại |

---

## 4. API Endpoints

### 4.1 Customer Lists

| Endpoint | Method | Mô tả |
|----------|--------|--------|
| `/workflow/customer-lists` | GET | Liệt kê tất cả danh sách |
| `/workflow/customer-lists` | POST | Tạo danh sách mới |
| `/workflow/customer-lists/{id}` | PATCH | Cập nhật tên |
| `/workflow/customer-lists/{id}` | DELETE | Xóa danh sách |
| `/workflow/customer-lists/{id}/rows` | GET | Lấy dữ liệu dòng |
| `/workflow/customer-lists/{id}/rows` | PUT | Cập nhật dữ liệu dòng |
| `/workflow/customer-lists/{id}/customers` | GET | Lấy customers (có filter segment) |
| `/workflow/customer-lists/{id}/analyze` | POST | Chạy phân tích |
| `/workflow/customer-lists/{id}/analysis` | GET | Lấy kết quả phân tích đã lưu |
| `/workflow/customer-lists/{id}/priority-customers` | GET | Lấy khách ưu tiên |
| `/workflow/customer-lists/{id}/priority-customers` | POST | Đánh dấu ưu tiên |
| `/workflow/customer-lists/{id}/priority-customers` | DELETE | Xóa tất cả ưu tiên |

### 4.2 Smart Contact (Email)

| Endpoint | Method | Mô tả |
|----------|--------|--------|
| `/workflow/customer-lists/{id}/quick-outreach` | POST | Gửi nhanh 1 message đến nhiều khách |
| `/workflow/customer-lists/{id}/smart-contact-compose` | POST | AI soạn nội dung email |
| `/workflow/customer-lists/{id}/smart-contact-batch` | POST | AI soạn nhiều email riêng theo segment |
| `/workflow/customer-lists/{id}/smart-contact-batch-send` | POST | Gửi email đã soạn |

### 4.3 Smart Contact Batch API Chi tiết

#### POST `/workflow/customer-lists/{id}/smart-contact-batch`

**Request:**
```json
{
  "brand_id": "uuid (optional)",
  "segment": "churn_risk | potential | new | vip",
  "purpose": "nhac_nhe | cham_soc | kich_hoat | khach_moi",
  "customers": [
    {
      "name": "Nguyễn Văn A",
      "email": "email@example.com",
      "phone": "0912345678",
      "segment": "churn_risk",
      "variables": {
        "HoVaTen": "Nguyễn Văn A",
        "LanCuoiChiTra": "2024-01-15",
        "DichVuLanCuoiSuDung": "Massage",
        "days_since_last": "120"
      }
    }
  ]
}
```

**Response:**
```json
{
  "results": [
    {
      "name": "Nguyễn Văn A",
      "email": "email@example.com",
      "phone": "0912345678",
      "subject": "Tin nhắn từ Cửa hàng",
      "body": "Chào A, đã lâu rồi bạn không ghé thăm..."
    }
  ]
}
```

#### POST `/workflow/customer-lists/{id}/smart-contact-batch-send`

**Request:**
```json
{
  "items": [
    {
      "name": "Nguyễn Văn A",
      "email": "email@example.com",
      "phone": "0912345678",
      "subject": "Tin nhắn từ Cửa hàng",
      "body": "Chào A, đã lâu rồi bạn không ghé thăm..."
    }
  ]
}
```

**Response:**
```json
{
  "results": [
    { "to": "email@example.com", "status": "sent", "detail": null }
  ]
}
```

---

## 5. Cấu trúc Code

### 5.1 Backend Structure

```
api/
├── main.py                           # FastAPI app, router registration
├── routers/
│   ├── workflow.py                   # Customer lists + smart contact endpoints
│   ├── campaigns.py                  # Campaign management
│   ├── insights.py                   # Deep analysis pipeline
│   └── ...
├── models/
│   ├── customer_list.py              # CustomerList model
│   ├── customer.py                   # Customer model
│   ├── customer_analysis_snapshot.py  # NEW: Analysis snapshot model
│   └── ...
├── services/
│   ├── customer_analysis_service.py  # Phân tích customer (rule engine)
│   ├── campaign_delivery_service.py  # Gửi email qua SMTP
│   └── ...
└── core/
    ├── config.py                     # Settings từ .env
    ├── database.py                   # AsyncSession, get_db
    └── deps.py                       # get_current_user dependency
```

### 5.2 Frontend Structure

```
web/
├── app/
│   └── (app)/
│       ├── customer-lists/
│       │   └── page.tsx             # Trang quản lý danh sách + bảng dữ liệu
│       └── outreach/
│           └── [segment]/
│               └── page.tsx         # Trang gửi email theo segment
└── components/
    └── layout/
        └── Sidebar.tsx              # Navigation sidebar
```

---

## 6. Hướng dẫn sử dụng

### 6.1 Tạo và quản lý danh sách khách hàng

1. **Tạo danh sách mới:**
   - Vào trang "Danh sách customer"
   - Bấm "Tạo danh sách"
   - Nhập tên danh sách

2. **Nạp dữ liệu:**
   - Chọn danh sách để mở
   - Bấm "Tải dữ liệu" để import CSV/XLSX
   - Hệ thống sẽ tự động map cột (nếu cần thiết, chỉnh mapping)

3. **Cột bắt buộc:** `HoVaTen` (Họ và tên), `SDT` (Số điện thoại)
4. **Cột khuyến nghị:** `Email`, `LanCuoiChiTra`, `TongSoTienDaChiTra`, `TongSoLanQuayLai`

### 6.2 Phân tích danh sách

1. **Chạy phân tích:**
   - Đảm bảo danh sách có dữ liệu
   - Bấm "Phân tích" hoặc "Phân tích lại"
   - Hệ thống sẽ phân tích và hiển thị kết quả

2. **Xem kết quả phân tích:**
   - Mở modal "Tổng quan phân tích"
   - Xem phân bố segment (VIP, Tiềm năng, Có khả năng rời bỏ)
   - Xem khách hàng có khả năng rời bỏ (rule engine)

3. **Đánh dấu ưu tiên:**
   - Từ kết quả phân tích, bấm "Đánh dấu ưu tiên"
   - Hệ thống sẽ tự động đánh dấu khách có khả năng rời bỏ

### 6.3 Gửi email theo segment

1. **Truy cập trang Outreach:**
   - Vào `/outreach/churn` cho khách có khả năng rời bỏ
   - Vào `/outreach/potential` cho khách tiềm năng
   - Vào `/outreach/vip` cho khách VIP
   - Vào `/outreach/new` cho khách mới

2. **Chọn mục đích gửi:**
   - Nhắc khách quay lại (nhac_nhe)
   - Chăm sóc, hỏi thăm (cham_soc)
   - Kích hoạt ghé lại (kich_hoat)
   - Chào khách mới (khach_moi)

3. **Soạn email:**
   - Bấm "Soạn tất cả" để AI soạn email riêng cho từng khách
   - Có thể chỉnh sửa email trước khi gửi
   - Bấm "Soạn lại" để yêu cầu AI soạn lại

4. **Gửi email:**
   - Bấm "Gửi" cho từng email
   - Hoặc bấm "Gửi tất cả email" ở footer

---

## 7. SMTP Configuration

Để gửi email thực sự, cần cấu hình SMTP trong file `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
```

**Lưu ý:** Với Gmail, cần tạo App Password thay vì dùng mật khẩu thường.

---

## 8. Database Migration

### Tạo bảng `customer_analysis_snapshots`

```sql
CREATE TABLE IF NOT EXISTS customer_analysis_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_list_id UUID NOT NULL REFERENCES customer_lists(id) ON DELETE CASCADE,
    result_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_customer_analysis_snapshots_list_id ON customer_analysis_snapshots(customer_list_id);
CREATE INDEX idx_customer_analysis_snapshots_created ON customer_analysis_snapshots(created_at DESC);
```

---

## 9. Troubleshooting

### 9.1 Lỗi "Chưa có kết quả phân tích"

**Nguyên nhân:** Chưa chạy phân tích cho customer list.

**Giải pháp:**
1. Mở customer list trong trang "Danh sách customer"
2. Bấm "Phân tích" để chạy phân tích
3. Sau khi phân tích xong, kết quả sẽ được lưu vào snapshot

### 9.2 Lỗi "Không có khách nào trong nhóm"

**Nguyên nhân:**
- Customer list chưa được phân tích
- Tên khách trong bảng không khớp với tên trong kết quả phân tích

**Giải pháp:**
- Chạy lại phân tích
- Kiểm tra cột "Họ và tên" trong bảng

### 9.3 Lỗi SMTP

**Nguyên nhân:** Chưa cấu hình SMTP hoặc cấu hình sai.

**Giải pháp:**
1. Kiểm tra các biến SMTP trong `.env`
2. Với Gmail, cần tạo App Password
3. Kiểm tra log để xem lỗi chi tiết

---

## 10. Security

### 10.1 Authentication
- Tất cả endpoints đều yêu cầu JWT token (qua `get_current_user` dependency)
- User chỉ có thể truy cập data của chính mình (`user_id` filter)

### 10.2 Input Validation
- Pydantic models cho request validation
- SQLAlchemy ORM để tránh SQL injection
- HTML escaping cho email body

### 10.3 Rate Limiting
- Giới hạn 200 khách mỗi batch compose
- Giới hạn 200 khách mỗi batch send
- Giới hạn 150 khách cho quick outreach
