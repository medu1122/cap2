# C4 Model — Level 2: Container

**AIMAP — Nền tảng marketing có AI**

---

## Mục tiêu sơ đồ

Cho người đọc biết hệ thống có 4 khối chính nào và chúng nói chuyện với nhau ra sao.

---

## Diagram

```mermaid
C4Container
    title Container Diagram — AIMAP Platform

    Person(user, "Người dùng", "Dùng trình duyệt web")
    Person(admin, "Quản trị", "Theo dõi vận hành")

    System_Ext(ai, "AI Providers", "DeepSeek / Qwen / OpenAI fallback")
    System_Ext(cloudinary, "Cloudinary", "Lưu hình ảnh campaign")

    System_Boundary(aimap, "AIMAP Platform") {
        Container(web, "Web App", "Next.js", "Giao diện cho campaign, calendar, insight")
        Container(api, "Backend API", "FastAPI", "Xử lý nghiệp vụ, auth, workflow, insight")
        Container(agent, "AI Service", "Python service", "Điều phối pipeline AI sinh nội dung")
        ContainerDb(db, "PostgreSQL", "Database", "Lưu toàn bộ dữ liệu hệ thống")
    }

    Rel(user, web, "Sử dụng")
    Rel(admin, web, "Quản trị")
    Rel(web, api, "Gọi API")
    Rel(api, db, "Đọc/Ghi dữ liệu")
    Rel(api, agent, "Giao việc AI")
    Rel(agent, api, "Trả kết quả AI")
    Rel(agent, ai, "Gọi model")
    Rel(api, cloudinary, "Upload ảnh")
```

---

## Vai trò từng container (bản dễ hiểu)

| Container | Vai trò chính | Ví dụ chức năng |
|---|---|---|
| **Web App** | Nơi người dùng thao tác | Tạo campaign, duyệt nội dung, xem dashboard/insight |
| **Backend API** | Trung tâm nghiệp vụ | Auth, lưu dữ liệu, xử lý workflow, trả kết quả cho UI |
| **AI Service** | Điều phối sinh nội dung | Lên kế hoạch nội dung, viết nháp, kiểm duyệt |
| **PostgreSQL** | Lưu trữ lâu dài | User, brand, campaign, content, logs, insight run |

---

## Luồng dữ liệu chính

1. Người dùng thao tác trên Web.
2. Web gọi Backend API.
3. Backend đọc/ghi Database.
4. Khi cần AI, Backend giao việc cho AI Service.
5. AI Service gọi model bên ngoài, nhận kết quả, gửi ngược về Backend.
6. Backend trả dữ liệu đã xử lý cho Web để hiển thị.

---

## Ghi chú đọc tài liệu

- Tài liệu này chủ đích ở mức **container**, không đi sâu file code hoặc endpoint chi tiết.
- Chi tiết bảng dữ liệu xem `database-overview.md`.
