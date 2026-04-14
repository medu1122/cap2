# AIMAP — AI-Powered Marketing Automation Platform for Small Businesses

Capstone 2 Project

---

## Overview

AIMAP helps small business owners create, review, and manage marketing campaigns using an AI multi-agent system. Instead of writing content manually, users describe their campaign goal, and three AI agents (Strategist, Writer, Critic) collaborate to produce ready-to-approve content.

---

## Documentation

Start here before coding:

| Doc | Description |
|---|---|
| [docs/product-scope.md](docs/product-scope.md) | Problem, target users, MVP scope, success criteria |
| [docs/mvp-boundary.md](docs/mvp-boundary.md) | What is in / out of MVP — read before adding any feature |
| [docs/feature-breakdown.md](docs/feature-breakdown.md) | Each feature: input → process → output → states |
| [docs/architecture.md](docs/architecture.md) | Service diagram, folder structures, data flow |
| [docs/agent-orchestration.md](docs/agent-orchestration.md) | Prompt templates, LLM router, error handling code |
| [docs/database-schema.md](docs/database-schema.md) | PostgreSQL tables, indexes, key queries |
| [docs/api-contracts.md](docs/api-contracts.md) | All REST endpoints with request/response shapes |
| [docs/ui-guidelines.md](docs/ui-guidelines.md) | Color palette, typography, layout specs, component specs |
| [docs/mvp-roadmap.md](docs/mvp-roadmap.md) | Sprint plan, task list, dependency order |
| [docs/demo-script.md](docs/demo-script.md) | Demo flow for capstone committee, Q&A prep |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS, shadcn/ui |
| Backend API | FastAPI (Python 3.11+), SQLAlchemy async |
| Agent Service | Python 3.11+, custom state machine |
| Database | PostgreSQL 16 |
| LLM: Writer / Summary | Qwen 2.5 7B via Ollama on VPS `171.238.156.10` |
| LLM: Strategist / Critic | OpenAI `gpt-4o-mini` |
| Infra | Docker Compose |

---

## Quick Start

### Prerequisites

- Docker + Docker Compose
- OpenAI API key
- Qwen VPS running Ollama at `http://171.238.156.10:11434`

### Setup

```bash
# 1. Clone and enter project
cd cap2

# 2. Copy env files
cp api/.env.example api/.env
cp web/.env.example web/.env.local

# 3. Fill in your OPENAI_API_KEY in api/.env

# 4. Start all services
docker compose up --build

# 5. Run migrations
docker compose exec api alembic upgrade head

# 6. (Optional) Seed demo data
docker compose exec api python seed_demo.py
```

App runs at:
- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs
- Agent service: http://localhost:8001 (internal only)

---

## Project Structure

```
cap2/
├── README.md
├── docker-compose.yml
├── docs/                          ← All planning documents
│   ├── product-scope.md
│   ├── mvp-boundary.md
│   ├── feature-breakdown.md
│   ├── architecture.md
│   ├── agent-orchestration.md
│   ├── database-schema.md
│   ├── api-contracts.md
│   ├── ui-guidelines.md
│   ├── mvp-roadmap.md
│   └── demo-script.md
├── web/                           ← Next.js frontend
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── package.json
├── api/                           ← FastAPI backend
│   ├── main.py
│   ├── core/
│   ├── models/
│   ├── schemas/
│   ├── routers/
│   ├── services/
│   ├── alembic/
│   └── requirements.txt
└── agent/                         ← AI orchestration service
    ├── main.py
    ├── orchestrator.py
    ├── agents/
    ├── llm/
    ├── prompts/
    └── requirements.txt
```

---

## Development Order

Follow sprints in [docs/mvp-roadmap.md](docs/mvp-roadmap.md):

1. **Sprint 0** — Docker Compose + DB migrations
2. **Sprint 1** — Auth + Brand Vault
3. **Sprint 2** — Campaign brief + AI orchestration (core)
4. **Sprint 3** — Approval flow
5. **Sprint 4** — Marketing Calendar
6. **Sprint 5** — Dashboard
7. **Sprint 6** — Polish + workflow automation
