# Sprint 3 — Advanced Features + Polish

**Tuần 7–9 | Goal: Dashboard, Workflow, Notifications + Demo-ready**

---

## Sprint Goal

> "Platform hoàn chỉnh, demo được cho hội đồng: Dashboard với AI summary, Workflow tự động, Notifications, và toàn bộ trải nghiệm người dùng được polish."

**Done when:**
- Dashboard hiển thị đúng stats từ database + AI summary từ Qwen
- Workflow schedule: tạo lịch → đến giờ → tự tạo campaign → chạy AI
- Upload CSV customer list → auto-tạo email campaign
- Notification center: bell icon + unread count + mark as read
- Seed data chạy được: 1 user demo + brand vault + 2 campaigns + content
- Full demo flow < 5 phút không có lỗi

---

## Sprint Backlog

| Story ID | User Story | Points | Assignee | Status |
|---|---|---|---|---|
| US-35 | Dashboard: 4 metric widgets | 5 | Dev | To Do |
| US-36 | Dashboard: content by channel chart | 3 | Dev | To Do |
| US-37 | Dashboard: AI weekly summary từ Qwen | 5 | Dev | To Do |
| US-38 | Workflow: recurring schedule | 8 | Dev | To Do |
| US-39 | Workflow: CSV upload → auto campaign | 8 | Dev | To Do |
| US-40 | Workflow history list | 2 | Dev | To Do |
| US-41 | Enable/disable workflow schedule | 3 | Dev | To Do |
| US-42 | In-app notifications | 3 | Dev | To Do |
| US-43 | Unread count badge | 2 | Dev | To Do |
| US-44 | Mark as read | 1 | Dev | To Do |
| US-46 | Customer lists view | 2 | Dev | To Do |
| US-47 | Customers in list view | 1 | Dev | To Do |
| **POLISH-01** | Seed demo data script hoàn chỉnh | 3 | Dev | To Do |
| **POLISH-02** | Error handling + loading states toàn app | 3 | Dev | To Do |
| **POLISH-03** | Responsive design check (tablet) | 2 | Dev | To Do |
| **POLISH-04** | Performance: lazy load agent logs | 2 | Dev | To Do |
| **DEMO-01** | Full demo rehearsal + timing | 2 | Dev | To Do |
| **Total** | | **55** | | |

---

## Timeline Chi tiết

### Tuần 7 — Dashboard + Notifications

| Ngày | Task | Output |
|---|---|---|
| Ngày 43 | Dashboard API: GET /dashboard/stats (aggregated SQL) | Stats API test |
| Ngày 44 | Dashboard API: GET /dashboard/ai-summary (call Qwen) | AI summary generation test |
| Ngày 45 | Dashboard page: 4 widgets + channel chart | Stats hiển thị đúng |
| Ngày 46 | Dashboard AI summary card với loading state | Summary card render |
| Ngày 47 | Notifications API: GET /notifications, PATCH read | Notification CRUD |
| Ngày 48 | Notification center UI: dropdown + unread badge | Bell icon + count |
| Ngày 49 | AI usage stats tracking (update ai_usage_stats sau mỗi agent call) | Token tracking |

### Tuần 8 — Workflow Automation + Customer Lists

| Ngày | Task | Output |
|---|---|---|
| Ngày 50 | Workflow schedules API: GET/POST/PATCH /workflow/schedules | Schedule CRUD |
| Ngày 51 | Cron job logic: check next_run_at, create workflow_job | Cron simulation test |
| Ngày 52 | Schedule trigger: tạo campaign từ template + run orchestrator | Auto campaign test |
| Ngày 53 | File upload API: POST /files/upload (CSV, image) | File upload test |
| Ngày 54 | CSV parsing: import customers into customer_lists + customers | Import 100 rows test |
| Ngày 55 | Upload trigger: CSV → auto create email campaign | End-to-end upload test |
| Ngày 56 | Workflow UI: schedule list + create form + history | Workflow UI complete |

### Tuần 9 — Polish + Demo Prep

| Ngày | Task | Output |
|---|---|---|
| Ngày 57 | Customer lists page + customers table | UI complete |
| Ngày 58 | Seed demo data: user + brand + 2 campaigns + 5 content + logs | `python seed_demo.py` thành công |
| Ngày 59 | Error handling: loading states, empty states, error boundaries | UX polish |
| Ngày 60 | Responsive check + minor UI fixes | Tablet view OK |
| Ngày 61 | Performance: lazy loading, optimize heavy queries | Dashboard load < 2s |
| Ngày 62 | Full demo rehearsal — time entire flow | Flow < 5 phút |
| Ngày 63 | Bug fixes từ rehearsal | Clean demo |

---

## Definition of Done (Sprint 3 — Release)

- [ ] Tất cả Must-have stories hoàn thành và tested
- [ ] Demo flow < 5 phút không có lỗi
- [ ] `docker compose up` → `docker compose run api alembic upgrade head` → `python seed_demo.py` → app ready
- [ ] Dashboard stats chính xác (verify bằng SQL query)
- [ ] AI summary tạo được (không phải hardcoded)
- [ ] Workflow tự động hoạt động (ít nhất với manual trigger)
- [ ] Notification bell có unread count sau khi campaign hoàn thành
- [ ] Không có unhandled 500 errors trong happy path
- [ ] README có hướng dẫn setup và demo steps

---

## Demo Preparation Checklist

### Môi trường
- [ ] Docker Compose up và running
- [ ] Database migration applied
- [ ] Seed data loaded (user demo + brand vault + 2 campaigns)
- [ ] API `/health` → 200
- [ ] Qwen VPS accessible (ping 171.238.156.10)
- [ ] OpenAI API key hợp lệ

### Demo Flow (< 5 phút)

**Phần 1 — Giới thiệu (30 giây)**
- Show Dashboard: tổng quan metrics, AI summary

**Phần 2 — Brand Vault (45 giây)**
- Show Brand Vault của Cafe Bờ Hồ
- Nhấn mạnh: tone='warm', forbidden_words, preferred_cta

**Phần 3 — Core Feature: Campaign (2 phút)**
- Tạo campaign brief mới (live hoặc trigger pre-seeded)
- Chờ hoặc show pre-seeded campaign đang `running`
- Show agent log timeline: 5 steps, 2 models, tokens
- Show "pending_approval" content items

**Phần 4 — Approval + Calendar (45 giây)**
- Approve 2 items, reject 1 với note
- Chuyển sang Calendar: show approved items trên lịch

**Phần 5 — Dashboard AI Summary (30 giây)**
- Load Dashboard: stats + AI-generated summary từ Qwen

### Backup Plan
- Nếu LLM chậm: dùng pre-seeded campaign với full logs
- Nếu VPS không available: OpenAI fallback đã được cấu hình
- Nếu DB chết: có `database-init.sql` backup

---

## Q&A Preparation

| Câu hỏi dự kiến | Trả lời chuẩn bị |
|---|---|
| Tại sao dùng 3 agent thay vì 1 LLM call? | Chain of thought externalized — mỗi agent có prompt chuyên biệt, kết quả nhất quán hơn |
| Hybrid routing quyết định thế nào? | Config trong llm/router.py: strategy/critic → OpenAI, writer/summary → Qwen |
| Nếu VPS chết thì sao? | Fallback sang OpenAI sau 15s timeout, campaign không fail |
| Database 23 bảng — thiết kế thế nào? | Show database-design.md ERD, giải thích các domain groups |
| Scrum process thực tế như thế nào? | Show sprint docs, backlog, velocity tracking |

---

## Sprint Retrospective Template

### What Went Well
- ...

### What Could Be Improved
- ...

### Lessons Learned (cho dự án tiếp theo)
- ...

---

## Velocity Actual

| Metric | Planned | Actual |
|---|---|---|
| Story Points | 55 | ___ |
| Stories Completed | 17 | ___ |
| Stories Carried Over | 0 | ___ |
| Total Project Points | 172 | ___ |

---

## Release Notes v1.0.0 (MVP)

### Features Delivered
- Multi-agent AI campaign orchestration (Strategist + Writer + Critic)
- Brand Vault with AI context injection
- 3-channel content generation (Facebook, Email, Video Script)
- Human approval flow with versioning and audit trail
- Marketing Calendar with scheduling
- Dashboard with real-time stats and AI summary
- Workflow automation (schedule + CSV upload trigger)
- In-app notifications
- Customer list management

### Known Limitations (Post-MVP)
- Auto-publishing không có (requires social media API integration)
- Email sending không có (requires SMTP/SendGrid)
- Single user per brand vault
- Mobile app chưa có
