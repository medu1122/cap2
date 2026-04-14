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
| [sequence-diagrams.md](02-architecture/sequence-diagrams.md) | 10 Sequence Diagrams cho từng tính năng |

---

## 04 — Sprint Plans

| Sprint | File | Tuần | Mục tiêu |
|---|---|---|---|
| Sprint 1 | [sprint-1.md](04-sprints/sprint-1.md) | 1–3 | Foundation: Auth, Brand Vault, Infra |
| Sprint 2 | [sprint-2.md](04-sprints/sprint-2.md) | 4–6 | Core AI: Orchestrator, Content, Calendar |
| Sprint 3 | [sprint-3.md](04-sprints/sprint-3.md) | 7–9 | Advanced: Dashboard, Workflow, Polish |

---

## 05 — Feature Documentation

Mỗi tính năng có 3 file: **plan.md** (đặc tả), **coding.md** (hướng dẫn cài đặt), **test.md** (kế hoạch kiểm thử).

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

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend API | FastAPI (Python 3.11+), SQLAlchemy 2.x async, Pydantic v2 |
| Agent Service | FastAPI, LangChain / CrewAI pattern, httpx |
| Database | PostgreSQL 16 (JSONB, UUID, ARRAY) — 23 tables |
| AI Models | OpenAI GPT-4o-mini (Strategy/Critic), Qwen 2.5 7B self-hosted (Writer) |
| Infrastructure | Docker Compose, Alembic migrations |

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
