# Sequence Diagrams — AIMAP

**Luồng tương tác cho 9 tính năng chính của hệ thống**

> **Chú giải:**
> - **Người dùng** — Chủ doanh nghiệp/Marketing Assistant dùng trình duyệt
> - **Giao diện Web** — Trang web AIMAP (Next.js)
> - **Máy chủ** — Backend API xử lý nghiệp vụ (FastAPI)
> - **AI Pipeline** — Dịch vụ điều phối 3 AI agents
> - **Cơ sở dữ liệu** — PostgreSQL lưu trữ dữ liệu
> - **AI Chiến lược / AI Kiểm duyệt** — OpenAI GPT-4o-mini
> - **AI Sáng tạo / AI Tóm tắt** — Qwen 2.5 7B (self-hosted VPS)

---

## SD-01: Thiết lập Brand Vault (Hồ sơ Thương hiệu)

> Chủ doanh nghiệp điền một lần — thông tin thương hiệu được tự động đưa vào mọi chiến dịch AI về sau. Đây là bước bắt buộc trước khi tạo campaign.

```mermaid
sequenceDiagram
    actor Owner as Chủ doanh nghiệp
    participant Web as Giao diện Web
    participant Server as Máy chủ
    participant DB as Cơ sở dữ liệu

    Owner->>Web: Vào trang Brand Vault
    Web->>Server: Kiểm tra đã có hồ sơ thương hiệu chưa
    Server->>DB: Tìm thương hiệu theo tài khoản

    alt Chưa có hồ sơ
        DB-->>Server: Không tìm thấy
        Server-->>Web: Trống
        Web-->>Owner: Form trống với gợi ý điền thông tin
    else Đã có hồ sơ
        DB-->>Server: Dữ liệu thương hiệu hiện tại
        Server-->>Web: Trả về thông tin
        Web-->>Owner: Form điền sẵn để chỉnh sửa
    end

    Owner->>Web: Điền đầy đủ thông tin thương hiệu
    Owner->>Web: Nhấn Lưu

    Web->>Server: Gửi thông tin thương hiệu
    Server->>Server: Kiểm tra các trường bắt buộc (tên, mô tả, tone, đối tượng)

    alt Thiếu trường bắt buộc
        Server-->>Web: Danh sách trường còn thiếu
        Web-->>Owner: Làm nổi bật ô chưa điền
    else Đủ thông tin
        Server->>DB: Lưu / cập nhật hồ sơ thương hiệu
        DB-->>Server: Thành công
        Server-->>Web: Lưu thành công
        Web-->>Owner: Thông báo "Brand Vault đã cập nhật"
    end
```

---

## SD-02: Tạo Campaign Brief → AI Multi-Agent Tự động Viết Nội dung

> Người dùng chỉ mô tả mục tiêu. Ba AI agents sẽ tự làm phần còn lại: lên chiến lược → viết nội dung → kiểm duyệt chất lượng. Toàn bộ diễn ra trong nền, người dùng nhận kết quả khi hoàn thành.

```mermaid
sequenceDiagram
    actor Owner as Chủ doanh nghiệp
    participant Web as Giao diện Web
    participant Server as Máy chủ
    participant DB as Cơ sở dữ liệu
    participant AI as AI Pipeline
    participant OpenAI as AI Chiến lược & Kiểm duyệt
    participant Qwen as AI Sáng tạo

    Owner->>Web: Điền Campaign Brief (tên, mục tiêu, sản phẩm, kênh, deadline)
    Web->>Server: Gửi thông tin chiến dịch
    Server->>DB: Lưu chiến dịch, đánh dấu "Chờ AI xử lý"
    Server->>AI: Giao việc: xử lý chiến dịch này
    Server-->>Web: Xác nhận đã nhận, đang xử lý
    Web-->>Owner: Chuyển sang trang chiến dịch — "AI đang làm việc..."

    AI->>Server: Lấy thông tin chiến dịch và Brand Vault
    Server->>DB: Truy xuất brief + hồ sơ thương hiệu
    DB-->>Server: Brief + Brand Vault data
    Server-->>AI: Dữ liệu đầy đủ
    AI->>DB: Cập nhật trạng thái "Đang xử lý"

    AI->>OpenAI: Bước 1 — Gửi brief + thương hiệu, yêu cầu lên kế hoạch chiến dịch
    OpenAI-->>AI: Kế hoạch: thông điệp chính + hướng viết từng kênh
    AI->>DB: Lưu nhật ký Bước 1 (model, thời gian, số token)

    loop Lặp cho từng kênh (Facebook / Email / Video)
        AI->>Qwen: Bước 2 — Gửi hướng viết + thương hiệu, yêu cầu soạn nội dung
        Qwen-->>AI: Bản nháp nội dung theo định dạng kênh
        AI->>DB: Lưu nhật ký Bước 2

        AI->>OpenAI: Bước 3 — Gửi bản nháp + tiêu chuẩn thương hiệu để rà soát
        OpenAI-->>AI: Bản đã chỉnh sửa + danh sách vấn đề phát hiện
        AI->>DB: Lưu nhật ký Bước 3
        AI->>DB: Lưu nội dung hoàn thiện, trạng thái "Chờ duyệt"
    end

    AI->>Server: Báo hoàn thành toàn bộ chiến dịch
    Server->>DB: Cập nhật chiến dịch "Chờ phê duyệt"
    Server->>DB: Tạo thông báo trong ứng dụng

    Web->>Server: Kiểm tra trạng thái chiến dịch (tự động)
    Server-->>Web: Chiến dịch sẵn sàng, 3 nội dung đang chờ duyệt
    Web-->>Owner: Hiển thị nội dung AI vừa tạo kèm nhật ký từng bước
```

---

## SD-03: Xem Nhật ký AI (Agent Run Logs)

> Sau khi AI xử lý xong, người dùng có thể xem lại từng bước AI đã làm gì, dùng model nào, mất bao lâu — minh bạch toàn bộ quá trình.

```mermaid
sequenceDiagram
    actor Owner as Chủ doanh nghiệp
    participant Web as Giao diện Web
    participant Server as Máy chủ
    participant DB as Cơ sở dữ liệu

    Owner->>Web: Vào trang Chi tiết Chiến dịch
    Web->>Server: Lấy thông tin chiến dịch kèm nhật ký AI
    Server->>DB: Truy xuất chiến dịch + toàn bộ agent run logs theo thứ tự bước
    DB-->>Server: Chiến dịch + danh sách nhật ký (mỗi bước 1 entry)
    Server-->>Web: Dữ liệu đầy đủ

    Web-->>Owner: Hiển thị timeline dọc — mỗi bước 1 thẻ

    Owner->>Web: Click vào thẻ Bước 1 (Strategist)
    Web-->>Owner: Mở rộng: tên model, thời gian xử lý, preview đầu vào, preview kết quả

    Owner->>Web: Click vào thẻ Bước 2 (Writer — Facebook)
    Web-->>Owner: Mở rộng: model Qwen, bản nháp trước khi Critic chỉnh sửa

    Owner->>Web: Click vào thẻ Bước 3 (Critic — Facebook)
    Web-->>Owner: Mở rộng: danh sách vấn đề Critic phát hiện, bản sau chỉnh sửa

    Owner->>Web: Xem tổng hợp: tổng token đã dùng, tổng thời gian pipeline
    Web->>Server: Lấy thống kê AI usage của chiến dịch này
    Server->>DB: Tổng hợp token và thời gian từ tất cả logs
    DB-->>Server: Tổng số token, tổng thời gian ms
    Server-->>Web: Số liệu tổng hợp
    Web-->>Owner: Hiển thị "Đã dùng X tokens — Xử lý trong Y giây"
```

---

## SD-04: Phê duyệt Nội dung (Approve / Reject / Chỉnh sửa)

> Không có nội dung nào được đưa lên lịch mà không qua tay người dùng. Ba lựa chọn: duyệt ngay, từ chối với ghi chú, hoặc chỉnh sửa trực tiếp rồi duyệt.

```mermaid
sequenceDiagram
    actor Owner as Chủ doanh nghiệp
    participant Web as Giao diện Web
    participant Server as Máy chủ
    participant DB as Cơ sở dữ liệu

    Owner->>Web: Vào trang Phê duyệt
    Web->>Server: Lấy danh sách nội dung đang chờ duyệt
    Server->>DB: Lọc nội dung trạng thái "Chờ duyệt" theo tài khoản
    DB-->>Server: Danh sách nội dung (kênh, tên chiến dịch, ngày dự kiến)
    Server-->>Web: Danh sách
    Web-->>Owner: Hiển thị thẻ nội dung — phân nhóm theo chiến dịch

    alt Duyệt nội dung
        Owner->>Web: Đọc nội dung → click Duyệt
        Web->>Server: Lệnh duyệt nội dung
        Server->>DB: Cập nhật trạng thái thành "Đã duyệt"
        Server->>DB: Ghi lịch sử phê duyệt (ai duyệt, lúc nào, phiên bản nào)
        Server->>DB: Kiểm tra toàn bộ nội dung của chiến dịch đã duyệt hết chưa
        DB-->>Server: Còn 2 nội dung khác chưa duyệt
        Server-->>Web: Thành công
        Web-->>Owner: Thẻ chuyển xanh — nội dung xuất hiện trên Calendar

    else Từ chối có ghi chú
        Owner->>Web: Click Từ chối → nhập lý do
        Web->>Server: Lệnh từ chối kèm lý do
        Server->>DB: Cập nhật trạng thái thành "Đã từ chối", lưu lý do
        Server->>DB: Ghi lịch sử phê duyệt
        Server-->>Web: Thành công
        Web-->>Owner: Thẻ chuyển đỏ kèm ghi chú lý do từ chối

    else Chỉnh sửa rồi duyệt
        Owner->>Web: Click Chỉnh sửa → sửa trực tiếp nội dung
        Web->>Server: Gửi bản chỉnh sửa
        Server->>DB: Tạo phiên bản mới (giữ nguyên phiên bản gốc)
        Server-->>Web: Trả về ID phiên bản mới
        Owner->>Web: Xác nhận hài lòng → click Duyệt
        Web->>Server: Duyệt phiên bản mới
        Server->>DB: Cập nhật trạng thái thành "Đã duyệt"
        Server-->>Web: Thành công
        Web-->>Owner: Thẻ chuyển xanh với nhãn "Đã chỉnh sửa & Duyệt"
    end

    Server->>DB: Kiểm tra lại: tất cả nội dung chiến dịch đã duyệt?
    DB-->>Server: Tất cả đã duyệt
    Server->>DB: Cập nhật chiến dịch thành "Hoàn thành"
    Server->>DB: Tạo thông báo "Chiến dịch X đã hoàn tất phê duyệt"
```

---

## SD-05: Lịch Marketing — Xem & Điều chỉnh Lịch Đăng bài

> Người dùng nhìn tổng thể kế hoạch nội dung cả tháng. Mỗi ngày hiển thị chấm màu theo kênh. Click vào ngày để đọc nội dung, thay đổi ngày nếu cần điều chỉnh kế hoạch.

```mermaid
sequenceDiagram
    actor Owner as Chủ doanh nghiệp
    participant Web as Giao diện Web
    participant Server as Máy chủ
    participant DB as Cơ sở dữ liệu

    Owner->>Web: Mở trang Lịch Marketing (mặc định tháng hiện tại)
    Web->>Server: Lấy nội dung có lịch đăng trong tháng này
    Server->>DB: Truy xuất nội dung theo tháng/năm, lấy phiên bản mới nhất mỗi kênh
    DB-->>Server: Danh sách nội dung kèm ngày, kênh, trạng thái, tên chiến dịch
    Server-->>Web: Dữ liệu tháng
    Web-->>Owner: Lịch tháng — mỗi ngày có chấm màu (Facebook=xanh, Email=vàng, Video=đỏ)

    Owner->>Web: Click sang tháng trước / tháng sau
    Web->>Server: Lấy dữ liệu tháng mới
    Server->>DB: Truy xuất theo tháng/năm mới
    DB-->>Server: Dữ liệu tháng mới
    Server-->>Web: Cập nhật lịch
    Web-->>Owner: Lịch tháng mới hiển thị

    Owner->>Web: Click vào một ngày có nội dung
    Web-->>Owner: Panel bên phải liệt kê nội dung trong ngày đó

    Owner->>Web: Click mở một nội dung để đọc chi tiết
    Web-->>Owner: Nội dung đầy đủ (bài viết / email / script video)

    Owner->>Web: Muốn đổi ngày đăng → chọn ngày mới
    Web->>Server: Cập nhật ngày đăng cho nội dung này
    Server->>DB: Lưu ngày mới
    DB-->>Server: Thành công
    Server-->>Web: Cập nhật thành công
    Web-->>Owner: Nội dung di chuyển sang ngày mới trên lịch ngay lập tức

    Owner->>Web: Lọc chỉ xem kênh Email
    Web-->>Owner: Ẩn nội dung Facebook và Video — không cần gọi server
```

---

## SD-06: Dashboard & AI Tóm tắt Tuần

> Trang tổng quan hiển thị con số hoạt động marketing và một đoạn nhận xét ngắn do AI viết — giống như có trợ lý marketing báo cáo tình hình mỗi ngày.

```mermaid
sequenceDiagram
    actor Owner as Chủ doanh nghiệp
    participant Web as Giao diện Web
    participant Server as Máy chủ
    participant DB as Cơ sở dữ liệu
    participant Qwen as AI Tóm tắt

    Owner->>Web: Mở trang Dashboard

    Web->>Server: Lấy số liệu tổng hợp
    Server->>DB: Đếm tổng chiến dịch
    Server->>DB: Đếm tổng nội dung đã tạo
    Server->>DB: Đếm nội dung đang chờ duyệt
    Server->>DB: Đếm nội dung đã được duyệt
    Server->>DB: Phân bổ nội dung theo kênh (Facebook / Email / Video)
    Server->>DB: Lấy 10 hoạt động AI gần nhất
    Server->>DB: Lấy số token AI đã dùng tháng này
    DB-->>Server: Toàn bộ số liệu
    Server-->>Web: Trả về stats
    Web-->>Owner: Hiển thị 4 ô thống kê + biểu đồ kênh + feed hoạt động gần đây

    Web->>Server: Yêu cầu tóm tắt AI cho tuần này
    Server->>DB: Lấy dữ liệu tuần: số campaign, kênh nhiều nhất, trạng thái tổng thể
    DB-->>Server: Dữ liệu tuần
    Server->>Qwen: Gửi dữ liệu tuần, yêu cầu viết nhận xét bằng tiếng Việt tự nhiên
    Qwen-->>Server: Đoạn nhận xét 2-3 câu + gợi ý hành động

    alt Qwen lỗi hoặc phản hồi quá chậm
        Server->>Server: Chuyển sang OpenAI để tạo tóm tắt (fallback)
        Server-->>Web: Tóm tắt từ OpenAI
    else Qwen phản hồi bình thường
        Server-->>Web: Tóm tắt từ Qwen
    end

    Web-->>Owner: Thẻ "Nhận xét của AI" với nội dung tóm tắt
```

---

## SD-07: Tạo & Kích hoạt Workflow Tự động

> Người dùng cài lịch một lần — từ đó mỗi tuần hệ thống tự tạo campaign và chạy AI mà không cần nhắc. Người dùng chỉ cần vào duyệt nội dung khi nhận thông báo.

```mermaid
sequenceDiagram
    actor Owner as Chủ doanh nghiệp
    participant Web as Giao diện Web
    participant Server as Máy chủ
    participant DB as Cơ sở dữ liệu
    participant Cron as Bộ lên lịch tự động
    participant AI as AI Pipeline

    Owner->>Web: Vào Workflow → Tạo lịch tự động mới
    Owner->>Web: Điền: "Mỗi thứ Hai 8 giờ sáng — tự tạo campaign tuần mới"
    Owner->>Web: Điền brief mặc định (mục tiêu, sản phẩm, kênh cần tạo)
    Web->>Server: Lưu cài đặt lịch tự động
    Server->>DB: Lưu lịch, tính thời điểm chạy tiếp theo
    DB-->>Server: Thành công
    Server-->>Web: Lịch đã kích hoạt
    Web-->>Owner: Xác nhận — hiển thị "Lần chạy tiếp theo: Thứ Hai xx/xx 08:00"

    Owner->>Web: Xem danh sách workflow đang chạy
    Web->>Server: Lấy danh sách workflow schedules + lịch sử jobs
    Server->>DB: Truy xuất schedules và workflow_jobs
    DB-->>Server: Danh sách
    Server-->>Web: Danh sách lịch + trạng thái từng lần chạy
    Web-->>Owner: Bảng hiển thị workflow, lần chạy gần nhất, kết quả

    Cron->>DB: Quét định kỳ: lịch nào cần chạy trong vòng 5 phút tới?
    DB-->>Cron: Tìm thấy lịch của Owner
    Cron->>DB: Ghi nhận bắt đầu chạy (workflow job)
    Cron->>Server: Tạo chiến dịch mới từ brief mặc định
    Server->>DB: Lưu chiến dịch, trạng thái "Chờ AI xử lý"
    Server->>AI: Khởi động AI Pipeline cho chiến dịch này
    Server->>DB: Cập nhật lịch — lần chạy tiếp theo: thứ Hai tuần sau

    AI->>Server: AI xử lý xong, nội dung sẵn sàng
    Server->>DB: Cập nhật workflow job thành "Hoàn thành"
    Server->>DB: Tạo thông báo cho Owner

    Owner->>Web: Nhận thông báo trong ứng dụng
    Web-->>Owner: "Campaign tuần này đã sẵn sàng — vào duyệt nhé"
```

---

## SD-08: Upload Danh sách Khách hàng (CSV) → Tự động tạo Email Campaign

> Người dùng upload file danh sách khách hàng. Hệ thống tự nhập dữ liệu, tự tạo email campaign phù hợp và chạy AI viết nội dung. Người dùng chỉ vào duyệt là xong — không cần làm gì thêm.

```mermaid
sequenceDiagram
    actor Owner as Chủ doanh nghiệp
    participant Web as Giao diện Web
    participant Server as Máy chủ
    participant DB as Cơ sở dữ liệu
    participant AI as AI Pipeline

    Owner->>Web: Vào Customer Lists → Upload file CSV
    Web->>Server: Gửi file CSV lên

    Server->>Server: Kiểm tra định dạng (.csv, dưới 10MB)

    alt File không hợp lệ
        Server-->>Web: Báo lỗi định dạng
        Web-->>Owner: Hướng dẫn chuẩn bị lại file (cột cần có: email, tên, số điện thoại)
    else File hợp lệ
        Server->>DB: Lưu file, tạo bản ghi danh sách "Đang xử lý"
        Server-->>Web: Nhận file thành công
        Web-->>Owner: "Đang nhập danh sách khách hàng..."

        Server->>Server: Xử lý file CSV trong nền (không chặn giao diện)
        Server->>DB: Lưu từng khách hàng (email, tên, số điện thoại, thông tin thêm)
        Server->>DB: Cập nhật danh sách: "Sẵn sàng — X khách hàng hợp lệ"

        Server->>DB: Tạo chiến dịch Email tự động cho danh sách này
        Server->>AI: Khởi động AI viết nội dung email

        AI->>AI: Chạy pipeline Strategist → Writer → Critic
        AI->>Server: Nội dung email hoàn thiện

        Server->>DB: Lưu nội dung, trạng thái "Chờ duyệt"
        Server->>DB: Tạo thông báo cho Owner

        Owner->>Web: Nhận thông báo "Email campaign đã sẵn sàng"
        Web-->>Owner: "AI vừa viết xong nội dung email cho 150 khách hàng — vào duyệt nhé"
        Owner->>Web: Vào trang Phê duyệt để xem và duyệt nội dung
    end
```

---

## SD-09: Insight Copilot Deep Analysis (có tiến trình theo bước)

```mermaid
sequenceDiagram
    actor Owner as Chủ doanh nghiệp
    participant Web as Giao diện Web
    participant API as Backend API
    participant DS as DeepSeek Coder 6.7B
    participant QW as Qwen 2.5 7B
    participant GPT as GPT Fallback
    participant DB as PostgreSQL

    Owner->>Web: Upload CSV/Excel báo cáo
    Web->>API: POST /insights/a2a/deep-analysis-stream
    API-->>Web: Bắt đầu stream tiến trình (step-by-step)

    API->>DS: Bước 1-2: phân loại file + ánh xạ cột cần thiết
    DS-->>API: report_type + schema_map + confidence
    API-->>Web: Cập nhật tiến trình "Phân loại/Ánh xạ"

    API->>API: Bước 3: tính toán chỉ số và thống kê khám phá
    API-->>Web: Cập nhật tiến trình "Tính toán"

    API->>QW: Bước 4: diễn giải kết quả theo ngôn ngữ dễ hiểu
    QW-->>API: insight_json
    alt Qwen lỗi hoặc timeout
        API->>GPT: fallback diễn giải
        GPT-->>API: fallback_insight_json
    end

    API->>DS: Bước 5: chuẩn hóa tiếng Việt (polish)
    DS-->>API: phiên bản diễn giải đã chuẩn hóa

    API->>DB: Lưu run trace + mapping + result snapshot
    API-->>Web: Gửi kết quả cuối cùng
    Web-->>Owner: Hiển thị điểm chất lượng dữ liệu + tin nhắn phân tích + lịch sử run
```
