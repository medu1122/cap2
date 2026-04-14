# AIMAP — Tài liệu Chính thức Dự án

**AI-Powered Marketing Automation Platform for Small Businesses**
Đồ án Capstone 2 — Tài liệu hoàn chỉnh để báo cáo hội đồng

---

## Mục lục

| # | Tài liệu | Mô tả |
|---|---|---|
| 01 | [Proposal](01-proposal.md) | Đề xuất dự án, mục tiêu, phạm vi, timeline |
| 02 | [Architecture](02-architecture/) | Kiến trúc hệ thống theo C4 Model + Sequence Diagrams |
| 03 | [Product Backlog](03-product-backlog.md) | User Stories, Story Points, Priority cho toàn dự án |
| 04 | [Sprint Plans](04-sprints/) | Kế hoạch 3 sprints × 3 tuần theo Scrum |
| 05 | [Feature Docs](05-features/) | Plan + Coding + Test cho từng tính năng |

---

## 02 — Architecture

| File | Nội dung |
|---|---|
| [c4-context.md](02-architecture/c4-context.md) | C4 Level 1 — System Context: Actors & External Systems |
| [c4-container.md](02-architecture/c4-container.md) | C4 Level 2 — Containers: 3 Services + Database |
| [c4-component.md](02-architecture/c4-component.md) | C4 Level 3 — Components bên trong mỗi service |
| [sequence-diagrams.md](02-architecture/sequence-diagrams.md) | 11 Sequence Diagrams (bo sung luong Insight A2A) |
| [database-overview.md](02-architecture/database-overview.md) | **Cơ sở dữ liệu:** danh sách 25 bảng, vai trò từng bảng, ERD Mermaid |

---

## 04 — Sprint Plans

| Sprint | File | Tuần | Mục tiêu |
|---|---|---|---|
| Sprint 1 | [sprint-1.md](04-sprints/sprint-1.md) | 1–3 | Foundation: Auth, Brand Vault, Infra |
| Sprint 2 | [sprint-2.md](04-sprints/sprint-2.md) | 4–6 | Core AI: Orchestrator, Content, Calendar |
| Sprint 3 | [sprint-3.md](04-sprints/sprint-3.md) | 7–9 | Advanced: Dashboard, Workflow, Insight Copilot, Polish |

---

## 05 — Feature Documentation

Mỗi tính năng có 4 file: **README.md** (tổng quan + trạng thái thực tế), **plan.md** (đặc tả), **coding.md** (hướng dẫn cài đặt), **test.md** (kế hoạch kiểm thử).

| Feature | Folder | Sprint |
|---|---|---|
| F01 — Authentication & Profile | [F01-authentication/](05-features/F01-authentication/) | Sprint 1 |
| F02 — Brand Vault | [F02-brand-vault/](05-features/F02-brand-vault/) | Sprint 1 |
| F03 — Campaign Brief Intake | [F03-campaign-brief/](05-features/F03-campaign-brief/) | Sprint 2 |
| F04 — Multi-Agent Orchestrator | [F04-agent-orchestrator/](05-features/F04-agent-orchestrator/) | Sprint 2 |
| F05 — Content Storage & Versioning | [F05-content-versioning/](05-features/F05-content-versioning/) | Sprint 2 |
| F06 — Approval Flow | [F06-approval-flow/](05-features/F06-approval-flow/) | Sprint 2 |
| F07 — Marketing Calendar | [F07-marketing-calendar/](05-features/F07-marketing-calendar/) | Sprint 2 |
| F08 — Dashboard & AI Summary | [F08-dashboard/](05-features/F08-dashboard/) | Sprint 3 |
| F09 — Workflow Automation | [F09-workflow-automation/](05-features/F09-workflow-automation/) | Sprint 3 |
| F10 — Notifications & Customer Lists | [F10-notifications/](05-features/F10-notifications/) | Sprint 3 |
| F11 — Insight Copilot A2A | [F11-insight-copilot-a2a/](05-features/F11-insight-copilot-a2a/) | Sprint 3 |
| F12 — Admin Operations | [F12-admin-operations/](05-features/F12-admin-operations/) | Sprint 3 |

Bắt đầu đọc mỗi tính năng từ file `README.md` trong thư mục tương ứng, sau đó đi sâu vào `plan.md`, `coding.md`, `test.md`.

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend API | FastAPI (Python 3.11+), SQLAlchemy 2.x async, Pydantic v2 |
| Agent Service | FastAPI, LangChain / CrewAI pattern, httpx |
| Database | PostgreSQL 16 (JSONB, UUID, ARRAY) — schema mo rong cho workflow schedule va customer list (xem [database-overview.md](02-architecture/database-overview.md)) |
| AI Models | OpenAI GPT-4o-mini (Strategy/Critic), Qwen 2.5 7B self-hosted (Writer) |
| Infrastructure | Docker Compose, Alembic migrations, Cloudinary (campaign image storage) |

---

## Tài liệu tham khảo bổ sung (trong `docs/`)

| File | Nội dung |
|---|---|
| [product-scope.md](../product-scope.md) | Problem statement, MVP scope, target users |
| [feature-breakdown.md](../feature-breakdown.md) | Input/Process/Output per feature |
| [api-contracts.md](../api-contracts.md) | REST API endpoint specifications |
| [database-design.md](../database-design.md) | ERD, table definitions, queries |
| [database-init.sql](../database-init.sql) | SQL script khởi tạo database |
| [agent-orchestration.md](../agent-orchestration.md) | Chi tiết pipeline AI agents |
| [ui-guidelines.md](../ui-guidelines.md) | Design system, color palette, components |
| [project-overview.md](../project-overview.md) | Tổng quan thuyết phục hội đồng |
| [insight-copilot-readme.md](06-update/insight-copilot-readme.md) | Bai toan SMB va gia tri thuc dung cua Insight Copilot |
| [insight-copilot-plan.md](06-update/insight-copilot-plan.md) | Kien truc backend/frontend/database va roadmap trien khai |
| [insight-copilot-ai-quality.md](06-update/insight-copilot-ai-quality.md) | Khung chat luong AI cho Qwen: prompt, guardrails, eval |
| [insight-copilot-data-template-readme.md](06-update/insight-copilot-data-template-readme.md) | Huong dan CSV mau tieng Viet de nap du lieu cho Tro ly phan tich |
| [deepseek-a2a-feasibility-readme.md](06-update/deepseek-a2a-feasibility-readme.md) | Phan tich kha thi DeepSeek + Qwen + GPT fallback |
| [deepseek-coder-vps-ubuntu-playbook.md](06-update/deepseek-coder-vps-ubuntu-playbook.md) | Playbook cai va van hanh DeepSeek Coder 6.7B tren VPS Ubuntu |
| [insight-a2a-backend-readme.md](06-update/insight-a2a-backend-readme.md) | API contracts, output contract va quality gate cho backend A2A |
| [insight-a2a-frontend-readme.md](06-update/insight-a2a-frontend-readme.md) | UX upload 1-sheet, pipeline status, model badges |
| [insight-a2a-database-readme.md](06-update/insight-a2a-database-readme.md) | Thiet ke bang run trace/schema map/result snapshot |
| [docs-changelog-2026-04-14.md](06-update/docs-changelog-2026-04-14.md) | Nhat ky cap nhat toan bo docs/final cho huong DeepSeek A2A |

---

## Cap nhat Admin (2026-04)

He thong duoc cap nhat mo hinh van hanh co vai tro `admin` ben canh user doanh nghiep.

- Admin dung de quan tri he thong, giam sat AI usage, xu ly workflow loi, va audit hanh dong.
- User workspace van giu quy trinh chinh: Brand Vault -> Campaign -> Approval -> Calendar.
- Tai lieu bo sung:
  - `docs/final/06-update/admin-overview-readme.md`
  - `docs/final/06-update/admin-backend-readme.md`
  - `docs/final/06-update/admin-frontend-readme.md`

## Cap nhat media storage (2026-04)

- Campaign image flow (`/campaigns/{id}/image/generate`, `/campaigns/{id}/image/upload`) da uu tien Cloudinary.
- Neu chua cau hinh `CLOUDINARY_*`, backend fallback local qua `STATIC_DIR` + `STATIC_BASE_URL`.
- Thay doi nay khong yeu cau migration DB vi image URL duoc luu trong `campaign_plan_json.image_url`.

## Cap nhat Insight UI/flow (2026-04)

- `/insights` ho tro nap file `.csv`, `.xlsx`, `.xls` (sheet 1).
- UI bo sung bang preview toan bo du lieu da nap.
- UI bo sung bang "Ket qua da luu" voi thao tac xem ket qua va phan tich lai.
- API bo sung:
  - `GET /insights/a2a/runs/{run_id}/result`
  - `POST /insights/a2a/runs/{run_id}/reanalyze`
