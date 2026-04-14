# F04 — Multi-Agent Orchestrator: Plan

**Feature ID**: F04 | **Epic**: AI Agent Pipeline | **Sprint**: Sprint 2

---

## Mô tả

Tính năng trung tâm của AIMAP. Pipeline 3 AI agents chạy nối tiếp nhau để tạo nội dung marketing chất lượng: Strategist Agent (lên kế hoạch), Writer Agent (viết nội dung), Critic Agent (kiểm duyệt).

---

## User Stories

| ID | Story | Acceptance Criteria | Points | Priority |
|---|---|---|---|---|
| US-19 | AI Strategist phân tích brief | campaign_plan_json có summary, key_messages, deliverables[] | 8 | M |
| US-20 | AI Writer viết content per channel | content_json đúng schema cho từng kênh | 8 | M |
| US-21 | AI Critic review và revise content | issues_found list, revised content nếu cần | 5 | M |
| US-22 | Xem agent log timeline | Timeline hiển thị đúng 3+ steps với metrics | 3 | M |
| US-23 | Thông báo khi content sẵn sàng | Notification tạo khi status→pending_approval | 2 | S |

---

## Agent Pipeline

### Agent 1: Strategist

- **Input**: Campaign brief + brand context
- **Model**: OpenAI GPT-4o-mini (reasoning)
- **Output**: `CampaignPlan` JSON
  ```json
  {
    "campaign_summary": "2-3 câu tóm tắt chiến lược",
    "key_messages": ["message 1", "message 2", "message 3"],
    "deliverables": [
      {"channel": "facebook_post", "content_goal": "...", "tone_hint": "...", "cta": "..."},
      {"channel": "email", "content_goal": "...", "tone_hint": "...", "cta": "..."}
    ]
  }
  ```

### Agent 2: Writer (chạy 1 lần per channel)

- **Input**: Deliverable spec + brand context + campaign_summary + key_messages
- **Model**: Qwen 2.5 7B VPS (cost-efficient)
- **Output** theo kênh:
  - facebook_post: `{"copy": "...", "hashtags": ["...", "..."]}`
  - email: `{"subject": "...", "body": "..."}`
  - video_script: `{"hook": "...", "body": "...", "cta": "...", "duration_estimate": "30s"}`

### Agent 3: Critic (chạy 1 lần per channel)

- **Input**: Draft content + deliverable spec + brand context + key_messages
- **Model**: OpenAI GPT-4o-mini (quality gate)
- **Output**:
  ```json
  {
    "status": "approved" | "revised",
    "issues_found": ["Issue 1: CTA thiếu", "Issue 2: Dùng từ cấm 'rẻ'"],
    "final_content": { /* same structure as Writer output */ }
  }
  ```

### Hybrid LLM Routing

| Task | Primary Model | Fallback | Reason |
|---|---|---|---|
| Strategist | OpenAI GPT-4o-mini | Qwen 2.5 7B | Reasoning mạnh |
| Writer | Qwen 2.5 7B | OpenAI GPT-4o-mini | Cost-efficient, adequate quality |
| Critic | OpenAI GPT-4o-mini | Qwen 2.5 7B | Quality judgment |
| Dashboard Summary | Qwen 2.5 7B | OpenAI GPT-4o-mini | Short text, low cost |

**Fallback condition**: VPS response timeout > 15 seconds

---

## Data Model

### Bảng `agent_run_logs`

```
id UUID PK
campaign_id UUID FK → campaigns (CASCADE)
agent_name VARCHAR(50)    -- 'strategist' | 'writer' | 'critic'
step_order INTEGER        -- 1, 2, 3, ...
channel VARCHAR(30)       -- null cho strategist
model_used VARCHAR(100)   -- 'gpt-4o-mini' | 'qwen2.5:7b'
model_provider VARCHAR(20) -- 'openai' | 'qwen'
prompt_preview TEXT       -- 300 ký tự đầu của prompt
output_preview TEXT       -- 300 ký tự đầu của output
input_tokens INTEGER
output_tokens INTEGER
duration_ms INTEGER
status VARCHAR(20)        -- 'success' | 'error'
error_detail TEXT
created_at TIMESTAMPTZ
```

### Bảng `ai_usage_stats` (aggregate)

```
user_id UUID FK → users (UNIQUE per user/month/model)
year INTEGER | month INTEGER
model_provider VARCHAR | model_name VARCHAR
total_input_tokens INTEGER | total_output_tokens INTEGER
total_requests INTEGER | failed_requests INTEGER
```

---

## Internal API Endpoints (Agent → API)

| Method | Path | Description |
|---|---|---|
| GET | `/internal/campaigns/{id}/detail` | Lấy brief + brand cho agent |
| PATCH | `/internal/campaigns/{id}` | Cập nhật campaign status |
| POST | `/internal/agent-logs` | Lưu agent run log |
| POST | `/internal/content` | Lưu content item |

---

## UI: Agent Log Timeline

**Vị trí**: Campaign Detail page, panel bên phải

**Mỗi log entry hiển thị:**
- Agent icon (robot icon theo loại: Strategist/Writer/Critic)
- `agent_name` + `channel` (nếu có)
- `model_used` badge
- `duration_ms` + `input_tokens` + `output_tokens`
- Expandable: `prompt_preview` và `output_preview`
- Timestamp

---

## Dependencies

- Depends on: F01 (Auth), F02 (Brand Vault), F03 (Campaign Brief)
- Required by: F05 (Content), F07 (Calendar)
