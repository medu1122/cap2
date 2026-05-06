# Cơ sở dữ liệu AIMAP - Tài liệu đầy đủ

> **Database**: `103.116.38.96:5432/aimap`
> **Cập nhật**: 2026-05-06
> **Tổng số bảng**: 28

---

## Mục lục

1. [ERD Tổng quan](#1-erd-tổng-quan)
2. [Danh sách bảng](#2-danh-sách-bảng)
3. [Chi tiết từng bảng](#3-chi-tiết-từng-bảng)
4. [SQL Build Database](#4-sql-build-database)
5. [Queries hữu ích](#5-queries-hữu-ích)

---

## 1. ERD Tổng quan

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                        AIMAP DATABASE SCHEMA                                │
│                                           (28 Tables)                                       │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

                                    ┌──────────────┐
                                    │    USERS     │
                                    ├──────────────┤
                                    │ PK id        │
                                    │    email     │
                                    │    hashed_pw │
                                    │    full_name │
                                    │    role      │
                                    └──────┬───────┘
                                           │
                        ┌──────────────────┼──────────────────┐
                        ▼                  ▼                  ▼
              ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
              │   BRANDS     │  │ CAMPAIGNS    │  │ CAMPAIGN_IDEAS   │
              ├──────────────┤  ├──────────────┤  ├──────────────────┤
              │ PK id       │  │ PK id        │  │ PK id            │
              │ FK user_id  │  │ FK user_id   │  │ FK user_id       │
              │    name     │  │ FK brand_id  │  │ FK brand_id      │
              │    colors   │  │    name      │  │    title         │
              │    audience │  │    status    │  │    content_json  │
              └──────────────┘  └──────┬───────┘  └──────────────────┘
                                      │
          ┌───────────┬───────────────┼───────────────┬───────────────┐
          ▼           ▼               ▼               ▼               ▼
┌─────────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐ ┌─────────────┐
│ CONTENT_ITEMS   │ │AGENT_RUN_LOGS│ │WORKFLOW_JOBS │ │CAMPAIGN_EXECUTION_ │ │  REVENUE    │
│                │ │              │ │              │ │      LOGS          │ │             │
├─────────────────┤ ├──────────────┤ ├──────────────┤ ├────────────────────┤ ├─────────────┤
│ PK id          │ │ PK id        │ │ PK id        │ │ PK id              │ │ PK id       │
│ FK campaign    │ │ FK campaign  │ │ FK user_id   │ │ FK campaign        │ │ FK campaign │
│    channel     │ │    agent     │ │ FK campaign  │ │ FK customer        │ │ FK user     │
│    content_json│ │    model     │ │    trigger   │ │    channel         │ │    revenue  │
│    status      │ │    tokens    │ │    status    │ │    tracking_token  │ └─────────────┘
└─────────────────┘ └──────────────┘ └──────────────┘ └────────────────────┘
                                          │
                                          ▼
                              ┌────────────────────┐
                              │CAMPAIGN_TRACKING_  │
                              │     LINKS          │
                              ├────────────────────┤
                              │ PK id              │
                              │ FK campaign       │
                              │    short_code     │
                              │    click_count    │
                              └────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              CUSTOMER TABLES                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

              ┌──────────────────────┐       ┌──────────────────┐
              │   CUSTOMER_LISTS    │◄──1:N─│   CUSTOMERS       │
              ├──────────────────────┤       ├──────────────────┤
              │ PK id                │       │ PK id            │
              │ FK user_id           │       │ FK customer_list  │
              │ FK file_upload      │       │    email         │
              │    list_name        │       │    name         │
              │    status           │       │    phone         │
              └──────────────────────┘       │    extra_fields │
                              │              └──────────────────┘
                              │ 1:N                    │
                              ▼                        ▼
              ┌────────────────────────┐  ┌────────────────────────┐
              │CUSTOMER_ANALYSIS_      │  │   FILE_UPLOADS          │
              │    SNAPSHOTS           │  ├────────────────────────┤
              ├────────────────────────┤  │ PK id                  │
              │ PK id                  │  │ FK user_id             │
              │ FK customer_list_id    │  │    original_filename   │
              │    result_json         │  │    stored_path         │
              └────────────────────────┘  │    purpose             │
                                         └────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              INSIGHT TABLES                                               │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐       ┌─────────────────────────────┐       ┌─────────────────────────┐
│ INSIGHT_DATA_     │◄──1:N─│     INSIGHT_CHATS           │──N:1─│ INSIGHT_CHAT_          │
│    SOURCES       │       ├─────────────────────────────┤       │     MESSAGES            │
├──────────────────┤       │ PK id                      │       ├─────────────────────────┤
│ PK id            │       │ FK user_id                 │       │ PK id                   │
│ FK user_id       │       │ FK data_source_id         │       │ FK chat_id             │
│    name          │       │ FK insight_run_id         │       │    role                │
│    source_type   │       │    title                  │       │    content             │
│    schema_json   │       │    status                 │       │    message_context     │
│    data_json     │       └─────────────────────────────┘       └─────────────────────────┘
└──────────────────┘               │
        │                           ▼
        │               ┌─────────────────────────────┐
        ▼               │   INSIGHT_REPORT_RUNS        │
┌────────────────┐     ├─────────────────────────────┤
│INSIGHT_RAW_    │     │ PK id                        │
│  SNAPSHOTS     │     │ FK user_id                   │
├────────────────┤     │    business_name             │
│ PK id          │     │    report_type              │
│ FK data_source │     │    summary_json             │
│    snapshot_date     │    status                    │
│    payload_json│     └─────────────┬───────────────┘
└────────────────┘                   │
        │                           ┌─┴───────────────┬───────────────┬───────────────┐
        ▼                           ▼               ▼               ▼               ▼
┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌──────────────┐
│ INSIGHT_       │ │   INSIGHT      │ │   INSIGHT      │ │   INSIGHT      │ │  INSIGHT     │
│ METRICS_DAILY  │ │   CARDS        │ │   AGENT_TRACES │ │   RESULT_      │ │  FEEDBACK    │
├────────────────┤ ├────────────────┤ ├────────────────┤ │   SNAPSHOTS    │ ├──────────────┤
│ PK id          │ │ PK id          │ │ PK id          │ ├────────────────┤ │ PK id        │
│    metric_date │ │ FK user_id     │ │ FK run_id      │ │ PK id          │ │ FK insight_  │
│    channel     │ │    title      │ │    step_order  │ │ FK run_id      │ │   card       │
│    revenue     │ │    reasoning  │ │    agent_name  │ │    result_json │ │    sentiment │
│    orders      │ │    priority   │ │    model       │ └────────────────┘ └──────────────┘
│    ad_spend    │ │    confidence │ │    status      │
└────────────────┘ │    status     │ │    duration_ms │
                   └────────────────┘ └────────────────┘

                              ┌─────────────────────────┐
                              │INSIGHT_REPORT_         │
                              │   SCHEMA_MAPS          │
                              ├─────────────────────────┤
                              │ PK id                   │
                              │ FK run_id              │
                              │    source_column       │
                              │    canonical_column    │
                              │    confidence         │
                              └─────────────────────────┘

                              ┌─────────────────────────┐
                              │   INSIGHT_ACTIONS      │
                              ├─────────────────────────┤
                              │ PK id                   │
                              │ FK insight_card_id     │
                              │    action_text         │
                              │    owner              │
                              │    impact_estimate    │
                              │    status             │
                              └─────────────────────────┘
```

---

## 2. Danh sách bảng

### Core Tables (Nghiệp vụ chính)

| # | Bảng | Mô tả |
|---|------|-------|
| 1 | `users` | Tài khoản người dùng (admin/user) |
| 2 | `brands` | Thông tin thương hiệu (brand voice, từ cấm, CTA) |
| 3 | `campaigns` | Chiến dịch marketing (brief, kênh, deadline) |
| 4 | `content_items` | Nội dung được tạo (email, post, video) |
| 5 | `campaign_ideas` | Ý tưởng từ AI suggestion |

### Customer Tables (Quản lý khách hàng)

| # | Bảng | Mô tả |
|---|------|-------|
| 6 | `customers` | Thông tin khách hàng trong list |
| 7 | `customer_lists` | Nhóm khách hàng (từ CSV upload) |
| 8 | `file_uploads` | File đã upload (CSV customer list) |
| 9 | `customer_analysis_snapshots` | Kết quả phân tích customer list |

### Campaign Execution Tables (Theo dõi gửi)

| # | Bảng | Mô tả |
|---|------|-------|
| 10 | `campaign_execution_logs` | Log từng lần gửi (email/SMS) |
| 11 | `campaign_tracking_links` | Tracking links với short code |
| 12 | `campaign_revenue` | Doanh thu theo chiến dịch |

### AI & Agent Tables (AI Operations)

| # | Bảng | Mô tả |
|---|------|-------|
| 13 | `agent_run_logs` | Log hoạt động AI agent |
| 14 | `workflow_jobs` | Job workflow tự động |

### Insight Tables (Phân tích dữ liệu)

| # | Bảng | Mô tả |
|---|------|-------|
| 15 | `insight_data_sources` | Nguồn dữ liệu phân tích |
| 16 | `insight_chats` | Chat session với AI |
| 17 | `insight_chat_messages` | Tin nhắn trong chat |
| 18 | `insight_report_runs` | Báo cáo insight đã chạy |
| 19 | `insight_report_schema_maps` | Mapping columns → canonical |
| 20 | `insight_agent_traces` | Trace từng bước AI |
| 21 | `insight_result_snapshots` | Kết quả snapshot |
| 22 | `insight_raw_snapshots` | Raw data snapshot |
| 23 | `insight_metrics_daily` | Metrics hàng ngày |
| 24 | `insight_cards` | Insight cards hiển thị |
| 25 | `insight_actions` | Actions đề xuất từ insight |
| 26 | `insight_feedback` | Feedback của user |

---

## 3. Chi tiết từng bảng

### 3.1 users

> **Mục đích**: Tài khoản người dùng hệ thống

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `email` | VARCHAR(255) | NO | - | Email đăng nhập, UNIQUE |
| `hashed_pw` | VARCHAR(255) | NO | - | Password đã hash bcrypt |
| `full_name` | VARCHAR(255) | YES | - | Tên đầy đủ |
| `role` | VARCHAR(20) | NO | 'user' | 'admin' hoặc 'user' |
| `is_active` | BOOLEAN | NO | true | Tài khoản có active không |
| `email_reminder_enabled` | BOOLEAN | NO | true | Bật nhắc lịch qua email |
| `created_at` | TIMESTAMPTZ | NO | now | Thời gian tạo |
| `updated_at` | TIMESTAMPTZ | NO | now | Thời gian cập nhật |

**Relationships**: 1:N → `brands`, `campaigns`, `campaign_ideas`, `insight_data_sources`, `insight_chats`

---

### 3.2 brands

> **Mục đích**: Lưu thông tin thương hiệu để AI tạo content đúng brand voice

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `user_id` | UUID | NO | - | FK → users.id |
| `brand_name` | VARCHAR(255) | NO | - | Tên thương hiệu |
| `tagline` | VARCHAR(512) | YES | - | Slogan |
| `brand_description` | TEXT | NO | - | Mô tả thương hiệu |
| `tone_of_voice` | VARCHAR(50) | NO | - | Giọng văn (thân thiện/chuyên nghiệp...) |
| `logo_url` | VARCHAR(1024) | YES | - | URL logo |
| `primary_color` | VARCHAR(7) | YES | - | Màu chính (#RRGGBB) |
| `target_audience` | TEXT | NO | - | Mô tả khách hàng mục tiêu |
| `key_products` | TEXT[] | YES | - | Array sản phẩm chính |
| `forbidden_words` | TEXT[] | YES | - | Array từ cấm (AI không dùng) |
| `preferred_cta` | VARCHAR(255) | YES | - | CTA ưa dùng |
| `preferred_salutation` | VARCHAR(50) | YES | - | Cách xưng hô (bạn/anh/chị...) |
| `sample_post` | TEXT | YES | - | Sample bài viết mẫu |
| `contact_email` | VARCHAR(255) | YES | - | Email liên hệ |
| `phone` | VARCHAR(64) | YES | - | SĐT liên hệ |
| `address` | TEXT | YES | - | Địa chỉ |
| `created_at` | TIMESTAMPTZ | NO | now | - |
| `updated_at` | TIMESTAMPTZ | NO | now | - |

**Relationships**: N:1 ← users | 1:N → campaigns, campaign_ideas

---

### 3.3 campaigns

> **Mục đích**: Chiến dịch marketing - brief đầy đủ để AI tạo content

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `user_id` | UUID | NO | - | FK → users.id |
| `brand_id` | UUID | YES | - | FK → brands.id (nullable = tạo campaign không có brand) |
| `campaign_name` | VARCHAR(255) | NO | - | Tên chiến dịch |
| `objective` | TEXT | NO | - | Mục tiêu chiến dịch |
| `product_or_service` | TEXT | NO | - | Sản phẩm/dịch vụ quảng cáo |
| `target_audience` | TEXT | YES | - | Đối tượng mục tiêu |
| `offer_or_hook` | TEXT | YES | - | Ưu đãi/Hook chính |
| `start_date` | DATE | YES | - | Ngày bắt đầu |
| `deadline` | DATE | NO | - | Hạn chót |
| `channels` | TEXT[] | NO | - | Array kênh: email, facebook_post, video_script |
| `additional_notes` | TEXT | YES | - | Ghi chú thêm |
| `status` | VARCHAR(30) | NO | pending_agent | pending_agent/running/completed/failed |
| `error_message` | TEXT | YES | - | Lỗi nếu có |
| `campaign_plan_json` | JSONB | YES | - | Plan chi tiết từ AI |
| `cost` | NUMERIC(15,2) | NO | 0 | Chi phí ước tính |
| `created_at` | TIMESTAMPTZ | NO | now | - |
| `updated_at` | TIMESTAMPTZ | NO | now | - |

**Relationships**: N:1 ← users, brands | 1:N → content_items, agent_run_logs, workflow_jobs, execution_logs, tracking_links

---

### 3.4 content_items

> **Mục đích**: Nội dung được AI tạo ra cho từng kênh (email/post/video)

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `campaign_id` | UUID | NO | - | FK → campaigns.id |
| `channel` | VARCHAR(30) | NO | - | 'email' / 'facebook_post' / 'video_script' |
| `version` | INT | NO | 1 | Số phiên bản (user có thể regenerate) |
| `status` | VARCHAR(30) | NO | draft | draft/pending_approval/approved/rejected |
| `content_json` | JSONB | NO | - | Nội dung: {subject, body, cta, hashtags...} |
| `source` | VARCHAR(20) | NO | agent | 'agent' hoặc 'manual' |
| `agent_run_id` | UUID | YES | - | FK → agent_run_logs.id (AI run nào tạo ra) |
| `rejection_note` | TEXT | YES | - | Lý do reject nếu có |
| `scheduled_date` | DATE | YES | - | Ngày hẹn đăng |
| `created_at` | TIMESTAMPTZ | NO | now | - |
| `updated_at` | TIMESTAMPTZ | NO | now | - |

---

### 3.5 campaign_ideas

> **Mục đích**: Ý tưởng chiến dịch được AI gợi ý từ brand + events + industry patterns

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `user_id` | UUID | NO | - | FK → users.id |
| `brand_id` | UUID | YES | - | FK → brands.id |
| `title` | VARCHAR(255) | NO | - | Tên ý tưởng |
| `objective` | TEXT | YES | - | Mục tiêu |
| `channels` | TEXT[] | YES | - | Kênh đề xuất |
| `timing` | VARCHAR(255) | YES | - | Thời gian chạy |
| `customer_segment` | TEXT | YES | - | Đối tượng mục tiêu |
| `email_content` | JSONB | YES | - | Nội dung email đã build |
| `post_content` | JSONB | YES | - | Nội dung post đã build |
| `video_script` | JSONB | YES | - | Script video đã build |
| `image_prompt` | TEXT | YES | - | Prompt tạo ảnh |
| `status` | VARCHAR(20) | NO | draft | draft/approved/rejected |
| `created_at` | TIMESTAMPTZ | NO | now | - |
| `updated_at` | TIMESTAMPTZ | NO | now | - |

---

### 3.6 customers

> **Mục đích**: Khách hàng trong danh sách (từ CSV import)

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `customer_list_id` | UUID | NO | - | FK → customer_lists.id |
| `email` | VARCHAR(255) | YES | - | Email khách hàng |
| `full_name` | VARCHAR(255) | YES | - | Tên |
| `phone` | VARCHAR(50) | YES | - | SĐT |
| `extra_fields` | JSONB | YES | - | Các trường tùy chỉnh từ CSV |
| `created_at` | TIMESTAMPTZ | NO | now | - |

---

### 3.7 customer_lists

> **Mục đích**: Nhóm khách hàng (ví dụ: "Khách VIP", "Leads tháng 5")

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `user_id` | UUID | NO | - | FK → users.id |
| `file_upload_id` | UUID | YES | - | FK → file_uploads.id |
| `list_name` | VARCHAR(255) | NO | - | Tên danh sách |
| `status` | VARCHAR(30) | NO | processing | processing/completed/failed |
| `total_records` | INT | NO | 0 | Tổng số records |
| `valid_records` | INT | NO | 0 | Số record hợp lệ |
| `invalid_records` | INT | NO | 0 | Số record lỗi |
| `created_at` | TIMESTAMPTZ | NO | now | - |
| `updated_at` | TIMESTAMPTZ | NO | now | - |

**Relationships**: 1:N → customers, customer_analysis_snapshots

---

### 3.8 file_uploads

> **Mục đích**: Lưu metadata file đã upload (CSV customer list)

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `user_id` | UUID | NO | - | FK → users.id |
| `original_filename` | VARCHAR(255) | NO | - | Tên file gốc |
| `stored_path` | TEXT | NO | - | Đường dẫn lưu trên server |
| `mime_type` | VARCHAR(100) | NO | text/csv | Loại file |
| `file_size_bytes` | INT | NO | 0 | Kích thước byte |
| `purpose` | VARCHAR(50) | NO | customer_list | 'customer_list' / 'other' |
| `created_at` | TIMESTAMPTZ | NO | now | - |

---

### 3.9 customer_analysis_snapshots

> **Mục đích**: Kết quả phân tích customer list (segments, churn risk, VIP)

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `customer_list_id` | UUID | NO | - | FK → customer_lists.id |
| `result_json` | JSONB | NO | - | Kết quả phân tích đầy đủ |
| `created_at` | TIMESTAMPTZ | NO | now | - |

---

### 3.10 campaign_execution_logs

> **Mục đích**: Log từng lần gửi (email/SMS) trong chiến dịch - theo dõi open/click

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `batch_id` | UUID | NO | - | ID batch gửi (nhóm các lần gửi) |
| `campaign_id` | UUID | NO | - | FK → campaigns.id |
| `customer_id` | UUID | YES | - | FK → customers.id |
| `channel` | VARCHAR(20) | NO | - | 'email' / 'sms' |
| `status` | VARCHAR(30) | NO | - | sent/failed/opened/clicked |
| `tracking_token` | VARCHAR(64) | NO | - | Token tracking unique |
| `recipient_email` | VARCHAR(255) | YES | - | Email người nhận |
| `recipient_phone` | VARCHAR(50) | YES | - | SĐT người nhận |
| `recipient_name` | VARCHAR(255) | YES | - | Tên người nhận |
| `opened_at` | TIMESTAMPTZ | YES | - | Thời gian mở email |
| `clicked_at` | TIMESTAMPTZ | YES | - | Thời gian click link |
| `sent_at` | TIMESTAMPTZ | YES | - | Thời gian gửi |
| `error_message` | TEXT | YES | - | Lỗi nếu gửi thất bại |
| `ab_variant` | VARCHAR(8) | YES | - | A/B test variant |
| `click_target_url` | VARCHAR(2048) | YES | - | URL đích khi click |
| `created_at` | TIMESTAMPTZ | NO | now | - |

---

### 3.11 campaign_tracking_links

> **Mục đích**: Short link tracking cho chiến dịch (thay vì link dài)

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `campaign_id` | UUID | NO | - | FK → campaigns.id |
| `name` | VARCHAR(255) | NO | - | Tên link (VD: "FB Ad 1") |
| `destination_url` | TEXT | NO | - | URL đích thực |
| `short_code` | VARCHAR(64) | NO | - | Code ngắn, UNIQUE |
| `click_count` | INT | NO | 0 | Số lần click |
| `created_at` | TIMESTAMPTZ | NO | now | - |

---

### 3.12 campaign_revenue

> **Mục đích**: Theo dõi doanh thu theo chiến dịch

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `campaign_id` | UUID | NO | - | FK → campaigns.id |
| `user_id` | UUID | NO | - | FK → users.id |
| `revenue` | NUMERIC(15,2) | NO | 0 | Doanh thu |
| `order_count` | INT | NO | 0 | Số đơn hàng |
| `cost` | NUMERIC(15,2) | YES | 0 | Chi phí |
| `source` | VARCHAR(20) | NO | manual | 'manual' / 'auto' |
| `notes` | TEXT | YES | - | Ghi chú |
| `recorded_date` | DATE | YES | - | Ngày ghi nhận |
| `created_at` | TIMESTAMPTZ | NO | now | - |
| `updated_at` | TIMESTAMPTZ | NO | now | - |

---

### 3.13 agent_run_logs

> **Mục đích**: Log hoạt động AI agent (debug, monitor token usage, performance)

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `campaign_id` | UUID | NO | - | FK → campaigns.id |
| `agent_name` | VARCHAR(50) | NO | - | 'strategist' / 'writer' / 'critic' / 'scheduler' |
| `step_order` | INT | NO | - | Thứ tự step trong workflow |
| `channel` | VARCHAR(30) | YES | - | Kênh đang xử lý |
| `model_used` | VARCHAR(100) | NO | - | VD: 'qwen2.5:14b' |
| `model_provider` | VARCHAR(20) | NO | - | 'ollama' / 'openai' |
| `prompt_preview` | TEXT | YES | - | Preview prompt (300 char) |
| `output_preview` | TEXT | YES | - | Preview output (300 char) |
| `input_tokens` | INT | YES | - | Số tokens input |
| `output_tokens` | INT | YES | - | Số tokens output |
| `duration_ms` | INT | YES | - | Thời gian chạy (ms) |
| `status` | VARCHAR(20) | NO | success | success / failed |
| `error_detail` | TEXT | YES | - | Chi tiết lỗi |
| `created_at` | TIMESTAMPTZ | NO | now | - |

---

### 3.14 workflow_jobs

> **Mục đích**: Job workflow tự động (schedule, trigger)

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `user_id` | UUID | NO | - | FK → users.id |
| `trigger_type` | VARCHAR(50) | NO | - | 'scheduled' / 'manual' / 'webhook' |
| `trigger_payload` | JSONB | YES | - | Data kích hoạt job |
| `campaign_id` | UUID | YES | - | FK → campaigns.id |
| `status` | VARCHAR(20) | NO | queued | queued/running/completed/failed |
| `error_message` | TEXT | YES | - | Lỗi nếu có |
| `created_at` | TIMESTAMPTZ | NO | now | - |
| `updated_at` | TIMESTAMPTZ | NO | now | - |

---

### 3.15 insight_data_sources

> **Mục đích**: Nguồn dữ liệu user tạo/upload để phân tích (table thủ công hoặc CSV/Excel)

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `user_id` | UUID | NO | - | FK → users.id |
| `name` | VARCHAR(255) | NO | - | Tên nguồn dữ liệu |
| `source_type` | VARCHAR(20) | NO | manual | 'manual' / 'csv_upload' / 'xlsx_upload' |
| `schema_json` | JSONB | YES | - | Schema nếu là table thủ công |
| `data_json` | JSONB | YES | - | Data nếu là table thủ công |
| `file_upload_id` | UUID | YES | - | FK → file_uploads.id (nếu upload file) |
| `original_filename` | VARCHAR(255) | YES | - | Tên file gốc |
| `created_at` | TIMESTAMPTZ | NO | now | - |
| `updated_at` | TIMESTAMPTZ | NO | now | - |

**Relationships**: 1:N → insight_chats

---

### 3.16 insight_chats

> **Mục đích**: Chat session với AI về một nguồn dữ liệu

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `user_id` | UUID | NO | - | FK → users.id |
| `data_source_id` | UUID | NO | - | FK → insight_data_sources.id |
| `insight_run_id` | UUID | YES | - | FK → insight_report_runs.id |
| `title` | VARCHAR(255) | YES | - | Tiêu đề chat |
| `status` | VARCHAR(20) | NO | active | 'active' / 'archived' |
| `created_at` | TIMESTAMPTZ | NO | now | - |
| `updated_at` | TIMESTAMPTZ | NO | now | - |

**Relationships**: 1:N → insight_chat_messages

---

### 3.17 insight_chat_messages

> **Mục đích**: Tin nhắn trong chat session (user hỏi, AI trả lời)

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `chat_id` | UUID | NO | - | FK → insight_chats.id |
| `role` | VARCHAR(20) | NO | - | 'user' / 'assistant' |
| `content` | TEXT | NO | - | Nội dung tin nhắn |
| `message_context` | JSONB | YES | - | Context: referenced_columns, intent... |
| `suggested_visualizations` | JSONB | YES | - | Charts/suggestions từ AI |
| `input_tokens` | INT | YES | - | Token usage input |
| `output_tokens` | INT | YES | - | Token usage output |
| `created_at` | TIMESTAMPTZ | NO | now | - |

---

### 3.18 insight_report_runs

> **Mục đích**: Báo cáo insight đã chạy (snapshot kết quả phân tích)

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `user_id` | UUID | NO | - | FK → users.id |
| `business_name` | VARCHAR(255) | NO | - | Tên business phân tích |
| `industry` | VARCHAR(120) | YES | - | Ngành nghề |
| `report_type` | VARCHAR(50) | NO | generic_report | Loại báo cáo |
| `source_filename` | VARCHAR(255) | YES | - | File source |
| `summary_json` | JSONB | YES | - | Tóm tắt kết quả |
| `status` | VARCHAR(20) | NO | completed | running/completed/failed |
| `fallback_provider` | VARCHAR(20) | YES | - | AI provider dùng fallback |
| `fallback_reason` | VARCHAR(255) | YES | - | Lý do fallback |
| `created_at` | TIMESTAMPTZ | NO | now | - |

**Relationships**: 1:N → insight_report_schema_maps, insight_agent_traces, insight_result_snapshots

---

### 3.19 insight_report_schema_maps

> **Mục đích**: Mapping từ column gốc → canonical column (AI nhận diện)

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `run_id` | UUID | NO | - | FK → insight_report_runs.id |
| `source_column` | VARCHAR(120) | NO | - | Tên column gốc |
| `canonical_column` | VARCHAR(120) | NO | - | Tên canonical (revenue, orders...) |
| `confidence` | FLOAT | NO | 0.7 | Độ chắc chắn |
| `created_at` | TIMESTAMPTZ | NO | now | - |

---

### 3.20 insight_agent_traces

> **Mục đích**: Trace từng bước AI agent chạy trong insight pipeline

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `run_id` | UUID | NO | - | FK → insight_report_runs.id |
| `step_order` | INT | NO | - | Thứ tự step |
| `step_name` | VARCHAR(100) | NO | - | Tên step |
| `agent_name` | VARCHAR(100) | NO | - | Agent xử lý |
| `model_provider` | VARCHAR(20) | NO | - | 'openai' / 'ollama' |
| `model_name` | VARCHAR(100) | NO | - | Model cụ thể |
| `status` | VARCHAR(20) | NO | success | - |
| `duration_ms` | INT | YES | - | Thời gian |
| `detail_json` | JSONB | YES | - | Chi tiết bước |
| `created_at` | TIMESTAMPTZ | NO | now | - |

---

### 3.21 insight_result_snapshots

> **Mục đích**: Snapshot kết quả cuối cùng của insight run

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `run_id` | UUID | NO | - | FK → insight_report_runs.id |
| `result_json` | JSONB | NO | - | Kết quả đầy đủ |
| `created_at` | TIMESTAMPTZ | NO | now | - |

---

### 3.22 insight_raw_snapshots

> **Mục đích**: Lưu raw data snapshot từ nguồn

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `user_id` | UUID | NO | - | FK → users.id |
| `data_source_id` | UUID | YES | - | FK → insight_data_sources.id |
| `source_type` | VARCHAR(50) | NO | - | Loại nguồn |
| `snapshot_date` | DATE | NO | - | Ngày snapshot |
| `payload_json` | JSONB | NO | - | Raw data |
| `checksum` | VARCHAR(64) | YES | - | Checksum để detect thay đổi |
| `created_at` | TIMESTAMPTZ | NO | now | - |

---

### 3.23 insight_metrics_daily

> **Mục đích**: Metrics hàng ngày cho dashboard

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `user_id` | UUID | NO | - | FK → users.id |
| `metric_date` | DATE | NO | - | Ngày metrics |
| `channel` | VARCHAR(50) | YES | - | Kênh (email/facebook...) |
| `revenue` | FLOAT | NO | 0 | Doanh thu |
| `orders` | FLOAT | NO | 0 | Số đơn |
| `ad_spend` | FLOAT | NO | 0 | Chi phí quảng cáo |
| `leads` | FLOAT | NO | 0 | Số leads |
| `repeat_orders` | FLOAT | NO | 0 | Số đơn lặp lại |
| `computed_json` | JSONB | YES | - | Metrics tính toán thêm |
| `created_at` | TIMESTAMPTZ | NO | now | - |

---

### 3.24 insight_cards

> **Mục đích**: Insight cards hiển thị trên dashboard (AI phát hiện anomalies, trends)

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `user_id` | UUID | NO | - | FK → users.id |
| `metric_date` | DATE | NO | - | Ngày insight |
| `title` | VARCHAR(255) | NO | - | Tiêu đề insight |
| `priority` | VARCHAR(10) | NO | P2 | P0/P1/P2/P3 |
| `confidence` | FLOAT | NO | 0.5 | Độ chắc chắn (0-1) |
| `reasoning` | TEXT | NO | - | Giải thích chi tiết |
| `evidence_json` | JSONB | YES | - | Bằng chứng/data points |
| `status` | VARCHAR(20) | NO | open | open/acknowledged/dismissed |
| `created_at` | TIMESTAMPTZ | NO | now | - |

**Relationships**: 1:N → insight_actions

---

### 3.25 insight_actions

> **Mục đích**: Actions đề xuất từ insight card

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `user_id` | UUID | NO | - | FK → users.id |
| `insight_card_id` | UUID | YES | - | FK → insight_cards.id |
| `action_text` | TEXT | NO | - | Mô tả action |
| `owner` | VARCHAR(30) | NO | marketing | 'marketing' / 'sales' / 'ops' |
| `impact_estimate` | VARCHAR(20) | NO | medium | low/medium/high |
| `status` | VARCHAR(20) | NO | open | open/in_progress/done |
| `created_at` | TIMESTAMPTZ | NO | now | - |

---

### 3.26 insight_feedback

> **Mục đích**: Feedback của user về insight card

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | auto | Primary key |
| `user_id` | UUID | NO | - | FK → users.id |
| `insight_card_id` | UUID | YES | - | FK → insight_cards.id |
| `sentiment` | VARCHAR(20) | NO | - | 'positive' / 'neutral' / 'negative' |
| `note` | TEXT | YES | - | Ghi chú thêm |
| `created_at` | TIMESTAMPTZ | NO | now | - |

---

## 4. SQL Build Database

```sql
-- ============================================================================
-- AIMAP Database - Build Script
-- Database: aimap
-- Host: 103.116.38.96:5432
-- Created: 2026-05-06
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- 1. users - Tài khoản người dùng
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_pw VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT true,
    email_reminder_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- 2. brands - Thông tin thương hiệu
CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    brand_name VARCHAR(255) NOT NULL,
    tagline VARCHAR(512),
    brand_description TEXT NOT NULL DEFAULT '',
    tone_of_voice VARCHAR(50) NOT NULL DEFAULT 'friendly',
    logo_url VARCHAR(1024),
    primary_color VARCHAR(7),
    target_audience TEXT NOT NULL DEFAULT '',
    key_products TEXT[],
    forbidden_words TEXT[],
    preferred_cta VARCHAR(255),
    preferred_salutation VARCHAR(50),
    sample_post TEXT,
    contact_email VARCHAR(255),
    phone VARCHAR(64),
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brands_user_id ON brands(user_id);

-- 3. campaigns - Chiến dịch marketing
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
    campaign_name VARCHAR(255) NOT NULL,
    objective TEXT NOT NULL DEFAULT '',
    product_or_service TEXT NOT NULL DEFAULT '',
    target_audience TEXT,
    offer_or_hook TEXT,
    start_date DATE,
    deadline DATE NOT NULL,
    channels TEXT[] NOT NULL DEFAULT '{}',
    additional_notes TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'pending_agent',
    error_message TEXT,
    campaign_plan_json JSONB,
    cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_brand_id ON campaigns(brand_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);

-- 4. campaign_ideas - Ý tưởng từ AI
CREATE TABLE campaign_ideas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    objective TEXT,
    channels TEXT[],
    timing VARCHAR(255),
    customer_segment TEXT,
    email_content JSONB,
    post_content JSONB,
    video_script JSONB,
    image_prompt TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaign_ideas_user_id ON campaign_ideas(user_id);

-- 5. content_items - Nội dung được tạo
CREATE TABLE content_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    channel VARCHAR(30) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    content_json JSONB NOT NULL DEFAULT '{}',
    source VARCHAR(20) NOT NULL DEFAULT 'agent',
    agent_run_id UUID,
    rejection_note TEXT,
    scheduled_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_items_campaign_id ON content_items(campaign_id);
CREATE INDEX idx_content_items_status ON content_items(status);
CREATE INDEX idx_content_items_scheduled_date ON content_items(scheduled_date);

-- ============================================================================
-- CUSTOMER TABLES
-- ============================================================================

-- 6. customer_lists - Nhóm khách hàng
CREATE TABLE customer_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_upload_id UUID,
    list_name VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'processing',
    total_records INT NOT NULL DEFAULT 0,
    valid_records INT NOT NULL DEFAULT 0,
    invalid_records INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_lists_user_id ON customer_lists(user_id);
CREATE INDEX idx_customer_lists_status ON customer_lists(status);

-- 7. customers - Khách hàng trong list
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_list_id UUID NOT NULL REFERENCES customer_lists(id) ON DELETE CASCADE,
    email VARCHAR(255),
    full_name VARCHAR(255),
    phone VARCHAR(50),
    extra_fields JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_customer_list_id ON customers(customer_list_id);
CREATE INDEX idx_customers_email ON customers(email);

-- 8. file_uploads - File đã upload
CREATE TABLE file_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    stored_path TEXT NOT NULL,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'text/csv',
    file_size_bytes INT NOT NULL DEFAULT 0,
    purpose VARCHAR(50) NOT NULL DEFAULT 'customer_list',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_file_uploads_user_id ON file_uploads(user_id);

-- 9. customer_analysis_snapshots - Kết quả phân tích customer list
CREATE TABLE customer_analysis_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_list_id UUID NOT NULL REFERENCES customer_lists(id) ON DELETE CASCADE,
    result_json JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_analysis_snapshots_customer_list_id ON customer_analysis_snapshots(customer_list_id);

-- ============================================================================
-- CAMPAIGN EXECUTION TABLES
-- ============================================================================

-- 10. campaign_execution_logs - Log từng lần gửi
CREATE TABLE campaign_execution_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    channel VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL,
    tracking_token VARCHAR(64) NOT NULL UNIQUE,
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(50),
    recipient_name VARCHAR(255),
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    ab_variant VARCHAR(8),
    click_target_url VARCHAR(2048),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaign_execution_logs_batch_id ON campaign_execution_logs(batch_id);
CREATE INDEX idx_campaign_execution_logs_campaign_id ON campaign_execution_logs(campaign_id);
CREATE INDEX idx_campaign_execution_logs_customer_id ON campaign_execution_logs(customer_id);
CREATE INDEX idx_campaign_execution_logs_status ON campaign_execution_logs(status);
CREATE INDEX idx_campaign_execution_logs_tracking_token ON campaign_execution_logs(tracking_token);

-- 11. campaign_tracking_links - Tracking links
CREATE TABLE campaign_tracking_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    destination_url TEXT NOT NULL,
    short_code VARCHAR(64) NOT NULL UNIQUE,
    click_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. campaign_revenue - Doanh thu theo chiến dịch
CREATE TABLE campaign_revenue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    revenue NUMERIC(15, 2) NOT NULL DEFAULT 0,
    order_count INT NOT NULL DEFAULT 0,
    cost NUMERIC(15, 2),
    source VARCHAR(20) NOT NULL DEFAULT 'manual',
    notes TEXT,
    recorded_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaign_revenue_campaign_id ON campaign_revenue(campaign_id);
CREATE INDEX idx_campaign_revenue_user_id ON campaign_revenue(user_id);

-- ============================================================================
-- AI & AGENT TABLES
-- ============================================================================

-- 13. agent_run_logs - Log hoạt động AI
CREATE TABLE agent_run_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    agent_name VARCHAR(50) NOT NULL,
    step_order INT NOT NULL,
    channel VARCHAR(30),
    model_used VARCHAR(100) NOT NULL,
    model_provider VARCHAR(20) NOT NULL,
    prompt_preview TEXT,
    output_preview TEXT,
    input_tokens INT,
    output_tokens INT,
    duration_ms INT,
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    error_detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_run_logs_campaign_id ON agent_run_logs(campaign_id);

-- Add FK to content_items (after agent_run_logs exists)
ALTER TABLE content_items 
    ADD CONSTRAINT fk_content_items_agent_run_id 
    FOREIGN KEY (agent_run_id) REFERENCES agent_run_logs(id) ON DELETE SET NULL;

-- 14. workflow_jobs - Job workflow tự động
CREATE TABLE workflow_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trigger_type VARCHAR(50) NOT NULL,
    trigger_payload JSONB,
    campaign_id UUID REFERENCES campaigns(id),
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_jobs_user_id ON workflow_jobs(user_id);

-- ============================================================================
-- INSIGHT TABLES
-- ============================================================================

-- 15. insight_data_sources - Nguồn dữ liệu phân tích
CREATE TABLE insight_data_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(20) NOT NULL DEFAULT 'manual',
    schema_json JSONB,
    data_json JSONB,
    file_upload_id UUID REFERENCES file_uploads(id) ON DELETE SET NULL,
    original_filename VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insight_data_sources_user_id ON insight_data_sources(user_id);

-- 16. insight_chats - Chat session với AI
CREATE TABLE insight_chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_source_id UUID NOT NULL REFERENCES insight_data_sources(id) ON DELETE CASCADE,
    insight_run_id UUID,
    title VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insight_chats_user_id ON insight_chats(user_id);
CREATE INDEX idx_insight_chats_data_source_id ON insight_chats(data_source_id);

-- 17. insight_chat_messages - Tin nhắn trong chat
CREATE TABLE insight_chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL REFERENCES insight_chats(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    message_context JSONB,
    suggested_visualizations JSONB,
    input_tokens INT,
    output_tokens INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insight_chat_messages_chat_id ON insight_chat_messages(chat_id);

-- 18. insight_report_runs - Báo cáo insight đã chạy
CREATE TABLE insight_report_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_name VARCHAR(255) NOT NULL,
    industry VARCHAR(120),
    report_type VARCHAR(50) NOT NULL DEFAULT 'generic_report',
    source_filename VARCHAR(255),
    summary_json JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    fallback_provider VARCHAR(20),
    fallback_reason VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insight_report_runs_user_id ON insight_report_runs(user_id);
CREATE INDEX idx_insight_report_runs_status ON insight_report_runs(status);

-- Add FK to insight_chats (after insight_report_runs exists)
ALTER TABLE insight_chats 
    ADD CONSTRAINT fk_insight_chats_insight_run_id 
    FOREIGN KEY (insight_run_id) REFERENCES insight_report_runs(id) ON DELETE SET NULL;

-- 19. insight_report_schema_maps - Mapping columns
CREATE TABLE insight_report_schema_maps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES insight_report_runs(id) ON DELETE CASCADE,
    source_column VARCHAR(120) NOT NULL,
    canonical_column VARCHAR(120) NOT NULL,
    confidence FLOAT NOT NULL DEFAULT 0.7,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insight_report_schema_maps_run_id ON insight_report_schema_maps(run_id);

-- 20. insight_agent_traces - Trace từng bước AI
CREATE TABLE insight_agent_traces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES insight_report_runs(id) ON DELETE CASCADE,
    step_order INT NOT NULL,
    step_name VARCHAR(100) NOT NULL,
    agent_name VARCHAR(100) NOT NULL,
    model_provider VARCHAR(20) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    duration_ms INT,
    detail_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insight_agent_traces_run_id ON insight_agent_traces(run_id);

-- 21. insight_result_snapshots - Kết quả snapshot
CREATE TABLE insight_result_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES insight_report_runs(id) ON DELETE CASCADE,
    result_json JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insight_result_snapshots_run_id ON insight_result_snapshots(run_id);

-- 22. insight_raw_snapshots - Raw data snapshot
CREATE TABLE insight_raw_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_source_id UUID REFERENCES insight_data_sources(id) ON DELETE SET NULL,
    source_type VARCHAR(50) NOT NULL,
    snapshot_date DATE NOT NULL,
    payload_json JSONB NOT NULL DEFAULT '{}',
    checksum VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insight_raw_snapshots_user_id ON insight_raw_snapshots(user_id);
CREATE INDEX idx_insight_raw_snapshots_source_type ON insight_raw_snapshots(source_type);
CREATE INDEX idx_insight_raw_snapshots_snapshot_date ON insight_raw_snapshots(snapshot_date);
CREATE INDEX idx_insight_raw_snapshots_checksum ON insight_raw_snapshots(checksum);

-- 23. insight_metrics_daily - Metrics hàng ngày
CREATE TABLE insight_metrics_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    channel VARCHAR(50),
    revenue FLOAT NOT NULL DEFAULT 0,
    orders FLOAT NOT NULL DEFAULT 0,
    ad_spend FLOAT NOT NULL DEFAULT 0,
    leads FLOAT NOT NULL DEFAULT 0,
    repeat_orders FLOAT NOT NULL DEFAULT 0,
    computed_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insight_metrics_daily_user_id ON insight_metrics_daily(user_id);
CREATE INDEX idx_insight_metrics_daily_metric_date ON insight_metrics_daily(metric_date);
CREATE INDEX idx_insight_metrics_daily_channel ON insight_metrics_daily(channel);

-- 24. insight_cards - Insight cards hiển thị
CREATE TABLE insight_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    title VARCHAR(255) NOT NULL,
    priority VARCHAR(10) NOT NULL DEFAULT 'P2',
    confidence FLOAT NOT NULL DEFAULT 0.5,
    reasoning TEXT NOT NULL,
    evidence_json JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insight_cards_user_id ON insight_cards(user_id);
CREATE INDEX idx_insight_cards_metric_date ON insight_cards(metric_date);
CREATE INDEX idx_insight_cards_priority ON insight_cards(priority);
CREATE INDEX idx_insight_cards_status ON insight_cards(status);

-- 25. insight_actions - Actions đề xuất
CREATE TABLE insight_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    insight_card_id UUID REFERENCES insight_cards(id) ON DELETE SET NULL,
    action_text TEXT NOT NULL,
    owner VARCHAR(30) NOT NULL DEFAULT 'marketing',
    impact_estimate VARCHAR(20) NOT NULL DEFAULT 'medium',
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insight_actions_user_id ON insight_actions(user_id);
CREATE INDEX idx_insight_actions_insight_card_id ON insight_actions(insight_card_id);
CREATE INDEX idx_insight_actions_status ON insight_actions(status);

-- 26. insight_feedback - Feedback của user
CREATE TABLE insight_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    insight_card_id UUID REFERENCES insight_cards(id) ON DELETE SET NULL,
    sentiment VARCHAR(20) NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insight_feedback_user_id ON insight_feedback(user_id);
CREATE INDEX idx_insight_feedback_insight_card_id ON insight_feedback(insight_card_id);

-- ============================================================================
-- ADD FK TO FILE_UPLOADS IN CUSTOMER_LISTS (after file_uploads exists)
-- ============================================================================
ALTER TABLE customer_lists 
    ADD CONSTRAINT fk_customer_lists_file_upload_id 
    FOREIGN KEY (file_upload_id) REFERENCES file_uploads(id) ON DELETE SET NULL;

-- ============================================================================
-- COMPLETE!
-- ============================================================================
```

---

## 5. Queries hữu ích

### 5.1 Đếm rows tất cả bảng

```sql
SELECT 
    table_name,
    (SELECT COUNT(*) FROM public."' || table_name || '") as row_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

### 5.2 Xem tất cả FK relationships

```sql
SELECT 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;
```

### 5.3 Backup toàn bộ database

```bash
# Chạy ngoài container:
pg_dump -h 103.116.38.96 -U thinh -d aimap -F c -b -v -f backup_aimap_$(date +%Y%m%d).dump
```

### 5.4 Restore database

```bash
pg_restore -h 103.116.38.96 -U thinh -d aimap -v backup_aimap_YYYYMMDD.dump
```

### 5.5 Xem campaign với brand và content items

```sql
SELECT 
    c.campaign_name,
    b.brand_name,
    c.status,
    c.deadline,
    COUNT(ci.id) as content_count
FROM campaigns c
LEFT JOIN brands b ON c.brand_id = b.id
LEFT JOIN content_items ci ON c.id = ci.campaign_id
GROUP BY c.id, b.brand_name, c.status, c.deadline
ORDER BY c.created_at DESC;
```

### 5.6 Xem customer list với số lượng customers

```sql
SELECT 
    cl.list_name,
    cl.status,
    cl.total_records,
    cl.valid_records,
    COUNT(c.id) as actual_customers
FROM customer_lists cl
LEFT JOIN customers c ON cl.id = c.customer_list_id
GROUP BY cl.id
ORDER BY cl.created_at DESC;
```

### 5.7 AI usage summary

```sql
SELECT 
    agent_name,
    COUNT(*) as total_runs,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    AVG(duration_ms) as avg_duration_ms
FROM agent_run_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY agent_name
ORDER BY total_runs DESC;
```

---

## 6. Database Migration Notes

### Đã xóa (2026-05-05)

| Bảng | Lý do |
|------|-------|
| approval_history | Không dùng |
| campaign_tag_assignments | Junction thừa |
| customer_list_members | Junction thừa |
| email_verifications | Auth chưa implement |
| insight_feedback | Chưa implement |
| outreach_logs | Không dùng |
| password_reset_tokens | Auth chưa implement |
| user_sessions | JWT stateless |
| workflow_schedules | Không có data |
| content_templates | Không dùng |

---

**Cập nhật**: 2026-05-06
