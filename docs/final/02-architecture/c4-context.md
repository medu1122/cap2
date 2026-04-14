# C4 Model — Level 1: System Context

**AIMAP — AI-Powered Marketing Automation Platform**

---

## Diagram

```mermaid
C4Context
    title System Context — AIMAP Platform

    Person(owner, "Owner", "Chủ doanh nghiệp nhỏ. Toàn quyền hệ thống. Role: owner")
    Person(user, "User", "Người dùng thứ cấp. Quyền hạn chế. Role: assistant")
    System(cron, "Cron Scheduler", "Tiến trình tự động chạy ngầm trong hệ thống")

    System(aimap, "AIMAP Platform", "Nền tảng AI tự động hóa marketing cho SMB — Web App, Backend API, Agent Service, PostgreSQL")

    System_Ext(openai, "OpenAI API", "GPT-4o-mini — Reasoning & Quality Gate")
    System_Ext(qwen, "Qwen VPS", "Qwen 2.5 7B self-hosted — Text Generation")
    System_Ext(smtp, "Email SMTP", "Dịch vụ gửi email giao dịch")

    %% ── Owner → AIMAP ───────────────────────────────────────────────
    Rel(owner, aimap, "Đăng ký tài khoản mới")
    Rel(owner, aimap, "Đăng nhập / đổi mật khẩu / cập nhật hồ sơ")
    Rel(owner, aimap, "Thiết lập & cập nhật Brand Vault")
    Rel(owner, aimap, "Tạo Campaign Brief (tên, mục tiêu, kênh, deadline)")
    Rel(owner, aimap, "Kích hoạt AI chạy lại nếu campaign bị lỗi")
    Rel(owner, aimap, "Duyệt nội dung AI (Approve)")
    Rel(owner, aimap, "Từ chối nội dung + ghi lý do (Reject)")
    Rel(owner, aimap, "Chỉnh sửa trực tiếp nội dung (Edit → tạo phiên bản mới)")
    Rel(owner, aimap, "Đổi ngày đăng bài trên Calendar")
    Rel(owner, aimap, "Xem Dashboard & yêu cầu AI tóm tắt tuần")
    Rel(owner, aimap, "Cài lịch Workflow tự động (cron schedule)")
    Rel(owner, aimap, "Upload danh sách khách hàng CSV")

    %% ── AIMAP → Owner ───────────────────────────────────────────────
    Rel_Back(owner, aimap, "Trả về nội dung AI đã tạo xong (3 kênh)")
    Rel_Back(owner, aimap, "Thông báo campaign hoàn thành, sẵn sàng duyệt")
    Rel_Back(owner, aimap, "Stats dashboard: tổng campaign, nội dung, token dùng")
    Rel_Back(owner, aimap, "AI Summary text: nhận xét hoạt động tuần")
    Rel_Back(owner, aimap, "Nhật ký AI: từng bước agent, model, thời gian, token")
    Rel_Back(owner, aimap, "Email xác minh tài khoản (qua SMTP)")
    Rel_Back(owner, aimap, "Email đặt lại mật khẩu (qua SMTP)")

    %% ── User → AIMAP ─────────────────────────────────────────────────
    Rel(user, aimap, "Đăng nhập tài khoản")
    Rel(user, aimap, "Tạo Campaign Brief")
    Rel(user, aimap, "Xem Lịch Marketing (chỉ xem, không chỉnh)")
    Rel(user, aimap, "Xem Nhật ký AI (theo dõi tiến trình)")

    %% ── AIMAP → User ─────────────────────────────────────────────────
    Rel_Back(user, aimap, "Danh sách campaign & nội dung")
    Rel_Back(user, aimap, "Lịch Marketing theo tháng")

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
    Rel_Back(aimap, qwen, "Trả về content JSON (FB copy/hashtags, email subject/body, video script)")
    Rel_Back(aimap, qwen, "Trả về đoạn tóm tắt 2-3 câu + gợi ý hành động")

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
| **Owner** | `owner` | Chủ doanh nghiệp — tạo tài khoản đầu tiên, toàn quyền |
| **User** | `assistant` | Người được Owner cho phép sử dụng, quyền hạn chế |
| **Cron Scheduler** | *(system)* | Tiến trình tự động, không phải người dùng |

> Không có role `admin` trong hệ thống. Owner là người dùng cao nhất. Không có tính năng quản trị hệ thống (user management, system config) trong MVP.

## Fallback Logic (Qwen ↔ OpenAI)

Nếu Qwen VPS không phản hồi trong **15 giây** → Agent Service tự động chuyển sang OpenAI.  
Áp dụng cho: Writer Agent và Dashboard AI Summary.
