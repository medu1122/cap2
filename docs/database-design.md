# Thiết kế Cơ sở Dữ liệu — AIMAP

**AI-Powered Marketing Automation Platform for Small Businesses**

---

## 1. Tổng quan Thiết kế

### 1.1 Hệ quản trị cơ sở dữ liệu

| Thành phần | Lựa chọn | Lý do |
|---|---|---|
| RDBMS | **PostgreSQL 16** | Hỗ trợ JSONB (lưu output AI), UUID, ARRAY, full-text search — phù hợp nhất cho platform AI |
| ORM | **SQLAlchemy 2.x (async)** | Hỗ trợ async I/O, type-safe, tương thích FastAPI |
| Migration | **Alembic** | Version control schema, rollback an toàn |
| Kết nối | **asyncpg** | Driver PostgreSQL bất đồng bộ hiệu năng cao |

### 1.2 Tại sao chọn PostgreSQL thay vì MySQL hay MongoDB?

- **JSONB**: Lưu output của AI agents (cấu trúc linh hoạt theo từng kênh nội dung) mà không cần schema cứng
- **ARRAY type**: Lưu danh sách channels, key_products, forbidden_words mà không cần bảng phụ
- **UUID**: Primary key không đoán được, an toàn hơn auto-increment khi expose qua API
- **Full-text search**: Tìm kiếm trong nội dung AI tạo ra mà không cần Elasticsearch
- **ACID**: Đảm bảo tính nhất quán khi nhiều agent ghi đồng thời

### 1.3 Tổng quan schema

| Nhóm | Số bảng | Bảng |
|---|---|---|
| Xác thực & Người dùng | 4 | users, user_sessions, password_reset_tokens, email_verifications |
| Thương hiệu | 2 | brands, brand_assets |
| Chiến dịch | 3 | campaigns, campaign_tags, campaign_tag_assignments |
| Nội dung | 3 | content_items, content_templates, approval_history |
| Khách hàng | 3 | customer_lists, customers, customer_list_members |
| Tệp tin | 1 | file_uploads |
| Thông báo | 2 | notifications, notification_settings |
| AI & Agent | 2 | agent_run_logs, ai_usage_stats |
| Workflow | 2 | workflow_jobs, workflow_schedules |
| Phân tích | 1 | content_analytics |
| **Tổng** | **23** | |

---

## Cap nhat role va admin governance

### Dinh nghia role (moi)

- `admin`: van hanh va quan tri he thong.
- `user`: nguoi dung su dung AIMAP de tao va duyet noi dung marketing.

### Nhom bang bo sung cho admin

1. `admin_action_logs` - audit hanh dong admin.
2. `system_settings` - cau hinh van hanh toan he thong (rate limit, nguong canh bao usage, ...).

### Loi ich thuc te

- Truy vet su co nhanh (ai da khoa user, ai da retry workflow).
- Kiem soat chi phi AI minh bach.
- Chuan bi de mo rong da tenant o giai doan sau.

---

## 2. ERD — Sơ đồ Quan hệ Thực thể

```mermaid
erDiagram
    users {
        UUID id PK
        VARCHAR email UK
        VARCHAR hashed_pw
        VARCHAR full_name
        VARCHAR phone
        VARCHAR avatar_url
        VARCHAR business_type
        VARCHAR city
        VARCHAR website
        VARCHAR role
        BOOLEAN is_active
        BOOLEAN email_verified
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    user_sessions {
        UUID id PK
        UUID user_id FK
        VARCHAR refresh_token UK
        VARCHAR device_info
        VARCHAR ip_address
        TIMESTAMPTZ expires_at
        TIMESTAMPTZ created_at
    }

    password_reset_tokens {
        UUID id PK
        UUID user_id FK
        VARCHAR token UK
        BOOLEAN used
        TIMESTAMPTZ expires_at
        TIMESTAMPTZ created_at
    }

    email_verifications {
        UUID id PK
        UUID user_id FK
        VARCHAR token UK
        BOOLEAN verified
        TIMESTAMPTZ expires_at
        TIMESTAMPTZ created_at
    }

    brands {
        UUID id PK
        UUID user_id FK_UK
        VARCHAR brand_name
        VARCHAR tagline
        TEXT brand_description
        VARCHAR tone_of_voice
        VARCHAR logo_url
        VARCHAR primary_color
        TEXT target_audience
        TEXT[] key_products
        TEXT[] forbidden_words
        VARCHAR preferred_cta
        VARCHAR preferred_salutation
        TEXT sample_post
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    brand_assets {
        UUID id PK
        UUID brand_id FK
        VARCHAR asset_type
        VARCHAR file_url
        VARCHAR file_name
        INTEGER file_size_bytes
        TIMESTAMPTZ created_at
    }

    campaigns {
        UUID id PK
        UUID user_id FK
        VARCHAR campaign_name
        TEXT objective
        TEXT product_or_service
        TEXT target_audience
        TEXT offer_or_hook
        DATE deadline
        TEXT[] channels
        TEXT additional_notes
        VARCHAR status
        TEXT error_message
        JSONB campaign_plan_json
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    campaign_tags {
        UUID id PK
        UUID user_id FK
        VARCHAR name UK
        VARCHAR color
        TIMESTAMPTZ created_at
    }

    campaign_tag_assignments {
        UUID campaign_id FK
        UUID tag_id FK
    }

    content_items {
        UUID id PK
        UUID campaign_id FK
        VARCHAR channel
        INTEGER version
        VARCHAR status
        JSONB content_json
        VARCHAR source
        UUID agent_run_id FK
        TEXT rejection_note
        DATE scheduled_date
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    content_templates {
        UUID id PK
        UUID user_id FK
        VARCHAR template_name
        TEXT objective_template
        TEXT product_template
        TEXT audience_template
        TEXT[] default_channels
        TEXT notes_template
        INTEGER use_count
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    approval_history {
        UUID id PK
        UUID content_item_id FK
        UUID user_id FK
        VARCHAR action
        TEXT note
        INTEGER content_version
        TIMESTAMPTZ created_at
    }

    customer_lists {
        UUID id PK
        UUID user_id FK
        VARCHAR list_name
        TEXT description
        VARCHAR status
        INTEGER total_records
        INTEGER valid_records
        UUID file_upload_id FK
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    customers {
        UUID id PK
        UUID customer_list_id FK
        VARCHAR email
        VARCHAR full_name
        VARCHAR phone
        JSONB extra_fields
        TIMESTAMPTZ created_at
    }

    customer_list_members {
        UUID customer_list_id FK
        UUID customer_id FK
        TIMESTAMPTZ added_at
    }

    file_uploads {
        UUID id PK
        UUID user_id FK
        VARCHAR original_filename
        VARCHAR stored_path
        VARCHAR file_type
        BIGINT file_size_bytes
        VARCHAR mime_type
        VARCHAR purpose
        TIMESTAMPTZ created_at
    }

    notifications {
        UUID id PK
        UUID user_id FK
        VARCHAR type
        VARCHAR title
        TEXT body
        JSONB payload
        BOOLEAN is_read
        TIMESTAMPTZ read_at
        TIMESTAMPTZ created_at
    }

    notification_settings {
        UUID id PK
        UUID user_id FK_UK
        BOOLEAN campaign_completed
        BOOLEAN content_pending
        BOOLEAN workflow_triggered
        BOOLEAN weekly_summary
        TIMESTAMPTZ updated_at
    }

    agent_run_logs {
        UUID id PK
        UUID campaign_id FK
        VARCHAR agent_name
        INTEGER step_order
        VARCHAR channel
        VARCHAR model_used
        VARCHAR model_provider
        TEXT prompt_preview
        TEXT output_preview
        INTEGER input_tokens
        INTEGER output_tokens
        INTEGER duration_ms
        VARCHAR status
        TEXT error_detail
        TIMESTAMPTZ created_at
    }

    ai_usage_stats {
        UUID id PK
        UUID user_id FK
        INTEGER year
        INTEGER month
        VARCHAR model_provider
        VARCHAR model_name
        INTEGER total_input_tokens
        INTEGER total_output_tokens
        INTEGER total_requests
        INTEGER failed_requests
        TIMESTAMPTZ updated_at
    }

    workflow_jobs {
        UUID id PK
        UUID user_id FK
        VARCHAR trigger_type
        JSONB trigger_payload
        UUID campaign_id FK
        UUID schedule_id FK
        VARCHAR status
        TEXT error_message
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    workflow_schedules {
        UUID id PK
        UUID user_id FK
        VARCHAR schedule_name
        VARCHAR trigger_type
        VARCHAR cron_expression
        BOOLEAN is_active
        JSONB default_brief_template
        TIMESTAMPTZ last_run_at
        TIMESTAMPTZ next_run_at
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    content_analytics {
        UUID id PK
        UUID content_item_id FK
        INTEGER views
        INTEGER clicks
        INTEGER likes
        INTEGER shares
        INTEGER comments
        NUMERIC click_through_rate
        VARCHAR data_source
        DATE recorded_date
        TIMESTAMPTZ updated_at
    }

    users ||--o{ user_sessions : "has"
    users ||--o{ password_reset_tokens : "requests"
    users ||--o{ email_verifications : "verifies"
    users ||--|| brands : "owns"
    users ||--o{ campaigns : "creates"
    users ||--o{ campaign_tags : "defines"
    users ||--o{ customer_lists : "uploads"
    users ||--o{ file_uploads : "uploads"
    users ||--o{ notifications : "receives"
    users ||--|| notification_settings : "configures"
    users ||--o{ workflow_jobs : "triggers"
    users ||--o{ workflow_schedules : "schedules"
    users ||--o{ ai_usage_stats : "accumulates"
    users ||--o{ content_templates : "saves"
    brands ||--o{ brand_assets : "has"
    campaigns ||--o{ content_items : "generates"
    campaigns ||--o{ agent_run_logs : "logs"
    campaigns ||--o{ workflow_jobs : "created_by"
    campaign_tags ||--o{ campaign_tag_assignments : "used_in"
    campaigns ||--o{ campaign_tag_assignments : "tagged_with"
    content_items ||--o{ approval_history : "records"
    content_items ||--o| content_analytics : "tracks"
    content_items }o--o| agent_run_logs : "referenced_by"
    customer_lists ||--o{ customer_list_members : "contains"
    customers ||--o{ customer_list_members : "belongs_to"
    customer_lists }o--o| file_uploads : "from"
    workflow_schedules ||--o{ workflow_jobs : "spawns"
```

---

## 3. Mô tả Chi tiết Từng Bảng

---

### NHÓM 1: XÁC THỰC & NGƯỜI DÙNG

---

### 3.1 Bảng `users` — Tài khoản Người dùng

**Mục đích**: Lưu thông tin tài khoản, xác thực, và hồ sơ cá nhân/doanh nghiệp của người dùng.

**Lý do thiết kế**: Gộp auth và profile vào 1 bảng vì quan hệ 1:1 tuyệt đối — không cần join thêm bảng profile riêng ở MVP.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Khóa chính không đoán được |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE | Email đăng nhập, index để tìm kiếm nhanh |
| `hashed_pw` | VARCHAR(255) | NOT NULL | Mật khẩu đã hash bằng bcrypt (cost factor 12) |
| `full_name` | VARCHAR(255) | | Họ tên hiển thị |
| `phone` | VARCHAR(20) | | Số điện thoại (tùy chọn) |
| `avatar_url` | VARCHAR(1024) | | URL ảnh đại diện từ file_uploads |
| `business_type` | VARCHAR(100) | | Loại hình KD: cafe, shop, dịch vụ... |
| `city` | VARCHAR(100) | | Thành phố để cá nhân hóa nội dung |
| `website` | VARCHAR(512) | | Website của doanh nghiệp |
| `role` | VARCHAR(20) | NOT NULL, DEFAULT 'user' | 'admin' hoặc 'user' |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Tài khoản có bị vô hiệu hóa không |
| `email_verified` | BOOLEAN | NOT NULL, DEFAULT FALSE | Đã xác minh email chưa |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Thời điểm tạo tài khoản |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Thời điểm cập nhật cuối |

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    hashed_pw       VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255),
    phone           VARCHAR(20),
    avatar_url      VARCHAR(1024),
    business_type   VARCHAR(100),
    city            VARCHAR(100),
    website         VARCHAR(512),
    role            VARCHAR(20) NOT NULL DEFAULT 'user',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_email ON users(email);
```

---

### 3.2 Bảng `user_sessions` — Quản lý Phiên đăng nhập

**Mục đích**: Lưu refresh tokens để duy trì đăng nhập lâu dài, cho phép đăng xuất tất cả thiết bị, track thiết bị đang dùng.

**Lý do thiết kế**: JWT access token hết hạn sau 15 phút — cần refresh token (lưu DB) để cấp token mới mà không cần đăng nhập lại.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | PK | Khóa chính |
| `user_id` | UUID | FK → users(id) CASCADE | Người dùng sở hữu session |
| `refresh_token` | VARCHAR(512) | NOT NULL, UNIQUE | Chuỗi token ngẫu nhiên 256-bit |
| `device_info` | VARCHAR(512) | | User-Agent string của trình duyệt |
| `ip_address` | VARCHAR(45) | | IP đăng nhập (IPv4/IPv6) |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Thời điểm token hết hạn (30 ngày) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Thời điểm tạo session |

```sql
CREATE TABLE user_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token   VARCHAR(512) NOT NULL UNIQUE,
    device_info     VARCHAR(512),
    ip_address      VARCHAR(45),
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(refresh_token);
```

---

### 3.3 Bảng `password_reset_tokens` — Token Đặt lại Mật khẩu

**Mục đích**: Quản lý luồng "Quên mật khẩu" — tạo token 1 lần dùng, gửi email, user nhập token để reset mật khẩu.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | PK | Khóa chính |
| `user_id` | UUID | FK → users(id) CASCADE | Người dùng yêu cầu reset |
| `token` | VARCHAR(255) | NOT NULL, UNIQUE | Token bí mật 128-bit (SHA-256) |
| `used` | BOOLEAN | NOT NULL, DEFAULT FALSE | Đã sử dụng chưa — dùng xong phải đánh dấu |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Hết hạn sau 1 giờ |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Thời điểm tạo |

```sql
CREATE TABLE password_reset_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(255) NOT NULL UNIQUE,
    used        BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prt_token ON password_reset_tokens(token);
CREATE INDEX idx_prt_user_id ON password_reset_tokens(user_id);
```

---

### 3.4 Bảng `email_verifications` — Xác minh Email

**Mục đích**: Khi đăng ký tài khoản mới, gửi email chứa token để xác nhận địa chỉ email là hợp lệ.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | PK | Khóa chính |
| `user_id` | UUID | FK → users(id) CASCADE | Người dùng cần xác minh |
| `token` | VARCHAR(255) | NOT NULL, UNIQUE | Token gửi qua email |
| `verified` | BOOLEAN | NOT NULL, DEFAULT FALSE | Đã xác minh chưa |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Hết hạn sau 24 giờ |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Thời điểm tạo |

```sql
CREATE TABLE email_verifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(255) NOT NULL UNIQUE,
    verified    BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### NHÓM 2: THƯƠNG HIỆU

---

### 3.5 Bảng `brands` — Kho Thương hiệu (Brand Vault)

**Mục đích**: Lưu toàn bộ DNA thương hiệu. Đây là "bộ nhớ dài hạn" của các AI agent — mọi nội dung sinh ra đều tham chiếu bảng này.

**Lý do thiết kế**: Quan hệ 1:1 với users (UNIQUE trên user_id) — mỗi tài khoản chỉ có 1 brand vault. Dùng TEXT[] cho key_products và forbidden_words thay vì bảng phụ vì đây là danh sách đơn giản, không cần join.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | PK | Khóa chính |
| `user_id` | UUID | FK → users(id) CASCADE, UNIQUE | Chủ thương hiệu |
| `brand_name` | VARCHAR(255) | NOT NULL | Tên thương hiệu |
| `tagline` | VARCHAR(512) | | Slogan |
| `brand_description` | TEXT | NOT NULL | Mô tả doanh nghiệp — AI dùng làm context |
| `tone_of_voice` | VARCHAR(50) | NOT NULL | playful / professional / warm / bold / informative |
| `logo_url` | VARCHAR(1024) | | URL logo |
| `primary_color` | VARCHAR(7) | | Màu chính dạng hex (#RRGGBB) |
| `target_audience` | TEXT | NOT NULL | Mô tả khách hàng mục tiêu |
| `key_products` | TEXT[] | | Danh sách sản phẩm/dịch vụ chính |
| `forbidden_words` | TEXT[] | | Từ ngữ AI không được dùng |
| `preferred_cta` | VARCHAR(255) | | CTA ưa dùng: "Đặt ngay", "Ghé thăm" |
| `preferred_salutation` | VARCHAR(50) | | Cách xưng hô: "bạn", "quý khách" |
| `sample_post` | TEXT | | Bài đăng mẫu để AI học phong cách |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

```sql
CREATE TABLE brands (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    brand_name          VARCHAR(255) NOT NULL,
    tagline             VARCHAR(512),
    brand_description   TEXT NOT NULL,
    tone_of_voice       VARCHAR(50) NOT NULL,
    logo_url            VARCHAR(1024),
    primary_color       VARCHAR(7),
    target_audience     TEXT NOT NULL,
    key_products        TEXT[],
    forbidden_words     TEXT[],
    preferred_cta       VARCHAR(255),
    preferred_salutation VARCHAR(50),
    sample_post         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 3.6 Bảng `brand_assets` — Tài nguyên Thương hiệu

**Mục đích**: Lưu danh sách các file đã upload cho thương hiệu: logo, banner, ảnh sản phẩm mẫu.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | PK | Khóa chính |
| `brand_id` | UUID | FK → brands(id) CASCADE | Thương hiệu sở hữu |
| `asset_type` | VARCHAR(50) | NOT NULL | 'logo' / 'banner' / 'product_image' |
| `file_url` | VARCHAR(1024) | NOT NULL | URL truy cập file |
| `file_name` | VARCHAR(255) | | Tên file gốc |
| `file_size_bytes` | INTEGER | | Kích thước file |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

```sql
CREATE TABLE brand_assets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    asset_type      VARCHAR(50) NOT NULL,
    file_url        VARCHAR(1024) NOT NULL,
    file_name       VARCHAR(255),
    file_size_bytes INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brand_assets_brand_id ON brand_assets(brand_id);
```

---

### NHÓM 3: CHIẾN DỊCH

---

### 3.7 Bảng `campaigns` — Chiến dịch Marketing

**Mục đích**: Lưu toàn bộ thông tin brief của một chiến dịch và kết quả phân tích của Strategist Agent.

**Lý do dùng JSONB cho campaign_plan_json**: Output của Strategist Agent có cấu trúc phức tạp (campaign_summary, key_messages, deliverables[]) — lưu JSONB giúp không cần chuẩn hóa thêm bảng, vẫn query được bằng JSONB operators.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | PK | Khóa chính |
| `user_id` | UUID | FK → users(id) CASCADE | Chủ chiến dịch |
| `campaign_name` | VARCHAR(255) | NOT NULL | Tên chiến dịch |
| `objective` | TEXT | NOT NULL | Mục tiêu chiến dịch |
| `product_or_service` | TEXT | NOT NULL | Sản phẩm/dịch vụ quảng bá |
| `target_audience` | TEXT | | Khách hàng mục tiêu (có thể override Brand Vault) |
| `offer_or_hook` | TEXT | | Ưu đãi hoặc hook thu hút |
| `deadline` | DATE | NOT NULL | Ngày mục tiêu đăng nội dung |
| `channels` | TEXT[] | NOT NULL | ['facebook_post', 'email', 'video_script'] |
| `additional_notes` | TEXT | | Ghi chú thêm cho AI |
| `status` | VARCHAR(30) | NOT NULL, DEFAULT 'pending_agent' | Trạng thái (xem state machine) |
| `error_message` | TEXT | | Lỗi nếu orchestration thất bại |
| `campaign_plan_json` | JSONB | | Kết quả phân tích của Strategist Agent |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**State Machine:**
```
pending_agent → running → pending_approval → approved
                       ↘ failed             ↘ partially_approved
```

```sql
CREATE TABLE campaigns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign_name       VARCHAR(255) NOT NULL,
    objective           TEXT NOT NULL,
    product_or_service  TEXT NOT NULL,
    target_audience     TEXT,
    offer_or_hook       TEXT,
    deadline            DATE NOT NULL,
    channels            TEXT[] NOT NULL,
    additional_notes    TEXT,
    status              VARCHAR(30) NOT NULL DEFAULT 'pending_agent',
    error_message       TEXT,
    campaign_plan_json  JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_deadline ON campaigns(deadline);
```

---

### 3.8 Bảng `campaign_tags` — Nhãn Phân loại Chiến dịch

**Mục đích**: Cho phép user tạo nhãn tùy chỉnh để phân loại campaign (VD: "Tháng 7", "Flash Sale", "Sản phẩm mới").

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | PK | Khóa chính |
| `user_id` | UUID | FK → users(id) CASCADE | Người tạo tag |
| `name` | VARCHAR(100) | NOT NULL | Tên nhãn |
| `color` | VARCHAR(7) | | Màu nhãn (hex) để hiển thị UI |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

```sql
CREATE TABLE campaign_tags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    color       VARCHAR(7),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)
);
```

---

### 3.9 Bảng `campaign_tag_assignments` — Gán Nhãn cho Chiến dịch

**Mục đích**: Bảng trung gian quan hệ N:N giữa campaigns và campaign_tags.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `campaign_id` | UUID | FK → campaigns(id) CASCADE | Chiến dịch |
| `tag_id` | UUID | FK → campaign_tags(id) CASCADE | Nhãn |

```sql
CREATE TABLE campaign_tag_assignments (
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    tag_id      UUID NOT NULL REFERENCES campaign_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (campaign_id, tag_id)
);
```

---

### NHÓM 4: NỘI DUNG

---

### 3.10 Bảng `content_items` — Nội dung do AI Tạo ra

**Mục đích**: Lưu trữ nội dung cho từng kênh trong từng chiến dịch, với lịch sử phiên bản đầy đủ.

**Lý do dùng JSONB cho content_json**: Cấu trúc nội dung khác nhau theo kênh:
- facebook_post: `{copy, hashtags[]}`
- email: `{subject, body}`
- video_script: `{hook, body, cta, duration_estimate}`

Dùng JSONB thay vì tạo 3 bảng riêng — linh hoạt hơn khi thêm kênh mới.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | PK | Khóa chính |
| `campaign_id` | UUID | FK → campaigns(id) CASCADE | Thuộc chiến dịch nào |
| `channel` | VARCHAR(30) | NOT NULL | 'facebook_post' / 'email' / 'video_script' |
| `version` | INTEGER | NOT NULL, DEFAULT 1 | Số phiên bản (tăng mỗi lần chỉnh sửa) |
| `status` | VARCHAR(30) | NOT NULL, DEFAULT 'draft' | draft / pending_approval / approved / rejected |
| `content_json` | JSONB | NOT NULL | Nội dung theo cấu trúc của kênh |
| `source` | VARCHAR(20) | NOT NULL, DEFAULT 'agent' | 'agent' hoặc 'user_edit' |
| `agent_run_id` | UUID | FK → agent_run_logs(id) | Agent run nào tạo ra nội dung này |
| `rejection_note` | TEXT | | Lý do từ chối (nếu bị rejected) |
| `scheduled_date` | DATE | | Ngày hiển thị trên Marketing Calendar |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

```sql
CREATE TABLE content_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    channel         VARCHAR(30) NOT NULL,
    version         INTEGER NOT NULL DEFAULT 1,
    status          VARCHAR(30) NOT NULL DEFAULT 'draft',
    content_json    JSONB NOT NULL,
    source          VARCHAR(20) NOT NULL DEFAULT 'agent',
    agent_run_id    UUID REFERENCES agent_run_logs(id),
    rejection_note  TEXT,
    scheduled_date  DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_items_campaign_id ON content_items(campaign_id);
CREATE INDEX idx_content_items_status ON content_items(status);
CREATE INDEX idx_content_items_scheduled_date ON content_items(scheduled_date);
CREATE INDEX idx_content_items_channel ON content_items(channel);
```

---

### 3.11 Bảng `content_templates` — Mẫu Brief Tái sử dụng

**Mục đích**: Cho phép user lưu lại brief của một chiến dịch thành công làm template, dùng lại cho các chiến dịch tương tự trong tương lai. Tiết kiệm thời gian nhập liệu.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | PK | Khóa chính |
| `user_id` | UUID | FK → users(id) CASCADE | Người tạo template |
| `template_name` | VARCHAR(255) | NOT NULL | Tên template |
| `objective_template` | TEXT | | Mẫu mục tiêu |
| `product_template` | TEXT | | Mẫu sản phẩm |
| `audience_template` | TEXT | | Mẫu khách hàng mục tiêu |
| `default_channels` | TEXT[] | | Kênh mặc định |
| `notes_template` | TEXT | | Ghi chú mẫu |
| `use_count` | INTEGER | NOT NULL, DEFAULT 0 | Số lần đã dùng |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

```sql
CREATE TABLE content_templates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_name       VARCHAR(255) NOT NULL,
    objective_template  TEXT,
    product_template    TEXT,
    audience_template   TEXT,
    default_channels    TEXT[],
    notes_template      TEXT,
    use_count           INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_templates_user_id ON content_templates(user_id);
```

---

### 3.12 Bảng `approval_history` — Lịch sử Phê duyệt

**Mục đích**: Ghi lại mọi hành động approve/reject với đầy đủ thông tin: ai thực hiện, lúc nào, ghi chú gì, phiên bản nào. Đây là audit trail quan trọng để giải trình và kiểm tra.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | PK | Khóa chính |
| `content_item_id` | UUID | FK → content_items(id) CASCADE | Nội dung được thao tác |
| `user_id` | UUID | FK → users(id) | Người thực hiện hành động |
| `action` | VARCHAR(20) | NOT NULL | 'approved' / 'rejected' / 'edited' |
| `note` | TEXT | | Ghi chú kèm theo hành động |
| `content_version` | INTEGER | NOT NULL | Phiên bản nội dung được thao tác |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Thời điểm thực hiện |

```sql
CREATE TABLE approval_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_item_id     UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id),
    action              VARCHAR(20) NOT NULL,
    note                TEXT,
    content_version     INTEGER NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approval_history_content_item_id ON approval_history(content_item_id);
CREATE INDEX idx_approval_history_user_id ON approval_history(user_id);
```

---

### NHÓM 5: QUẢN LÝ KHÁCH HÀNG

---

### 3.13 Bảng `customer_lists` — Danh sách Khách hàng

**Mục đích**: Khi user upload file CSV danh sách khách hàng, hệ thống tạo một customer_list. Danh sách này có thể trigger workflow tự động tạo email campaign.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | PK | Khóa chính |
| `user_id` | UUID | FK → users(id) CASCADE | Chủ danh sách |
| `list_name` | VARCHAR(255) | NOT NULL | Tên danh sách |
| `description` | TEXT | | Mô tả danh sách |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'processing' | processing / ready / failed |
| `total_records` | INTEGER | | Tổng số dòng trong file |
| `valid_records` | INTEGER | | Số bản ghi hợp lệ sau validate |
| `file_upload_id` | UUID | FK → file_uploads(id) | File CSV gốc |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

```sql
CREATE TABLE customer_lists (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    list_name       VARCHAR(255) NOT NULL,
    description     TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'processing',
    total_records   INTEGER,
    valid_records   INTEGER,
    file_upload_id  UUID REFERENCES file_uploads(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_lists_user_id ON customer_lists(user_id);
```

---

### 3.14 Bảng `customers` — Khách hàng Cá nhân

**Mục đích**: Lưu thông tin từng khách hàng được import từ CSV.

**Lý do dùng JSONB cho extra_fields**: CSV của mỗi doanh nghiệp có cột khác nhau (ngày sinh, địa chỉ, điểm tích lũy...) — JSONB giúp lưu linh hoạt mà không cần thay đổi schema.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | PK | Khóa chính |
| `customer_list_id` | UUID | FK → customer_lists(id) CASCADE | Thuộc danh sách nào |
| `email` | VARCHAR(255) | | Email khách hàng |
| `full_name` | VARCHAR(255) | | Tên khách hàng |
| `phone` | VARCHAR(20) | | Số điện thoại |
| `extra_fields` | JSONB | | Các trường bổ sung từ CSV |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

```sql
CREATE TABLE customers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_list_id    UUID NOT NULL REFERENCES customer_lists(id) ON DELETE CASCADE,
    email               VARCHAR(255),
    full_name           VARCHAR(255),
    phone               VARCHAR(20),
    extra_fields        JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_customer_list_id ON customers(customer_list_id);
CREATE INDEX idx_customers_email ON customers(email);
```

---

### 3.15 Bảng `customer_list_members` — Liên kết Khách hàng ↔ Danh sách

**Mục đích**: Bảng junction cho phép 1 khách hàng thuộc nhiều danh sách (N:N), với timestamp ghi nhận thời điểm thêm vào.

```sql
CREATE TABLE customer_list_members (
    customer_list_id    UUID NOT NULL REFERENCES customer_lists(id) ON DELETE CASCADE,
    customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    added_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (customer_list_id, customer_id)
);
```

---

### NHÓM 6: TỆP TIN

---

### 3.16 Bảng `file_uploads` — Quản lý File Upload

**Mục đích**: Theo dõi tất cả file đã upload vào hệ thống (logo, CSV, ảnh sản phẩm). Tập trung quản lý thay vì mỗi bảng tự lưu đường dẫn file.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | PK | Khóa chính |
| `user_id` | UUID | FK → users(id) CASCADE | Người upload |
| `original_filename` | VARCHAR(255) | NOT NULL | Tên file gốc |
| `stored_path` | VARCHAR(1024) | NOT NULL | Đường dẫn lưu trữ trên server |
| `file_type` | VARCHAR(50) | NOT NULL | 'image' / 'csv' / 'document' |
| `file_size_bytes` | BIGINT | | Kích thước file (bytes) |
| `mime_type` | VARCHAR(100) | | MIME type: image/png, text/csv... |
| `purpose` | VARCHAR(50) | | 'logo' / 'customer_list' / 'brand_asset' |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

```sql
CREATE TABLE file_uploads (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_filename   VARCHAR(255) NOT NULL,
    stored_path         VARCHAR(1024) NOT NULL,
    file_type           VARCHAR(50) NOT NULL,
    file_size_bytes     BIGINT,
    mime_type           VARCHAR(100),
    purpose             VARCHAR(50),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_file_uploads_user_id ON file_uploads(user_id);
```

---

### NHÓM 7: THÔNG BÁO

---

### 3.17 Bảng `notifications` — Thông báo Trong ứng dụng

**Mục đích**: Lưu thông báo gửi đến user khi có sự kiện quan trọng: campaign hoàn thành, nội dung chờ duyệt, workflow tự động chạy xong.

**Lý do dùng JSONB cho payload**: Mỗi loại thông báo có dữ liệu đính kèm khác nhau — campaign_id, content_item_id... — JSONB giúp linh hoạt mà không cần nhiều FK nullable.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | PK | Khóa chính |
| `user_id` | UUID | FK → users(id) CASCADE | Người nhận thông báo |
| `type` | VARCHAR(50) | NOT NULL | 'campaign_complete' / 'content_pending' / 'workflow_done' |
| `title` | VARCHAR(255) | NOT NULL | Tiêu đề thông báo |
| `body` | TEXT | NOT NULL | Nội dung chi tiết |
| `payload` | JSONB | | Dữ liệu đính kèm (campaign_id, content_count...) |
| `is_read` | BOOLEAN | NOT NULL, DEFAULT FALSE | Đã đọc chưa |
| `read_at` | TIMESTAMPTZ | | Thời điểm đọc |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Thời điểm tạo |

```sql
CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(50) NOT NULL,
    title       VARCHAR(255) NOT NULL,
    body        TEXT NOT NULL,
    payload     JSONB,
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read);
```

---

### 3.18 Bảng `notification_settings` — Cài đặt Thông báo

**Mục đích**: Cho user tùy chỉnh loại thông báo nào muốn nhận.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | PK | Khóa chính |
| `user_id` | UUID | FK → users(id) CASCADE, UNIQUE | Một user một bộ cài đặt |
| `campaign_completed` | BOOLEAN | NOT NULL, DEFAULT TRUE | Nhận TB khi campaign xong |
| `content_pending` | BOOLEAN | NOT NULL, DEFAULT TRUE | Nhận TB khi có nội dung chờ duyệt |
| `workflow_triggered` | BOOLEAN | NOT NULL, DEFAULT TRUE | Nhận TB khi workflow chạy |
| `weekly_summary` | BOOLEAN | NOT NULL, DEFAULT TRUE | Nhận tóm tắt tuần |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

```sql
CREATE TABLE notification_settings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    campaign_completed  BOOLEAN NOT NULL DEFAULT TRUE,
    content_pending     BOOLEAN NOT NULL DEFAULT TRUE,
    workflow_triggered  BOOLEAN NOT NULL DEFAULT TRUE,
    weekly_summary      BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### NHÓM 8: AI & AGENT

---

### 3.19 Bảng `agent_run_logs` — Nhật ký Chạy AI Agent

**Mục đích**: Ghi lại từng bước thực thi của AI agents. Đây là bảng quan trọng để demo hội đồng — hiển thị "nhật ký làm việc" của 3 agent.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | PK | Khóa chính |
| `campaign_id` | UUID | FK → campaigns(id) CASCADE | Campaign nào chạy agent |
| `agent_name` | VARCHAR(50) | NOT NULL | 'strategist' / 'writer' / 'critic' |
| `step_order` | INTEGER | NOT NULL | Thứ tự bước trong pipeline (1, 2, 3...) |
| `channel` | VARCHAR(30) | | Kênh nào (null cho strategist) |
| `model_used` | VARCHAR(100) | NOT NULL | 'gpt-4o-mini' / 'qwen2.5:7b' |
| `model_provider` | VARCHAR(20) | NOT NULL | 'openai' / 'qwen' |
| `prompt_preview` | TEXT | | 300 ký tự đầu của prompt |
| `output_preview` | TEXT | | 300 ký tự đầu của output |
| `input_tokens` | INTEGER | | Số token đầu vào |
| `output_tokens` | INTEGER | | Số token đầu ra |
| `duration_ms` | INTEGER | | Thời gian chạy (milliseconds) |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'success' | 'success' / 'error' |
| `error_detail` | TEXT | | Chi tiết lỗi nếu thất bại |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

```sql
CREATE TABLE agent_run_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    agent_name      VARCHAR(50) NOT NULL,
    step_order      INTEGER NOT NULL,
    channel         VARCHAR(30),
    model_used      VARCHAR(100) NOT NULL,
    model_provider  VARCHAR(20) NOT NULL,
    prompt_preview  TEXT,
    output_preview  TEXT,
    input_tokens    INTEGER,
    output_tokens   INTEGER,
    duration_ms     INTEGER,
    status          VARCHAR(20) NOT NULL DEFAULT 'success',
    error_detail    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_run_logs_campaign_id ON agent_run_logs(campaign_id);
CREATE INDEX idx_agent_run_logs_created_at ON agent_run_logs(created_at);
```

---

### 3.20 Bảng `ai_usage_stats` — Thống kê Sử dụng AI

**Mục đích**: Tổng hợp số token đã dùng theo user theo tháng, theo model. Dùng để hiển thị "chi phí AI ước tính" trên dashboard và kiểm soát giới hạn sử dụng.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | PK | Khóa chính |
| `user_id` | UUID | FK → users(id) CASCADE | Người dùng |
| `year` | INTEGER | NOT NULL | Năm (2024, 2025...) |
| `month` | INTEGER | NOT NULL | Tháng (1-12) |
| `model_provider` | VARCHAR(20) | NOT NULL | 'openai' / 'qwen' |
| `model_name` | VARCHAR(100) | NOT NULL | 'gpt-4o-mini' / 'qwen2.5:7b' |
| `total_input_tokens` | INTEGER | NOT NULL, DEFAULT 0 | Tổng token đầu vào tháng đó |
| `total_output_tokens` | INTEGER | NOT NULL, DEFAULT 0 | Tổng token đầu ra |
| `total_requests` | INTEGER | NOT NULL, DEFAULT 0 | Tổng số lần gọi API |
| `failed_requests` | INTEGER | NOT NULL, DEFAULT 0 | Số lần gọi thất bại |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Thời điểm cập nhật |

```sql
CREATE TABLE ai_usage_stats (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year                INTEGER NOT NULL,
    month               INTEGER NOT NULL,
    model_provider      VARCHAR(20) NOT NULL,
    model_name          VARCHAR(100) NOT NULL,
    total_input_tokens  INTEGER NOT NULL DEFAULT 0,
    total_output_tokens INTEGER NOT NULL DEFAULT 0,
    total_requests      INTEGER NOT NULL DEFAULT 0,
    failed_requests     INTEGER NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, year, month, model_provider, model_name)
);

CREATE INDEX idx_ai_usage_stats_user_id ON ai_usage_stats(user_id);
```

---

### NHÓM 9: WORKFLOW & TỰ ĐỘNG HÓA

---

### 3.21 Bảng `workflow_jobs` — Phiên Chạy Workflow

**Mục đích**: Ghi lại từng lần workflow tự động được kích hoạt (mỗi lần chạy = 1 job). Phân biệt với workflow_schedules (cấu hình lịch).

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | PK | Khóa chính |
| `user_id` | UUID | FK → users(id) CASCADE | Chủ workflow |
| `trigger_type` | VARCHAR(50) | NOT NULL | 'schedule_trigger' / 'upload_trigger' / 'manual' |
| `trigger_payload` | JSONB | | Dữ liệu trigger (filename cho upload, cron cho schedule) |
| `campaign_id` | UUID | FK → campaigns(id) | Campaign tự động tạo ra từ job này |
| `schedule_id` | UUID | FK → workflow_schedules(id) | Lịch nào sinh ra job này (nếu có) |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'queued' | queued / running / completed / failed |
| `error_message` | TEXT | | Lỗi nếu thất bại |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

```sql
CREATE TABLE workflow_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trigger_type    VARCHAR(50) NOT NULL,
    trigger_payload JSONB,
    campaign_id     UUID REFERENCES campaigns(id),
    schedule_id     UUID REFERENCES workflow_schedules(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'queued',
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_jobs_user_id ON workflow_jobs(user_id);
CREATE INDEX idx_workflow_jobs_status ON workflow_jobs(status);
```

---

### 3.22 Bảng `workflow_schedules` — Cấu hình Lịch Tự động

**Mục đích**: Lưu cấu hình lịch tự động của từng user — ví dụ: "Mỗi thứ Hai 8 giờ sáng, tự tạo campaign tuần mới". Tách khỏi workflow_jobs để phân biệt cấu hình (1 lần) với phiên chạy (nhiều lần).

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | PK | Khóa chính |
| `user_id` | UUID | FK → users(id) CASCADE | Chủ lịch |
| `schedule_name` | VARCHAR(255) | NOT NULL | Tên mô tả lịch |
| `trigger_type` | VARCHAR(50) | NOT NULL | 'schedule_trigger' / 'upload_trigger' |
| `cron_expression` | VARCHAR(100) | | Biểu thức cron: "0 8 * * 1" = thứ Hai 8am |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Lịch có đang hoạt động không |
| `default_brief_template` | JSONB | | Template brief mặc định khi trigger |
| `last_run_at` | TIMESTAMPTZ | | Lần chạy gần nhất |
| `next_run_at` | TIMESTAMPTZ | | Lần chạy tiếp theo |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

```sql
CREATE TABLE workflow_schedules (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schedule_name           VARCHAR(255) NOT NULL,
    trigger_type            VARCHAR(50) NOT NULL,
    cron_expression         VARCHAR(100),
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    default_brief_template  JSONB,
    last_run_at             TIMESTAMPTZ,
    next_run_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_schedules_user_id ON workflow_schedules(user_id);
CREATE INDEX idx_workflow_schedules_next_run ON workflow_schedules(next_run_at) WHERE is_active = TRUE;
```

---

### NHÓM 10: PHÂN TÍCH

---

### 3.23 Bảng `content_analytics` — Chỉ số Hiệu quả Nội dung

**Mục đích**: Lưu các chỉ số hiệu quả của từng content item (lượt xem, click, like...). MVP dùng mock data, phiên bản sau kết nối API thực của Facebook, Email ESP.

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | PK | Khóa chính |
| `content_item_id` | UUID | FK → content_items(id) CASCADE, UNIQUE | Mỗi content chỉ có 1 bản analytics |
| `views` | INTEGER | NOT NULL, DEFAULT 0 | Lượt xem |
| `clicks` | INTEGER | NOT NULL, DEFAULT 0 | Lượt click |
| `likes` | INTEGER | NOT NULL, DEFAULT 0 | Lượt thích |
| `shares` | INTEGER | NOT NULL, DEFAULT 0 | Lượt chia sẻ |
| `comments` | INTEGER | NOT NULL, DEFAULT 0 | Lượt bình luận |
| `click_through_rate` | NUMERIC(5,2) | | CTR = clicks/views × 100 (%) |
| `data_source` | VARCHAR(50) | NOT NULL, DEFAULT 'mock' | 'mock' / 'facebook_api' / 'email_esp' |
| `recorded_date` | DATE | NOT NULL, DEFAULT CURRENT_DATE | Ngày ghi nhận |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

```sql
CREATE TABLE content_analytics (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_item_id     UUID NOT NULL UNIQUE REFERENCES content_items(id) ON DELETE CASCADE,
    views               INTEGER NOT NULL DEFAULT 0,
    clicks              INTEGER NOT NULL DEFAULT 0,
    likes               INTEGER NOT NULL DEFAULT 0,
    shares              INTEGER NOT NULL DEFAULT 0,
    comments            INTEGER NOT NULL DEFAULT 0,
    click_through_rate  NUMERIC(5,2),
    data_source         VARCHAR(50) NOT NULL DEFAULT 'mock',
    recorded_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 4. Tổng hợp Quan hệ Giữa các Bảng

| Quan hệ | Bảng nguồn | Bảng đích | Loại | FK | ON DELETE |
|---|---|---|---|---|---|
| User có sessions | users | user_sessions | 1:N | user_id | CASCADE |
| User yêu cầu reset PW | users | password_reset_tokens | 1:N | user_id | CASCADE |
| User xác minh email | users | email_verifications | 1:N | user_id | CASCADE |
| User sở hữu brand | users | brands | 1:1 | user_id (UNIQUE) | CASCADE |
| Brand có assets | brands | brand_assets | 1:N | brand_id | CASCADE |
| User tạo campaign | users | campaigns | 1:N | user_id | CASCADE |
| User tạo tag | users | campaign_tags | 1:N | user_id | CASCADE |
| Campaign có tags | campaigns | campaign_tag_assignments | N:M | campaign_id | CASCADE |
| Tag gán cho campaign | campaign_tags | campaign_tag_assignments | N:M | tag_id | CASCADE |
| Campaign có content | campaigns | content_items | 1:N | campaign_id | CASCADE |
| Campaign có agent logs | campaigns | agent_run_logs | 1:N | campaign_id | CASCADE |
| Content tham chiếu log | content_items | agent_run_logs | N:1 | agent_run_id | SET NULL |
| Content có lịch sử duyệt | content_items | approval_history | 1:N | content_item_id | CASCADE |
| Content có analytics | content_items | content_analytics | 1:1 | content_item_id (UNIQUE) | CASCADE |
| User upload danh sách | users | customer_lists | 1:N | user_id | CASCADE |
| Danh sách có khách hàng | customer_lists | customer_list_members | N:M | customer_list_id | CASCADE |
| Khách hàng trong danh sách | customers | customer_list_members | N:M | customer_id | CASCADE |
| User upload file | users | file_uploads | 1:N | user_id | CASCADE |
| User nhận thông báo | users | notifications | 1:N | user_id | CASCADE |
| User cài đặt TB | users | notification_settings | 1:1 | user_id (UNIQUE) | CASCADE |
| User tích lũy AI stats | users | ai_usage_stats | 1:N | user_id | CASCADE |
| User tạo lịch workflow | users | workflow_schedules | 1:N | user_id | CASCADE |
| Lịch sinh ra jobs | workflow_schedules | workflow_jobs | 1:N | schedule_id | SET NULL |
| User trigger job | users | workflow_jobs | 1:N | user_id | CASCADE |
| Job tạo campaign | workflow_jobs | campaigns | N:1 | campaign_id | SET NULL |

---

## 5. Indexes và Lý do

| Index | Bảng | Cột | Lý do |
|---|---|---|---|
| `idx_users_email` | users | email | Đăng nhập tra cứu theo email — query đầu tiên và nhiều nhất |
| `idx_user_sessions_user_id` | user_sessions | user_id | Xem tất cả sessions của 1 user |
| `idx_user_sessions_token` | user_sessions | refresh_token | Xác thực refresh token — cần tốc độ cao |
| `idx_campaigns_user_id` | campaigns | user_id | 99% query campaign đều filter theo user |
| `idx_campaigns_status` | campaigns | status | Lọc campaigns đang chạy, chờ duyệt |
| `idx_campaigns_deadline` | campaigns | deadline | Sắp xếp, lọc theo ngày deadline |
| `idx_content_items_campaign_id` | content_items | campaign_id | Lấy tất cả content của 1 campaign |
| `idx_content_items_status` | content_items | status | Lấy items đang chờ duyệt |
| `idx_content_items_scheduled_date` | content_items | scheduled_date | Calendar view filter theo tháng |
| `idx_agent_run_logs_campaign_id` | agent_run_logs | campaign_id | Lấy tất cả logs của 1 campaign |
| `idx_notifications_user_id` | notifications | user_id | Lấy thông báo của 1 user |
| `idx_notifications_is_read` | notifications | (user_id, is_read) | Đếm thông báo chưa đọc |
| `idx_workflow_schedules_next_run` | workflow_schedules | next_run_at WHERE is_active | Cron job quét lịch sắp chạy — partial index |
| `idx_ai_usage_stats_user_id` | ai_usage_stats | user_id | Xem thống kê AI của 1 user |

---

## 6. Các Query Quan trọng

### 6.1 Xác thực & Người dùng

```sql
-- Đăng ký user mới
INSERT INTO users (email, hashed_pw, full_name, role)
VALUES ($1, $2, $3, 'owner')
RETURNING id, email, full_name, role, created_at;

-- Tạo email verification token
INSERT INTO email_verifications (user_id, token, expires_at)
VALUES ($1, $2, NOW() + INTERVAL '24 hours');

-- Đăng nhập: lấy user theo email
SELECT id, email, hashed_pw, full_name, role, is_active, email_verified
FROM users
WHERE email = $1 AND is_active = TRUE;

-- Tạo session sau đăng nhập thành công
INSERT INTO user_sessions (user_id, refresh_token, device_info, ip_address, expires_at)
VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days')
RETURNING id, refresh_token, expires_at;

-- Xác thực refresh token
SELECT us.id, us.user_id, u.email, u.role, u.is_active
FROM user_sessions us
JOIN users u ON u.id = us.user_id
WHERE us.refresh_token = $1
  AND us.expires_at > NOW()
  AND u.is_active = TRUE;

-- Đăng xuất: xóa session
DELETE FROM user_sessions WHERE refresh_token = $1;

-- Đăng xuất tất cả thiết bị
DELETE FROM user_sessions WHERE user_id = $1;

-- Yêu cầu reset mật khẩu
INSERT INTO password_reset_tokens (user_id, token, expires_at)
VALUES ($1, $2, NOW() + INTERVAL '1 hour');

-- Đặt lại mật khẩu
UPDATE users SET hashed_pw = $1, updated_at = NOW()
WHERE id = (
    SELECT user_id FROM password_reset_tokens
    WHERE token = $2 AND used = FALSE AND expires_at > NOW()
);
UPDATE password_reset_tokens SET used = TRUE WHERE token = $1;
```

---

### 6.2 Hồ sơ Người dùng (Profile)

```sql
-- Lấy profile đầy đủ
SELECT u.id, u.email, u.full_name, u.phone, u.avatar_url,
       u.business_type, u.city, u.website, u.role, u.email_verified, u.created_at,
       b.brand_name, b.tone_of_voice
FROM users u
LEFT JOIN brands b ON b.user_id = u.id
WHERE u.id = $1;

-- Cập nhật profile
UPDATE users
SET full_name = $2, phone = $3, avatar_url = $4,
    business_type = $5, city = $6, website = $7,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- Đổi mật khẩu (verify mật khẩu cũ trong code trước khi gọi query này)
UPDATE users
SET hashed_pw = $2, updated_at = NOW()
WHERE id = $1;
```

---

### 6.3 Brand Vault

```sql
-- Lấy brand vault của user
SELECT * FROM brands WHERE user_id = $1;

-- Tạo brand vault lần đầu
INSERT INTO brands (user_id, brand_name, brand_description, tone_of_voice, target_audience,
                    key_products, forbidden_words, preferred_cta, preferred_salutation)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- Cập nhật brand vault
UPDATE brands
SET brand_name = $2, tagline = $3, brand_description = $4, tone_of_voice = $5,
    target_audience = $6, key_products = $7, forbidden_words = $8,
    preferred_cta = $9, preferred_salutation = $10, updated_at = NOW()
WHERE user_id = $1
RETURNING *;
```

---

### 6.4 Campaigns

```sql
-- Tạo campaign mới
INSERT INTO campaigns (user_id, campaign_name, objective, product_or_service,
                       target_audience, offer_or_hook, deadline, channels, additional_notes)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, campaign_name, status, created_at;

-- Lấy danh sách campaign của user (kèm số content items)
SELECT c.id, c.campaign_name, c.objective, c.status, c.channels, c.deadline, c.created_at,
       COUNT(ci.id) AS content_count,
       COUNT(ci.id) FILTER (WHERE ci.status = 'pending_approval') AS pending_count
FROM campaigns c
LEFT JOIN content_items ci ON ci.campaign_id = c.id
WHERE c.user_id = $1
GROUP BY c.id
ORDER BY c.created_at DESC;

-- Lấy chi tiết 1 campaign kèm content và agent logs
SELECT c.*,
       json_agg(DISTINCT ci.*) FILTER (WHERE ci.id IS NOT NULL) AS content_items,
       json_agg(DISTINCT arl.*) FILTER (WHERE arl.id IS NOT NULL) AS agent_logs
FROM campaigns c
LEFT JOIN content_items ci ON ci.campaign_id = c.id
LEFT JOIN agent_run_logs arl ON arl.campaign_id = c.id
WHERE c.id = $1 AND c.user_id = $2
GROUP BY c.id;

-- Cập nhật trạng thái campaign (từ orchestrator)
UPDATE campaigns
SET status = $2, campaign_plan_json = $3, updated_at = NOW()
WHERE id = $1;

-- Xóa campaign
DELETE FROM campaigns WHERE id = $1 AND user_id = $2;
```

---

### 6.5 Content Items & Approval

```sql
-- Lưu content item từ AI agent
INSERT INTO content_items (campaign_id, channel, version, status, content_json, agent_run_id, scheduled_date)
VALUES ($1, $2, 1, 'pending_approval', $3, $4, $5)
RETURNING id;

-- Lấy tất cả content đang chờ duyệt của user
SELECT ci.id, ci.channel, ci.status, ci.content_json, ci.scheduled_date,
       ci.version, c.campaign_name, c.id AS campaign_id
FROM content_items ci
JOIN campaigns c ON c.id = ci.campaign_id
WHERE c.user_id = $1 AND ci.status = 'pending_approval'
ORDER BY ci.created_at DESC;

-- Approve content
UPDATE content_items
SET status = 'approved', updated_at = NOW()
WHERE id = $1
RETURNING *;

-- Ghi lại lịch sử phê duyệt
INSERT INTO approval_history (content_item_id, user_id, action, note, content_version)
VALUES ($1, $2, 'approved', $3, $4);

-- Reject content
UPDATE content_items
SET status = 'rejected', rejection_note = $2, updated_at = NOW()
WHERE id = $1;

INSERT INTO approval_history (content_item_id, user_id, action, note, content_version)
VALUES ($1, $2, 'rejected', $3, $4);

-- User chỉnh sửa content (tạo version mới)
INSERT INTO content_items (campaign_id, channel, version, status, content_json, source, scheduled_date)
SELECT campaign_id, channel, version + 1, 'pending_approval', $2, 'user_edit', scheduled_date
FROM content_items WHERE id = $1
RETURNING id;
```

---

### 6.6 Marketing Calendar

```sql
-- Lấy content items trong tháng để hiển thị calendar
SELECT ci.id, ci.channel, ci.status, ci.scheduled_date,
       ci.content_json->>'copy' AS facebook_preview,
       ci.content_json->>'subject' AS email_preview,
       ci.content_json->>'hook' AS video_preview,
       c.campaign_name, c.id AS campaign_id
FROM content_items ci
JOIN campaigns c ON c.id = ci.campaign_id
WHERE c.user_id = $1
  AND ci.scheduled_date >= $2   -- month_start
  AND ci.scheduled_date <= $3   -- month_end
  AND ci.version = (
      SELECT MAX(version) FROM content_items ci2
      WHERE ci2.campaign_id = ci.campaign_id AND ci2.channel = ci.channel
  )
ORDER BY ci.scheduled_date, ci.channel;

-- Thay đổi ngày đăng của content item
UPDATE content_items
SET scheduled_date = $2, updated_at = NOW()
WHERE id = $1;
```

---

### 6.7 Dashboard Stats

```sql
-- Thống kê tổng hợp cho dashboard
WITH user_campaigns AS (
    SELECT id FROM campaigns WHERE user_id = $1
)
SELECT
    (SELECT COUNT(*) FROM user_campaigns) AS total_campaigns,
    (SELECT COUNT(*) FROM content_items
     WHERE campaign_id IN (SELECT id FROM user_campaigns)) AS total_content,
    (SELECT COUNT(*) FROM content_items
     WHERE campaign_id IN (SELECT id FROM user_campaigns)
       AND status = 'pending_approval') AS pending_approvals,
    (SELECT COUNT(*) FROM content_items
     WHERE campaign_id IN (SELECT id FROM user_campaigns)
       AND status = 'approved') AS approved_items;

-- Thống kê content theo kênh
SELECT channel, COUNT(*) AS count
FROM content_items
WHERE campaign_id IN (SELECT id FROM campaigns WHERE user_id = $1)
GROUP BY channel;

-- Hoạt động agent gần đây
SELECT arl.agent_name, arl.channel, arl.model_used, arl.model_provider,
       arl.duration_ms, arl.status, arl.created_at, c.campaign_name
FROM agent_run_logs arl
JOIN campaigns c ON c.id = arl.campaign_id
WHERE c.user_id = $1
ORDER BY arl.created_at DESC
LIMIT 10;

-- Thống kê token AI theo tháng
SELECT model_provider, model_name,
       SUM(total_input_tokens) AS input_tokens,
       SUM(total_output_tokens) AS output_tokens,
       SUM(total_requests) AS requests
FROM ai_usage_stats
WHERE user_id = $1 AND year = $2 AND month = $3
GROUP BY model_provider, model_name;
```

---

### 6.8 Notifications

```sql
-- Tạo thông báo mới
INSERT INTO notifications (user_id, type, title, body, payload)
VALUES ($1, $2, $3, $4, $5)
RETURNING id;

-- Lấy thông báo của user (chưa đọc đầu tiên)
SELECT id, type, title, body, payload, is_read, created_at
FROM notifications
WHERE user_id = $1
ORDER BY is_read ASC, created_at DESC
LIMIT 20;

-- Đánh dấu đã đọc
UPDATE notifications
SET is_read = TRUE, read_at = NOW()
WHERE id = $1 AND user_id = $2;

-- Đánh dấu tất cả đã đọc
UPDATE notifications
SET is_read = TRUE, read_at = NOW()
WHERE user_id = $1 AND is_read = FALSE;

-- Đếm thông báo chưa đọc (dùng cho badge)
SELECT COUNT(*) FROM notifications
WHERE user_id = $1 AND is_read = FALSE;
```

---

### 6.9 Workflow & Schedules

```sql
-- Lấy danh sách lịch workflow đang hoạt động
SELECT * FROM workflow_schedules
WHERE user_id = $1 AND is_active = TRUE
ORDER BY created_at DESC;

-- Cron job: lấy schedules cần chạy
SELECT ws.*, u.id AS user_id
FROM workflow_schedules ws
JOIN users u ON u.id = ws.user_id
WHERE ws.is_active = TRUE
  AND ws.next_run_at <= NOW()
  AND u.is_active = TRUE;

-- Sau khi chạy xong, cập nhật last_run và next_run
UPDATE workflow_schedules
SET last_run_at = NOW(), next_run_at = $2, updated_at = NOW()
WHERE id = $1;

-- Tạo workflow job từ schedule
INSERT INTO workflow_jobs (user_id, trigger_type, schedule_id, status)
VALUES ($1, $2, $3, 'queued')
RETURNING id;

-- Lịch sử workflow jobs
SELECT wj.id, wj.trigger_type, wj.status, wj.created_at,
       c.campaign_name, ws.schedule_name
FROM workflow_jobs wj
LEFT JOIN campaigns c ON c.id = wj.campaign_id
LEFT JOIN workflow_schedules ws ON ws.id = wj.schedule_id
WHERE wj.user_id = $1
ORDER BY wj.created_at DESC
LIMIT 20;
```

---

### 6.10 Customer Lists

```sql
-- Upload danh sách khách hàng mới
INSERT INTO customer_lists (user_id, list_name, description, status, file_upload_id)
VALUES ($1, $2, $3, 'processing', $4)
RETURNING id;

-- Thêm khách hàng hàng loạt từ CSV (batch insert)
INSERT INTO customers (customer_list_id, email, full_name, phone, extra_fields)
SELECT $1, email, full_name, phone, extra_fields
FROM json_populate_recordset(null::customers, $2);

-- Cập nhật thống kê sau khi import xong
UPDATE customer_lists
SET status = 'ready', total_records = $2, valid_records = $3, updated_at = NOW()
WHERE id = $1;

-- Lấy danh sách khách hàng
SELECT id, email, full_name, phone FROM customers
WHERE customer_list_id = $1
ORDER BY created_at DESC;
```
