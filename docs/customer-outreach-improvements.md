# Customer Lists & Outreach — Sửa lỗi & Cải thiện (18/05/2026)

## Tổng quan

Trang `/customer-lists` và `/outreach/[segment]` có nhiều lỗi khiến phân tích và gửi mail không hoạt động đúng.

---

## Các lỗi đã sửa

### 1. `_to_float` không parse số tiền tiếng Việt (`customer_analysis_service.py`)

**Vấn đề:** Dữ liệu Excel có format `"2.400.000 ₫"`. Code cũ `.replace(",", "")` → `"2.400.000"` → parse float thất bại → trả về 0.

**Fix:** Nhận diện Vietnamese format: dot là thousands separator, strip ₫/đ, convert.

### 2. `_to_date` không parse ngày DD/M/YY (`customer_analysis_service.py`)

**Vấn đề:** Dữ liệu `"15/2/26"` → trả về `None` → mọi khách `days_since_last = None` → segmentation sai hoàn toàn.

**Fix:** Thêm format `%d/%m/%y`, `%d.%m.%y`, và regex fallback cho D/M/YY.

### 3. Outreach segment switch — race condition (`outreach/[segment]/page.tsx`)

**Vấn đề:** Chuyển tab (churn → potential...) → build effect tạo emails → restore effect ghi đè bằng localStorage cũ.

**Fix:** Thêm `analysis` vào dependency của restore effect.

### 4. Email thiếu brand context + segment context (`workflow.py`)

**Vấn đề:** `_compose_single_email` gọi LLM nhưng không có segment-specific instruction → nội dung chung chung.

**Fix:**
- Thêm `segment_context` dict cho mỗi nhóm (churn_risk/potential/new/vip)
- Mỗi nhóm có hướng dẫn riêng về giọng văn, nội dung phù hợp
- Mở rộng danh sách subject lines

### 5. "Chúng tôi:" thừa trong subject (`workflow.py`)

**Fix:** Bỏ prefix, chỉ dùng `subject = base_subject`.

### 6. "Tiêu đề:" và `{{HoVaTen}}` thừa trong body (`workflow.py`)

**Fix:**
- Thêm `"tiêu đề:"` vào danh sách strip prefix
- Thêm placeholder replacement: `{{HoVaTen}}` → tên thực

---

## Data format mẫu (Excel/CSV import)

| Cột | Format | Ví dụ |
|------|--------|-------|
| `HoVaTen` | text | Nguyễn Văn A |
| `SDT` | text | 0912345678 |
| `Email` | email | email@example.com |
| `LanCuoiChiTra` | DD/M/YY | 15/2/26 |
| `TongSoTienDaChiTra` | number + ₫ | 2.400.000 ₫ |
| `TongSoLanQuayLai` | integer | 4 |
| `LoaiKhachHang` | text | VIP, Thân thiết |

---

## Sau khi sửa

- User cần **chạy lại phân tích** (bấm "Phân tích") sau khi restart backend
- Brand Vault giúp email cá nhân hóa hơn — nếu chưa có, email vẫn soạn được nhưng chung chung hơn
- Draft email được lưu riêng cho từng segment trong localStorage
