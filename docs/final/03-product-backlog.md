# Product Backlog — AIMAP

**AI-Powered Marketing Automation Platform for Small Businesses**

---

## Tổng quan

| Metric | Giá trị |
|---|---|
| Tổng Epics | 10 |
| Tổng User Stories | 52 |
| Tổng Story Points | 144 |
| Velocity ước tính | 48 points/sprint |
| Số Sprints | 3 (mỗi sprint 3 tuần) |

---

## Story Points Scale (Fibonacci)

| Points | Ý nghĩa |
|---|---|
| 1 | Trivial — thay đổi nhỏ, ít rủi ro |
| 2 | Simple — vài giờ, pattern đã biết |
| 3 | Small — nửa ngày, ít phức tạp |
| 5 | Medium — 1–2 ngày, một vài decisions |
| 8 | Large — 2–3 ngày, phức tạp, có risk |
| 13 | X-Large — nhiều ngày, phụ thuộc nhiều thứ |

---

## Priority Levels

| Level | Ký hiệu | Ý nghĩa |
|---|---|---|
| Must-have | M | Thiếu là không demo được |
| Should-have | S | Quan trọng nhưng có thể bỏ qua lúc demo |
| Could-have | C | Nice-to-have, làm nếu còn thời gian |

---

## EPIC 1: Authentication & User Profile (F01)

**Sprint**: Sprint 1 | **Tổng points**: 21

| ID | User Story | Acceptance Criteria | Points | Priority |
|---|---|---|---|---|
| US-01 | As a **user**, I want to **register with email and password** so that **I can create my AIMAP account** | Given email chưa tồn tại, When submit form, Then tạo account + gửi verification email | 3 | M |
| US-02 | As a **user**, I want to **verify my email address** so that **my account is activated** | Given có verification token hợp lệ, When click link, Then email_verified=TRUE | 2 | M |
| US-03 | As a **user**, I want to **log in with email and password** so that **I can access the platform** | Given đúng credentials, When login, Then nhận JWT + refresh token, redirect dashboard | 3 | M |
| US-04 | As a **user**, I want to **stay logged in** so that **I don't have to log in every 15 minutes** | Given access token hết hạn, When gọi API, Then auto-refresh qua refresh token | 5 | M |
| US-05 | As a **user**, I want to **reset my forgotten password** so that **I can regain access to my account** | Given email tồn tại, When request reset, Then nhận email với link; When click + nhập pw mới, Then pw được cập nhật | 3 | M |
| US-06 | As a **user**, I want to **view and update my profile** so that **my business information is accurate** | Given đang login, When vào /profile, Then thấy và chỉnh được full_name, phone, business_type, city, website | 2 | M |
| US-07 | As a **user**, I want to **change my password** so that **I can keep my account secure** | Given nhập đúng pw cũ, When submit, Then pw được hash và update | 2 | S |
| US-08 | As a **user**, I want to **log out from all devices** so that **my account is secure if I lose a device** | Given đang login, When click "Đăng xuất tất cả thiết bị", Then tất cả sessions bị xóa | 1 | S |

---

## EPIC 2: Brand Vault — AI Brand Memory (F02)

**Sprint**: Sprint 1 | **Tổng points**: 13

| ID | User Story | Acceptance Criteria | Points | Priority |
|---|---|---|---|---|
| US-09 | As a **user**, I want to **set up my Brand Vault** so that **AI always uses my brand voice** | Given chưa có brand, When điền form + submit, Then brand được tạo và AI có thể đọc | 5 | M |
| US-10 | As a **user**, I want to **update my Brand Vault** so that **my brand information stays current** | Given brand đã có, When chỉnh sửa và lưu, Then brand được update và các campaign mới dùng data mới | 2 | M |
| US-11 | As a **user**, I want to **define forbidden words** so that **AI never uses inappropriate language for my brand** | Given có forbidden_words list, When AI viết nội dung, Then không có từ nào trong list đó xuất hiện | 3 | M |
| US-12 | As a **user**, I want to **upload my logo** so that **my brand identity is complete** | Given có file PNG/JPG < 5MB, When upload, Then logo_url được lưu và hiển thị | 2 | S |
| US-13 | As a **user**, I want to **see a warning if Brand Vault is incomplete** so that **campaign quality is not compromised** | Given thiếu required fields, When tạo campaign, Then thấy warning "Brand Vault chưa đầy đủ" | 1 | S |

---

## EPIC 3: Campaign Brief Intake (F03)

**Sprint**: Sprint 2 | **Tổng points**: 13

| ID | User Story | Acceptance Criteria | Points | Priority |
|---|---|---|---|---|
| US-14 | As a **business owner**, I want to **create a campaign brief** so that **AI knows what to write about** | Given điền đầy đủ required fields, When submit, Then campaign tạo với status='pending_agent' và AI bắt đầu chạy | 5 | M |
| US-15 | As a **business owner**, I want to **select which channels to generate content for** so that **I only get what I need** | Given chọn 1-3 channels, When submit, Then campaign.channels array đúng và AI chỉ tạo nội dung cho các kênh đó | 2 | M |
| US-16 | As a **business owner**, I want to **set a campaign deadline** so that **content is scheduled appropriately** | Given nhập deadline trong tương lai, When submit, Then content items có scheduled_date = deadline | 2 | M |
| US-17 | As a **business owner**, I want to **save a campaign brief as a template** so that **I can reuse it for similar campaigns** | Given có campaign thành công, When click "Lưu làm template", Then content_template được tạo | 2 | S |
| US-18 | As a **business owner**, I want to **create a campaign from a saved template** so that **I can start faster** | Given có template, When chọn + submit, Then form tự điền các trường từ template | 2 | C |

---

## EPIC 4: Multi-Agent Orchestrator (F04)

**Sprint**: Sprint 2 | **Tổng points**: 21

| ID | User Story | Acceptance Criteria | Points | Priority |
|---|---|---|---|---|
| US-19 | As a **business owner**, I want the **Strategist Agent to analyze my brief** so that **content has a proper strategy** | Given campaign brief + brand vault, When Strategist runs, Then campaign_plan_json có summary, key_messages, deliverables | 8 | M |
| US-20 | As a **business owner**, I want the **Writer Agent to draft content per channel** so that **I have ready-to-use content** | Given deliverable spec, When Writer runs, Then content_json có đúng cấu trúc theo kênh | 8 | M |
| US-21 | As a **business owner**, I want the **Critic Agent to review content quality** so that **AI catches issues before I see it** | Given draft content + brand, When Critic runs, Then issues_found list + revised content nếu cần | 5 | M |
| US-22 | As a **business owner**, I want to **see the AI agent log timeline** so that **I can understand what AI did** | Given campaign đã orchestrate, When xem /campaigns/{id}, Then timeline panel hiển thị từng step với agent name, model, duration, tokens | 3 | M |
| US-23 | As a **business owner**, I want to **be notified when content is ready** so that **I can review without checking manually** | Given orchestration hoàn thành, When status='pending_approval', Then in-app notification xuất hiện | 2 | S |

---

## EPIC 5: Content Storage & Versioning (F05)

**Sprint**: Sprint 2 | **Tổng points**: 10

| ID | User Story | Acceptance Criteria | Points | Priority |
|---|---|---|---|---|
| US-24 | As a **business owner**, I want **content to be saved with version history** so that **I can track changes** | Given AI tạo content, Then version=1; Given user chỉnh sửa + approve, Then version+1 được tạo | 5 | M |
| US-25 | As a **business owner**, I want to **see all versions of a content item** so that **I can compare and choose** | Given content có nhiều versions, When xem detail, Then tất cả versions hiển thị với timestamp và source | 3 | S |
| US-26 | As a **business owner**, I want **content to be organized by channel** so that **I can easily find what I need** | Given nhiều content items, When filter by channel, Then chỉ hiển thị items của kênh đó | 2 | M |

---

## EPIC 6: Human Approval Flow (F06)

**Sprint**: Sprint 2 | **Tổng points**: 13

| ID | User Story | Acceptance Criteria | Points | Priority |
|---|---|---|---|---|
| US-27 | As a **business owner**, I want to **approve content** so that **it appears on my calendar** | Given content status='pending_approval', When click Approve, Then status='approved' và xuất hiện trên calendar | 3 | M |
| US-28 | As a **business owner**, I want to **reject content with a note** so that **I can provide feedback** | Given content, When click Reject + điền note, Then status='rejected', rejection_note lưu, approval_history ghi | 3 | M |
| US-29 | As a **business owner**, I want to **edit content before approving** so that **I can make final tweaks** | Given pending content, When edit text + approve, Then version mới được tạo với source='user_edit' | 5 | M |
| US-30 | As a **business owner**, I want to **see approval history** so that **I have an audit trail** | Given content đã có actions, When xem history, Then danh sách {action, user, timestamp, note} hiển thị | 2 | S |

---

## EPIC 7: Marketing Calendar (F07)

**Sprint**: Sprint 2 | **Tổng points**: 13

| ID | User Story | Acceptance Criteria | Points | Priority |
|---|---|---|---|---|
| US-31 | As a **business owner**, I want to **see all approved content on a monthly calendar** so that **I can plan my posting schedule** | Given có content items với scheduled_date, When xem /calendar, Then calendar hiển thị dots theo ngày và kênh | 5 | M |
| US-32 | As a **business owner**, I want to **click a calendar day to see content details** so that **I can read full content** | Given calendar đang hiển thị, When click ngày, Then sidebar/panel mở với full content | 3 | M |
| US-33 | As a **business owner**, I want to **reassign the scheduled date of content** so that **I can adjust my posting plan** | Given content có scheduled_date, When chọn ngày mới, Then scheduled_date update và item di chuyển trên calendar | 3 | M |
| US-34 | As a **business owner**, I want to **filter calendar by channel** so that **I can focus on one channel at a time** | Given calendar đang hiển thị, When chọn filter 'email', Then chỉ hiển thị email items | 2 | S |

---

## EPIC 8: Dashboard & AI Summary (F08)

**Sprint**: Sprint 3 | **Tổng points**: 13

| ID | User Story | Acceptance Criteria | Points | Priority |
|---|---|---|---|---|
| US-35 | As a **business owner**, I want to **see key metrics on my dashboard** so that **I understand my marketing activity** | Given có dữ liệu, When load dashboard, Then 4 widgets: total campaigns, total content, pending approvals, approved items | 5 | M |
| US-36 | As a **business owner**, I want to **see content distribution by channel** so that **I know which channels I use most** | Given content items, When load dashboard, Then bar/pie chart hiển thị count per channel | 3 | M |
| US-37 | As a **business owner**, I want to **receive an AI-generated weekly summary** so that **I have actionable insights** | Given có stats data, When load dashboard, Then AI summary card hiển thị 2-3 câu tóm tắt meaningful | 5 | M |

---

## EPIC 9: Workflow Automation (F09)

**Sprint**: Sprint 3 | **Tổng points**: 16

| ID | User Story | Acceptance Criteria | Points | Priority |
|---|---|---|---|---|
| US-38 | As a **business owner**, I want to **create a recurring schedule** so that **campaigns are drafted automatically each week** | Given cron expression, When time arrives, Then workflow_job tạo campaign + chạy orchestrator | 8 | S |
| US-39 | As a **business owner**, I want to **upload a customer CSV list** so that **an email campaign is automatically created** | Given file CSV hợp lệ, When upload, Then customers imported + email campaign tự tạo + orchestrator chạy | 8 | S |
| US-40 | As a **business owner**, I want to **view my workflow history** so that **I can see what automation has done** | Given workflow_jobs, When xem /workflow, Then list jobs với trigger_type, status, campaign_name, timestamp | 2 | S |
| US-41 | As a **business owner**, I want to **enable/disable a workflow schedule** so that **I can pause automation when needed** | Given schedule, When toggle is_active, Then cron không còn trigger khi is_active=false | 3 | S |

**Reality update (2026-04-14):**
- US-38, US-40, US-41 đã có triển khai runtime.
- US-39 đã triển khai mức MVP (upload CSV, parse cơ bản, auto tạo campaign email).

---

## EPIC 10: Notifications & Customer Lists (F10)

**Sprint**: Sprint 3 | **Tổng points**: 11

| ID | User Story | Acceptance Criteria | Points | Priority |
|---|---|---|---|---|
| US-42 | As a **business owner**, I want to **receive in-app notifications** so that **I know when attention is needed** | Given campaign hoàn thành, Then notification xuất hiện trong notification center | 3 | S |
| US-43 | As a **business owner**, I want to **see unread notification count** so that **I can quickly spot new activity** | Given có notifications chưa đọc, Then badge số xuất hiện trên bell icon | 2 | S |
| US-44 | As a **business owner**, I want to **mark notifications as read** so that **my notification list stays clean** | Given notification, When click, Then is_read=TRUE, badge giảm | 1 | S |
| US-45 | As a **business owner**, I want to **configure which notifications I receive** so that **I'm not overwhelmed** | Given notification_settings, When toggle types, Then chỉ nhận loại đã chọn | 2 | C |
| US-46 | As a **business owner**, I want to **view my uploaded customer lists** so that **I can manage my contacts** | Given customer_lists, When vào /customer-lists, Then danh sách với name, count, status hiển thị | 2 | S |
| US-47 | As a **business owner**, I want to **see customers in a list** so that **I can verify the import was correct** | Given customer_list, When click vào, Then bảng customers với email, name, phone hiển thị | 1 | S |

**Reality update (2026-04-14):**
- US-46, US-47 đã có giao diện và API mức MVP tại `/customer-lists`.
- US-42..US-45 vẫn là backlog mở.

---

## Backlog Summary

| Epic | Sprint | Stories | Points | Priority |
|---|---|---|---|---|
| F01 — Auth & Profile | Sprint 1 | 8 | 21 | Must |
| F02 — Brand Vault | Sprint 1 | 5 | 13 | Must |
| F03 — Campaign Brief | Sprint 2 | 5 | 13 | Must |
| F04 — Agent Orchestrator | Sprint 2 | 5 | 21 | Must |
| F05 — Content Versioning | Sprint 2 | 3 | 10 | Must |
| F06 — Approval Flow | Sprint 2 | 4 | 13 | Must |
| F07 — Marketing Calendar | Sprint 2 | 4 | 13 | Must |
| F08 — Dashboard | Sprint 3 | 3 | 13 | Must |
| F09 — Workflow Automation | Sprint 3 | 4 | 16 | Should |
| F10 — Notifications | Sprint 3 | 6 | 11 | Should |
| **Tổng** | | **47** | **144** | |

**Sprint Velocity Plan:**
- Sprint 1: 34 points (F01 + F02 + Infra setup ~5pts)
- Sprint 2: 70 points (F03 + F04 + F05 + F06 + F07)
- Sprint 3: 40 points (F08 + F09 + F10 + Polish ~5pts)

> Lưu ý: Sprint 2 có velocity cao nhất vì đây là phase triển khai tính năng core nhất. Sprint 1 và 3 có buffer cho setup và polish.

---

## Bo sung backlog cho Admin

| Feature | Sprint de xuat | Story points | Priority |
|---|---|---:|---|
| Admin Dashboard (health + usage) | Sprint 3 | 5 | Must |
| User Management (lock/unlock) | Sprint 3 | 5 | Must |
| Workflow Ops (view failed/retry) | Sprint 3 | 4 | Should |
| Audit Logs cho thao tac admin | Sprint 3 | 3 | Should |
