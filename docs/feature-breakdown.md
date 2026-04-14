# Feature Breakdown — AIMAP

Mỗi tính năng được đặc tả theo: **Input → Process → Output → State transitions → Edge cases**.

---

## F1 — Campaign Brief Intake

**Mô tả**: Form cho phép user mô tả mục tiêu chiến dịch.

**Input**
```
campaign_name       : string (required)
objective           : string — e.g. "Ra mắt cà phê mới", "Khuyến mãi cuối tuần"
product_or_service  : string (required)
target_audience     : string — e.g. "Học sinh sinh viên 18-24"
offer_or_hook       : string — e.g. "Giảm 20% cho ly đầu tiên"
deadline            : date (required)
channels            : array<"facebook_post" | "email" | "video_script"> (at least 1)
additional_notes    : string (optional)
```

**Process**
- Validate required fields.
- Create Campaign record with status `pending_agent`.
- Enqueue orchestration job.

**Output**
- Campaign record created in DB.
- User redirected to Campaign Detail page with status `Running...`

**State Transitions**
```
[form filled] → pending_agent → running → pending_approval → approved | partially_approved
```

**Edge Cases**
- If no brand vault configured: warn user and prompt to set up Brand Vault first (soft warning, not blocker).
- If deadline is in the past: reject with validation error.

---

## F2 — AI Multi-Agent Campaign Orchestrator

**Mô tả**: 3-agent pipeline chạy trong Python orchestration service.

### F2.1 — Strategist Agent

**Input**
```python
{
  "brief": <CampaignBrief>,
  "brand_vault": <BrandVaultContext>
}
```

**Process**
1. Build a structured prompt containing the brief and brand context.
2. Call LLM (OpenAI GPT-4o preferred for this step due to reasoning).
3. Parse LLM response into a `CampaignPlan` object:
   - `campaign_summary`: 2-3 sentence overview of the strategy.
   - `key_messages`: list of 3 key messages to convey.
   - `deliverables`: list of deliverable specs, one per requested channel.

**Output**
```python
{
  "campaign_summary": str,
  "key_messages": [str],
  "deliverables": [
    {
      "channel": "facebook_post" | "email" | "video_script",
      "content_goal": str,
      "tone_hint": str,
      "cta": str
    }
  ]
}
```

**Logged fields**: `agent`, `step`, `model_used`, `prompt_tokens`, `completion_tokens`, `duration_ms`, `output_summary`

---

### F2.2 — Writer Agent

**Input**
```python
{
  "deliverable": <DeliverableSpec>,
  "brand_vault": <BrandVaultContext>,
  "campaign_summary": str,
  "key_messages": [str]
}
```

**Process**
1. Build channel-specific prompt (facebook vs email vs video_script templates differ).
2. Call LLM (Qwen 2.5 7B on VPS preferred for cost efficiency).
3. Return raw draft content per channel format.

**Output per channel**
- `facebook_post`: `{ "copy": str, "hashtags": [str] }`
- `email`: `{ "subject": str, "body": str }`
- `video_script`: `{ "hook": str, "body": str, "cta": str, "duration_estimate": str }`

---

### F2.3 — Critic Agent

**Input**
```python
{
  "original_deliverable": <DeliverableSpec>,
  "draft_content": <WriterOutput>,
  "brand_vault": <BrandVaultContext>,
  "key_messages": [str]
}
```

**Process**
1. Build a review prompt listing the criteria: brand tone match, key message coverage, CTA presence, forbidden words, clarity.
2. Call LLM (OpenAI preferred for this quality gate).
3. If revision needed: produce a revised version + `issues_found` list.
4. If approved as-is: pass with `issues_found: []`.

**Output**
```python
{
  "status": "approved" | "revised",
  "issues_found": [str],
  "final_content": <same shape as WriterOutput>
}
```

---

### F2.4 — Orchestrator State Machine

```
START
  ├── load_brief()
  ├── load_brand_vault()
  ├── run_strategist()        → saves CampaignPlan
  ├── for each deliverable:
  │     ├── run_writer()      → saves DraftContent
  │     └── run_critic()      → saves FinalContent
  └── finalize()              → set campaign status = pending_approval
```

Each step appends an `AgentRunLog` record. On any exception: mark campaign `failed`, save error log.

---

## F3 — AI Brand Vault

**Mô tả**: Cấu hình thương hiệu dùng chung cho toàn bộ agent prompts.

**Fields**
```
brand_name          : string (required)
tagline             : string (optional)
brand_description   : string — what the business does, who it serves
tone_of_voice       : enum ["playful", "professional", "warm", "bold", "informative"]
logo_url            : string (optional)
primary_color       : hex string (optional, for UI display only)
target_audience     : string — describe the ideal customer
key_products        : list of strings
forbidden_words     : list of strings — words agents must never use
preferred_cta       : string — e.g. "Đặt ngay", "Nhắn tin cho chúng tôi"
preferred_salutation: string — e.g. "bạn", "quý khách"
sample_post         : string (optional) — a real post the owner likes, for style reference
```

**Validation**: `brand_name`, `brand_description`, `tone_of_voice`, `target_audience` are required before any campaign can be run.

**Prompt Injection**: Every agent prompt wraps brand vault in a `<brand_context>` block before task-specific instructions.

---

## F4 — Content Storage and Versioning

**Mô tả**: Lưu trữ từng `ContentItem` với full version history.

**ContentItem States**
```
draft → pending_approval → approved | rejected → (if rejected) → revised_draft → pending_approval
```

**Fields per ContentItem**
```
id, campaign_id, channel, version, status, content_json, agent_run_id, created_at, updated_at
```

**Versioning**: Each Critic revision creates a new version row. The latest approved version is the canonical one.

**Manual Edit**: User can edit the text of a content item inline. A manual edit creates a new version with `source: user_edit`.

---

## F5 — Approval Flow

**Mô tả**: Human-in-the-loop control gate before any content is considered ready.

**Approval Actions**
| Action | Transition | Notes |
|---|---|---|
| Approve | `pending_approval → approved` | Content appears on calendar as approved |
| Reject with note | `pending_approval → rejected` | User writes rejection reason; system can optionally re-trigger Writer for that item |
| Edit + Approve | `pending_approval → approved` | User edits inline, saves as new version, approves |

**Notification** (in-app only for MVP): When all items in a campaign reach `approved`, campaign status becomes `approved`.

---

## F6 — Marketing Calendar

**Mô tả**: Visual calendar showing all content items scheduled by channel.

**Views**: Month view (default), Week view.

**Item Display**
- Color dot by channel: `facebook_post` / `email` / `video_script`.
- Status badge: `Draft`, `Pending`, `Approved`.
- Click → opens content detail panel (right sidebar).

**Date assignment**: 
- Default date = campaign deadline.
- User can reassign date by clicking the item and changing the date.

**Filters**: By channel, by status, by campaign.

---

## F7 — Agent Run Logs

**Mô tả**: Transparency layer showing what each agent did, used for demo and debugging.

**Log Entry Fields**
```
id, campaign_id, agent_name, step_order, model_used, prompt_preview (first 200 chars),
output_preview (first 200 chars), duration_ms, token_usage, timestamp, status
```

**UI**: Timeline panel on Campaign Detail page. Shows agent steps in chronological order with expand-to-full option.

---

## F8 — Dashboard

**Mô tả**: Overview page with key metrics and AI-generated weekly summary.

**Metrics Widgets**
| Widget | Data Source |
|---|---|
| Total Campaigns | `campaigns` table count |
| Content Items Created | `content_items` table count |
| Pending Approvals | `content_items` where status = `pending_approval` |
| Content by Channel (pie/bar) | `content_items` grouped by channel |
| Recent Activity Feed | Last 10 `agent_run_logs` across all campaigns |

**AI Summary**
- Triggered on dashboard load.
- Calls LLM (Qwen) with internal stats context.
- Returns 2-3 sentence insight: e.g. "Tuần này bạn đã tạo 3 chiến dịch, nội dung email đang được duyệt nhiều nhất. Hãy cân nhắc tạo thêm nội dung cho video."

---

## F9 — Smart Workflow Automation (Should-Have)

**Mô tả**: Event-driven trigger system that auto-initiates campaign drafting.

**MVP Triggers**
| Trigger | Description |
|---|---|
| `schedule_trigger` | Cron-based: every Monday 8am, check if any scheduled campaigns need drafting |
| `upload_trigger` | User uploads a customer list CSV → system auto-creates an email campaign brief |

**Process**
1. Trigger fires → system auto-creates a Campaign record with pre-filled brief fields.
2. Orchestrator runs automatically.
3. Results go to `pending_approval` as usual.
4. In-app notification: "Tôi đã soạn xong campaign tuần này, hãy vào duyệt nhé."

**No auto-publish.** Human approval is always required.

---

## F10 — Hybrid Model Routing (Should-Have)

**Mô tả**: Route each agent step to the most appropriate model.

**Routing Table**
| Agent Step | Default Model | Fallback |
|---|---|---|
| Strategist | OpenAI `gpt-4o-mini` | Qwen 2.5 7B |
| Writer | Qwen 2.5 7B (via VPS) | OpenAI `gpt-4o-mini` |
| Critic | OpenAI `gpt-4o-mini` | Qwen 2.5 7B |
| Dashboard AI Summary | Qwen 2.5 7B | OpenAI `gpt-4o-mini` |

**Fallback condition**: VPS unreachable or response timeout > 15s → fall back to OpenAI.

**VPS API**: Qwen served as OpenAI-compatible API (via `ollama` or `vllm`) at `http://171.238.156.10:11434/v1` or similar endpoint.

---

## F11 - Admin Console (bo sung)

**Mô tả**: Bo sung khu vuc admin de van hanh he thong.

**Input**
- Tai khoan co role `admin`.
- Du lieu user, workflow jobs, token usage.

**Process**
1. Xem dashboard tong quan suc khoe he thong.
2. Quan ly user (lock/unlock).
3. Theo doi workflow loi va retry.
4. Xem va loc audit logs.

**Output**
- Van hanh on dinh hon, co kha nang truy vet su co.
