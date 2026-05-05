# Cơ sở dữ liệu AIMAP - Tài liệu đầy đủ

> **Database**: `103.116.38.96:5432/aimap`
> **Cập nhật**: 2026-05-05
> **Tổng số bảng**: 32 (đã cleanup từ 42)

---

## Mục lục

1. [ERD Tổng quan](#1-erd-tổng-quan)
2. [Danh sách bảng](#2-danh-sách-bảng)
3. [Chi tiết từng bảng](#3-chi-tiết-từng-bảng)
4. [Queries hữu ích](#4-queries-hữu-ích)

---

## 1. ERD Tổng quan

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                        AIMAP DATABASE SCHEMA                                │
│                                           (32 Tables)                                       │
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
       │ 1:N
       ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              CORE TABLES (Business Logic)                                   │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   BRANDS    │       │  CAMPAIGNS   │       │CAMPAIGN_IDEAS│
├──────────────┤       ├──────────────┤       ├──────────────┤
│ PK id       │       │ PK id        │       │ PK id        │
│ FK user_id───┼───────│ FK user_id   │       │ FK user_id   │
│ FK brand_id─┼──┐    │ FK brand_id  │       │ FK brand_id  │
│    name     │  │    │    name     │       │    content   │
│    colors   │  │    │    status  │       └──────────────┘
│    audience │  │    │    deadline│
└─────────────┘  │    └──────┬──────┘
                 │           │
       ┌─────────┴───────────┘
       │
       ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐       ┌──────────────────┐
│CONTENT_ITEMS │       │  WORKFLOW_   │       │   INSIGHT    │       │    INSIGHT       │
│              │       │    JOBS      │       │   _CHATS     │       │   _REPORT_       │
├──────────────┤       ├──────────────┤       ├──────────────┤       │     RUNS         │
│ PK id        │       │ PK id        │       │ PK id        │       ├──────────────────┤
│ FK campaign  │       │ FK user_id   │       │ PK id        │       │ PK id            │
│ FK agent_run │       │ FK campaign  │       │ FK user_id   │       │ FK user_id       │
│    channel  │       │    status    │       │ FK data_src  │       └────────┬─────────┘
│    content   │       └──────────────┘       └───────┬──────┘                │
│    status   │                                     │                        │
└──────────────┘                                     ▼                        │
       │                          ┌─────────────────────────────┐              │
       ▼                          │  INSIGHT_DATA_SOURCES      │              │
┌──────────────────┐              ├─────────────────────────────┤              │
│    INSIGHT       │              │ PK id                      │              │
│    _CARDS        │              │ FK user_id                 │◄─────────────┘
├──────────────────┤              └─────────────────────────────┘
│ PK id            │
│ FK user_id       │
│ FK insight_card  │◄──────────────────────┐
└──────────────────┘                      │
       │                                   │
       ▼                                   ▼
┌─────────────────────────────────────────────────────────┐
│                    INSIGHT SUB-TABLES                     │
├─────────────────────────────────────────────────────────┤
│ insight_agent_traces     │ insight_result_snapshots     │
│ insight_report_schema_maps│ insight_raw_snapshots        │
│ insight_metrics_daily     │ insight_actions              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              CUSTOMER TABLES                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐       ┌──────────────────────┐       ┌──────────────────┐
│ CUSTOMER_LISTS   │       │     CUSTOMERS        │       │  FILE_UPLOADS    │
├──────────────────┤       ├──────────────────────┤       ├──────────────────┤
│ PK id            │◄──N:1─│ PK id                │       │ PK id            │
│ FK user_id       │       │ FK customer_list_id───┼───1:N─│ FK user_id       │
│ FK file_upload   │       │    email             │       │    filename      │
│    list_name     │       │    name             │       │    path          │
│    status        │       │    phone            │       └──────────────────┘
└──────────────────┘       └──────────────────────┘
                                   │
                                   ▼
                         ┌──────────────────────┐
                         │CUSTOMER_ANALYSIS_   │
                         │    SNAPSHOTS        │
                         ├──────────────────────┤
                         │ PK id                │
                         │ FK customer_list_id   │
                         └──────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              TRACKING & LOGS                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐       ┌──────────────────────┐       ┌──────────────────┐
│AGENT_RUN_LOGS    │       │CAMPAIGN_EXECUTION_   │       │CAMPAIGN_TRACKING_│
│                  │       │      LOGS            │       │      LINKS       │
├──────────────────┤       ├──────────────────────┤       ├──────────────────┤
│ PK id            │       │ PK id                │       │ PK id            │
│ FK campaign_id   │       │ FK campaign_id       │       │ FK campaign_id   │
│    agent_name   │       │ FK customer_id       │       │    short_code   │
│    status       │       │    channel          │       │    click_count  │
│    tokens       │       │    status           │       └──────────────────┘
└──────────────────┘       └──────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              SYSTEM TABLES                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐       ┌──────────────────────┐       ┌──────────────────┐
│ AI_USAGE_STATS   │       │    NOTIFICATIONS    │       │  CAMPAIGN_      │
│                  │       │                      │       │    TAGS          │
├──────────────────┤       ├──────────────────────┤       ├──────────────────┤
│ PK id            │       │ PK id                │       │ PK id            │
│ FK user_id       │       │ FK user_id           │       │ FK user_id       │
│    model_stats  │       │    message           │       │    name         │
└──────────────────┘       │    is_read          │       │    color        │
                           └──────────────────────┘       └──────────────────┘
```

---

## 2. Danh sách bảng

### Core Tables (Bắt buộc)

| # | Bảng | Rows | Mô tả |
|---|------|------|-------|
| 1 | `users` | 11 | Tài khoản người dùng |
| 2 | `brands` | 5 | Thông tin thương hiệu |
| 3 | `campaigns` | 15 | Chiến dịch marketing |
| 4 | `content_items` | 27 | Nội dung (email, post, video) |
| 5 | `campaign_ideas` | 7 | Ý tưởng từ AI |
| 6 | `campaign_tags` | 3 | Tags phân loại |
| 7 | `customers` | 60 | Danh sách khách hàng |
| 8 | `customer_lists` | 3 | Nhóm khách hàng |

### AI & Insights Tables

| # | Bảng | Rows | Mô tả |
|---|------|------|-------|
| 9 | `agent_run_logs` | 129 | Log hoạt động AI |
| 10 | `insight_report_runs` | 12 | Báo cáo insight |
| 11 | `insight_result_snapshots` | 12 | Kết quả insight |
| 12 | `insight_report_schema_maps` | 27 | Schema mapping |
| 13 | `insight_agent_traces` | 80 | Trace AI |
| 14 | `insight_data_sources` | 1 | Nguồn dữ liệu |
| 15 | `insight_cards` | 2 | Cards hiển thị |
| 16 | `insight_actions` | 2 | Actions đề xuất |
| 17 | `insight_metrics_daily` | 1 | Metrics hàng ngày |
| 18 | `insight_raw_snapshots` | 1 | Raw data |
| 19 | `insight_chats` | 0 | Chat AI |
| 20 | `insight_chat_messages` | 0 | Messages chat |

### Workflow & Tracking Tables

| # | Bảng | Rows | Mô tả |
|---|------|------|-------|
| 21 | `workflow_jobs` | 4 | Job workflow |
| 22 | `campaign_execution_logs` | 40 | Log thực thi |
| 23 | `campaign_tracking_links` | 0 | Tracking links |
| 24 | `campaign_revenue` | 0 | Revenue tracking |

### System Tables

| # | Bảng | Rows | Mô tả |
|---|------|------|-------|
| 25 | `notifications` | 2 | Thông báo |
| 26 | `notification_settings` | 1 | Cài đặt thông báo |
| 27 | `ai_usage_stats` | 2 | Stats AI usage |
| 28 | `content_analytics` | 2 | Analytics content |

### Reference Tables

| # | Bảng | Rows | Mô tả |
|---|------|------|-------|
| 29 | `file_uploads` | 0 | Upload files |
| 30 | `brand_assets` | 0 | Brand assets |
| 31 | `customer_analysis_snapshots` | 3 | Customer snapshots |

---

## 3. Chi tiết từng bảng

### 3.1 Users

```sql
users {
    id              UUID PK
    email           VARCHAR(255) UNIQUE NOT NULL
    hashed_pw       VARCHAR(255) NOT NULL
    full_name       VARCHAR(255)
    role            VARCHAR(20) DEFAULT 'user'
    is_active       BOOLEAN DEFAULT true
    email_reminder_enabled BOOLEAN DEFAULT true
    created_at      TIMESTAMPTZ
    updated_at      TIMESTAMPTZ
}
```

### 3.2 Brands

```sql
brands {
    id              UUID PK
    user_id         UUID FK -> users.id
    brand_name      VARCHAR(255) NOT NULL
    tagline         VARCHAR(500)
    brand_description TEXT
    tone_of_voice   VARCHAR(50)
    logo_url        VARCHAR(500)
    primary_color   VARCHAR(20)
    target_audience TEXT
    key_products    TEXT[]
    forbidden_words TEXT[]
    preferred_cta   VARCHAR(255)
    preferred_salutation VARCHAR(100)
    sample_post     TEXT
    contact_email   VARCHAR(255)
    phone           VARCHAR(50)
    address         TEXT
    created_at      TIMESTAMPTZ
    updated_at      TIMESTAMPTZ
}
```

### 3.3 Campaigns

```sql
campaigns {
    id              UUID PK
    user_id         UUID FK -> users.id
    brand_id        UUID FK -> brands.id
    campaign_name   VARCHAR(255) NOT NULL
    objective       TEXT NOT NULL
    product_or_service TEXT NOT NULL
    target_audience TEXT
    offer_or_hook   TEXT
    deadline        DATE NOT NULL
    channels        TEXT[] NOT NULL
    additional_notes TEXT
    status          VARCHAR(30) DEFAULT 'pending_agent'
    error_message   TEXT
    campaign_plan_json JSONB
    cost            NUMERIC(15,2) DEFAULT 0
    created_at      TIMESTAMPTZ
    updated_at      TIMESTAMPTZ
}
```

### 3.4 Content Items

```sql
content_items {
    id              UUID PK
    campaign_id     UUID FK -> campaigns.id
    channel         VARCHAR(50)  -- email, facebook_post, video_script
    version         INT DEFAULT 1
    status          VARCHAR(30)  -- draft, pending_approval, approved, rejected
    content_json    JSONB  -- {subject, body, copy, hashtags, hook, cta}
    scheduled_date  DATE
    agent_run_id    UUID FK -> agent_run_logs.id
    created_at      TIMESTAMPTZ
    updated_at      TIMESTAMPTZ
}
```

### 3.5 Customers

```sql
customers {
    id              UUID PK
    user_id         UUID FK -> users.id
    customer_list_id UUID FK -> customer_lists.id
    email           VARCHAR(255)
    full_name       VARCHAR(255)
    phone           VARCHAR(50)
    company         VARCHAR(255)
    position        VARCHAR(255)
    tags            TEXT[]
    notes           TEXT
    metadata        JSONB
    created_at      TIMESTAMPTZ
    updated_at      TIMESTAMPTZ
}
```

### 3.6 Agent Run Logs

```sql
agent_run_logs {
    id              UUID PK
    campaign_id     UUID FK -> campaigns.id
    agent_name      VARCHAR(50)  -- strategist, writer, critic, scheduler
    step_order      INT
    channel         VARCHAR(50)
    model_used      VARCHAR(100)
    model_provider  VARCHAR(50)
    prompt_preview  TEXT
    output_preview  TEXT
    input_tokens    INT
    output_tokens   INT
    duration_ms     INT
    status          VARCHAR(20)
    error_detail    TEXT
    created_at      TIMESTAMPTZ
}
```

### 3.7 Insight Report Runs

```sql
insight_report_runs {
    id              UUID PK
    user_id         UUID FK -> users.id
    run_type        VARCHAR(50)
    status          VARCHAR(20)
    query           TEXT
    result_summary  TEXT
    error_message   TEXT
    started_at      TIMESTAMPTZ
    completed_at    TIMESTAMPTZ
    created_at      TIMESTAMPTZ
}
```

### 3.8 Workflow Jobs

```sql
workflow_jobs {
    id              UUID PK
    user_id         UUID FK -> users.id
    trigger_type    VARCHAR(50)
    trigger_payload JSONB
    campaign_id     UUID FK -> campaigns.id
    status          VARCHAR(20) DEFAULT 'queued'
    error_message   TEXT
    created_at      TIMESTAMPTZ
    updated_at      TIMESTAMPTZ
}
```

---

## 4. Queries hữu ích

### 4.1 Đếm rows tất cả bảng

```sql
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.tables t 
     WHERE t.table_name = c.table_name) as count
FROM information_schema.tables c
WHERE table_schema = 'public'
ORDER BY table_name;
```

### 4.2 Xem tất cả FK relationships

```sql
SELECT 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;
```

### 4.3 Backup toàn bộ database

```sql
-- Chạy ngoài container:
-- pg_dump -h 103.116.38.96 -U thinh -d aimap -F c -b -v -f backup_aimap_$(date +%Y%m%d).dump
```

### 4.4 Restore database

```sql
-- pg_restore -h 103.116.38.96 -U thinh -d aimap -v backup_aimap_YYYYMMDD.dump
```

---

## 5. Database Migration Notes

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

**Cập nhật**: 2026-05-05
