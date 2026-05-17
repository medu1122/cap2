# Customer Lists & Outreach — Sửa lỗi & Cải thiện

**Ngày:** 18/05/2026
**Tác giả:** AI Agent
**Trạng thái:** Hoàn thành

---

## Tổng quan vấn đề

Trang `/customer-lists` và `/outreach/[segment]` có nhiều lỗi nghiêm trọng khiến tính năng phân tích và gửi mail không hoạt động đúng.

### Vấn đề phát hiện

| # | Mô tả | Nguyên nhân gốc | Mức độ |
|---|--------|-----------------|---------|
| 1 | Phân tích không hiểu số tiền → `total_revenue = 0`, charts trống | `_to_float` không parse được format `"2.400.000 ₫"` | Nghiêm trọng |
| 2 | Phân tích segmentation sai hoàn toàn | `_to_date` không parse được `"15/2/26"` → mọi `days_since_last = None` | Nghiêm trọng |
| 3 | Charts revenue/ARPU không hiển thị | Do bug #1 khiến toàn bộ giá trị = 0 | Nghiêm trọng |
| 4 | Tab Tiềm năng/VIP/Khách mới trong outreach không có email | Bug race condition trong React effect dependencies | Cao |
| 5 | Email thiếu brand context → nội dung chung chung | `_compose_single_email` gọi LLM không có thông tin thương hiệu | Cao |
| 6 | Tiêu đề email có "Chúng tôi:" thừa | Code cố tình ghép `brand_name: base_subject` nhưng fallback = "Chúng tôi" | Thấp |
| 7 | Subject/body có "Tiêu đề:" và `{{HoVaTen}}` thừa | LLM trả kèm meta text + backend không strip | Thấp |

---

## Chi tiết từng sửa

### Fix 1: `_to_float` — parse số tiền tiếng Việt

**File:** `api/services/customer_analysis_service.py`

**Vấn đề:** Khi import file Excel/CSV, số tiền có format `"2.400.000 ₫"`. Hàm `_to_float` cũ chỉ `.replace(",", "")` → `"2.400.000"` → parse float thất bại → trả về 0.

**Fix:**
```python
# Handle Vietnamese number format: "2.400.000 ₫", "4.000.000đ", "2,400,000" etc.
text = str(value).strip()
# Strip currency symbols
for sym in ("₫", "đ", "Đ", "VND", "USD", "$", "€", "£"):
    text = text.replace(sym, "")
text = text.strip()
# Vietnamese: dot = thousands separator, comma = decimal
dot_count = text.count(".")
comma_count = text.count(",")
if dot_count > 0:
    # 2.400.000 → 2400000
    text = text.replace(".", "")
    if comma_count == 1 and "," in text:
        text = text.replace(",", ".")
elif comma_count == 1:
    # 1234,56 → 1234.56
    parts = text.split(",")
    if len(parts) == 2 and len(parts[1]) <= 2:
        text = text.replace(",", ".")
```

**Kết quả:** `"2.400.000 ₫"` → `2400000.0`

---

### Fix 2: `_to_date` — parse ngày DD/M/YY

**File:** `api/services/customer_analysis_service.py`

**Vấn đề:** Dữ liệu từ Excel có format `"15/2/26"` (DD/M/YY). Code cũ không có format này → trả về `None` → mọi khách có `days_since_last = None` → segmentation hoàn toàn sai.

**Fix:** Thêm các format và regex fallback:
```python
# Thêm format:
"%d/%m/%y",    # 15/2/26
"%d.%m.%y",    # 15.2.26
# Regex fallback cho D/M/YY:
import re
m = re.match(r"^(\d{1,2})[/\.](\d{1,2})[/\.](\d{2,4})$", raw)
if m:
    d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if y < 100:
        y += 2000
    return datetime(y, mo, d, tzinfo=timezone.utc)
```

---

### Fix 3: Outreach segment switch — race condition

**File:** `web/app/(app)/outreach/[segment]/page.tsx`

**Vấn đề:** Khi chuyển tab (churn → potential → vip...), `useEffect([segment, analysis, rows])` tạo emails → nhưng restore effect cũ chạy sau và ghi đè bằng localStorage cũ → emails sai segment.

**Fix:** Thêm `analysis` vào restore effect dependency để chỉ restore khi có đủ dữ liệu:
```typescript
// Before (bug):
useEffect(() => {
  if (!activeListId || !segment) return;
  // ...
}, [activeListId, segment]);

// After (fixed):
useEffect(() => {
  if (!activeListId || !segment || !analysis) return;
  // ...
}, [activeListId, segment, analysis]);
```

---

### Fix 4: Brand context trong outreach email

**File:** `api/routers/workflow.py` — `_compose_single_email`

**Vấn đề:** Hàm `_compose_single_email` gọi `_smart_contact_compose_text` với `brand_context` nhưng context này có thể `None` nếu user chưa thiết lập Brand Vault → LLM viết email chung chung không đặc thù thương hiệu.

**Fix:**
1. **Thêm segment-specific context** cho LLM — mỗi nhóm (churn_risk, potential, new, vip) có hướng dẫn riêng về giọng văn và nội dung phù hợp
2. **Thêm thông tin khách hàng vào user_prompt** để LLM có đủ ngữ cảnh cá nhân hóa
3. **Mở rộng danh sách subject lines** để mỗi segment có nhiều lựa chọn

---

### Fix 5: Strip "Tiêu đề:" và placeholder trong email

**File:** `api/routers/workflow.py` — `_normalize_smart_contact_compose_output`

**Vấn đề:** LLM trả nội dung kèm "Tiêu đề:" hoặc `{{HoVaTen}}` → hiển thị thừa cho user.

**Fix:**
1. Thêm `"tiêu đề:"` và `"subject:"` vào danh sách prefix cần strip
2. Thêm placeholder replacement trong `_compose_single_email` — thay `{{HoVaTen}}`, `{{days_since_last}}`, etc. bằng giá trị thực từ customer data

---

### Fix 6: Bỏ "Chúng tôi:" trong subject

**File:** `api/routers/workflow.py` — `_compose_single_email`

**Vấn đề:** Code cũ ghép `f"{brand_name}: {base_subject}"` → khi không có Brand Vault, `brand_name = "Chúng tôi"` → subject thành `"Chúng tôi: Bạn ơi..."`

**Fix:** Bỏ prefix, chỉ dùng `subject = base_subject`

---

## Kiến trúc dữ liệu phân tích

```
Excel/CSV Import
     ↓
customer_analysis_service.analyze_customer_rows()
     ↓
_normalize_rows()  → extract: name, spend, repeat_count, days_since_last
     ↓
_segment_label()   → churn_risk | vip | potential | new
     ↓
segmentation.summary        → count per segment
segmentation.revenue_by_customer_type  → grouped by LoaiKhachHang (raw column)
segmentation.arpu_by_segment          → avg spend per segment
segmentation.customers    → [{name, segment}] per customer
     ↓
Snapshot stored in DB
     ↓
customer-lists/page.tsx displays:
  - KPI: total_revenue, customer count
  - Pie: segmentation distribution
  - Bar: inactive timeline
  - Bar: revenue_by_customer_type
  - Bar: arpu_by_segment
  - Grid: segment count tiles → outreach links
```

---

## Data format mẫu

Import từ Excel → dữ liệu nên có các cột:

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

### Fix 7: Strip "[Your Name]" placeholder thừa trong email body

**File:** `api/routers/workflow.py` — `_normalize_smart_contact_compose_output` và `_compose_single_email`

**Vấn đề:** LLM hay ghi `[Your Name]` ở cuối email body → hiển thị thừa cho user.

**Fix:**
1. `_normalize_smart_contact_compose_output`: Strip các dòng signature lines thừa (regex patterns cho `[Your Name]`, `[Tên của bạn]`, `[Name]`, `Trân trọng`, `Thân ái`, markdown link `[Name](url)`, etc.)
2. `_compose_single_email._PLACEHOLDER_MAP`: Thêm mapping cho `[Your Name]`, `[Name]`, `[Shop Name]`, etc. → thay bằng tên khách hàng

### Fix 8: Gắn thông tin liên hệ brand vào cuối email & cải thiện prompt

**File:** `api/routers/workflow.py` — `_compose_single_email`

**Vấn đề:**
1. Email không có thông tin liên hệ thương hiệu ở cuối
2. LLM viết email chung chung, không đúng brand → kể cả khi có brand context trong system prompt

**Fix:**
1. Trích `brand_contact_parts` (tên brand, email liên hệ, phone, address) từ `brand_context` → gắn vào cuối `rendered_body`
2. Thêm brand name vào `recipients_data` block để LLM nhận biết mình đang viết cho brand nào
3. Thêm block `⚠️ QUAN TRỌNG — ĐÂY LÀ EMAIL TỪ THƯƠNG HIỆU:` trong user prompt, nhấn mạnh 4 quy tắc:
   - Giữ đúng giọng điệu/tone từ brand profile
   - Nhắc đúng tên brand, tagline, dịch vụ/sản phẩm đặc trưng
   - Viết như chính chủ cửa hàng viết tay
   - Không chung chung

---

## Lưu ý triển khai

- Sau khi fix `_to_float` và `_to_date`, user cần **chạy lại phân tích** (bấm "Phân tích") để cập nhật kết quả đúng
- Brand Vault cần thiết để email có thông tin thương hiệu — nếu chưa có, email vẫn soạn được nhưng chung chung hơn
- Outreach page sử dụng `localStorage` để lưu draft email — khi chuyển segment, draft cũ được giữ riêng cho từng segment
