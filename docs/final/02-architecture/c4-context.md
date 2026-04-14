# C4 Model — Level 1: System Context

**AIMAP — AI-Powered Marketing Automation Platform**

---

## Diagram

```mermaid
C4Context
    title System Context — AIMAP Platform

    Person(user, "User", "Người dùng doanh nghiệp. Role: user")
    Person(admin, "Admin", "Quản trị hệ thống AIMAP. Role: admin")
    System(cron, "Cron Scheduler", "Tiến trình tự động chạy ngầm trong hệ thống")

    System(aimap, "AIMAP Platform", "Nền tảng AI tự động hóa marketing cho SMB — Web App, Backend API, Agent Service, PostgreSQL")

    System_Ext(openai, "OpenAI API", "GPT-4o-mini — Fallback Reasoning")
    System_Ext(qwen, "Qwen VPS", "Qwen 2.5 7B self-hosted — Narrative")
    System_Ext(deepseek, "DeepSeek VPS", "DeepSeek Coder 6.7B — Classify/Map/Plan")
    System_Ext(smtp, "Email SMTP", "Dịch vụ gửi email giao dịch")

    %% ── User → AIMAP ─────────────────────────────────────────────────
    Rel(user, aimap, "Đăng ký tài khoản mới")
    Rel(user, aimap, "Đăng nhập tài khoản")
    Rel(user, aimap, "Cập nhật hồ sơ / Brand Vault")
    Rel(user, aimap, "Tạo Campaign Brief")
    Rel(user, aimap, "Duyệt / từ chối / chỉnh sửa nội dung")
    Rel(user, aimap, "Xem Dashboard và Calendar")
    Rel(user, aimap, "Cài workflow và upload CSV")
    Rel(user, aimap, "Nạp CSV/Excel vào Insight Copilot và xem kết quả AI phân tích")
    Rel(user, aimap, "Xem Lịch Marketing")
    Rel(user, aimap, "Xem Nhật ký AI (theo dõi tiến trình)")

    %% ── AIMAP → User ─────────────────────────────────────────────────
    Rel_Back(user, aimap, "Danh sách campaign & nội dung")
    Rel_Back(user, aimap, "Lịch Marketing theo tháng")
    Rel_Back(user, aimap, "Email xác minh tài khoản và đặt lại mật khẩu")
    Rel_Back(user, aimap, "Nội dung AI và log xử lý")

    %% ── Admin ↔ AIMAP ────────────────────────────────────────────────
    Rel(admin, aimap, "Quản trị user (khóa/mở)")
    Rel(admin, aimap, "Giám sát workflow jobs")
    Rel(admin, aimap, "Theo dõi AI usage và audit logs")
    Rel_Back(admin, aimap, "Báo cáo vận hành toàn hệ thống")

    %% ── Cron → AIMAP ─────────────────────────────────────────────────
    Rel(cron, aimap, "Kích hoạt workflow schedule (VD: Thứ Hai 8am)")
    Rel(cron, aimap, "Upload trigger: tạo email campaign từ CSV")

    %% ── AIMAP → Cron ─────────────────────────────────────────────────
    Rel_Back(cron, aimap, "Cập nhật next_run_at sau mỗi lần chạy")

    %% ── AIMAP ↔ OpenAI ───────────────────────────────────────────────
    Rel(aimap, openai, "Strategist Agent: gửi brief + brand vault → yêu cầu lên kế hoạch")
    Rel(aimap, openai, "Critic Agent: gửi bản nháp + tiêu chuẩn → yêu cầu kiểm duyệt")
    Rel_Back(aimap, openai, "Trả về campaign plan JSON (summary, key_messages, deliverables)")
    Rel_Back(aimap, openai, "Trả về review result (status, issues_found, final_content)")

    %% ── AIMAP ↔ Qwen ─────────────────────────────────────────────────
    Rel(aimap, qwen, "Writer Agent: gửi deliverable spec + brand → yêu cầu viết nội dung")
    Rel(aimap, qwen, "Dashboard AI: gửi stats context → yêu cầu tóm tắt tiếng Việt")
    Rel(aimap, qwen, "Insight Copilot: diễn giải KPI thành business insights")
    Rel_Back(aimap, qwen, "Trả về content JSON (FB copy/hashtags, email subject/body, video script)")
    Rel_Back(aimap, qwen, "Trả về đoạn tóm tắt 2-3 câu + gợi ý hành động")

    Rel(aimap, deepseek, "Insight Copilot: phân loại báo cáo, map cột, lập kế hoạch phân tích")
    Rel_Back(aimap, deepseek, "Trả về report_type, schema_map, trace")

    %% ── AIMAP → SMTP ─────────────────────────────────────────────────
    Rel(aimap, smtp, "Gửi email xác minh tài khoản (link hết hạn 24h)")
    Rel(aimap, smtp, "Gửi email đặt lại mật khẩu (link dùng 1 lần, hết hạn 1h)")
    Rel_Back(aimap, smtp, "Xác nhận email đã được gửi thành công")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

---

## Roles thực tế trong hệ thống

| Actor trong diagram | Role trong DB | Mô tả |
|---|---|---|
| **User** | `user` | Người dùng doanh nghiệp — sử dụng toàn bộ luồng marketing |
| **Admin** | `admin` | Quản trị hệ thống AIMAP: user ops, workflow ops, audit |
| **Cron Scheduler** | *(system)* | Tiến trình tự động, không phải người dùng |

> Cap nhat: he thong da bo sung role `admin` de van hanh o muc system-level.

## Fallback Logic (Qwen ↔ OpenAI)

Nếu Qwen VPS không phản hồi trong **15 giây** → Agent Service tự động chuyển sang OpenAI.  
Áp dụng cho: Writer Agent và Dashboard AI Summary.
