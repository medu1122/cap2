# F05 — Content Storage & Versioning: Plan

**Feature ID**: F05 | **Sprint**: Sprint 2

---

## Mô tả

Lưu trữ nội dung AI tạo ra với lịch sử phiên bản đầy đủ. Mỗi lần AI tạo hoặc user chỉnh sửa nội dung đều tạo ra version mới, đảm bảo không mất dữ liệu và có thể rollback.

---

## User Stories

| ID | Story | Points | Priority |
|---|---|---|---|
| US-24 | Content có version history (AI=v1, user edit=v2) | 5 | M |
| US-25 | Xem tất cả versions của 1 content item | 3 | S |
| US-26 | Filter content theo channel | 2 | M |

---

## Data Model

### Bảng `content_items`

```
id UUID PK
campaign_id UUID FK → campaigns (CASCADE)
channel VARCHAR(30)        -- 'facebook_post' | 'email' | 'video_script'
version INTEGER DEFAULT 1  -- tăng mỗi lần edit
status VARCHAR(30)         -- 'draft' | 'pending_approval' | 'approved' | 'rejected'
content_json JSONB NOT NULL  -- cấu trúc theo kênh
source VARCHAR(20)         -- 'agent' | 'user_edit'
agent_run_id UUID FK → agent_run_logs (nullable)
rejection_note TEXT
scheduled_date DATE
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### JSONB Schemas per Channel

**facebook_post:**
```json
{"copy": "text content", "hashtags": ["tag1", "tag2"]}
```

**email:**
```json
{"subject": "Email subject line", "body": "Full email body text"}
```

**video_script:**
```json
{"hook": "Opening hook", "body": "Main script", "cta": "Call to action", "duration_estimate": "30s"}
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/content` | List content items (filter: status, channel) |
| GET | `/content/{id}` | Chi tiết 1 content item |
| PUT | `/content/{id}` | Edit content → tạo version mới |
| GET | `/content/{id}/versions` | Tất cả versions |

---

## Versioning Logic

```
AI creates version 1:        campaign_id=X, channel=facebook_post, version=1, source='agent'
User edits → version 2:      campaign_id=X, channel=facebook_post, version=2, source='user_edit'
User edits again → version 3: campaign_id=X, channel=facebook_post, version=3, source='user_edit'

"Current" version = MAX(version) cho mỗi (campaign_id, channel) pair
```

---

## Dependencies

- Depends on: F03 (Campaign), F04 (Agent Orchestrator)
- Required by: F06 (Approval), F07 (Calendar)
