# MVP Boundary — AIMAP

File này là **nguồn sự thật duy nhất** để kiểm soát scope. Mọi feature request mới phải được đối chiếu với file này trước khi implement.

---

## What is in MVP

### Must-have (không thể thiếu để demo được)

| Feature | Điều kiện done |
|---|---|
| Auth (register/login/JWT) | User đăng ký và đăng nhập được |
| Brand Vault CRUD | Lưu và load lại được toàn bộ brand config |
| Campaign Brief Intake | Form tạo brief với validation |
| Multi-Agent Orchestration | Brief → Strategist → Writer → Critic → 3 content items |
| Agent Run Logs | Mỗi agent step lưu log, hiển thị timeline trên UI |
| Content Storage | Content items lưu vào DB với status tracking |
| Approval Flow | User có thể Approve / Reject từng content item |
| Marketing Calendar | Month view hiển thị content items theo ngày |
| Dashboard | 4 stat cards + recent activity feed + AI summary text |

### Should-have (có thì tốt, không có vẫn demo được)

| Feature | Điều kiện done |
|---|---|
| Hybrid Model Routing | Qwen VPS cho Writer, OpenAI cho Strategist/Critic, có fallback |
| Scheduled Workflow Trigger | Cron trigger tạo draft campaign tự động |
| Customer List Upload Trigger | Upload CSV → tạo campaign email tự động |
| Workflow Jobs List | Hiển thị lịch sử các workflow đã chạy |

---

## What is NOT in MVP

Danh sách này là **cứng** — không thêm dù có thời gian dư.

| Feature | Lý do loại |
|---|---|
| Auto-publish lên Facebook/Instagram/Email ESP | Rủi ro cao, cần API keys bên ngoài, không tăng điểm demo |
| A/B content variants | Thêm độ phức tạp mà không tăng giá trị demo |
| Real social analytics (likes, reach, click) | Cần OAuth với social platform, nằm ngoài scope |
| Multi-user team với role phức tạp | Chỉ cần 1 user = owner là đủ cho demo |
| Mobile app / responsive mobile | Desktop 1280px+ là đủ |
| Dark mode | Không trong scope UI |
| Google Calendar sync | Không cần, calendar nội bộ là đủ |
| Multi-language UI | Tiếng Việt là đủ |
| Email delivery thật (SMTP send) | Chỉ tạo nội dung, không gửi |
| Drag-and-drop calendar | Nếu hết thời gian, click-to-change-date là đủ |

---

## Fixed Content Channels (MVP)

Chỉ 3 channel, không thêm:

1. `facebook_post` — copy text + hashtags
2. `email` — subject + body
3. `video_script` — hook + body + CTA + duration estimate

---

## Fixed Agent Pipeline (MVP)

Chỉ 3 agent theo thứ tự, không thêm:

```
Strategist → Writer (x3 channels) → Critic (x3 channels)
```

Không có:
- Agent loop / retry nhiều lần
- Agent tự quyết định có cần Critic không
- Agent gọi thêm tool bên ngoài (web search, image gen)

---

## Fixed Workflow Triggers (MVP)

Chỉ 2 trigger:

1. `schedule_trigger` — cron Monday 8am
2. `upload_trigger` — CSV customer list upload

---

## Status State Machines

**Campaign status**
```
pending_agent → running → pending_approval → approved | partially_approved
                       ↘ failed
```

**ContentItem status**
```
draft → pending_approval → approved
                        → rejected → (manual re-run or edit)
```

---

## Technical Constraints (Locked)

| Constraint | Value |
|---|---|
| Frontend | Next.js 14 App Router |
| Backend | FastAPI + SQLAlchemy async |
| Agent service | Python standalone FastAPI service |
| Database | PostgreSQL 16 |
| Qwen model | `qwen2.5:7b` via `http://171.238.156.10:11434/v1` |
| OpenAI model | `gpt-4o-mini` |
| Auth | JWT (no OAuth) |
| Deployment | Docker Compose (local/VPS) |
| UI style | Tailwind CSS + shadcn/ui, monochrome, no animation |
