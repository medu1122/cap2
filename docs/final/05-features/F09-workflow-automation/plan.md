# F09 — Workflow Automation: Plan

**Feature ID**: F09 | **Sprint**: Sprint 3

---

## Mô tả

Hệ thống tự động hóa event-driven — tự khởi tạo campaign drafting khi đến thời điểm lịch hoặc khi user upload danh sách khách hàng.

---

## User Stories

| ID | Story | Points | Priority |
|---|---|---|---|
| US-38 | Tạo recurring schedule → tự tạo campaign mỗi tuần | 8 | S |
| US-39 | Upload CSV → auto email campaign | 8 | S |
| US-40 | Xem workflow history | 2 | S |
| US-41 | Enable/disable schedule | 3 | S |

---

## Data Model

### `workflow_schedules` — Cấu hình lịch

```
id UUID PK | user_id UUID FK → users
schedule_name VARCHAR | trigger_type VARCHAR
cron_expression VARCHAR    -- '0 8 * * 1' = thứ Hai 8am
is_active BOOLEAN | default_brief_template JSONB
last_run_at TIMESTAMPTZ | next_run_at TIMESTAMPTZ
```

### `workflow_jobs` — Instance của mỗi lần chạy

```
id UUID PK | user_id UUID FK → users
trigger_type VARCHAR      -- 'schedule_trigger' | 'upload_trigger' | 'manual'
trigger_payload JSONB    -- context (schedule_id, file_id...)
campaign_id UUID FK → campaigns (nullable — khi campaign đã tạo)
schedule_id UUID FK → workflow_schedules (nullable)
status VARCHAR           -- 'queued' | 'running' | 'completed' | 'failed'
error_message TEXT
```

---

## Trigger Types

### 1. Schedule Trigger (Cron-based)
- User tạo schedule với cron expression
- Cron job quét `workflow_schedules` mỗi 5 phút
- Khi `next_run_at <= NOW()` và `is_active=TRUE`: tạo workflow_job + campaign
- Cập nhật `next_run_at` cho lần tiếp theo

### 2. Upload Trigger (CSV)
- User upload file CSV danh sách khách hàng
- Hệ thống parse CSV → tạo `customer_list` + `customers`
- Tự tạo email campaign với brief mặc định
- Chạy orchestrator tự động

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/workflow/schedules` | List schedules |
| POST | `/workflow/schedules` | Tạo schedule mới |
| PATCH | `/workflow/schedules/{id}` | Enable/disable schedule |
| DELETE | `/workflow/schedules/{id}` | Xóa schedule |
| GET | `/workflow/jobs` | Workflow job history |
| POST | `/files/upload` | Upload file CSV (customer list cho workflow trigger) |
| GET | `/customer-lists` | Danh sách customer lists |
| GET | `/customer-lists/{id}/customers` | Customers trong list |

---

## Dependencies

- Depends on: F01 (Auth), F03 (Campaign Brief), F04 (Agent)
