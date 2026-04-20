# C4 Model — Level 3: Component

**AIMAP — Nhìn theo nhóm chức năng (không đi sâu code)**

---

## Mục tiêu tài liệu

Thay vì nói theo file/class, tài liệu này mô tả hệ thống theo **nhóm chức năng dễ hiểu**:

- Nhóm giao diện người dùng
- Nhóm nghiệp vụ backend
- Nhóm AI xử lý nội dung và phân tích

---

## 3.1 Web Application — các nhóm chức năng chính

```mermaid
C4Component
    title Component Diagram — Web Application (dễ hiểu)

    Person(user, "Người dùng", "Sử dụng trên trình duyệt")
    Container(api, "Backend API", "FastAPI", "")

    Container_Boundary(web, "Web App") {
        Component(authUI, "Xác thực & Phiên đăng nhập", "UI module", "Đăng nhập, đăng ký, giữ trạng thái đăng nhập")
        Component(campaignUI, "Campaign Workspace", "UI module", "Tạo chiến dịch, xem kết quả AI, duyệt nội dung")
        Component(calendarUI, "Marketing Calendar", "UI module", "Xem và dời lịch nội dung")
        Component(insightUI, "Insight Copilot", "UI module", "Upload CSV/Excel, xem tiến trình và kết quả phân tích")
        Component(sharedUI, "Shared UI Components", "UI module", "Bảng, form, modal, thông báo")
    }

    Rel(user, authUI, "Đăng nhập/đăng ký")
    Rel(user, campaignUI, "Tạo và theo dõi campaign")
    Rel(user, calendarUI, "Xem lịch marketing")
    Rel(user, insightUI, "Phân tích dữ liệu")
    Rel(authUI, api, "Gọi API")
    Rel(campaignUI, api, "Gọi API")
    Rel(calendarUI, api, "Gọi API")
    Rel(insightUI, api, "Gọi API")
    Rel(campaignUI, sharedUI, "Dùng chung component")
    Rel(calendarUI, sharedUI, "Dùng chung component")
    Rel(insightUI, sharedUI, "Dùng chung component")
```

---

## 3.2 Backend API — các nhóm chức năng chính

```mermaid
C4Component
    title Component Diagram — Backend API (dễ hiểu)

    Container(web, "Web App", "Next.js", "")
    Container(agent, "AI Service", "Python service", "")
    ContainerDb(db, "PostgreSQL", "Database", "")

    Container_Boundary(api, "Backend API") {
        Component(authCore, "Authentication", "Business module", "Đăng ký, đăng nhập, bảo mật phiên")
        Component(campaignCore, "Campaign & Content", "Business module", "Quản lý campaign, nội dung, phê duyệt")
        Component(workflowCore, "Workflow Automation", "Business module", "Lịch tự động và job chạy nền")
        Component(insightCore, "Insight Analysis", "Business module", "Nhận file dữ liệu, trả kết quả phân tích")
        Component(adminCore, "Admin & Audit", "Business module", "Giám sát vận hành và nhật ký quản trị")
    }

    Rel(web, authCore, "API calls")
    Rel(web, campaignCore, "API calls")
    Rel(web, workflowCore, "API calls")
    Rel(web, insightCore, "API calls")
    Rel(web, adminCore, "API calls")
    Rel(authCore, db, "Đọc/Ghi dữ liệu")
    Rel(campaignCore, db, "Đọc/Ghi dữ liệu")
    Rel(workflowCore, db, "Đọc/Ghi dữ liệu")
    Rel(insightCore, db, "Đọc/Ghi dữ liệu")
    Rel(adminCore, db, "Đọc/Ghi dữ liệu")
    Rel(campaignCore, agent, "Giao việc AI")
    Rel(insightCore, agent, "Gọi pipeline phân tích khi cần")
```

---

## 3.3 AI Service — các nhóm xử lý

```mermaid
C4Component
    title Component Diagram — AI Service (dễ hiểu)

    Container(api, "Backend API", "FastAPI", "")
    System_Ext(ai, "AI Providers", "DeepSeek / Qwen / OpenAI fallback")

    Container_Boundary(agent, "AI Service") {
        Component(orchestrator, "Orchestrator", "AI workflow", "Điều phối toàn bộ bước AI")
        Component(strategyStep, "Strategy Step", "AI workflow", "Lên ý tưởng/kế hoạch")
        Component(writingStep, "Writing Step", "AI workflow", "Viết nội dung theo kênh")
        Component(reviewStep, "Review Step", "AI workflow", "Rà soát và tinh chỉnh")
        Component(callbackStep, "Result Callback", "Integration module", "Gửi kết quả về Backend")
    }

    Rel(api, orchestrator, "Yêu cầu chạy AI")
    Rel(orchestrator, strategyStep, "Bước 1")
    Rel(orchestrator, writingStep, "Bước 2")
    Rel(orchestrator, reviewStep, "Bước 3")
    Rel(strategyStep, ai, "Gọi model")
    Rel(writingStep, ai, "Gọi model")
    Rel(reviewStep, ai, "Gọi model")
    Rel(orchestrator, callbackStep, "Đóng gói kết quả")
    Rel(callbackStep, api, "Trả kết quả và trạng thái")
```

---

## Luồng end-to-end ngắn gọn

1. Người dùng tạo campaign hoặc upload file insight trên Web.
2. Web gọi Backend API để lưu yêu cầu.
3. Backend gọi AI Service khi cần xử lý AI.
4. AI Service chạy các bước, gọi model phù hợp, lấy kết quả.
5. Kết quả trả về Backend, lưu DB, sau đó hiển thị lại cho người dùng.
