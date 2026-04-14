# Product Scope — AIMAP

**AI-Powered Marketing Automation Platform for Small Businesses**

---

## 1. Problem Statement

Small business users in Vietnam (coffee shops, boutiques, food stalls, local services) typically run marketing activities alone or with a small team. They:

- Lack time and expertise to plan consistent marketing campaigns.
- Cannot afford an agency or full-time marketing staff.
- Struggle to maintain a consistent brand voice across channels.
- Spend hours writing posts, emails, and promotional scripts manually.

**AIMAP solves this** by acting as an always-on AI marketing team that can draft, review, and organize marketing content — while keeping the business user in control via a simple approval flow.

---

## 2. Target Users

| User Type | Description |
|---|---|
| **Business User** | Runs a local shop, F&B, or service business. Wants to do marketing without becoming a marketer. Non-technical. |
| **System Admin** | Operates the platform, manages users, monitors workflow/usage, and handles incidents. |

---

## 3. Value Proposition

> "You tell AIMAP your goal. Three AI agents plan the campaign, write the content, and quality-check it — then ask you to approve before anything goes live."

Core value delivered:

- **Time savings**: From hours of writing to minutes of reviewing.
- **Consistency**: Brand Vault ensures tone and style never drift.
- **Visibility**: Marketing Calendar gives a full-month picture of all planned content.
- **Control**: Nothing publishes without human approval.

---

## 4. MVP Scope

### In Scope

| # | Feature | Priority |
|---|---|---|
| 1 | Campaign Brief Intake | Must-have |
| 2 | AI Multi-Agent Campaign Orchestrator (Strategist → Writer → Critic) | Must-have |
| 3 | AI Brand Vault | Must-have |
| 4 | Content Storage & Versioning (Draft → Approved) | Must-have |
| 5 | Approval Flow (Pending → Approved / Rejected) | Must-have |
| 6 | Marketing Calendar | Must-have |
| 7 | Agent Run Logs (for transparency and demo) | Must-have |
| 8 | Dashboard (campaign/content stats + AI summary) | Must-have |
| 9 | Scheduled Workflow Automation (event-triggered drafts) | Should-have |
| 10 | Customer List Upload Trigger | Should-have |
| 11 | Hybrid Model Routing (Qwen VPS / OpenAI) | Should-have |

### Out of Scope (MVP)

- Auto-publishing to Facebook, Instagram, Email ESPs.
- Real social analytics ingestion.
- A/B content variants.
- Fine-grained RBAC (module-level permissions).
- Mobile application.
- Multi-language campaign support.

---

## 5. User Roles (MVP)

| Role | Permissions |
|---|---|
| `admin` | Platform operations: manage users, monitor workflow and AI usage, audit actions |
| `user` | Product usage: Brand Vault, campaigns, approvals, calendar, dashboard |

Authentication: email + password (JWT), no OAuth in MVP.

---

## 6. Content Channels (MVP)

Three fixed output channels per campaign:

| Channel | Output Type |
|---|---|
| `facebook_post` | Social media post copy (text + suggested hashtags) |
| `email` | Subject line + email body |
| `video_script` | Short-form video script (30–60 seconds) |

Each channel maps to one `ContentItem` in the database.

---

## 7. Core User Flow

```
User fills Campaign Brief
        ↓
Strategist Agent generates Campaign Plan + Deliverables list
        ↓
Writer Agent drafts content for each Deliverable
        ↓
Critic Agent reviews and revises each Draft
        ↓
Content Items saved as "Pending Approval"
        ↓
User reviews on Calendar / Campaign Detail page
        ↓
User approves or rejects
        ↓
Approved items appear on Calendar as "Approved/Scheduled"
```

---

## 8. Success Criteria (Capstone Evaluation)

| Criterion | Target |
|---|---|
| Agent orchestration demonstrated live | End-to-end campaign brief → 3 content items in < 90 seconds |
| Brand Vault context used in all outputs | Agent prompts verified to inject Brand Vault data |
| Agent logs visible to evaluator | Timeline panel shows each agent step with timestamp |
| Calendar shows approved content | At least 5 content items plotted on calendar |
| Dashboard shows real aggregated data | Stats reflect actual campaign/content records |

---

## Cap nhat product scope: Admin operations

### In-scope (cap nhat)
- Co vai tro admin de van hanh he thong.
- Admin duoc phep:
  - Quan tri user.
  - Giam sat AI usage.
  - Theo doi workflow jobs loi.
  - Xem audit logs.

### Out-of-scope (giu nguyen)
- Khong lam RBAC phuc tap da cap.
- Khong co phan quyen theo module/per-screen chi tiet.
