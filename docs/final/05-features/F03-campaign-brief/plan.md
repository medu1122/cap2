# F03 — Campaign Brief Intake: Plan

**Feature ID**: F03 | **Epic**: Campaign Management | **Sprint**: Sprint 2

---

## Mô tả

Form nhập liệu cho phép user mô tả mục tiêu marketing bằng ngôn ngữ tự nhiên. Sau khi submit, hệ thống tạo Campaign record và dispatch AI orchestration job.

---

## User Stories

| ID | Story | Acceptance Criteria | Points | Priority |
|---|---|---|---|---|
| US-14 | As an owner, I want to create a campaign brief | Required fields validated, campaign created, AI starts running | 5 | M |
| US-15 | As an owner, I want to select content channels | channels array lưu đúng, AI chỉ tạo content cho channels đã chọn | 2 | M |
| US-16 | As an owner, I want to set a campaign deadline | deadline trong tương lai, content scheduled_date = deadline | 2 | M |
| US-17 | As an owner, I want to save a brief as template | content_template record được tạo với brief fields | 2 | S |
| US-18 | As an owner, I want to create from template | Form tự điền từ template khi chọn | 2 | C |

---

## Data Model

### Bảng `campaigns`

```
id UUID PK
user_id UUID FK → users (CASCADE)
campaign_name VARCHAR(255) NOT NULL
objective TEXT NOT NULL
product_or_service TEXT NOT NULL
target_audience TEXT
offer_or_hook TEXT
deadline DATE NOT NULL
channels TEXT[] NOT NULL   -- ['facebook_post', 'email', 'video_script']
additional_notes TEXT
status VARCHAR(30) NOT NULL DEFAULT 'pending_agent'
  -- pending_agent | running | pending_approval | approved | partially_approved | failed
error_message TEXT
campaign_plan_json JSONB    -- Strategist output
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### Status State Machine

```
pending_agent → running → pending_approval → approved
                       ↘ failed            ↘ partially_approved
```

---

## API Endpoints

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/campaigns` | Tạo campaign mới + dispatch AI | Yes |
| GET | `/campaigns` | Danh sách campaigns của user | Yes |
| GET | `/campaigns/{id}` | Chi tiết campaign + content + logs | Yes |
| DELETE | `/campaigns/{id}` | Xóa campaign | Yes |

---

## UI Screens

**`/(app)/campaigns/new`** — Form tạo campaign:
- campaign_name (text input)
- objective (textarea — mô tả mục tiêu)
- product_or_service (text/textarea)
- target_audience (text — optional, override brand vault)
- offer_or_hook (text — ưu đãi, hook thu hút)
- deadline (date picker — must be future date)
- channels (checkbox group: Facebook Post, Email, Video Script)
- additional_notes (textarea optional)
- Submit button: "Tạo Campaign & Chạy AI"

**`/(app)/campaigns`** — Campaign list:
- Table/cards: campaign_name, status badge, channels, deadline, content count
- Filter by status
- "Tạo chiến dịch mới" button

---

## Validation Rules

| Field | Rule |
|---|---|
| campaign_name | Required, 1-255 chars |
| objective | Required, min 10 chars |
| product_or_service | Required, min 5 chars |
| deadline | Required, must be >= today |
| channels | Required, at least 1 channel selected |

---

## Dependencies

- Depends on: F01 (Auth), F02 (Brand Vault — soft dependency, warning only)
- Triggers: F04 (Agent Orchestrator)
- Required by: F05 (Content), F06 (Approval), F07 (Calendar)
