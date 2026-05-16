# AIMAP - Phân Tích Kiến Trúc Hệ Thống Toàn Diện

## 📋 Tổng Quan

AIMAP là một **nền tảng tự động hóa marketing được hỗ trợ bởi AI** cho các chủ doanh nghiệp nhỏ. Hệ thống giúp tạo, quản lý và theo dõi các chiến dịch marketing mà không cần chuyên môn kỹ thuật.

---

## 🏗️ KIẾN TRÚC HỆ THỐNG (5 TẦNG)

### Tầng 1: Giao Diện Người Dùng (Frontend)
**Công Nghệ**: Next.js + React + Tailwind CSS
**Port**: 3000

Đây là cái mà người dùng nhìn thấy và tương tác.

**Tính năng giao diện**:
- 🏢 Quản lý thương hiệu
- 📢 Tạo chiến dịch
- 📧 Quản lý nội dung
- 📊 Xem báo cáo & phân tích
- ⚙️ Cài đặt quy trình tự động

---

### Tầng 2: API Gateway & Routers
**Công Nghệ**: FastAPI (Python) + Uvicorn
**Port**: 8000

**Các API Router chính**:

| Router | Chức Năng |
|--------|-----------|
| `brands.py` | Quản lý thương hiệu (tạo, chỉnh sửa, xóa) |
| `campaigns.py` | Quản lý chiến dịch (tạo, thực thi, theo dõi) |
| `campaign_idea.py` | AI gợi ý ý tưởng chiến dịch |
| `content.py` | Quản lý nội dung (email, social, video) |
| `tracking.py` + `tracking_links.py` | Theo dõi clicks và tạo short links |
| `insights.py` + `insights_chat.py` | Phân tích dữ liệu & chatbot AI |
| `workflow.py` | Quy trình tự động & công việc lặp lại |
| `calendar.py` | Lịch & nhắc nhở hàng ngày |
| `auth.py` | Đăng nhập & quản lý người dùng |
| `internal.py` | API nội bộ cho các tác vụ hệ thống |

---

### Tầng 3: Business Logic Services
**Công Nghệ**: Python Services (Async/Scheduler)

**Các Service chính**:

#### 🤖 Agent Dispatcher
- **Chức năng**: Điều phối các AI agents theo quy trình
- **Xử lý**: Gọi Strategist → Writer → Critic theo trình tự
- **Kết quả**: Nội dung marketing (email, Facebook, video, image)

#### 📅 Publish Schedule Service
- **Chức năng**: Lên lịch phát hành nội dung
- **Logic**: Tính toán ngày giờ tốt nhất dựa trên:
  - Kênh gửi (email, Facebook, video)
  - Ngày trong tuần
  - Ngày lễ Việt Nam
  - Hạn chót chiến dịch

#### 📧 Campaign Delivery Service
- **Chức năng**: Gửi email hàng loạt, theo dõi kết quả
- **Tích hợp**: SMTP/Gmail
- **Theo dõi**: Thư gửi, mở, click, bounce, failed

#### 📊 Customer Analysis Service
- **Chức năng**: Phân tích khách hàng thành các nhóm:
  - Khách sắp rời (30 ngày không mua)
  - Khách tiềm năng (có mua, có tiền)
  - Khách VIP (mua nhiều, chi tiêu cao)
  - Khách mới
- **Output**: Gợi ý hành động marketing cho mỗi nhóm

#### 📈 Dashboard Service
- **Chức năng**: Tính toán metrics & KPI cho dashboard
- **Dữ liệu**: Số chiến dịch, tỷ lệ mở, conversions, etc.

#### ⏰ Calendar Reminder Service
- **Chức năng**: Gửi email nhắc nhở hàng ngày
- **Cron**: Chạy mỗi ngày vào giờ cố định
- **Nội dung**: Nhắc chiến dịch sắp phát hành

#### 🔄 Workflow Scheduler Service
- **Chức năng**: Chạy quy trình tự động
- **Ví dụ**: Gửi email follow-up mỗi 3 ngày
- **Cron**: Chạy định kỳ để kiểm tra công việc đến hạn

#### 🖼️ Image Prompt Generator
- **Chức năng**: Tạo prompt mô tả để AI vẽ ảnh
- **Output**: Prompt cho Midjourney, DALL-E, hay Qwen

---

### Tầng 4: AI Agents (Bộ Não Sáng Tạo)
**Công Nghệ**: Python Agents + Async
**Port**: 8001

**3 Agents làm việc theo team**:

#### 1️⃣ Strategist Agent
- **Input**: Tên chiến dịch, ngành, mục tiêu
- **Output**: Chiến lược (mục tiêu cụ thể, đối tượng, hooks, channels)
- **LLM**: OpenAI GPT-4 hoặc Qwen

#### 2️⃣ Writer Agent
- **Input**: Chiến lược từ Strategist
- **Output**: 4 bản nội dung cụ thể:
  - Email marketing
  - Bài đăng Facebook
  - Kịch bản video TikTok/Reels
  - Prompt tạo ảnh (AI image generation)
- **LLM**: OpenAI GPT-3.5 hoặc Qwen (tốc độ)

#### 3️⃣ Critic Agent
- **Input**: Nội dung từ Writer
- **Output**: Đánh giá + gợi ý cải thiện
- **Kiểm tra**: Tone, format, grammar, brand consistency
- **LLM**: OpenAI GPT-4 hoặc Qwen

---

### Tầng 5: LLM Router & Data Storage
**Công Nghệ**: OpenAI API + Qwen API + PostgreSQL

#### 🧠 LLM Router
- **Chức năng**: Chọn AI model phù hợp cho từng tác vụ
- **Logic**:
  - Tasks yêu cầu chất lượng cao → **OpenAI GPT-4**
  - Tasks yêu cầu tốc độ → **Qwen** (Alibaba, rẻ hơn)
  - Tasks creative → **OpenAI**
  - Tasks analysis → **Qwen**

#### 🌐 LLM Providers

| Provider | Ưu Điểm | Nhược Điểm |
|----------|---------|-----------|
| **OpenAI (GPT-4)** | Chất lượng cao, creative tốt | Giá đắt, chậm |
| **Qwen (Alibaba)** | Giá rẻ, nhanh, hỗ trợ tiếng Việt | Chất lượng hơi thấp |

#### 💾 PostgreSQL Database
- **Chức năng**: Lưu trữ tất cả dữ liệu hệ thống
- **Bảng chính**:
  - `users` - Người dùng
  - `brands` - Thương hiệu
  - `campaigns` - Chiến dịch
  - `content_items` - Nội dung (email, social, etc.)
  - `customers` - Danh sách khách hàng
  - `campaign_execution_log` - Lịch sử gửi email
  - `insight_raw_snapshot` - Dữ liệu phân tích
  - `workflow_schedule` - Quy trình tự động

---

## 📊 PHÂN CÔNG TỪng TÍNH NĂNG

### 🏢 Quản Lý Thương Hiệu
```
User Input → brands.py Router → svc_dashboard Service → PostgreSQL
                ↓
            Strategist Agent (nếu AI generate mô tả)
                ↓
            OpenAI/Qwen LLM
```

### 📢 Tạo Chiến Dịch
```
User Input → campaigns.py Router → agent_dispatcher Service
                ↓
    ┌─────────────────────────┬──────────────────────┐
    ↓                         ↓                      ↓
1. Strategist Agent      2. Writer Agent       3. Critic Agent
   (rạp kế hoạch)          (viết nội dung)       (kiểm tra)
    ↓                         ↓                      ↓
GPT-4 / Qwen           GPT-3.5 / Qwen          GPT-4 / Qwen
                ↓
            Lưu vào PostgreSQL
                ↓
    Hiển thị trong web UI để User chỉnh sửa
```

### 📧 Gửi Chiến Dịch
```
User "Confirm" → campaigns.py Router → publish_schedule Service
                ↓
            Tính toán ngày giờ tốt nhất
                ↓
            campaign_delivery Service
                ↓
            SMTP/Gmail → Khách hàng
                ↓
            Lưu log gửi vào PostgreSQL
                ↓
            Campaign Execution Log (tracking)
```

### 📊 Phân Tích Khách Hàng
```
User Upload CSV → insights.py Router → customer_analysis Service
                ↓
            Phân tích & Segmentation
                ↓
            AI gợi ý Actions
                ↓
            Lưu vào PostgreSQL
                ↓
            Hiển thị trong insights dashboard
                ↓
            User hỏi chatbot (insights_chat.py)
                ↓
            OpenAI/Qwen API → Trả lời tự nhiên
```

### ⚙️ Quy Trình Tự Động
```
User Create Workflow → workflow.py Router → Lưu vào PostgreSQL
                ↓
        workflow_scheduler_service (chạy định kỳ)
                ↓
            Kiểm tra công việc đến hạn
                ↓
            Thực thi (gửi email, tạo task, etc.)
                ↓
            Cập nhật database
```

---

## 🚀 LUỒNG DỮ LIỆU CHÍNH

### 1. Luồng Tạo Chiến Dịch (Campaign Creation)
```
┌─────────────────────────────────────────────────────────────┐
│                      USER (Browser)                          │
├─────────────────────────────────────────────────────────────┤
│  Nhập: Tên chiến dịch, mục tiêu, sản phẩm, hạn chót, kênh  │
│  Bấm: "AI Create Campaign"                                   │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTP POST /campaigns/create
                 ↓
┌─────────────────────────────────────────────────────────────┐
│           API Service (FastAPI - Port 8000)                  │
├─────────────────────────────────────────────────────────────┤
│  Route: campaigns.py                                          │
│  - Validate input                                             │
│  - Call agent_dispatcher service                              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────┐
│          Agent Dispatcher Service                             │
├─────────────────────────────────────────────────────────────┤
│  1. Call Strategist Agent                                     │
│  2. Wait for strategy result                                  │
│  3. Call Writer Agent with strategy                           │
│  4. Wait for content result                                   │
│  5. Call Critic Agent with content                            │
│  6. Get quality review                                        │
│  7. Return combined result                                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────┐
│       Agent Service (FastAPI - Port 8001)                    │
├─────────────────────────────────────────────────────────────┤
│  Orchestrator.py → Handles 3 agents in sequence               │
│  - Strategist: "What should the strategy be?"                │
│  - Writer: "Write content based on strategy"                 │
│  - Critic: "Rate and improve the content"                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ├─────────────────────────────────────────┐
                 ↓                                         ↓
        ┌─────────────────┐                    ┌─────────────────┐
        │  OpenAI API     │                    │  Qwen API       │
        │  (GPT-4, 3.5)   │                    │  (Alibaba LLM)  │
        └────────┬────────┘                    └────────┬────────┘
                 └────────────────────┬─────────────────┘
                                     │ AI Response
                                     ↓
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                        │
├─────────────────────────────────────────────────────────────┤
│  INSERT INTO campaigns (...)                                  │
│  INSERT INTO content_items (...)                              │
│  UPDATE campaign_execution_log (...)                          │
└────────────────┬────────────────────────────────────────────┘
                 │ Response
                 ↓
┌─────────────────────────────────────────────────────────────┐
│           API Service (Return to Client)                      │
├─────────────────────────────────────────────────────────────┤
│  Response: {                                                  │
│    "campaign_id": "uuid",                                     │
│    "strategy": "...",                                         │
│    "content": {                                               │
│      "email": "...",                                          │
│      "facebook": "...",                                       │
│      "video_script": "...",                                   │
│      "image_prompt": "..."                                    │
│    }                                                          │
│  }                                                            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────┐
│                   USER (Browser)                              │
├─────────────────────────────────────────────────────────────┤
│  Xem 4 bản nội dung AI viết                                  │
│  Chỉnh sửa nếu cần                                            │
│  Bấm "Save & Publish"                                         │
└─────────────────────────────────────────────────────────────┘
```

### 2. Luồng Gửi Chiến Dịch (Campaign Delivery)
```
User "Send Campaign"
        ↓
campaigns.py → publish_schedule Service
        ↓
Tính: Ngày gửi tốt nhất cho mỗi kênh (với algorithm Việt)
        ↓
Lưu lịch vào database
        ↓
Định kỳ: workflow_scheduler_service kiểm tra
        ↓
campaign_delivery Service
        ↓
Gửi email qua SMTP/Gmail
        ↓
Cập nhật: campaign_execution_log (sent, opened, clicked, bounced)
        ↓
User xem dashboard → Thống kê kết quả
```

### 3. Luồng Phân Tích Khách Hàng (Customer Analytics)
```
User Upload CSV
        ↓
insights.py Router
        ↓
customer_analysis Service
        ↓
Phân tích & Segmentation (4 nhóm khách)
        ↓
AI gợi ý Actions
        ↓
Lưu vào: insight_raw_snapshot, insight_result_snapshot
        ↓
User xem dashboard hoặc
        ↓
User hỏi chatbot (insights_chat.py)
        ↓
OpenAI/Qwen → Trả lời natural language
        ↓
Hiển thị kết quả
```

---

## 🌐 DEPLOYMENT & INFRASTRUCTURE

### Docker Architecture
```
Docker Host
├── Container 1: API Service (Port 8000)
│   └── FastAPI + Python + PostgreSQL Client
├── Container 2: Agent Service (Port 8001)
│   └── Agent Orchestrator + LLM Clients
├── Container 3: Web Frontend (Port 3000)
│   └── Next.js + Node.js
└── Docker Network Bridge
    ├── DNS: api (resolves to API container)
    ├── DNS: agent (resolves to Agent container)
    └── DNS: web (resolves to Web container)

External Services:
├── PostgreSQL 16 Database (Managed service)
├── OpenAI API
├── Qwen API
├── SMTP Server (Email relay)
└── Cloudinary CDN (Image storage)
```

### Exposed Ports
- **8000**: API Service (FastAPI)
- **8001**: Agent Service
- **3000**: Frontend (Next.js)

---

## 📈 SCALING & PERFORMANCE

### Hiện Tại:
- Single instance (development/MVP)
- Synchronous processing cho requests
- Async jobs cho long-running tasks (agent calls)

### Để scale lên production:
1. **Load Balancer**: Nginx/HAProxy cho multiple API instances
2. **Message Queue**: Redis/RabbitMQ cho async tasks
3. **Worker Pool**: Multiple agents processing in parallel
4. **Database**: Connection pooling, read replicas
5. **Caching**: Redis cache cho frequently accessed data
6. **CDN**: Cloudinary cho images, CloudFlare cho frontend

---

## 🔐 SECURITY ARCHITECTURE

1. **Authentication**: JWT tokens (auth.py)
2. **Authorization**: User-scoped data access
3. **Database**: PostgreSQL with role-based access
4. **API**: CORS configured, input validation
5. **External APIs**: API keys stored in environment
6. **Data**: Sensitive data encrypted at rest

---

## 📝 TÓML VỤC TẠO DIAGRAM

| File | Mục Đích | Đối Tượng |
|------|----------|----------|
| `DIAGRAMS_PLANTUML_07_DEPLOYMENT.puml` | Kiến trúc Docker & deployment | DevOps/Engineers |
| `DIAGRAMS_PLANTUML_08_ALLOCATION_SERVICES.puml` | Phân công tính năng (chi tiết) | Developers/Architects |
| `DIAGRAMS_PLANTUML_09_LOWTECH_SIMPLE.puml` | Giải thích đơn giản cho người không chuyên | Non-technical users |
| `DIAGRAMS_PLANTUML_10_FEATURE_ALLOCATION.puml` | Bảng phân công chi tiết | Project Managers |
| `DIAGRAMS_PLANTUML_11_ARCHITECTURE_EXPLAINED.puml` | Kiến trúc dễ hiểu | Everyone |

---

## 🎯 TÓM LẠI

### AIMAP gồm 3 phần chính:

1. **Frontend** (Website) - Nơi người dùng tương tác
2. **Backend** (API + Services) - Xử lý logic & quản lý dữ liệu
3. **AI Agents** (Orchestrator + LLMs) - Tạo nội dung marketing

### Quy trình chính:
```
User Input 
  → API Router 
  → Business Logic Service 
  → AI Agents (nếu cần) 
  → Database 
  → External Services (Email, CDN) 
  → Response to User
```

### Công nghệ stack:
- **Frontend**: Next.js
- **Backend**: FastAPI (Python)
- **AI**: OpenAI + Qwen
- **Database**: PostgreSQL
- **Deployment**: Docker + Docker Compose

---

**Tác giả**: AIMAP Architecture Team  
**Ngày cập nhật**: May 2026  
**Phiên bản**: 1.0
