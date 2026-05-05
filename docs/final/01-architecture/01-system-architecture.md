# Architecture Document - AIMAP Project

## Overview

AIMAP là hệ thống quản lý chiến dịch marketing tự động, sử dụng AI để tạo nội dung và insights.

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Frontend)                              │
│                        Next.js 14 - App Router                          │
│                     http://localhost:3000                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ REST API / WebSocket
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         API SERVER (Backend)                             │
│                      FastAPI - Port 8000                                 │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      ROUTERS (14 endpoints)                      │    │
│  │  auth | brands | campaigns | content | calendar | dashboard      │    │
│  │  workflow | insights | tracking | internal | redirect            │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                       SERVICES (Business Logic)                    │    │
│  │  - workflow_scheduler_service.py  (APScheduler jobs)             │    │
│  │  - calendar_reminder_service.py  (Email reminders)                │    │
│  │  - campaign_delivery_service.py (Campaign dispatch)              │    │
│  │  - customer_analysis_service.py  (Customer data processing)       │    │
│  │  - dashboard_service.py          (Dashboard analytics)           │    │
│  │  - publish_schedule.py            (Scheduling heuristics)         │    │
│  │  - image_prompt_generator.py     (DALL-E prompt generation)     │    │
│  │  - agent_dispatcher.py           (Call agent service)            │    │
│  │  - insight_intelligence/         (AI insight processing)         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                         MODELS (28 tables)                        │    │
│  │  User, Brand, Campaign, ContentItem, Customer, CustomerList       │    │
│  │  WorkflowSchedule, WorkflowJob, FileUpload, AgentRunLog           │    │
│  │  InsightDataSource, InsightChat, InsightCard, InsightAction      │    │
│  │  ... (xem chi tiết trong database-overview.md)                    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP Internal
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       AGENT SERVICE (AI Worker)                          │
│                      FastAPI - Port 8001                                 │
│                   Xử lý AI orchestration, content generation             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Database
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         POSTGRESQL DATABASE                              │
│                       External PostgreSQL Server                          │
│                    (NOT in Docker - Separate host)                        │
│                                                                         
│  DATABASE_URL format: postgresql+asyncpg://user:pass@host:5432/db      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

### Backend
| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | FastAPI 0.104+ | REST API |
| ORM | SQLAlchemy 2.x (async) | Database operations |
| Database | PostgreSQL 16 | Primary database |
| Scheduler | APScheduler | Background jobs |
| Auth | JWT (PyJWT) | Authentication |
| Validation | Pydantic v2 | Request/Response validation |
| AI | OpenAI, Ollama API | AI features |

### Frontend
| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Next.js 14 | Web application |
| UI | Tailwind CSS | Styling |
| State | React Context | State management |
| HTTP | fetch API | API calls |

### Infrastructure
| Component | Technology | Purpose |
|-----------|------------|---------|
| Container | Docker | Development deployment |
| Database | External PostgreSQL | NOT in Docker |

---

## 3. Project Structure

```
cap2/
├── api/                          # Backend (FastAPI)
│   ├── main.py                   # FastAPI app entry point
│   ├── init_db.py                # Database initialization script
│   ├── seed_demo.py              # Demo data seeder
│   │
│   ├── core/                     # ⭐ CORE: Config, DB, Security
│   │   ├── config.py             # Settings (env vars)
│   │   ├── database.py           # Async SQLAlchemy engine + session
│   │   ├── security.py            # JWT, password hashing
│   │   └── deps.py               # Dependency injection helpers
│   │
│   ├── models/                   # ⭐ MODELS: SQLAlchemy ORM (28 files)
│   │   ├── __init__.py           # Export all models
│   │   ├── user.py               # Users table
│   │   ├── brand.py              # Brands table
│   │   ├── campaign.py           # Campaigns table
│   │   ├── content_item.py       # Content items table
│   │   ├── customer.py           # Customers table
│   │   ├── customer_list.py       # Customer lists table
│   │   ├── workflow_schedule.py   # Scheduled workflows
│   │   ├── workflow_job.py       # Workflow execution logs
│   │   ├── file_upload.py        # File storage metadata
│   │   ├── agent_run_log.py      # AI agent execution logs
│   │   ├── insight_*.py          # Insight-related tables (10 files)
│   │   └── campaign_*.py         # Campaign-related tables (4 files)
│   │
│   ├── routers/                  # ⭐ ROUTERS: API endpoints (14 files)
│   │   ├── auth.py               # POST /auth/*
│   │   ├── brands.py             # GET/POST/PUT /brands/*
│   │   ├── campaigns.py          # Campaign CRUD + dispatch
│   │   ├── content.py            # Content items management
│   │   ├── calendar.py           # Calendar integration
│   │   ├── dashboard.py          # Dashboard data
│   │   ├── workflow.py           # Workflow scheduling
│   │   ├── insights.py           # AI insights
│   │   ├── insights_chat.py      # Insight chat interface
│   │   ├── tracking.py           # Email/link tracking
│   │   ├── tracking_links.py     # Campaign tracking links
│   │   ├── campaign_idea.py      # AI campaign ideas
│   │   ├── internal.py           # Internal API (agent service)
│   │   └── redirect.py           # URL shortener redirect
│   │
│   ├── services/                 # ⭐ SERVICES: Business logic
│   │   ├── workflow_scheduler_service.py  # APScheduler jobs
│   │   ├── calendar_reminder_service.py    # Email reminders
│   │   ├── campaign_delivery_service.py   # Campaign to agent
│   │   ├── customer_analysis_service.py    # Customer processing
│   │   ├── dashboard_service.py           # Analytics aggregation
│   │   ├── publish_schedule.py            # Scheduling heuristics
│   │   ├── image_prompt_generator.py      # DALL-E prompts
│   │   ├── agent_dispatcher.py            # Agent service calls
│   │   └── insight_intelligence/          # AI insight processing
│   │       ├── context_builder.py
│   │       ├── intent_classifier.py
│   │       ├── calculator_agent.py
│   │       ├── guidance_agent.py
│   │       ├── data_manipulation_agent.py
│   │       ├── entity_linker.py
│   │       ├── reference_resolver.py
│   │       ├── visualization_planner.py
│   │       ├── response_formatter.py
│   │       └── conversation_memory.py
│   │
│   ├── schemas/                  # ⭐ SCHEMAS: Pydantic validation (5 files)
│   │   ├── user.py              # User request/response schemas
│   │   ├── brand.py             # Brand schemas
│   │   ├── campaign.py          # Campaign schemas
│   │   ├── campaign_idea.py     # Campaign idea schemas
│   │   └── campaign_revenue.py  # Revenue schemas
│   │
│   ├── static/                   # Static files (uploaded images)
│   │   └── uploads/             # User-uploaded content
│   │
│   └── tests/                    # Unit tests
│       ├── test_insights_utils.py
│       ├── test_workflow_utils.py
│       ├── test_calendar_utils.py
│       └── test_phase1_action_and_segment.py
│
├── web/                          # Frontend (Next.js)
│   ├── app/                      # Next.js App Router
│   ├── components/               # React components
│   └── package.json
│
├── agent/                        # AI Agent Service
│   ├── agents/                   # AI agent implementations
│   └── main.py                   # Agent service entry
│
├── docs/                         # Documentation
│   └── final/                    # Final documents
│
├── docker-compose.yml             # Docker orchestration
├── .env                          # Environment variables
└── README.md
```

---

## 4. Database Connection

### Current Setup (External Database)
```
┌──────────────────────────────────────────────┐
│           HOST MACHINE (Database)            │
│                                              │
│   PostgreSQL: 192.168.1.100:5432            │
│   Database: aimap                            │
│   User: aimap                                │
│   Password: [stored in .env]                │
│                                              │
│   NOT in Docker                              │
└──────────────────────────────────────────────┘
                    │
                    │ TCP/IP
                    ▼
┌──────────────────────────────────────────────┐
│            DOCKER CONTAINER (API)             │
│                                              │
│   FastAPI App reads DATABASE_URL from .env   │
│   postgresql+asyncpg://aimap:xxx@host:5432  │
│                                              │
│   ⚠️ host = host.docker.internal (Mac/Win)   │
│   ⚠️ host = 172.17.0.1 (Linux)             │
└──────────────────────────────────────────────┘
```

### Why External Database?
1. **Development flexibility** - Dễ backup, migrate
2. **Resource separation** - Database trên máy mạnh hơn
3. **Team collaboration** - Nhiều dev cùng connect

### Connection String Format
```
DATABASE_URL=postgresql+asyncpg://username:password@host:port/database
```

**IMPORTANT**: Sử dụng `postgresql+asyncpg://` cho async SQLAlchemy, KHÔNG phải `postgresql://`

---

## 5. API Flow Examples

### Example 1: Create Campaign
```
1. User clicks "Tạo chiến dịch" in web
2. POST /campaigns/ with campaign data
3. Router validates with Pydantic schema
4. Service saves to Campaign model
5. agent_dispatcher sends campaign_id to Agent Service
6. Agent Service processes asynchronously
7. Web polls /campaigns/{id} for status
```

### Example 2: View Dashboard
```
1. GET /dashboard/ with user_id
2. dashboard_service aggregates:
   - Campaign stats from campaigns table
   - Revenue from campaign_revenue table
   - Content status from content_items
3. Returns aggregated dashboard data
```

### Example 3: Scheduled Workflow
```
1. APScheduler runs every 5 minutes
2. workflow_scheduler_service queries workflow_schedules
3. Finds schedules where next_run_at <= now
4. Creates workflow_job entries
5. Triggers campaign delivery
```

---

## 6. Security Considerations

### Authentication Flow
```
1. POST /auth/login → returns JWT token
2. Frontend stores token in localStorage/cookie
3. All subsequent requests include: Authorization: Bearer <token>
4. Router validates token via deps.py
5. User data injected into request via dependency
```

### Password Security
- Passwords hashed with bcrypt via security.py
- Never stored in plain text
- JWT tokens expire after 24 hours (configurable)

### CORS Configuration
- Only configured origins allowed
- Stored in CORS_ORIGINS env var
- Default: http://localhost:3000 (development)

---

## 7. Key Configuration (.env)

```bash
# Database
DATABASE_URL=postgresql+asyncpg://aimap:password@192.168.1.100:5432/aimap

# Auth
JWT_SECRET=your-secret-key-min-32-chars
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

# AI Services
OPENAI_API_KEY=sk-...
DEEPSEEK_BASE_URL=http://171.238.156.10:11434/v1
QWEN_MODEL=qwen2.5:14b

# Agent Service
AGENT_SERVICE_URL=http://agent:8001

# Tracking
TRACKING_PUBLIC_BASE_URL=http://localhost:8000
TRACKING_DEFAULT_REDIRECT_URL=http://localhost:3000

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=app-password

# CORS
CORS_ORIGINS=http://localhost:3000
```

---

## 8. Important Notes

### DO NOT DELETE
- `core/` - Config, DB, Security (required by all)
- `models/` - Database schema (28 tables)
- `routers/` - API endpoints (14 files)
- `services/` - Business logic

### FILES NOT IN USE (Can Clean)
- `schemas/` - Pydantic schemas defined but NOT imported by routers
- `init_db.py` - Run manually when needed
- `seed_demo.py` - Run manually for demo data

### DATABASE CONNECTION RULES
1. Always use `postgresql+asyncpg://` prefix
2. Host for Docker: use `host.docker.internal` (Mac/Windows) or IP address (Linux)
3. Test connection: `docker compose exec api python -c "from core.database import engine; print('OK')"`

---

## 9. Maintenance Commands

```bash
# Initialize database tables
docker compose exec api python init_db.py

# Seed demo data
docker compose exec api python seed_demo.py

# Check database connection
docker compose exec api python -c "from core.database import engine; print('DB OK')"

# Run migrations (if using Alembic)
alembic upgrade head

# Create migration
alembic revision --autogenerate -m "description"
```

---

## 10. Architecture Principles

1. **Separation of Concerns** - Routers → Services → Models
2. **Async First** - Use async/await for I/O operations
3. **Configuration via .env** - No hardcoded values
4. **External Database** - Database NOT in Docker for flexibility
5. **Single Source of Truth** - Database is source of truth
6. **Stateless API** - No session state, JWT auth only

---

**Last Updated**: 2026-05-05
**Version**: 1.0
