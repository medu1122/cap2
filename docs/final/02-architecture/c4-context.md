# C4 Model — Level 1: System Context

**AIMAP — Nền tảng hỗ trợ marketing có AI**

---

## Mục tiêu sơ đồ

Sơ đồ này chỉ trả lời 3 câu hỏi đơn giản:

1. Ai dùng hệ thống?
2. Hệ thống kết nối với dịch vụ nào bên ngoài?
3. Dòng giá trị chính đi qua đâu?

---

## Diagram

```mermaid
C4Context
    title System Context — AIMAP Platform

    Person(user, "Người dùng doanh nghiệp", "Tạo chiến dịch, duyệt nội dung, xem báo cáo")
    Person(admin, "Quản trị hệ thống", "Giám sát vận hành và hỗ trợ người dùng")
    System(cron, "Bộ lịch tự động", "Kích hoạt workflow theo giờ")

    System(aimap, "AIMAP Platform", "Web + API + AI pipeline + Database")

    System_Ext(ai, "AI Providers", "DeepSeek / Qwen / OpenAI (fallback khi cần)")
    System_Ext(smtp, "Email SMTP", "Gửi email xác minh và đặt lại mật khẩu")

    Rel(user, aimap, "Sử dụng các tính năng marketing và insight")
    Rel(admin, aimap, "Quản trị vận hành")
    Rel(cron, aimap, "Kích hoạt các workflow định kỳ")

    Rel(aimap, ai, "Gọi AI để tạo nội dung và phân tích dữ liệu")
    Rel(aimap, smtp, "Gửi email giao dịch")
```

---

## Luồng chính cho người đọc phổ thông

- Người dùng thao tác trên web: tạo campaign, duyệt nội dung, xem dashboard/calendar/insight.
- AIMAP gọi nhóm AI Providers để tạo nội dung và diễn giải dữ liệu.
- Nếu model chính lỗi hoặc timeout, hệ thống tự chuyển model dự phòng để đảm bảo có kết quả.
- Cron Scheduler chạy nền để kích hoạt workflow tự động.
- Admin theo dõi trạng thái vận hành, không tham gia luồng sử dụng hằng ngày của user.

---

## Vai trò trong hệ thống

| Actor | Vai trò |
|---|---|
| `user` | Người dùng doanh nghiệp |
| `admin` | Quản trị vận hành hệ thống |
| `cron` | Tiến trình tự động, không phải người dùng |
