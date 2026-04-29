# RM-07: AI Campaign Assistant

> **Ngày tạo:** 29/04/2026
> **Người tạo:** AI Assistant
> **Trạng thái:** Đã triển khai

---

## Tên chức năng

**AI Campaign Assistant** — Trợ lý AI tạo chiến dịch theo từng bước chọn lựa

---

## Công dụng, tác dụng

### Giải quyết vấn đề gì?

Nhiều người dùng nhỏ (chủ quán, chủ shop) **không biết nên chạy chiến dịch gì**.
Họ không phải dân marketing, không biết nên bắt đầu từ đâu.

### AI Campaign Assistant giúp gì?

1. **Gợi ý ý tưởng** — AI tự phân tích thương hiệu của bạn, xem các dịp lễ sắp tới, rồi đề xuất 3-4 hướng chiến dịch phù hợp.

2. **Chỉ cần chọn** — Bạn không cần nghĩ nhiều, cứ chọn 1 trong các gợi ý. Hoặc tự nhập ý tưởng của mình cũng được.

3. **AI tự viết nội dung** — Khi đã chọn xong, AI sẽ tự tạo:
   - Nội dung email
   - Bài đăng Facebook
   - Kịch bản quay video TikTok
   - Câu lệnh tạo ảnh (prompt cho AI vẽ)

4. **Xem và sửa** — Bạn xem được từng phần, có thể yêu cầu AI viết lại nếu chưa ưng.

5. **Tạo chiến dịch thật** — Bấm 1 nút, chuyển thành chiến dịch thật trên hệ thống và bắt đầu chạy.

---

## Cách hoạt động (theo từng bước)

### Bước 1: Bấm nút "Gợi ý chiến dịch AI"
Nút màu xanh dương nằm ở góc dưới bên phải màn hình, có hình tia sét ⚡.

### Bước 2: Chọn thương hiệu
Chọn thương hiệu bạn muốn chạy chiến dịch. Nếu chưa có, phải vào **Kho thương hiệu** tạo trước.

### Bước 3: AI gợi ý
Hệ thống tự chạy, mất khoảng 10-30 giây. Sau đó hiện ra 3-4 gợi ý chiến dịch, mỗi gợi ý có:
- Tên chiến dịch
- Mô tả ngắn
- Nên chạy kênh nào (email, Facebook, video)

Bạn bấm chọn 1 gợi ý. Hoặc tự gõ ý tưởng của mình cũng được.

### Bước 4: Xem trước và chỉnh sửa
Hệ thống hiện tóm tắt chiến dịch bạn đã chọn.
Bạn có thể bấm **Chỉnh sửa** để sửa lại tên, mục tiêu, ưu đãi, kênh nếu muốn.

### Bước 5: AI viết nội dung
Bấm **Bắt đầu build**, AI sẽ viết từng phần một:
- Đầu tiên viết nội dung email
- Rồi viết bài đăng Facebook
- Rồi viết kịch bản video
- Rồi viết câu lệnh tạo ảnh

Mỗi phần hiện dấu tick xanh khi xong. Có thể bấm **Tạo lại** nếu chưa ưng.

### Bước 6: Xem kết quả
Tất cả nội dung được gom lại, bạn có thể:
- Đọc từng phần
- Copy (sao chép) nội dung
- Bấm **Tạo chiến dịch** để chuyển thành chiến dịch thật

---

## Sơ đồ luồng hoạt động

```
Người dùng          Hệ thống              AI
    |                  |                   |
    |-- Bấm nút ------>|                   |
    |                  |-- Gợi ý --------->|
    |<-- Hiện gợi ý ---|                   |
    |                  |                   |
    |-- Chọn 1 gợi ý ->|                   |
    |                  |-- Viết email ----->|
    |<-- Email xong ---|                   |
    |                  |-- Viết bài đăng ->|
    |<-- Bài đăng xong-|                   |
    |                  |-- Viết video ----->|
    |<-- Video xong ---|                   |
    |                  |-- Viết ảnh ------->|
    |<-- Prompt ảnh xong|                  |
    |                  |                   |
    |-- Xem kết quả ---|                   |
    |-- Bấm tạo chiến dịch ->|             |
    |                  |-- Tạo campaign --->|
    |<-- Xong ---------|
```

---

## Ai nên dùng?

- Chủ shop, chủ quán nhỏ muốn chạy quảng cáo nhưng không biết bắt đầu từ đâu
- Người muốn nhanh, không cần học marketing
- Người muốn có nội dung sẵn, chỉ cần sửa lại cho vừa

---

## Màn hình chính

| Màn hình | Mô tả |
|----------|--------|
| Nút ⚡ | Bấm để mở trợ lý |
| Step 1: Chọn thương hiệu | Chọn brand đã tạo |
| Step 2: Gợi ý | Xem 3-4 ý tưởng, bấm chọn |
| Step 3: Xem trước | Xem và sửa nhanh |
| Step 4: Đang viết | AI viết từng phần, hiện tiến độ |
| Step 5: Kết quả | Xem toàn bộ, copy, tạo chiến dịch |
