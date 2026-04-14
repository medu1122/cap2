# F10 — Notifications & Customer Lists: Plan

**Feature ID**: F10 | **Sprint**: Sprint 3

---

## Mô tả

Hệ thống thông báo trong ứng dụng (in-app) giúp user nhận biết các sự kiện quan trọng mà không cần kiểm tra thủ công. Kết hợp với quản lý danh sách khách hàng đã upload.

---

## User Stories

| ID | Story | Points | Priority |
|---|---|---|---|
| US-42 | Nhận in-app notification khi campaign xong | 3 | S |
| US-43 | Unread notification count trên bell icon | 2 | S |
| US-44 | Mark notification as read | 1 | S |
| US-45 | Cấu hình loại notification muốn nhận | 2 | C |
| US-46 | Xem danh sách customer lists | 2 | S |
| US-47 | Xem customers trong 1 list | 1 | S |

---

## Data Model

### `notifications`

```
id UUID PK | user_id UUID FK → users
type VARCHAR     -- 'campaign_complete' | 'content_pending' | 'workflow_done'
title VARCHAR NOT NULL | body TEXT NOT NULL
payload JSONB    -- {campaign_id, content_count, ...}
is_read BOOLEAN DEFAULT FALSE | read_at TIMESTAMPTZ
created_at TIMESTAMPTZ
```

### `notification_settings`

```
id UUID PK | user_id UUID FK → users (UNIQUE)
campaign_completed BOOLEAN DEFAULT TRUE
content_pending BOOLEAN DEFAULT TRUE
workflow_triggered BOOLEAN DEFAULT TRUE
weekly_summary BOOLEAN DEFAULT TRUE
```

### `customer_lists` + `customers` (xem F09)

---

## Notification Types

| Type | When | Payload |
|---|---|---|
| `campaign_complete` | Campaign status → pending_approval | {campaign_id, content_count} |
| `content_pending` | Số pending items > 0 | {pending_count} |
| `workflow_done` | Workflow job completed | {job_id, campaign_id} |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/notifications` | List notifications (latest 20) |
| GET | `/notifications/unread-count` | Số chưa đọc |
| PATCH | `/notifications/{id}/read` | Mark as read |
| PATCH | `/notifications/read-all` | Mark all as read |
| GET | `/notification-settings` | Lấy settings |
| PUT | `/notification-settings` | Cập nhật settings |
| GET | `/customer-lists` | List customer lists |
| GET | `/customer-lists/{id}/customers` | Customers paginated |

---

## UI

**Bell icon** trong top navigation bar:
- Badge với unread count (đỏ)
- Click → dropdown (tối đa 5 notifications gần nhất)
- "Xem tất cả" link → /notifications page

**`/(app)/notifications`:**
- Full list với pagination
- Mỗi item: icon theo type, title, body, time ago
- Mark as read khi click

---

## Dependencies

- Depends on: F01 (Auth), F03-F04 (để tạo notifications)
