# AIMAP — AI-Powered Marketing Automation Platform for Small Businesses

Capstone 2 Project

---

## Tổng quan

AIMAP giúp chủ doanh nghiệp nhỏ quản lý chiến dịch marketing với sự hỗ trợ của AI. Thay vì tự viết nội dung, user mô tả mục tiêu và hệ thống sẽ tự động tạo ra chiến dịch hoàn chỉnh.

---

## Tính năng chính

### 1. AI Campaign Assistant
**Tạo chiến dịch tự động bằng AI**

- Chọn thương hiệu → AI gợi ý ý tưởng chiến dịch
- Chỉ cần chọn hoặc nhập ý tưởng của mình
- AI viết tự động: email, bài đăng Facebook, kịch bản video, prompt tạo ảnh
- Xem trước, chỉnh sửa, tạo chiến dịch thật chỉ với 1 click

### 2. Customer Outreach
**Gửi email hàng loạt cá nhân hóa cho từng khách**

- Phân tích khách hàng thành 4 nhóm:
  - Khách sắp rời bỏ (30 ngày chưa mua)
  - Khách tiềm năng (có mua hàng, có tiền)
  - Khách VIP (mua nhiều, chi tiêu lớn)
  - Khách mới (mới đăng ký)
- AI viết email riêng cho từng khách hàng
- Gửi thật qua SMTP/Gmail
- Theo dõi: đã gửi, thất bại, mở email, click

### 3. AI Analyst Insights
**Phân tích dữ liệu bằng AI**

- **Tạo bảng**: Nhập dữ liệu thủ công
- **Upload file**: Import CSV/Excel
- **Phân tích AI**: KPIs, Insights, Actions tự động
- **Chatbot**: Hỏi đáp tự nhiên về dữ liệu

### 4. Custom Tracking Links
**Theo dõi clicks trên custom links**

- User nhập nhiều links với tên + URL
- Hệ thống tự tạo short code để đếm clicks
- Khi gửi email, dùng tracking link làm CTA
- Xem số clicks trên từng link

### 5. Performance Tracking
**Đo lường hiệu quả chiến dịch**

- KPIs: Email gửi, mở, click, open rate, click rate
- Nhập doanh thu để tính ROI
- So sánh với mức trung bình ngành
- Bảng tổng hợp: v_campaign_performance

---

## Sơ đồ tính năng

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AIMAP FEATURES                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │
│  │   BRAND     │    │  CAMPAIGN   │    │   INSIGHTS  │            │
│  │   VAULT     │    │   MANAGER   │    │             │            │
│  └─────────────┘    └─────────────┘    └─────────────┘            │
│         │                  │                  │                   │
│         │    ┌─────────────┼─────────────┐    │                   │
│         │    │             │             │    │                   │
│         ▼    ▼             ▼             ▼    ▼                   │
│  ┌───────────────────────────────────────────────────────┐        │
│  │              AI CAMPAIGN ASSISTANT                    │        │
│  │  Brand → AI gợi ý → Chọn → AI viết nội dung        │        │
│  │  Email | Facebook | Video | Image Prompt             │        │
│  └───────────────────────────────────────────────────────┘        │
│                              │                                    │
│                              ▼                                    │
│  ┌───────────────────────────────────────────────────────┐        │
│  │            CUSTOM TRACKING LINKS                      │        │
│  │  User nhập links → Short code → Đếm clicks          │        │
│  └───────────────────────────────────────────────────────┘        │
│                              │                                    │
│                              ▼                                    │
│  ┌───────────────────────────────────────────────────────┐        │
│  │              CUSTOMER OUTREACH                        │        │
│  │  Phân tích khách → AI viết email → Gửi SMTP         │        │
│  └───────────────────────────────────────────────────────┘        │
│                              │                                    │
│                              ▼                                    │
│  ┌───────────────────────────────────────────────────────┐        │
│  │           PERFORMANCE TRACKING                        │        │
│  │  KPIs | Revenue | ROI | v_campaign_performance        │        │
│  └───────────────────────────────────────────────────────┘        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tài liệu chi tiết

| Tài liệu | Mô tả |
|-----------|--------|
| [docs/product-scope.md](docs/product-scope.md) | Problem, target users, MVP scope, success criteria |
| [docs/mvp-boundary.md](docs/mvp-boundary.md) | What is in / out of MVP |
| [docs/feature-breakdown.md](docs/feature-breakdown.md) | Each feature: input → process → output |
| [docs/architecture.md](docs/architecture.md) | Service diagram, folder structures, data flow |
| [docs/database-schema.md](docs/database-schema.md) | PostgreSQL tables, indexes, key queries |
| [docs/api-contracts.md](docs/api-contracts.md) | All REST endpoints |
| [docs/ui-guidelines.md](docs/ui-guidelines.md) | Color palette, typography, layout specs |
| [docs/agent-orchestration.md](docs/agent-orchestration.md) | Prompt templates, LLM router |
| [docs/mvp-roadmap.md](docs/mvp-roadmap.md) | Sprint plan, task list |
| [docs/demo-script.md](docs/demo-script.md) | Demo flow for capstone committee |
| [docs/final/README.md](docs/final/README.md) | Tài liệu tổng hợp tính năng |
| [docs/final/RM-07-AI-Campaign-Assistant.md](docs/final/RM-07-AI-Campaign-Assistant.md) | Chi tiết AI Campaign Assistant |
| [docs/final/RM-08-AI-Analyst-Insights-Page.md](docs/final/RM-08-AI-Analyst-Insights-Page.md) | Chi tiết AI Analyst |
| [docs/final/29-4 - tinh nang danh sach customer.md](docs/final/29-4%20-%20tinh%20nang%20danh%20sach%20customer.md) | Chi tiết Customer Outreach |
| [docs/final/cai tien tinh nang chien dich.md](docs/final/cai%20tien%20tinh%20nang%20chien%20dich.md) | Cải tiến: Revenue + Tracking Links |
| [docs/final/02-architecture/database-overview.md](docs/final/02-architecture/database-overview.md) | Database schema đầy đủ |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), Tailwind CSS, shadcn/ui |
| Backend API | FastAPI (Python 3.11+), SQLAlchemy async |
| Agent Service | Python 3.11+, custom state machine |
| Database | PostgreSQL 16 |
| LLM: Writer / Summary | Qwen 2.5 7B via Ollama on VPS `171.238.156.10` |
| LLM: Strategist / Critic | OpenAI `gpt-4o-mini` |
| LLM: Deep Analysis | DeepSeek |
| Infra | Docker Compose |

---

## Quick Start

### Prerequisites

- Docker + Docker Compose
- OpenAI API key
- DeepSeek API key (for AI Analyst)
- Qwen VPS running Ollama at `http://171.238.156.10:11434`

### Setup

```bash
# 1. Clone and enter project
cd cap2

# 2. Copy env files
cp api/.env.example api/.env
cp web/.env.example web/.env.local

# 3. Fill in your API keys in api/.env
#    - OPENAI_API_KEY
#    - DEEPSEEK_API_KEY

# 4. Start all services
docker compose up --build

# 5. Run migrations
docker compose exec api alembic upgrade head

# 6. (Optional) Seed demo data
docker compose exec api python seed_demo.py
```

### App runs at

- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs
- Agent service: http://localhost:8001 (internal only)

---

## Project Structure

```
cap2/
├── README.md
├── docker-compose.yml
├── docs/                          # All planning documents
│   ├── product-scope.md
│   ├── mvp-boundary.md
│   ├── feature-breakdown.md
│   ├── architecture.md
│   ├── agent-orchestration.md
│   ├── database-schema.md
│   ├── api-contracts.md
│   ├── ui-guidelines.md
│   ├── mvp-roadmap.md
│   ├── demo-script.md
│   └── final/                     # Completed features documentation
│       ├── README.md
│       ├── RM-07-AI-Campaign-Assistant.md
│       ├── RM-08-AI-Analyst-Insights-Page.md
│       ├── cai tien tinh nang chien dich.md
│       ├── 29-4 - tinh nang danh sach customer.md
│       └── 02-architecture/
│           └── database-overview.md
├── web/                           # Next.js frontend
│   ├── app/
│   │   ├── (app)/               # Authenticated pages
│   │   │   ├── campaigns/        # Campaign management
│   │   │   ├── brand-vault/      # Brand management
│   │   │   ├── customer-lists/   # Customer management
│   │   │   ├── insights/         # AI Analyst
│   │   │   └── calendar/         # Marketing calendar
│   │   └── auth/                 # Auth pages
│   ├── components/
│   │   ├── campaign/            # Campaign components
│   │   ├── campaign-assistant/   # AI Campaign Assistant
│   │   └── ...
│   ├── lib/
│   └── package.json
├── api/                           # FastAPI backend
│   ├── main.py
│   ├── core/
│   ├── models/
│   ├── schemas/
│   ├── routers/
│   ├── services/
│   ├── alembic/
│   └── requirements.txt
└── agent/                         # AI orchestration service
    ├── main.py
    ├── orchestrator.py
    ├── agents/
    ├── llm/
    ├── prompts/
    └── requirements.txt
```

---

## Database Schema Overview

### Core Tables

| Table | Mô tả |
|-------|--------|
| `users` | Người dùng |
| `brands` | Thương hiệu |
| `campaigns` | Chiến dịch marketing |
| `content_items` | Nội dung (email, facebook, video, image) |
| `customer_lists` | Danh sách khách hàng |
| `customers` | Thông tin khách hàng |

### Performance & Tracking

| Table | Mô tả |
|-------|--------|
| `campaign_revenue` | Doanh thu từ chiến dịch |
| `campaign_tracking_links` | Custom tracking links |
| `campaign_execution_logs` | Lịch sử gửi email (sent, opened, clicked) |
| `v_campaign_performance` | View tổng hợp KPIs |

### Insights & Chat

| Table | Mô tả |
|-------|--------|
| `insight_data_sources` | Nguồn dữ liệu (manual, CSV, Excel) |
| `insight_chats` | Phiên chat với AI Analyst |
| `insight_chat_messages` | Tin nhắn trong chat |

---

## API Endpoints Overview

### Campaigns

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/campaigns` | Danh sách chiến dịch |
| POST | `/campaigns` | Tạo chiến dịch mới |
| GET | `/campaigns/{id}` | Chi tiết chiến dịch |
| PUT | `/campaigns/{id}` | Cập nhật chiến dịch |
| DELETE | `/campaigns/{id}` | Xóa chiến dịch |
| GET | `/campaigns/{id}/tracking-links` | Danh sách tracking links |
| POST | `/campaigns/{id}/tracking-links` | Tạo tracking link |

### Customer Outreach

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/customer-lists` | Danh sách khách |
| POST | `/customer-lists` | Tạo danh sách |
| POST | `/customer-lists/{id}/customers` | Thêm khách |
| POST | `/outreach/send` | Gửi email hàng loạt |

### Insights

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/insights/data-sources` | Danh sách nguồn dữ liệu |
| POST | `/insights/data-sources` | Tạo nguồn dữ liệu |
| POST | `/insights/a2a/deep-analysis-stream` | Phân tích AI (stream) |
| GET | `/insights/chats` | Danh sách chat sessions |
| POST | `/insights/chats/{id}/messages` | Gửi tin nhắn chat |

### Tracking

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/r/{short_code}` | Redirect + đếm click |
| GET | `/track/open/{token}` | Tracking email open |
| GET | `/track/click/{token}` | Tracking email click |

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

---

## License

Capstone 2 Project - 2026
