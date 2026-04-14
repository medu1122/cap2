# Architecture — AIMAP

---

## 1. System Overview

AIMAP is split into **three services** that communicate over HTTP:

| Service | Technology | Responsibility |
|---|---|---|
| `web` | Next.js 14 (App Router) | UI, user interactions, SSR pages |
| `api` | FastAPI (Python 3.11+) | Business logic, data persistence, job dispatch |
| `agent` | Python 3.11+ (standalone) | AI orchestration — Strategist, Writer, Critic pipeline |

All three services run on the same machine (or Docker Compose stack) for the capstone.

---

## 2. High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        Browser (User)                            │
└─────────────────────────┬────────────────────────────────────────┘
                          │ HTTPS
┌─────────────────────────▼────────────────────────────────────────┐
│                   Next.js Web Service (port 3000)                │
│  Pages: Dashboard / Campaigns / Calendar / Brand Vault / Approve │
│  API Routes: /api/* → proxy to FastAPI                           │
└─────────────────────────┬────────────────────────────────────────┘
                          │ HTTP REST
┌─────────────────────────▼────────────────────────────────────────┐
│                  FastAPI Backend (port 8000)                      │
│  Routers: /auth /brands /campaigns /content /calendar /workflow  │
│  Services: CampaignService, ApprovalService, DashboardService    │
│  Job Dispatch → Agent Service via HTTP callback / direct call    │
└──────┬──────────────────────────────────────┬────────────────────┘
       │                                      │
       │ PostgreSQL                           │ HTTP POST /run
┌──────▼──────────┐                ┌──────────▼──────────────────┐
│   PostgreSQL DB  │                │  Agent Orchestration Service │
│   (port 5432)    │                │  (port 8001, internal only) │
└─────────────────┘                │                              │
                                   │  ┌────────────────────────┐ │
                                   │  │ Strategist Agent Step  │ │
                                   │  └──────────┬─────────────┘ │
                                   │             │                │
                                   │  ┌──────────▼─────────────┐ │
                                   │  │ Writer Agent Step      │ │
                                   │  └──────────┬─────────────┘ │
                                   │             │                │
                                   │  ┌──────────▼─────────────┐ │
                                   │  │ Critic Agent Step      │ │
                                   │  └──────────┬─────────────┘ │
                                   │             │                │
                                   │  Writes back to FastAPI /   │
                                   │  internal DB via REST calls  │
                                   └─────────────────────────────┘
                                              │         │
                              ┌───────────────┘         └───────────────┐
                    ┌─────────▼──────────┐               ┌──────────────▼──────┐
                    │  Qwen 2.5 7B VPS   │               │  OpenAI API          │
                    │  171.238.156.10    │               │  api.openai.com      │
                    │  (Writer / Summary) │               │  (Strategist/Critic) │
                    └────────────────────┘               └─────────────────────┘
```

---

## 3. Service Details

### 3.1 Next.js Web (`web/`)

```
web/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx            # Sidebar + topbar shell
│   │   ├── dashboard/page.tsx
│   │   ├── campaigns/
│   │   │   ├── page.tsx          # Campaign list
│   │   │   ├── new/page.tsx      # Brief intake form
│   │   │   └── [id]/page.tsx     # Campaign detail + agent logs
│   │   ├── calendar/page.tsx
│   │   ├── brand-vault/page.tsx
│   │   └── approve/page.tsx      # Approval queue
│   └── api/                      # Next.js route handlers (proxy to FastAPI)
├── components/
│   ├── ui/                       # Base: Button, Input, Badge, Card, etc.
│   ├── layout/                   # Sidebar, Topbar, PageHeader
│   ├── campaigns/                # BriefForm, CampaignCard, AgentLogTimeline
│   ├── calendar/                 # CalendarGrid, ContentDot, ContentDetailPanel
│   └── dashboard/                # StatCard, ActivityFeed, AiSummaryBox
├── lib/
│   ├── api-client.ts             # Fetch wrapper for FastAPI
│   └── utils.ts
└── middleware.ts                  # Auth guard
```

**State management**: Server Components + React Context for auth. No Redux/Zustand needed at MVP scale.

---

### 3.2 FastAPI Backend (`api/`)

```
api/
├── main.py                        # App factory, middleware, router mounts
├── core/
│   ├── config.py                  # Settings (DB URL, API keys, agent URL)
│   ├── database.py                # SQLAlchemy async engine + session
│   ├── security.py                # JWT encode/decode, password hashing
│   └── deps.py                    # FastAPI dependency injection
├── models/                        # SQLAlchemy ORM models
│   ├── user.py
│   ├── brand.py
│   ├── campaign.py
│   ├── content_item.py
│   ├── agent_run_log.py
│   └── workflow_job.py
├── schemas/                       # Pydantic request/response schemas
│   ├── user.py
│   ├── brand.py
│   ├── campaign.py
│   ├── content_item.py
│   └── dashboard.py
├── routers/
│   ├── auth.py                    # POST /auth/login, /auth/register
│   ├── brands.py                  # GET/PUT /brands/me
│   ├── campaigns.py               # CRUD /campaigns, POST /campaigns/{id}/run
│   ├── content.py                 # GET /content, PATCH /content/{id}/approve
│   ├── calendar.py                # GET /calendar?month=YYYY-MM
│   ├── dashboard.py               # GET /dashboard/stats, /dashboard/summary
│   └── workflow.py                # POST /workflow/trigger
└── services/
    ├── campaign_service.py
    ├── approval_service.py
    ├── dashboard_service.py
    └── agent_dispatcher.py        # HTTP call to Agent service
```

---

### 3.3 Agent Orchestration Service (`agent/`)

```
agent/
├── main.py                        # FastAPI app (internal only, port 8001)
├── orchestrator.py                # Main state machine / pipeline runner
├── agents/
│   ├── base.py                    # Abstract agent with LLM call, log writer
│   ├── strategist.py              # Strategist agent implementation
│   ├── writer.py                  # Writer agent (per-channel logic)
│   └── critic.py                  # Critic agent implementation
├── llm/
│   ├── router.py                  # Model routing logic (Qwen vs OpenAI)
│   ├── openai_client.py           # OpenAI API wrapper
│   └── qwen_client.py             # Qwen VPS wrapper (OpenAI-compatible API)
├── prompts/
│   ├── strategist_prompt.py
│   ├── writer_prompts/
│   │   ├── facebook_post.py
│   │   ├── email.py
│   │   └── video_script.py
│   └── critic_prompt.py
└── schemas.py                     # Shared input/output schemas for agent pipeline
```

---

## 4. Data Flow: Campaign Orchestration

```
POST /campaigns/{id}/run  (FastAPI)
        │
        ├── validate campaign + brand vault exists
        ├── update campaign status → "running"
        └── POST http://agent-service:8001/run  { campaign_id, brief, brand_vault }

Agent Service receives job:
        │
        ├── Step 1: Strategist
        │     ├── build_prompt(brief, brand_vault)
        │     ├── call OpenAI gpt-4o-mini
        │     ├── parse → CampaignPlan
        │     └── POST /internal/logs  { agent: "strategist", ... }
        │
        ├── Step 2: Writer (loop per deliverable)
        │     ├── build_channel_prompt(deliverable, brand_vault, plan)
        │     ├── call Qwen 2.5 7B (fallback: OpenAI)
        │     ├── parse → DraftContent
        │     └── POST /internal/content  { campaign_id, channel, status: "draft" }
        │
        ├── Step 3: Critic (loop per draft)
        │     ├── build_review_prompt(draft, deliverable, brand_vault)
        │     ├── call OpenAI gpt-4o-mini
        │     ├── parse → FinalContent
        │     └── PATCH /internal/content/{id}  { content: final, status: "pending_approval" }
        │
        └── Finalize
              └── PATCH /internal/campaigns/{id}  { status: "pending_approval" }
```

---

## 5. Model Routing

```python
# agent/llm/router.py

ROUTING_TABLE = {
    "strategist":    "openai",
    "writer":        "qwen",
    "critic":        "openai",
    "dashboard_ai":  "qwen",
}

def get_client(agent_name: str):
    provider = ROUTING_TABLE.get(agent_name, "openai")
    if provider == "qwen":
        return qwen_client  # tries VPS first
    return openai_client
```

Qwen VPS is accessed via OpenAI-compatible API endpoint:
```
base_url = "http://171.238.156.10:11434/v1"
model    = "qwen2.5:7b"
api_key  = "ollama"  # placeholder, Ollama doesn't require real key
```

---

## 6. Authentication Flow

- Registration: `POST /auth/register` → hash password (bcrypt) → save user.
- Login: `POST /auth/login` → verify password → return JWT (access + refresh).
- All protected routes: `Authorization: Bearer <token>` header.
- Next.js middleware checks JWT presence → redirects to `/login` if missing.

---

## 7. Infrastructure (Capstone / Local)

```
docker-compose.yml
├── db          → postgres:16-alpine
├── api         → python:3.11 + fastapi + uvicorn (port 8000)
├── agent       → python:3.11 + agent service (port 8001, internal)
└── web         → node:20 + next.js (port 3000)
```

External dependencies (not containerized):
- Qwen VPS: `http://171.238.156.10` (must be reachable from agent container)
- OpenAI API: `https://api.openai.com` (requires `OPENAI_API_KEY`)

---

## 8. Environment Variables

```env
# api/.env
DATABASE_URL=postgresql+asyncpg://aimap:aimap@db:5432/aimap
JWT_SECRET=change_this_secret
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

AGENT_SERVICE_URL=http://agent:8001

OPENAI_API_KEY=sk-...
QWEN_BASE_URL=http://171.238.156.10:11434/v1
QWEN_MODEL=qwen2.5:7b
QWEN_TIMEOUT=15

# web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 9. Cap nhat kien truc cho Admin

- Bo sung actor `Admin` trong context: quan tri he thong, khong thao tac campaign noi dung hang ngay nhu user.
- Bo sung admin routes trong API layer (`/admin/*`) voi guard rieng.
- Bo sung 2 thanh phan du lieu he thong:
  - `admin_action_logs` (audit)
  - `system_settings` (cau hinh van hanh)
- Frontend tach khu vuc `/admin/*` voi sidebar rieng de tranh nham luong voi workspace user.
