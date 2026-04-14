# AIMAP — AI-Powered Marketing Automation Platform for Small Businesses

> Dự án Capstone 2 — Tổng quan cho Hội đồng Chấm điểm

---

## Mục lục

1. [Vấn đề thực tế](#1-vấn-đề-thực-tế)
2. [AIMAP là gì?](#2-aimap-là-gì)
3. [Ai là người dùng?](#3-ai-là-người-dùng)
4. [Các tính năng cốt lõi](#4-các-tính-năng-cốt-lõi)
5. [Điểm khác biệt so với các AI tool hiện có](#5-điểm-khác-biệt-so-với-các-ai-tool-hiện-có)
6. [Kiến trúc hệ thống](#6-kiến-trúc-hệ-thống)
7. [Lựa chọn công nghệ và lý do](#7-lựa-chọn-công-nghệ-và-lý-do)
8. [Phạm vi MVP](#8-phạm-vi-mvp)
9. [Tác động thực tế](#9-tác-động-thực-tế)
10. [Câu hỏi thường gặp từ Hội đồng](#10-câu-hỏi-thường-gặp-từ-hội-đồng)

---

## 1. Vấn đề Thực tế

### Bối cảnh

Tại Việt Nam có hơn **5 triệu doanh nghiệp vừa và nhỏ** — từ quán cà phê vỉa hè, tiệm quần áo nhỏ, đến cửa hàng sửa xe, salon tóc, tiệm bánh handmade. Đây là nhóm đang có nhu cầu marketing lớn nhất nhưng lại ít được phục vụ nhất bởi các công cụ hiện có.

### Nỗi đau cụ thể

**Một chủ quán cà phê nhỏ đang phải làm gì mỗi tuần?**

```
Thứ Hai sáng → ngồi 2-3 tiếng nghĩ caption cho bài Facebook hôm nay
Thứ Tư tối  → cố gõ email gửi khách hàng thân thiết về ưu đãi cuối tuần
Thứ Sáu     → loay hoay nghĩ script quay Reels nhưng không biết bắt đầu từ đâu
Cuối tháng  → nhìn lại không biết mình đã đăng gì, kết quả thế nào
```

Họ không phải không muốn làm marketing — họ **không có thời gian, không có kiến thức, và không có tiền thuê người**. Theo khảo sát năm 2024, **68% SMB chủ quán tự làm marketing** và trung bình tốn **15-20 giờ/tháng** chỉ để viết bài, gửi email, nghĩ nội dung — trong khi thứ họ cần là tập trung vào sản phẩm và khách hàng.

### Hậu quả của không có hệ thống

| Vấn đề | Biểu hiện | Thiệt hại |
|---|---|---|
| **Không nhất quán về thương hiệu** | Bài này viết một kiểu, bài kia viết kiểu khác | Khách hàng không nhớ thương hiệu |
| **Đăng bài không đều** | Tuần đăng 5 bài, tuần đăng 0 bài | Thuật toán phạt, reach giảm |
| **Nội dung không đúng target** | Viết theo cảm hứng, không có strategy | Tiêu thụ ngân sách quảng cáo kém hiệu quả |
| **Mất cơ hội thời điểm** | Không chuẩn bị trước cho ngày lễ, sự kiện | Bỏ lỡ thời điểm mua sắm cao điểm |
| **Không có lưu trữ** | Nội dung cũ lẫn lộn trong note điện thoại | Không tái sử dụng được nội dung tốt |

---

## 2. AIMAP là gì?

**AIMAP** (AI-Powered Marketing Automation Platform) là một nền tảng tự động hóa marketing tích hợp AI, được thiết kế đặc biệt cho chủ doanh nghiệp nhỏ tại Việt Nam.

### Một câu mô tả đơn giản nhất

> "Bạn kể cho AIMAP biết bạn muốn quảng bá gì. Ba AI agent sẽ lên kế hoạch, viết nội dung, và tự kiểm duyệt — rồi hỏi bạn duyệt trước khi bất kỳ thứ gì được sử dụng."

### Cách AIMAP hoạt động trong 5 bước

```
[1] Bạn điền Campaign Brief
    → Mục tiêu gì? Sản phẩm gì? Đối tượng nào? Ưu đãi gì?

[2] Strategist Agent phân tích
    → Đọc brief + DNA thương hiệu của bạn
    → Tạo kế hoạch chiến dịch: thông điệp chính, tone, định hướng từng kênh

[3] Writer Agent viết nội dung
    → Viết bài Facebook, email, script video theo đúng phong cách thương hiệu bạn

[4] Critic Agent kiểm tra chất lượng
    → Đối chiếu với brand voice, kiểm tra từ ngữ cấm, đảm bảo có CTA
    → Sửa nếu cần, báo cáo vấn đề tìm thấy

[5] Bạn duyệt và lên lịch
    → Xem nội dung trên Marketing Calendar
    → Approve hoặc Reject với ghi chú
    → Nội dung đã duyệt hiển thị trên lịch theo ngày
```

---

## 3. Ai là Người dùng?

### Persona 1: Chị Lan — Chủ quán cà phê

- 32 tuổi, mở quán cà phê ở Q.3 TP.HCM được 3 năm
- Tự quản lý fanpage, mỗi tuần cố gắng đăng 3-4 bài
- Không có ngân sách thuê agency, thỉnh thoảng nhờ em họ viết giúp
- **Nỗi đau**: "Tôi biết mình cần đăng đều hơn, nhưng mỗi lần ngồi nghĩ caption là mất cả buổi tối"
- **Kỳ vọng từ AIMAP**: Không cần biết marketing — chỉ cần nói mình muốn gì là có nội dung chất lượng

### Persona 2: Anh Minh — Chủ shop quần áo online

- 27 tuổi, bán quần áo qua Facebook và TikTok
- Có 1 nhân viên hỗ trợ, ngân sách marketing hạn chế
- Hiểu về kênh social media nhưng không biết viết email marketing
- **Nỗi đau**: "Tôi muốn mở rộng sang email marketing nhưng không biết bắt đầu từ đâu, viết gì"
- **Kỳ vọng từ AIMAP**: Tool giúp đa kênh mà không cần học từng kênh một

### Cả hai đều cần

- Nội dung **đúng tone thương hiệu** của họ (không phải generic AI output)
- **Không mất quá nhiều thời gian** để học hoặc setup
- **Kiểm soát hoàn toàn** — AI gợi ý, người dùng quyết định

---

## 4. Các Tính năng Cốt lõi

### 4.1 Campaign Brief Intake — Điểm bắt đầu đơn giản

Thay vì user phải tự nghĩ "tôi cần viết gì", AIMAP hỏi các câu hỏi có cấu trúc:

- **Mục tiêu**: Tôi muốn ra mắt sản phẩm / chạy khuyến mãi / nhắc khách hàng cũ quay lại
- **Sản phẩm/dịch vụ**: Cụ thể là gì
- **Ưu đãi hoặc hook**: Có gì hấp dẫn để nói
- **Ngày deadline**: Nội dung cần sẵn sàng trước khi nào
- **Kênh**: Facebook, Email, Video Script (hoặc tất cả)

Từ 5-6 thông tin này, AI tự làm hết phần còn lại.

---

### 4.2 Multi-Agent Orchestrator — 3 AI Agent làm việc nối tiếp nhau

Đây là **tính năng kỹ thuật trung tâm** và điểm phân biệt chính của AIMAP.

```
Strategist Agent  →  Writer Agent  →  Critic Agent
(OpenAI GPT-4o)      (Qwen 2.5 7B)    (OpenAI GPT-4o)
```

**Tại sao cần 3 agent thay vì 1?**

Một AI duy nhất làm tất cả sẽ cho output kém nhất quán. Chia nhỏ nhiệm vụ theo chuyên môn:

| Agent | Chuyên môn | Model phù hợp |
|---|---|---|
| **Strategist** | Tư duy chiến lược, phân tích brief, lên kế hoạch | GPT-4o-mini (reasoning mạnh) |
| **Writer** | Sáng tạo nội dung, viết văn bản sinh động | Qwen 2.5 7B (chi phí thấp, đủ chất lượng) |
| **Critic** | Kiểm duyệt, đối chiếu tiêu chuẩn, sửa lỗi | GPT-4o-mini (phán xét chính xác) |

Mỗi bước đều được **ghi lại đầy đủ** (agent logs) — người dùng thấy được chính xác AI đã làm gì.

---

### 4.3 AI Brand Vault — "Bộ nhớ dài hạn" của Thương hiệu

Trước khi viết bất kỳ nội dung nào, tất cả agent đều đọc Brand Vault — nơi user lưu DNA thương hiệu:

| Trường | Ví dụ |
|---|---|
| Tên thương hiệu | Cafe Bờ Hồ |
| Mô tả doanh nghiệp | Quán cà phê truyền thống, mở cửa 7am-10pm |
| Giọng văn (tone) | warm (ấm áp, gần gũi) |
| Khách hàng mục tiêu | Sinh viên và dân văn phòng 20-30 tuổi |
| Sản phẩm chính | Cà phê sữa đá, Bạc xỉu, Trà đào cam sả |
| Từ ngữ cấm | "rẻ", "bình dân", "giảm sốc" |
| CTA ưa thích | "Ghé thăm ngay" |

Kết quả: Mọi nội dung AI tạo ra đều **nghe như chính thương hiệu đó viết** — không phải content generic.

---

### 4.4 Content Approval Flow — Kiểm soát trước khi đăng

AI gợi ý, **người dùng quyết định**. Không có gì tự động đăng lên.

```
AI tạo nội dung
    → status: pending_approval
    → User xem và chọn:
        ✓ Approve  → status: approved → xuất hiện trên Calendar
        ✗ Reject   → ghi lý do        → có thể yêu cầu AI viết lại
        ✎ Chỉnh sửa rồi Approve → version mới được lưu lại
```

Toàn bộ lịch sử approve/reject được lưu — hội đồng có thể xem audit trail đầy đủ.

---

### 4.5 Marketing Calendar — Toàn cảnh nội dung theo tháng

Sau khi duyệt, nội dung xuất hiện trên lịch theo ngày dự kiến đăng:

- **Month view** và **Week view**
- Phân màu theo kênh: Facebook / Email / Video Script
- Badge trạng thái: Draft / Pending / Approved
- Click vào item xem nội dung đầy đủ
- Kéo thả để thay đổi ngày đăng

Lần đầu tiên user có được **bức tranh toàn cảnh** về marketing của mình cho cả tháng.

---

### 4.6 Smart Workflow Automation — Chạy tự động theo lịch

Hệ thống tự động kích hoạt khi:

- **Lịch định kỳ**: Mỗi thứ Hai 8 giờ sáng → tự tạo campaign tuần mới
- **Upload khách hàng**: User upload file CSV danh sách email → tự tạo email campaign

User nhận thông báo: *"Tôi đã soạn xong campaign tuần này, hãy vào duyệt nhé."*

---

### 4.7 Dashboard thông minh — Nhìn thấy bức tranh tổng quan

Khi mở app, user thấy ngay:

- Tổng số chiến dịch đã tạo
- Số nội dung đang chờ duyệt
- Phân bố nội dung theo kênh
- Hoạt động agent gần đây
- Thống kê token AI đã sử dụng
- AI Summary: 2-3 câu tóm tắt tình hình marketing tuần này

---

## 5. Điểm Khác biệt so với các AI Tool Hiện có

| Tiêu chí | ChatGPT / Claude | Canva AI | AIMAP |
|---|---|---|---|
| **Phải biết prompt** | Phải tự viết prompt tốt | Không cần prompt nhiều | Không cần — điền form đơn giản |
| **Nhớ thương hiệu của bạn** | Không (mỗi chat là mới) | Một phần (brand kit cơ bản) | Có — Brand Vault lưu toàn bộ DNA |
| **Multi-agent pipeline** | Không | Không | Có — 3 agent với chuyên môn riêng |
| **Nhiều kênh cùng lúc** | Tự làm từng cái | Chủ yếu design | Tự động 3 kênh từ 1 brief |
| **Kiểm soát nội dung** | Không có approval flow | Không có | Approve/Reject/Edit đầy đủ |
| **Lịch marketing** | Không | Không | Marketing Calendar có sẵn |
| **Tự động theo lịch** | Không | Không | Workflow automation có sẵn |
| **Dành cho VN SMB** | Generic toàn cầu | Generic toàn cầu | Thiết kế riêng cho thị trường VN |
| **Giá** | $20+/tháng | $15+/tháng | Tự host — chi phí thấp hơn nhiều |

### Tại sao so sánh này quan trọng?

ChatGPT giỏi trả lời câu hỏi — nhưng không phải là hệ thống quản lý marketing. Canva giỏi làm thiết kế — nhưng không tự viết nội dung có chiến lược. AIMAP không cố gắng thay thế ChatGPT hay Canva — nó **kết nối AI với quy trình marketing thực tế của SMB**.

---

## 6. Kiến trúc Hệ thống

### Tổng quan 3 service

```
┌─────────────────────────────────────────────────────────────┐
│                        Người dùng                            │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS
┌────────────────────────────▼────────────────────────────────┐
│              WEB SERVICE (Next.js 14)                        │
│  • UI/UX: Campaign forms, Calendar, Dashboard, Approval      │
│  • Authentication state (JWT)                                │
│  • Server Components + Client Components                     │
└────────────────────────────┬────────────────────────────────┘
                             │ REST API
┌────────────────────────────▼────────────────────────────────┐
│              API SERVICE (FastAPI / Python)                   │
│  • Business logic: Auth, Brand Vault, Campaigns, Content     │
│  • Database ORM (SQLAlchemy async)                           │
│  • Dispatch jobs → Agent Service                             │
└──────────────┬──────────────────────────┬───────────────────┘
               │ REST (internal)           │ SQL
┌──────────────▼──────────────┐  ┌────────▼────────────────────┐
│  AGENT SERVICE (FastAPI)     │  │   PostgreSQL 16              │
│  • Orchestrator state machine│  │   23 tables                  │
│  • Strategist Agent          │  │   JSONB, UUID, ARRAY         │
│  • Writer Agent              │  └─────────────────────────────┘
│  • Critic Agent              │
│  • Hybrid LLM Router         │
└──────────────┬───────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼────────┐   ┌────────▼──────────────┐
│ OpenAI API │   │ Qwen 2.5 7B VPS       │
│ GPT-4o-mini│   │ 171.238.156.10        │
│ (Strategy  │   │ (Writer, Dashboard AI) │
│  + Critic) │   └────────────────────────┘
└────────────┘
```

### Tại sao chia 3 service?

| Lý do | Giải thích |
|---|---|
| **Tách biệt trách nhiệm** | Web không cần biết AI hoạt động thế nào. AI service không cần biết database có gì |
| **Scale độc lập** | AI service tốn tài nguyên nhất — có thể scale riêng mà không ảnh hưởng API |
| **Phát triển song song** | Frontend và AI pipeline có thể phát triển độc lập |
| **Thực tế công nghiệp** | Đây là kiến trúc microservices tiêu chuẩn của các startup công nghệ |

---

## 7. Lựa chọn Công nghệ và Lý do

### Frontend: Next.js 14 (App Router)

| Ưu điểm | Lý do chọn |
|---|---|
| Server Components | Giảm JavaScript gửi xuống client, load nhanh hơn |
| File-based routing | Cấu trúc code rõ ràng, dễ maintain |
| TypeScript built-in | Type safety giảm bug, IDE hỗ trợ tốt |
| shadcn/ui + Tailwind | Component library chất lượng cao, tùy chỉnh dễ |

### Backend: FastAPI (Python)

| Ưu điểm | Lý do chọn |
|---|---|
| Python ecosystem | Tương thích trực tiếp với LangChain, CrewAI, OpenAI SDK |
| Async native | Xử lý nhiều request đồng thời, phù hợp khi gọi LLM |
| Auto-generated docs | Swagger UI tự động từ code |
| Pydantic validation | Type validation mạnh, tương thích với AI output |

### Database: PostgreSQL 16

| Ưu điểm | Lý do chọn |
|---|---|
| JSONB | Lưu AI output linh hoạt mà vẫn query được |
| ARRAY type | Lưu danh sách không cần bảng phụ |
| UUID | Primary key an toàn hơn khi expose qua API |
| ACID | Đảm bảo nhất quán dữ liệu khi nhiều agent ghi đồng thời |

### AI Models: Hybrid Qwen + OpenAI

| Model | Dùng cho | Lý do |
|---|---|---|
| **OpenAI GPT-4o-mini** | Strategist (lên kế hoạch), Critic (kiểm duyệt) | Reasoning mạnh, kết quả nhất quán với task phức tạp |
| **Qwen 2.5 7B (self-hosted)** | Writer (viết nội dung), Dashboard Summary | Chi phí gần như 0, đủ chất lượng cho text generation |

**Hybrid routing logic**: Nếu VPS không phản hồi trong 15 giây → tự động fallback sang OpenAI. Không có điểm lỗi đơn.

### Deployment: Docker Compose

Toàn bộ 3 service + PostgreSQL chạy bằng 1 lệnh `docker compose up`. Dễ deploy lên VPS, dễ demo.

---

## 8. Phạm vi MVP

### Những gì có trong MVP (đã xây dựng)

| # | Tính năng | Trạng thái |
|---|---|---|
| 1 | Đăng ký / Đăng nhập / Quên mật khẩu | Có |
| 2 | Hồ sơ người dùng + thông tin doanh nghiệp | Có |
| 3 | Brand Vault (tạo, chỉnh sửa, xem) | Có |
| 4 | Tạo Campaign Brief | Có |
| 5 | Multi-Agent Orchestrator (Strategist→Writer→Critic) | Có |
| 6 | Content Items với phiên bản (versioning) | Có |
| 7 | Approval Flow (Approve / Reject / Edit) | Có |
| 8 | Marketing Calendar (month/week view) | Có |
| 9 | Agent Run Logs (nhật ký AI) | Có |
| 10 | Dashboard với thống kê tổng hợp | Có |
| 11 | Workflow Automation (schedule + upload trigger) | Có |
| 12 | In-app Notifications | Có |
| 13 | Customer List Upload | Có |
| 14 | Campaign Tags | Có |
| 15 | AI Usage Stats | Có |

### Những gì chưa có trong MVP (tương lai)

| Tính năng | Lý do chưa làm |
|---|---|
| Auto-publish lên Facebook | Cần Facebook App Review, ngoài phạm vi capstone |
| Real email sending | Cần tích hợp SendGrid/Mailchimp |
| A/B Testing nội dung | Phức tạp về UI/UX, không cần thiết cho MVP |
| Mobile app | Ngoài phạm vi |
| Multi-user team | Phức tạp về phân quyền, không cần cho MVP |

---

## 9. Tác động Thực tế

### Chỉ số có thể đo được

| Chỉ số | Trước AIMAP | Với AIMAP |
|---|---|---|
| Thời gian tạo 1 campaign (3 kênh) | 3-5 giờ | 5-10 phút |
| Thời gian duyệt nội dung | N/A (không có quy trình) | 5-15 phút/lần |
| Tính nhất quán thương hiệu | Phụ thuộc "hôm nay mình có cảm hứng không" | Đảm bảo 100% thông qua Brand Vault |
| Lưu trữ lịch sử nội dung | Nằm rải rác trong note, Facebook draft | Tập trung, searchable, có version |
| Chi phí marketing content | 0 VND (tự làm) hoặc 5-15tr/tháng (agency) | Chi phí API thấp, không cần agency |

### Câu chuyện người dùng (User Story)

**Trước AIMAP:**
> "Chị Lan mỗi tối thứ Tư lại ngồi nhìn điện thoại, cố nghĩ xem hôm nay đăng gì. 45 phút sau vẫn chưa ra được caption. Gần 11 giờ đêm mới đăng bài — reach thấp vì giờ đăng sai. Cuối tháng nhìn lại không biết mình đã làm gì."

**Sau AIMAP:**
> "Chị Lan mỗi thứ Hai buổi sáng mở AIMAP, điền brief cho tuần mới trong 5 phút. AI tạo nội dung cho cả tuần trong vài phút. Chị đọc qua, sửa 1-2 chỗ, duyệt. Calendar tự cập nhật. Cuối tháng dashboard hiển thị đầy đủ chị đã tạo bao nhiêu campaign, bao nhiêu nội dung được duyệt."

---

## 10. Câu hỏi Thường gặp từ Hội đồng

**Q: Tại sao cần 3 agent thay vì gọi 1 AI một lần?**

A: Gọi 1 AI một lần cho kết quả kém nhất quán — đặc biệt khi phải vừa lên kế hoạch chiến lược, vừa viết sáng tạo, vừa kiểm duyệt chất lượng trong một prompt. Chia nhỏ nhiệm vụ (chain of thought externalized) theo các nghiên cứu về LLM pipeline (LangChain, CrewAI) cho kết quả tốt hơn đáng kể. Mỗi agent có prompt được tối ưu cho đúng một nhiệm vụ.

---

**Q: Sự khác biệt giữa Qwen 7B và GPT-4o là gì? Sao không dùng toàn OpenAI?**

A: GPT-4o-mini tốt hơn trong reasoning và judging (phán xét). Qwen 2.5 7B đủ tốt cho creative writing và text generation với chi phí gần như 0 vì self-hosted. Hybrid routing tận dụng điểm mạnh của từng model: reasoning task → OpenAI, generation task → Qwen. Nếu VPS chết → fallback tự động sang OpenAI.

---

**Q: Làm sao đảm bảo AI không tạo ra nội dung sai lệch thương hiệu?**

A: Hai lớp bảo vệ: (1) Brand Vault được inject vào mọi agent prompt qua `<brand_context>` block — AI luôn có context về tone, từ cấm, CTA. (2) Critic Agent chuyên kiểm tra đối chiếu brand guidelines và báo cáo issues. (3) Người dùng luôn là người phê duyệt cuối cùng — không có gì được dùng khi chưa qua mắt người.

---

**Q: Database có 23 bảng — có phức tạp quá không?**

A: Không phức tạp — mỗi bảng phục vụ một mục đích rõ ràng. Có thể nhóm thành 10 domain logic: Auth (4), Brand (2), Campaign (3), Content (3), Customer (3), File (1), Notification (2), AI (2), Workflow (2), Analytics (1). Số bảng phản ánh đúng độ phức tạp của nghiệp vụ một platform marketing đa chức năng.

---

**Q: Tại sao không làm mobile app?**

A: Marketing content creation là task cần màn hình đủ lớn để đọc và chỉnh sửa nội dung. Marketing Manager thường dùng laptop khi làm việc với campaign. MVP tập trung vào web responsive — hoạt động tốt trên cả desktop và tablet. Mobile app là phiên bản tiếp theo.

---

**Q: Nếu OpenAI hết quota hoặc VPS chết thì sao?**

A: Hybrid LLM Router có built-in fallback: VPS timeout > 15s → fallback sang OpenAI. OpenAI quota → fallback sang Qwen nếu task phù hợp, hoặc trả lỗi rõ ràng với message giải thích. Campaign được đánh dấu `failed` với error_message, user có thể retry.

---

## Tổng kết

AIMAP giải quyết một vấn đề **thực tế, cụ thể, và đang tồn tại** với hàng triệu doanh nghiệp nhỏ ở Việt Nam. Không phải là demo AI chạy prompt một lần — mà là một **hệ thống hoàn chỉnh** với:

- **Quy trình rõ ràng**: Brief → Orchestrate → Approve → Publish
- **Kiến trúc chuẩn công nghiệp**: 3 microservices, PostgreSQL, Docker
- **AI có chủ đích**: Hybrid routing, brand context injection, 3-agent pipeline
- **Dữ liệu bền vững**: 23 bảng với quan hệ đầy đủ, audit trail, versioning
- **Con người vẫn là trung tâm**: Approval flow đảm bảo AI hỗ trợ chứ không thay thế người dùng

> AIMAP không phải là "AI làm marketing hộ bạn" — mà là "AI làm phần nặng nhọc để bạn tập trung vào phần quan trọng nhất: phán xét và quyết định."
