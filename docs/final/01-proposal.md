# Đề xuất Dự án — AIMAP

**AI-Powered Marketing Automation Platform for Small Businesses**

---

## Thông tin Dự án

| Mục | Nội dung |
|---|---|
| Tên đề tài | AIMAP — AI-Powered Marketing Automation Platform for Small Businesses |
| Loại dự án | Ứng dụng web fullstack tích hợp AI đa tác nhân (Multi-Agent AI System) |
| Đối tượng hướng đến | Doanh nghiệp nhỏ và vừa (SMB) tại Việt Nam |
| Thời gian thực hiện | 9 tuần (3 sprints × 3 tuần) |
| Công nghệ chính | Next.js 14, FastAPI, PostgreSQL, OpenAI API, Qwen 2.5 7B |

---

## 1. Bối cảnh và Vấn đề

### 1.1 Bối cảnh thực tế

Tại Việt Nam, có hơn **5 triệu doanh nghiệp vừa và nhỏ** hoạt động trong các lĩnh vực F&B, bán lẻ, dịch vụ cá nhân. Đây là nhóm có nhu cầu marketing cao nhất nhưng lại có ít tài nguyên nhất để thực hiện marketing chuyên nghiệp.

Theo thống kê năm 2024:
- **68%** SMB chủ quán tự làm marketing mà không có nhân viên chuyên trách
- Trung bình **15–20 giờ/tháng** dành cho việc viết nội dung, đăng bài, gửi email
- **74%** cho biết họ không nhất quán trong việc duy trì giọng văn thương hiệu
- **82%** không có kế hoạch marketing theo lịch — chủ yếu đăng bài theo cảm hứng

### 1.2 Nỗi đau cụ thể (User Pain Points)

| Pain Point | Biểu hiện | Hậu quả |
|---|---|---|
| Thiếu thời gian | Viết 1 caption mất 30–60 phút | Đăng bài không đều, mất reach |
| Thiếu kiến thức marketing | Không biết viết email marketing, script video | Chỉ dùng 1–2 kênh, bỏ lỡ audience |
| Không nhất quán thương hiệu | Bài này viết thế này, bài kia viết kiểu khác | Khách không nhớ thương hiệu |
| Không có quy trình | Mọi thứ trong đầu hoặc ghi chú lộn xộn | Mất nội dung tốt, không tái sử dụng được |
| Chi phí agency cao | Agency nhỏ tốn 5–15 triệu/tháng | Không đủ ngân sách, bỏ trống marketing |

### 1.3 Giải pháp hiện tại và hạn chế

| Công cụ hiện có | Hạn chế với SMB Việt Nam |
|---|---|
| ChatGPT / Claude | Phải biết viết prompt tốt; không nhớ thương hiệu; không có workflow |
| Canva AI | Chủ yếu về design, không có AI content strategy |
| Hootsuite / Buffer | Lên lịch đăng bài nhưng không tạo nội dung |
| Agency | Chi phí cao, không phù hợp SMB nhỏ |

**Khoảng trống thị trường**: Chưa có công cụ nào kết hợp được (1) AI tạo nội dung theo đúng brand voice, (2) multi-channel từ 1 brief, và (3) workflow phê duyệt có kiểm soát — phù hợp ngân sách SMB.

---

## 2. Mục tiêu Dự án

### 2.1 Mục tiêu chính

Xây dựng nền tảng AIMAP cho phép chủ doanh nghiệp nhỏ:

1. **Mô tả mục tiêu marketing** bằng ngôn ngữ tự nhiên (không cần biết kỹ thuật)
2. **Nhận nội dung chất lượng** cho nhiều kênh (Facebook, Email, Video Script) trong vài phút
3. **Kiểm soát hoàn toàn** — duyệt/từ chối trước khi bất kỳ nội dung nào được dùng
4. **Duy trì nhất quán thương hiệu** thông qua Brand Vault được AI sử dụng

### 2.2 Mục tiêu kỹ thuật (Capstone)

| Mục tiêu | Tiêu chí đo lường |
|---|---|
| Multi-agent AI pipeline | 3 agents (Strategist, Writer, Critic) chạy nối tiếp, có agent logs |
| Hybrid LLM routing | OpenAI + Qwen VPS với fallback tự động |
| Full-stack web platform | Next.js frontend + FastAPI backend + Agent service |
| Database design | PostgreSQL 23 bảng với proper relationships, indexes |
| Containerized deployment | Docker Compose, chạy được trên VPS với 1 lệnh |
| End-to-end demo | Brief → 3 content items trong dưới 90 giây |

---

## 3. Phạm vi Dự án

### 3.1 Trong phạm vi (In Scope)

| # | Tính năng | Loại |
|---|---|---|
| F01 | Authentication & User Profile | Must-have |
| F02 | Brand Vault (AI Brand Memory) | Must-have |
| F03 | Campaign Brief Intake | Must-have |
| F04 | Multi-Agent Orchestrator (Strategist → Writer → Critic) | Must-have |
| F05 | Content Storage & Versioning | Must-have |
| F06 | Human Approval Flow | Must-have |
| F07 | Marketing Calendar | Must-have |
| F08 | Dashboard & AI Summary | Must-have |
| F09 | Workflow Automation (Schedule + CSV Upload Trigger) | Should-have |
| F10 | In-app Notifications & Customer Lists | Should-have |

### 3.2 Ngoài phạm vi (Out of Scope)

- Auto-publishing lên Facebook, Instagram (cần Facebook App Review)
- Gửi email thực tế qua SMTP/SendGrid
- A/B Testing nội dung
- Mobile application (iOS / Android)
- Multi-tenant / multi-user team với RBAC phức tạp
- Real-time social media analytics ingestion
- Payment & subscription management

### 3.3 Kênh nội dung hỗ trợ (MVP)

| Kênh | Output |
|---|---|
| `facebook_post` | Bài đăng + hashtags |
| `email` | Subject + body email |
| `video_script` | Hook + body + CTA + thời lượng |

---

## 4. Kiến trúc Tổng quan

```
[ Browser ]
     │ HTTPS
[ Next.js Web — port 3000 ]
     │ REST API
[ FastAPI Backend — port 8000 ] ──── [ PostgreSQL 16 ]
     │ HTTP internal
[ Agent Service — port 8001 ]
     │                  │
[ OpenAI API ]    [ Qwen 2.5 7B VPS ]
```

Hệ thống gồm 3 service Docker:
- **web**: UI/UX, authentication state, page rendering
- **api**: Business logic, database, job dispatch
- **agent**: AI orchestration, 3-agent pipeline, LLM routing

Chi tiết trong `02-architecture/`.

---

## 5. Công nghệ Sử dụng

| Layer | Công nghệ | Phiên bản | Lý do chọn |
|---|---|---|---|
| Frontend | Next.js | 14 (App Router) | Server Components, TypeScript, ecosystem |
| Styling | Tailwind CSS + shadcn/ui | Latest | Utility-first, component quality |
| Backend | FastAPI | 0.110+ | Async native, Python AI ecosystem |
| ORM | SQLAlchemy | 2.x async | Type-safe, Alembic migration |
| Validation | Pydantic | v2 | FastAPI integration, performance |
| Database | PostgreSQL | 16 | JSONB, UUID, ARRAY — phù hợp AI data |
| AI Reasoning | OpenAI GPT-4o-mini | Latest | Strong reasoning cho Strategy/Critic |
| AI Generation | Qwen 2.5 7B | Self-hosted | Chi phí thấp cho Writer/Summary |
| Agent Framework | LangChain / Custom | Latest | Orchestration, prompt management |
| Infrastructure | Docker Compose | Latest | Local dev và VPS deployment |
| Migration | Alembic | 1.13+ | Version-controlled schema |

---

## 6. Timeline

| Giai đoạn | Tuần | Nội dung |
|---|---|---|
| Sprint 1 — Foundation | 1–3 | Infra setup, Auth, Brand Vault |
| Sprint 2 — Core AI | 4–6 | Agent Orchestrator, Content, Calendar, Approval |
| Sprint 3 — Advanced + Polish | 7–9 | Dashboard, Workflow, Notifications, Demo prep |

---

## 7. Thước đo Thành công

### 7.1 Tiêu chí kỹ thuật (Demo cho hội đồng)

| Tiêu chí | Mục tiêu |
|---|---|
| Brief → 3 content items | Dưới 90 giây |
| Agent logs hiển thị | 3 agents với timestamp và token count |
| Brand Vault context | Được inject vào mọi agent prompt |
| Calendar hiển thị | Ít nhất 5 content items trên lịch |
| Dashboard stats | Reflect dữ liệu thực từ database |
| Approval flow | Approve/Reject hoạt động, cập nhật status ngay |

### 7.2 Tiêu chí sản phẩm

| Tiêu chí | Mục tiêu |
|---|---|
| Thời gian tạo 1 campaign | Giảm từ 3–5 giờ xuống 5–10 phút |
| Nhất quán thương hiệu | 100% nội dung có Brand Vault context |
| Kiểm soát nội dung | 0 nội dung được dùng khi chưa qua approve |
| Lưu trữ lịch sử | Toàn bộ versions và approval history lưu database |

---

## 8. Rủi ro và Giải pháp

| Rủi ro | Xác suất | Giải pháp |
|---|---|---|
| Qwen VPS không ổn định | Trung bình | Fallback sang OpenAI nếu timeout > 15s |
| OpenAI API quota hết | Thấp | Fallback sang Qwen cho task phù hợp |
| LLM output không đúng format | Trung bình | JSON schema validation + retry logic |
| Docker port conflict | Thấp | Port mapping linh hoạt trong docker-compose |
| DB migration conflict | Thấp | Alembic version control, rollback sẵn sàng |

---

## 9. Cap nhat de tai: bo sung vai tro Admin

De tang tinh thuc te khi trien khai cho nhieu doanh nghiep, AIMAP bo sung vai tro `admin` voi pham vi:

- Quan tri tai khoan nguoi dung (khoa/mo, xu ly su co).
- Giam sat chi phi AI va token usage.
- Theo doi, retry workflow jobs loi.
- Audit hanh dong van hanh he thong.

Cap nhat nay khong thay doi gia tri cot loi cua de tai, nhung tang tinh san sang van hanh thuc te.
