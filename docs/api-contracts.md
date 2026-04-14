# API Contracts — AIMAP

Base URL: `http://localhost:8000`
All requests require `Authorization: Bearer <token>` unless noted.
All responses are JSON. Timestamps are ISO 8601 UTC.

---

## Auth

### POST `/auth/register`
No auth required.

**Request**
```json
{
  "email": "owner@shop.com",
  "password": "password123",
  "full_name": "Nguyen Van A"
}
```

**Response 201**
```json
{
  "id": "uuid",
  "email": "owner@shop.com",
  "full_name": "Nguyen Van A",
  "role": "owner"
}
```

**Errors**: `400 Email already exists`

---

### POST `/auth/login`
No auth required.

**Request**
```json
{
  "email": "owner@shop.com",
  "password": "password123"
}
```

**Response 200**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "owner@shop.com",
    "full_name": "Nguyen Van A",
    "role": "owner"
  }
}
```

**Errors**: `401 Invalid credentials`

---

### GET `/auth/me`

**Response 200**
```json
{
  "id": "uuid",
  "email": "owner@shop.com",
  "full_name": "Nguyen Van A",
  "role": "owner",
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

## Brand Vault

### GET `/brands/me`

**Response 200**
```json
{
  "id": "uuid",
  "brand_name": "Cafe Bờ Hồ",
  "tagline": "Ngụm cà phê, ngàn ký ức",
  "brand_description": "Quán cà phê nhỏ ở trung tâm TP.HCM...",
  "tone_of_voice": "warm",
  "logo_url": "https://...",
  "primary_color": "#7B5B3A",
  "target_audience": "Học sinh, sinh viên 18-25 tuổi",
  "key_products": ["Cà phê sữa đá", "Bạc xỉu", "Trà đào"],
  "forbidden_words": ["rẻ", "bình dân"],
  "preferred_cta": "Ghé thăm ngay",
  "preferred_salutation": "bạn",
  "sample_post": "Mùa mưa về, một ly bạc xỉu nóng...",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

**Response 404** — if no brand configured yet.

---

### PUT `/brands/me`
Creates or updates the brand vault.

**Request** — same shape as GET response (all fields optional except `brand_name`, `brand_description`, `tone_of_voice`, `target_audience`):
```json
{
  "brand_name": "Cafe Bờ Hồ",
  "brand_description": "...",
  "tone_of_voice": "warm",
  "target_audience": "...",
  "key_products": ["Cà phê sữa đá"],
  "forbidden_words": [],
  "preferred_cta": "Ghé thăm ngay",
  "preferred_salutation": "bạn"
}
```

**Response 200** — updated brand object.

---

## Campaigns

### GET `/campaigns`

**Query params**: `status`, `page` (default 1), `limit` (default 20)

**Response 200**
```json
{
  "items": [
    {
      "id": "uuid",
      "campaign_name": "Ra mắt cà phê mới",
      "objective": "Tăng nhận diện sản phẩm mới",
      "status": "pending_approval",
      "channels": ["facebook_post", "email"],
      "deadline": "2024-07-20",
      "created_at": "2024-07-10T08:00:00Z",
      "content_count": 2,
      "pending_count": 2
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 20
}
```

---

### POST `/campaigns`
Create a campaign brief.

**Request**
```json
{
  "campaign_name": "Ra mắt cà phê mới",
  "objective": "Giới thiệu sản phẩm cà phê trứng mới ra lò",
  "product_or_service": "Cà phê trứng truyền thống",
  "target_audience": "Dân văn phòng 25-35",
  "offer_or_hook": "Mua 1 tặng 1 trong tuần đầu",
  "deadline": "2024-07-20",
  "channels": ["facebook_post", "email", "video_script"],
  "additional_notes": "Nhấn mạnh nguyên liệu sạch"
}
```

**Response 201**
```json
{
  "id": "uuid",
  "campaign_name": "Ra mắt cà phê mới",
  "status": "pending_agent",
  "created_at": "2024-07-10T08:00:00Z"
}
```

---

### GET `/campaigns/{id}`

**Response 200**
```json
{
  "id": "uuid",
  "campaign_name": "Ra mắt cà phê mới",
  "objective": "...",
  "product_or_service": "...",
  "target_audience": "...",
  "offer_or_hook": "...",
  "deadline": "2024-07-20",
  "channels": ["facebook_post", "email", "video_script"],
  "additional_notes": "...",
  "status": "pending_approval",
  "campaign_plan_json": {
    "campaign_summary": "...",
    "key_messages": ["msg1", "msg2", "msg3"],
    "deliverables": [...]
  },
  "content_items": [
    {
      "id": "uuid",
      "channel": "facebook_post",
      "version": 2,
      "status": "pending_approval",
      "content_json": { "copy": "...", "hashtags": ["#cafe"] },
      "scheduled_date": "2024-07-20"
    }
  ],
  "agent_logs": [
    {
      "id": "uuid",
      "agent_name": "strategist",
      "step_order": 1,
      "model_used": "gpt-4o-mini",
      "model_provider": "openai",
      "duration_ms": 2340,
      "input_tokens": 412,
      "output_tokens": 280,
      "status": "success",
      "created_at": "2024-07-10T08:00:12Z"
    }
  ],
  "created_at": "2024-07-10T08:00:00Z"
}
```

---

### POST `/campaigns/{id}/run`
Trigger the AI orchestration for a campaign (idempotent — will re-run if status is `failed` or `pending_agent`).

**Response 202**
```json
{
  "message": "Orchestration started",
  "campaign_id": "uuid",
  "status": "running"
}
```

**Errors**: `409 Campaign is already running`, `400 Brand Vault not configured`

---

### DELETE `/campaigns/{id}`

**Response 204** — no body.

---

## Content Items

### GET `/content`

**Query params**: `campaign_id`, `channel`, `status`, `page`, `limit`

**Response 200**
```json
{
  "items": [
    {
      "id": "uuid",
      "campaign_id": "uuid",
      "campaign_name": "Ra mắt cà phê mới",
      "channel": "email",
      "version": 1,
      "status": "pending_approval",
      "content_json": {
        "subject": "Chào mừng cà phê trứng!",
        "body": "Kính gửi bạn,\n\n..."
      },
      "scheduled_date": "2024-07-20",
      "created_at": "2024-07-10T08:05:00Z"
    }
  ],
  "total": 8
}
```

---

### GET `/content/{id}`
Full detail of a single content item.

---

### PATCH `/content/{id}`
Update content (manual edit or reschedule).

**Request** (all fields optional):
```json
{
  "content_json": { "subject": "...", "body": "..." },
  "scheduled_date": "2024-07-22"
}
```

**Response 200** — updated content item.

---

### PATCH `/content/{id}/approve`

**Response 200**
```json
{
  "id": "uuid",
  "status": "approved"
}
```

---

### PATCH `/content/{id}/reject`

**Request**
```json
{
  "rejection_note": "Tone quá trang trọng, viết vui hơn"
}
```

**Response 200**
```json
{
  "id": "uuid",
  "status": "rejected",
  "rejection_note": "..."
}
```

---

## Calendar

### GET `/calendar`

**Query params**: `month` (format `YYYY-MM`, required)

**Response 200**
```json
{
  "month": "2024-07",
  "items": [
    {
      "id": "uuid",
      "campaign_id": "uuid",
      "campaign_name": "Ra mắt cà phê mới",
      "channel": "facebook_post",
      "status": "approved",
      "scheduled_date": "2024-07-20",
      "content_preview": "Xin chào cà phê trứng..."
    }
  ]
}
```

---

### PATCH `/content/{id}/schedule`
Assign or change the calendar date for a content item.

**Request**
```json
{
  "scheduled_date": "2024-07-25"
}
```

**Response 200** — updated content item.

---

## Dashboard

### GET `/dashboard/stats`

**Response 200**
```json
{
  "total_campaigns": 5,
  "total_content_items": 14,
  "pending_approvals": 3,
  "approved_items": 9,
  "content_by_channel": {
    "facebook_post": 6,
    "email": 5,
    "video_script": 3
  },
  "recent_campaigns": [
    {
      "id": "uuid",
      "campaign_name": "...",
      "status": "approved",
      "created_at": "..."
    }
  ]
}
```

---

### GET `/dashboard/summary`
AI-generated text summary of the user's recent activity.

**Response 200**
```json
{
  "summary": "Tuần này bạn đã tạo 2 chiến dịch mới và duyệt 5 nội dung. Nội dung Facebook đang được tạo nhiều nhất. Hãy kiểm tra 3 nội dung đang chờ duyệt nhé.",
  "generated_at": "2024-07-10T09:00:00Z"
}
```

---

## Workflow Automation

### POST `/workflow/trigger`
Manually trigger a workflow (for testing or on-demand scheduling).

**Request**
```json
{
  "trigger_type": "schedule_trigger"
}
```

**Response 202**
```json
{
  "job_id": "uuid",
  "status": "queued"
}
```

---

### GET `/workflow/jobs`

**Response 200**
```json
{
  "items": [
    {
      "id": "uuid",
      "trigger_type": "schedule_trigger",
      "campaign_id": "uuid",
      "status": "completed",
      "created_at": "2024-07-10T08:00:00Z"
    }
  ]
}
```

---

## Internal (Agent Service → FastAPI)

These routes are called by the agent service only, not exposed to the browser.

### PATCH `/internal/campaigns/{id}`
Update campaign status and plan from agent service.

**Request**
```json
{
  "status": "pending_approval",
  "campaign_plan_json": { ... }
}
```

---

### POST `/internal/content`
Save a draft or final content item from agent.

**Request**
```json
{
  "campaign_id": "uuid",
  "channel": "facebook_post",
  "version": 1,
  "status": "pending_approval",
  "content_json": { ... },
  "agent_run_id": "uuid"
}
```

---

### POST `/internal/logs`
Append an agent run log entry.

**Request**
```json
{
  "campaign_id": "uuid",
  "agent_name": "strategist",
  "step_order": 1,
  "channel": null,
  "model_used": "gpt-4o-mini",
  "model_provider": "openai",
  "prompt_preview": "You are a marketing strategist...",
  "output_preview": "Campaign Summary: ...",
  "input_tokens": 412,
  "output_tokens": 280,
  "duration_ms": 2340,
  "status": "success"
}
```

---

## Error Response Format

All errors follow:
```json
{
  "detail": "Human-readable error message"
}
```

Common status codes:
| Code | Meaning |
|---|---|
| 400 | Bad request / validation error |
| 401 | Not authenticated |
| 403 | Forbidden (wrong user) |
| 404 | Resource not found |
| 409 | Conflict (duplicate / state conflict) |
| 422 | Unprocessable entity (Pydantic validation) |
| 500 | Internal server error |
