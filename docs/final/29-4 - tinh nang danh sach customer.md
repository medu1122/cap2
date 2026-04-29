# Tính năng Gửi Email Hàng Loạt - Tài liệu mô tả

**Ngày tạo:** 29/4/2026
**Phiên bản:** 1.0

---

## 1. Tính năng là gì?

**Tên:** Gửi Email Hàng Loạt (Outreach)

**Công dụng:** Gửi email tự động cho nhiều khách hàng cùng lúc, mỗi người nhận được một email riêng được viết riêng cho họ.

**Ví dụ thực tế:**
- Gửi email nhắc khách hàng đã lâu không quay lại
- Gửi email chúc mừng khách hàng mới
- Gửi email chăm sóc khách VIP

**Đặc điểm:**
- Không xuất hiện trên menu bên trái
- Chỉ mở ra khi bấm nút "Gửi email" trong trang phân tích khách hàng
- AI sẽ tự viết nội dung email phù hợp với từng khách

---

## 2. Ai được gửi email?

Dựa vào kết quả phân tích, khách hàng được chia thành 4 nhóm:

| Nhóm | Đối tượng | Ví dụ |
|------|-----------|-------|
| Khách sắp rời bỏ | 30 ngày chưa mua | "Anh Minh, 2 tháng rồi không ghé shop..." |
| Khách tiềm năng | Có mua hàng, có tiền | "Chị Hương, shop có sản phẩm mới phù hợp..." |
| Khách VIP | Mua nhiều, chi tiêu lớn | "Quý khách VIP, cảm ơn đã đồng hành..." |
| Khách mới | Mới đăng ký | "Chào bạn, rất vui được làm quen..." |

---

## 3. Luồng hoạt động (đơn giản)

```
Bước 1: Người dùng vào trang "Danh sách khách"
         │
         ▼
Bước 2: Mở một danh sách khách hàng cụ thể
         │
         ▼
Bước 3: Bấm nút "Phân tích"
         │                    Hệ thống tự động:
         ▼                    - Đọc dữ liệu khách
Bước 4: Xem kết quả phân tích    - Chia khách thành 4 nhóm
         │                    - Tính toán thông tin
         ▼
Bước 5: Chọn nhóm khách muốn gửi
         │  (Ví dụ: Khách sắp rời bỏ)
         ▼
Bước 6: Bấm nút "Gửi email"
         │
         ├──► Mở ra trang soạn email riêng
         │
         ▼
Bước 7: Chọn mục đích gửi
         │  - Nhắc khách quay lại
         │  - Chăm sóc khách
         │  - Kích hoạt mua hàng
         │  - Chào khách mới
         ▼
Bước 8: Bấm "AI viết email"
         │                    AI tự động:
         ▼                    - Viết email cho từng khách
Bước 9: Xem danh sách email đã viết   - Mỗi người 1 email riêng
         │                    - Lấy thông tin khách điền vào
         ▼
Bước 10: Sửa email nếu cần
         │
         ▼
Bước 11: Bấm "Gửi tất cả"
         │                    Email được gửi đi
         ▼                    thật sự qua Gmail/SMTP
Bước 12: Xem kết quả
         │  - Đã gửi thành công
         │  - Gửi thất bại (sẽ thử lại)
         ▼
         XONG
```

---

## 4. Sơ đồ tương tác (sequence diagram)

```
Người dùng          Trang phân tích         Backend AI            Gmail
    │                       │                     │                   │
    │── Bấm "Phân tích" ───►│                     │                   │
    │                       │── Gửi dữ liệu ─────►│                   │
    │                       │                     │── Phân tích ──────►│
    │                       │                     │◄── Kết quả ────────│
    │◄── Hiện kết quả ─────│◄── Trả kết quả ────│                   │
    │                       │                     │                   │
    │── Bấm "Gửi email" ───►│                     │                   │
    │                       │── Mở trang gửi ────►│                   │
    │◄── Trang soạn email ─│◄── OK ─────────────│                   │
    │                       │                     │                   │
    │── Chọn nhóm + mục ───►│                     │                   │
    │── đích, bấm "AI viết" │                     │                   │
    │                       │── Gửi danh sách ───►│                   │
    │                       │   khách + mục đích  │                   │
    │                       │                     │── Viết email ────►│
    │                       │                     │   (AI soạn)      │
    │                       │                     │◄── Email đã soạn ─│
    │◄── Danh sách email ───│◄── Trả email ──────│                   │
    │                       │                     │                   │
    │── Sửa email (nếu muốn)                     │                   │
    │── Bấm "Gửi tất cả" ──►│                     │                   │
    │                       │── Gửi từng email ──►│                   │
    │                       │                     │── Email 1 ──────►│
    │                       │                     │◄── OK ───────────│
    │                       │                     │── Email 2 ──────►│
    │                       │                     │◄── OK ───────────│
    │                       │◄── Kết quả gửi ────│                   │
    │◄── Báo thành công ────│                     │                   │
    │                       │                     │                   │
```

---

## 5. Thông tin chi tiết kỹ thuật

### 5.1 Các thành phần chính

```
┌─────────────────────────────────────────────────────────────────┐
│                      Giao diện người dùng                        │
├─────────────────────────────────────────────────────────────────┤
│  Trang phân tích khách        Trang gửi email                   │
│  - Xem kết quả phân tích       - Chọn nhóm khách                │
│  - Bấm nút gửi email          - Chọn mục đích gửi              │
│                                - Xem danh sách email             │
│                                - Sửa & gửi email                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (FastAPI)                           │
├─────────────────────────────────────────────────────────────────┤
│  - Nhận yêu cầu phân tích                                       │
│  - AI viết email cho từng khách                                 │
│  - Gửi email qua SMTP (Gmail)                                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Database (PostgreSQL)                       │
├─────────────────────────────────────────────────────────────────┤
│  customer_lists          │  customers                            │
│  - Thông tin danh sách   │  - Thông tin từng khách              │
│  customer_analysis_      │  campaign_execution_logs             │
│  snapshots               │  - Lịch sử gửi email                 │
│  - Kết quả phân tích     │                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Cách thông tin khách được điền vào email

Khi AI viết email, hệ thống sẽ lấy thông tin có sẵn của khách để điền vào:

| Biến | Ví dụ | Giải thích |
|------|-------|------------|
| `{{HoVaTen}}` | Nguyễn Văn A | Tên khách hàng |
| `{{LanCuoiChiTra}}` | 15/01/2024 | Ngày mua cuối cùng |
| `{{DichVuLanCuoiSuDung}}` | Massage | Dịch vụ đã dùng |
| `{{days_since_last}}` | 120 | Bao nhiêu ngày chưa mua |

**Ví dụ email thực tế:**

> **Tiêu đề:** Nhắc nhở từ Cửa hàng AIMA
>
> Chào **Nguyễn Văn A**,
>
> Đã **120 ngày** rồi bạn không ghé thăm cửa hàng. Chúng mình rất nhớ bạn!
>
> Lần cuối bạn sử dụng dịch vụ **Massage** vào ngày **15/01/2024**.
>
> Hôm nay, shop có chương trình **giảm 20%** tất cả dịch vụ cho khách cũ.
>
> Bạn ơi, quay lại với chúng mình nhé!
>
> Thân ái,
> AIMA Shop

### 5.3 Giới hạn sử dụng

| Hạng mục | Giới hạn | Lý do |
|----------|----------|-------|
| Số khách mỗi lần gửi | Tối đa 200 | Tránh quá tải server |
| Số email gửi cùng lúc | 200 | Theo giới hạn của Gmail |

---

## 6. Hướng dẫn sử dụng (từng bước)

### Bước 1: Vào trang danh sách khách
- Đăng nhập vào hệ thống
- Chọn menu "Danh sách khách" ở bên trái

### Bước 2: Chọn danh sách cần gửi
- Click vào tên danh sách để mở
- Đảm bảo danh sách có dữ liệu

### Bước 3: Chạy phân tích
- Bấm nút "Phân tích"
- Đợi hệ thống xử lý (khoảng 10-30 giây tuỳ lượng data)
- Xem kết quả phân tích

### Bước 4: Bấm nút gửi email
- Sau khi xem kết quả phân tích
- Bấm nút "Gửi email" (xuất hiện trong modal kết quả)
- Trang soạn email sẽ mở ra

### Bước 5: Chọn nhóm và mục đích
- **Nhóm khách:** Chọn 1 trong 4 nhóm (sắp rời bỏ, tiềm năng, VIP, mới)
- **Mục đích:** Nhắc quay lại / Chăm sóc / Kích hoạt / Chào mừng

### Bước 6: AI viết email
- Bấm "AI viết email"
- Đợi AI soạn (5-30 giây)
- Xem danh sách email đã viết

### Bước 7: Sửa và gửi
- Đọc từng email, sửa nếu cần
- Bấm "Gửi tất cả" để gửi
- Hoặc bấm "Gửi" bên cạnh từng email

### Bước 8: Kiểm tra kết quả
- Xem trạng thái gửi (thành công / thất bại)
- Email thất bại có thể gửi lại sau

---

## 7. Xử lý lỗi thường gặp

### Lỗi: "Chưa có kết quả phân tích"
- **Nguyên nhân:** Chưa bấm nút "Phân tích"
- **Cách sửa:** Vào danh sách → Bấm "Phân tích" → Đợi xong → Gửi email

### Lỗi: "Không có khách nào trong nhóm"
- **Nguyên nhân:** Nhóm này không có khách nào phù hợp
- **Cách sửa:** Thử chọn nhóm khác

### Lỗi: Email không gửi được
- **Nguyên nhân:** Cấu hình Gmail chưa đúng
- **Cách sửa:** Kiểm tra file `.env`, đảm bảo đã điền đúng thông tin Gmail

---

## 8. Bảo mật

- Mỗi user chỉ thấy danh sách của mình
- Email được gửi từ tài khoản đã cấu hình trong hệ thống
- Không lưu mật khẩu email ở đâu khác ngoài file cấu hình
