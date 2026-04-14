# MVP Roadmap — AIMAP

Lộ trình chia theo **Sprint 1 tuần**, ưu tiên làm được demo chạy được end-to-end trước, rồi mới hoàn thiện UX và thêm tính năng should-have.

---

## Sprint 0 — Setup (1–2 ngày)

**Mục tiêu**: Dựng khung dự án, Docker Compose chạy được, connect được DB.

### Tasks

- [ ] Khởi tạo monorepo: `web/`, `api/`, `agent/`
- [ ] Viết `docker-compose.yml` với services: `db`, `api`, `agent`, `web`
- [ ] Setup `api/`: FastAPI + SQLAlchemy async + Alembic
- [ ] Viết migration baseline (tất cả bảng theo `database-schema.md`)
- [ ] Setup `web/`: Next.js 14 App Router + Tailwind CSS + shadcn/ui
- [ ] Setup `agent/`: FastAPI app rỗng + folder structure
- [ ] Verify: `docker compose up` → db reachable, api `/health` trả 200
- [ ] Tạo `.env.example` cho từng service

**Done when**: `docker compose up` lên được, Alembic migrate thành công, Next.js homepage load.

---

## Sprint 1 — Auth + Brand Vault (3–4 ngày)

**Mục tiêu**: User có thể đăng ký, đăng nhập, và cấu hình Brand Vault.

### Tasks

**Backend**
- [ ] `POST /auth/register` + `POST /auth/login` (JWT)
- [ ] `GET /auth/me`
- [ ] `GET /brands/me` + `PUT /brands/me`
- [ ] Middleware auth cho tất cả routes

**Frontend**
- [ ] App shell: Sidebar + Topbar layout
- [ ] `/login` page + `/register` page
- [ ] Auth context + JWT storage (httpOnly cookie preferred)
- [ ] `/brand-vault` page: form 2-column theo ui-guidelines.md
- [ ] Redirect to brand vault setup if brand not configured

**Done when**: User đăng ký, đăng nhập, vào Brand Vault, điền form, lưu, reload vẫn còn data.

---

## Sprint 2 — Campaign Brief + Orchestration Core (5–7 ngày)

**Mục tiêu**: Tính năng trung tâm — tạo campaign brief và chạy 3-agent pipeline.

### Tasks

**Backend**
- [ ] `POST /campaigns` — tạo campaign
- [ ] `GET /campaigns` + `GET /campaigns/{id}`
- [ ] `POST /campaigns/{id}/run` — dispatch tới agent service
- [ ] `PATCH /internal/campaigns/{id}` — agent cập nhật status
- [ ] `POST /internal/content` — agent lưu content item
- [ ] `POST /internal/logs` — agent lưu log entry

**Agent Service**
- [ ] `POST /run` endpoint nhận job
- [ ] LLM router (Qwen client + OpenAI client với fallback logic)
- [ ] Strategist agent: prompt template + call LLM + parse output
- [ ] Writer agent: 3 channel templates (facebook_post, email, video_script)
- [ ] Critic agent: review prompt + parse + lưu final content
- [ ] Orchestrator state machine gắn kết 3 bước trên
- [ ] Error handling: nếu 1 bước fail → log error, mark campaign failed

**Frontend**
- [ ] `/campaigns` list page (table view)
- [ ] `/campaigns/new` — brief intake form
- [ ] `/campaigns/[id]` — campaign detail page
  - Brief info section
  - Status badge với auto-refresh polling
  - Content tabs (facebook_post / email / video_script)
  - Agent logs timeline panel (right side)

**Done when**: Điền brief → nhấn Create → thấy status "Running..." → sau vài giây thấy content items với agent logs.

---

## Sprint 3 — Approval Flow + Content Management (3–4 ngày)

**Mục tiêu**: User có thể review, edit, approve, reject từng content item.

### Tasks

**Backend**
- [ ] `PATCH /content/{id}/approve`
- [ ] `PATCH /content/{id}/reject` (với rejection_note)
- [ ] `PATCH /content/{id}` — edit content + reschedule date
- [ ] `GET /content` với filters
- [ ] Auto-update campaign status khi tất cả items approved

**Frontend**
- [ ] Content detail view trong Campaign Detail page
  - Hiển thị full content text theo từng channel format
  - Inline edit mode
  - [Approve] [Reject với note] buttons
- [ ] `/approve` page — approval queue table
  - Danh sách tất cả items pending_approval
  - Quick approve/reject trực tiếp từ table

**Done when**: User có thể vào campaign detail, đọc content, approve từng item, thấy status thay đổi ngay.

---

## Sprint 4 — Marketing Calendar (3–4 ngày)

**Mục tiêu**: Calendar view hoạt động được, user thấy content items theo ngày.

### Tasks

**Backend**
- [ ] `GET /calendar?month=YYYY-MM`
- [ ] `PATCH /content/{id}/schedule` — thay đổi ngày trên lịch

**Frontend**
- [ ] `/calendar` page
  - Month grid (CSS Grid 7 cột)
  - Render content dots theo `scheduled_date`
  - Filter by channel / status
  - Month navigation (< tháng trước / tháng sau >)
  - Click item → right panel mở chi tiết + approve/reject
  - Click item → change date inline

**Done when**: Calendar load ra các content items, có thể click xem chi tiết, thay đổi ngày.

---

## Sprint 5 — Dashboard (2–3 ngày)

**Mục tiêu**: Dashboard hiển thị stats thực tế + AI summary.

### Tasks

**Backend**
- [ ] `GET /dashboard/stats` — aggregate queries
- [ ] `GET /dashboard/summary` — gọi Qwen để sinh text summary

**Frontend**
- [ ] `/dashboard` page
  - 4 stat cards
  - Recent activity feed (last 8 agent log entries)
  - Content by channel bar chart (dùng Recharts hoặc đơn giản là table)
  - AI Insight box

**Done when**: Dashboard hiển thị số thực tế, AI summary load được (có thể chậm vài giây).

---

## Sprint 6 — Polish + Should-Have Features (3–5 ngày)

**Mục tiêu**: Hoàn thiện UX, thêm workflow automation, kiểm tra demo flow.

### Tasks

**Workflow Automation**
- [ ] `POST /workflow/trigger` endpoint
- [ ] `GET /workflow/jobs`
- [ ] Cron job (APScheduler hoặc simple loop) chạy `schedule_trigger` mỗi sáng thứ Hai
- [ ] Frontend: workflow jobs list trong settings hoặc dashboard

**UX Polish**
- [ ] Skeleton loading states cho tất cả pages
- [ ] Empty states cho campaigns, calendar, approve queue
- [ ] Error handling + retry cho agent failures
- [ ] Loading indicator khi campaign đang running (polling)
- [ ] Campaign delete với confirmation
- [ ] Responsive tối thiểu cho màn 1280px+

**Demo Prep**
- [ ] Seed script: tạo sẵn user demo + brand vault + 3 campaigns ở các trạng thái khác nhau
- [ ] Kiểm tra agent log timeline hiển thị đẹp
- [ ] Kiểm tra model routing thực tế (Qwen VPS phải chạy được)

**Done when**: Full demo flow chạy được từ đầu đến cuối không crash.

---

## Sprint 7 — Buffer + Presentation Prep (1–2 ngày)

- [ ] Final bug fixes
- [ ] Chuẩn bị demo data đa dạng
- [ ] Viết slide tóm tắt kiến trúc (dùng `architecture.md`)
- [ ] In / export `demo-script.md` để dùng khi trình bày

---

## Timeline Overview

| Sprint | Nội dung | Thời gian |
|---|---|---|
| 0 | Setup | 2 ngày |
| 1 | Auth + Brand Vault | 4 ngày |
| 2 | Campaign + Orchestration | 7 ngày |
| 3 | Approval Flow | 4 ngày |
| 4 | Calendar | 4 ngày |
| 5 | Dashboard | 3 ngày |
| 6 | Polish + Should-have | 5 ngày |
| 7 | Buffer + Demo prep | 2 ngày |
| **Tổng** | | **~31 ngày** |

---

## Dependency Order

```
Sprint 0 (infra)
    ↓
Sprint 1 (auth + brand vault)   ← phải xong trước khi có brand context cho agent
    ↓
Sprint 2 (campaign + orchestration)   ← core feature
    ↓
Sprint 3 (approval)   ← cần content items từ Sprint 2
    ↓
Sprint 4 (calendar)   ← cần approved/scheduled content từ Sprint 3
    ↓
Sprint 5 (dashboard)   ← cần data từ Sprint 1-4
    ↓
Sprint 6 (polish)
```

---

## Critical Path (Minimum Demo-able State)

Nếu thời gian thiếu, đây là phần tối thiểu phải xong để demo được:

1. ✅ Sprint 0 — Setup
2. ✅ Sprint 1 — Auth + Brand Vault
3. ✅ Sprint 2 — Campaign + Orchestration (đây là phần quan trọng nhất)
4. ✅ Sprint 3 — Approval (có thể chỉ implement approve, bỏ reject + edit)
5. Partial Sprint 4 — Calendar (chỉ cần month view, không cần drag-drop)
6. Partial Sprint 5 — Dashboard (chỉ cần stat cards + AI summary text)

---

## Cap nhat roadmap: them Admin track

### Sprint 3+ (bo sung)

1. Admin Dashboard (system health + usage).
2. User Management (lock/unlock + search/filter).
3. Workflow Ops (failed jobs + retry).
4. Audit Logs (timeline hanh dong admin).

Muc tieu: tang kha nang van hanh he thong khi demo/production ma khong pha vo luong chinh cua user doanh nghiep.
