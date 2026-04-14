# Kiểm định Tính năng AIMAP — Đã làm thật hay chỉ mô tả?

**Tài liệu này trả lời câu hỏi: mỗi tính năng trong dự án thực sự chạy được chưa, hay mới chỉ có trong tài liệu kế hoạch?**

> Cách kiểm định: đọc trực tiếp mã nguồn trong các thư mục `api/`, `agent/`, `web/` — không dựa vào tài liệu mô tả.

---

## Tóm tắt nhanh

| Trạng thái | Số tính năng | Ý nghĩa |
|---|---|---|
| ✅ Hoàn chỉnh | 3 | Chạy ổn định, đúng với thiết kế ban đầu |
| ⚠️ Làm một phần | 7 | Có mã nguồn, nhưng còn thiếu một số chỗ |
| ❌ Chưa có | 2 | Chỉ tồn tại trong tài liệu, không có mã nguồn |

---

## Phân tích từng tính năng

---

### ✅ Tính năng 1 — Đăng ký, đăng nhập, bảo mật tài khoản

**Kết luận: Hoàn chỉnh, chạy tốt**

| Bộ phận | Vị trí trong mã nguồn | Tình trạng |
|---|---|---|
| Xử lý đăng ký / đăng nhập phía máy chủ | `api/routers/auth.py` | Đầy đủ |
| Mã hoá mật khẩu và cấp thẻ truy cập | `api/core/security.py` | Thẻ truy cập hết hạn 15 phút, thẻ gia hạn 30 ngày |
| Trang đăng nhập | `web/app/(auth)/login/page.tsx` | Đầy đủ |
| Trang đăng ký | `web/app/(auth)/register/page.tsx` | Đầy đủ |

**Lưu ý nhỏ:**
- Thẻ truy cập đang lưu trong bộ nhớ trình duyệt thông thường thay vì cookie an toàn hơn — chấp nhận được trong môi trường demo.
- Tính năng gửi email xác minh tài khoản chưa kết nối dịch vụ gửi thật. Ở môi trường phát triển, mã xác minh được in ra màn hình terminal thay vì gửi đi.

---

### ✅ Tính năng 2 — Kho hồ sơ thương hiệu (Brand Vault)

**Kết luận: Hoàn chỉnh, chạy tốt**

| Bộ phận | Vị trí trong mã nguồn | Tình trạng |
|---|---|---|
| Lấy và lưu thông tin thương hiệu | `api/routers/brands.py` | Đầy đủ |
| Cấu trúc dữ liệu thương hiệu | `api/models/brand.py` | Hơn 12 trường thông tin |
| Giao diện nhập thông tin | `web/app/(app)/brand-vault/page.tsx` | Form đầy đủ |
| Đưa thông tin thương hiệu vào AI | `agent/agents/base.py` | Đúng như thiết kế |

**Lưu ý nhỏ:**
- Hệ thống chưa bắt buộc người dùng thiết lập hồ sơ thương hiệu trước khi tạo chiến dịch. Máy chủ chỉ cảnh báo khi AI bắt đầu chạy, chưa có thông báo sớm trên giao diện.

---

### ✅ Tính năng 3 — Bảng tổng quan (Dashboard) và AI nhận xét tuần

**Kết luận: Hoàn chỉnh, chạy tốt**

| Bộ phận | Vị trí trong mã nguồn | Tình trạng |
|---|---|---|
| Tổng hợp số liệu thống kê | `api/routers/dashboard.py` | Đúng |
| Yêu cầu AI viết tóm tắt | `api/services/dashboard_service.py` | Gọi Qwen, có dự phòng sang OpenAI |
| Giao diện bảng tổng quan | `web/app/(app)/dashboard/page.tsx` | Các ô số liệu và danh sách hoạt động |

**Lưu ý nhỏ:**
- Biểu đồ phân bổ nội dung theo kênh hiển thị dạng danh sách thay vì đồ thị hình tròn — chấp nhận được theo phạm vi ban đầu.

---

### ⚠️ Tính năng 4 — Tạo tóm tắt chiến dịch (Campaign Brief)

**Kết luận: Làm một phần — Phần chính chạy được, kiểm tra đầu vào còn yếu**

| Bộ phận | Vị trí trong mã nguồn | Tình trạng |
|---|---|---|
| Nhận và lưu thông tin chiến dịch | `api/routers/campaigns.py` | ✅ Hoạt động |
| Form nhập liệu trên giao diện | `web/app/(app)/campaigns/new/page.tsx` | ✅ Đủ các trường |
| Kiểm tra deadline không được trong quá khứ | `api/routers/campaigns.py` | ❌ Chưa có |
| Kiểm tra kênh nội dung hợp lệ | `api/schemas/campaign.py` | ❌ Chưa kiểm tra nghiêm |
| Cảnh báo nếu chưa thiết lập hồ sơ thương hiệu | Giao diện | ❌ Chưa có |

**Rủi ro khi demo:**
Người dùng có thể nhập deadline là ngày trong quá khứ hoặc kênh không hợp lệ mà không nhận được thông báo lỗi rõ ràng.

**Cần thêm vào để hoàn thiện:**
```python
# api/routers/campaigns.py — thêm kiểm tra đầu vào
from datetime import date
if body.deadline < date.today():
    raise HTTPException(400, "Ngày kết thúc không được là ngày trong quá khứ")
cac_kenh_sai = [k for k in body.channels if k not in VALID_CHANNELS]
if cac_kenh_sai:
    raise HTTPException(400, f"Kênh không hợp lệ: {cac_kenh_sai}")
```

---

### ⚠️ Tính năng 5 — AI đa tác nhân tự động viết nội dung (Strategist → Writer → Critic)

**Kết luận: Làm một phần — Luồng xử lý chính chạy được, chưa có xử lý lỗi tốt**

| Bộ phận | Vị trí trong mã nguồn | Tình trạng |
|---|---|---|
| Trình điều phối 3 bước | `agent/orchestrator.py` | ✅ Đúng thứ tự Chiến lược → Viết × kênh → Kiểm duyệt × kênh |
| AI Chiến lược (Strategist) | `agent/agents/strategist.py` | ✅ Hoạt động |
| AI Sáng tạo (Writer) | `agent/agents/writer.py` | ✅ Có mẫu cho cả 3 kênh |
| AI Kiểm duyệt (Critic) | `agent/agents/critic.py` | ✅ Hoạt động |
| Định tuyến mô hình thông minh | `agent/llm/router.py` | ✅ Qwen cho Writer, OpenAI cho Chiến lược/Kiểm duyệt |
| Dự phòng Qwen → OpenAI khi timeout | `agent/llm/qwen_client.py` | ✅ Timeout 15 giây |
| Thử lại khi AI trả kết quả sai định dạng | — | ❌ Chưa có — lỗi một lần là dừng ngay |
| Ghi lại số token đã dùng | `agent/agents/base.py` | ❌ Chưa ghi được trường `input_tokens`, `output_tokens` |
| Liên kết nội dung với bước AI đã tạo | `agent/orchestrator.py` | ❌ Không truyền mã bước khi lưu nội dung |

**Rủi ro khi demo:**
Nếu AI trả về kết quả không đúng định dạng một lần → toàn bộ chiến dịch bị đánh dấu thất bại ngay lập tức. Không có cơ chế thử lại.

**Cần thêm vào để hoàn thiện:**
```python
# agent/agents/strategist.py — thêm logic thử lại khi parse lỗi
def _parse(self, raw: str) -> dict:
    for lan_thu in range(2):
        try:
            da_lam_sach = re.sub(r"```json\s*|```\s*", "", raw).strip()
            return json.loads(da_lam_sach)
        except json.JSONDecodeError:
            if lan_thu == 0:
                # Cắt bỏ phần thừa sau dấu } cuối cùng
                raw = raw[:raw.rfind("}") + 1]
    raise ValueError("AI trả về kết quả không đúng định dạng JSON")
```

---

### ⚠️ Tính năng 6 — Nhật ký hoạt động AI

**Kết luận: Làm một phần — Ghi và hiển thị được, còn thiếu thông tin chi tiết**

| Bộ phận | Vị trí trong mã nguồn | Tình trạng |
|---|---|---|
| Cấu trúc dữ liệu nhật ký | `api/models/agent_run_log.py` | ✅ Đủ các trường |
| Ghi nhật ký lên máy chủ | `api/routers/internal.py` | ✅ |
| Hiển thị dòng thời gian trên giao diện | `web/app/(app)/campaigns/[id]/page.tsx` | ✅ Sau lần cập nhật này |
| Báo hiệu "đang xử lý" trước khi gọi AI | `agent/agents/base.py` | ✅ Sau lần cập nhật này |
| Ghi số token đã dùng | `agent/agents/base.py` | ❌ Chưa đọc từ phản hồi của OpenAI |
| Ghi nhật ký khi xảy ra lỗi | `agent/orchestrator.py` | ❌ Lỗi chỉ cập nhật trạng thái chiến dịch, không tạo mục nhật ký chi tiết |

**Cần thêm vào để ghi số token:**
```python
# agent/llm/openai_client.py — trả về thêm thông tin token đã dùng
async def complete(system_prompt, user_prompt, temperature=0.7):
    phan_hoi = await client.chat.completions.create(...)
    thong_ke = phan_hoi.usage
    return (
        phan_hoi.choices[0].message.content,
        thong_ke.prompt_tokens if thong_ke else None,
        thong_ke.completion_tokens if thong_ke else None,
    )
```

---

### ⚠️ Tính năng 7 — Lưu trữ và quản lý phiên bản nội dung

**Kết luận: Làm một phần — Lưu trữ đúng, theo dõi lịch sử phiên bản chưa đầy đủ**

| Bộ phận | Vị trí trong mã nguồn | Tình trạng |
|---|---|---|
| Cấu trúc dữ liệu nội dung | `api/models/content_item.py` | ✅ Có trường `version` và `source` |
| Các thao tác cơ bản | `api/routers/content.py` | ✅ Duyệt / Từ chối / Chỉnh sửa |
| Ghi nội dung từ AI | `api/routers/internal.py` | ✅ |
| Khi người dùng chỉnh sửa — tạo phiên bản mới | `api/routers/content.py` | ⚠️ Tạo dòng mới đúng, nhưng trang chi tiết chiến dịch chỉ hiện phiên bản mới nhất của mỗi kênh |
| Giao diện xem lại lịch sử các phiên bản | Giao diện | ❌ Không có |

**Lưu ý kỹ thuật:** Khi người dùng chỉnh sửa nội dung, hệ thống tạo đúng một dòng mới với số phiên bản tăng lên. Dữ liệu cũ vẫn còn trong cơ sở dữ liệu — chỉ là giao diện chưa cho phép xem lại.

---

### ⚠️ Tính năng 8 — Duyệt và phê duyệt nội dung

**Kết luận: Làm một phần — Duyệt/Từ chối hoạt động, thiếu tự động hoá**

| Bộ phận | Vị trí trong mã nguồn | Tình trạng |
|---|---|---|
| Duyệt nội dung | `api/routers/content.py` | ✅ Cập nhật trạng thái đúng |
| Từ chối với lý do | `api/routers/content.py` | ✅ Lưu ghi chú từ chối |
| Chỉnh sửa và tạo phiên bản mới | `api/routers/content.py` | ✅ |
| Tự động cập nhật chiến dịch khi tất cả nội dung đã duyệt | `api/routers/content.py` | ❌ **Chưa có** — chiến dịch không tự chuyển sang "Hoàn thành" |
| Bảng lịch sử duyệt | `api/models/` | ❌ Không có bảng lưu lịch sử ai đã duyệt gì |
| Thông báo trong ứng dụng | — | ❌ Bảng thông báo có trong cơ sở dữ liệu nhưng không được ghi khi chiến dịch xong |
| Trang danh sách chờ duyệt | `web/app/(app)/approve/page.tsx` | ✅ Hiển thị nội dung đang chờ |

**Cần thêm vào — tự động cập nhật chiến dịch:**
```python
# api/routers/content.py — chạy sau khi duyệt thành công
so_cho_duyet = await db.execute(
    select(func.count()).where(
        ContentItem.campaign_id == noi_dung.campaign_id,
        ContentItem.status == "pending_approval"
    )
)
if so_cho_duyet.scalar() == 0:
    await db.execute(
        update(Campaign)
        .where(Campaign.id == noi_dung.campaign_id)
        .values(status="approved")
    )
```

---

### ⚠️ Tính năng 9 — Lịch marketing

**Kết luận: Làm một phần — Xem theo tháng hoạt động, còn thiếu các tính năng phụ**

| Bộ phận | Vị trí trong mã nguồn | Tình trạng |
|---|---|---|
| Truy vấn nội dung theo tháng | `api/routers/calendar.py` | ✅ Lọc đúng theo tháng/năm |
| Giao diện xem theo tháng | `web/app/(app)/calendar/page.tsx` | ✅ Hiển thị theo ngày |
| Đổi ngày đăng bài | `api/routers/calendar.py` | ✅ |
| Xem theo tuần | Giao diện | ❌ Chỉ có chế độ xem tháng |
| Lọc theo kênh hoặc trạng thái | Giao diện | ❌ Chưa có bộ lọc |
| Click vào ngày mở panel chi tiết | Giao diện | ⚠️ Cần kiểm tra thêm — có thể chỉ chuyển sang trang chiến dịch |

---

### ⚠️ Tính năng 10 — Lịch tự động hoá công việc (Workflow)

**Kết luận: Làm một phần — Máy chủ có đủ, giao diện không tồn tại**

| Bộ phận | Vị trí trong mã nguồn | Tình trạng |
|---|---|---|
| Các endpoint quản lý lịch | `api/routers/workflow.py` | ✅ Tạo lịch, xem lịch, xem lịch sử chạy |
| Cấu trúc dữ liệu | `api/models/workflow_job.py` | ✅ |
| Trang giao diện Workflow | `web/app/(app)/workflow/` | ❌ **Không tồn tại** |
| Đường dẫn trong thanh điều hướng | Thanh bên trái | ❌ Không có |

**Rủi ro khi demo:** Toàn bộ tính năng Workflow không nhìn thấy được từ giao diện dù máy chủ đã sẵn sàng. Cần tạo trang `/workflow` tối thiểu để demo được.

---

### ❌ Tính năng 11 — Kích hoạt tự động theo lịch (Cron)

**Kết luận: Chưa có — chỉ tồn tại trong tài liệu kế hoạch**

| Bộ phận | Vị trí trong mã nguồn | Tình trạng |
|---|---|---|
| Dịch vụ chạy lịch định kỳ | — | ❌ Không tồn tại |
| Tự động tạo chiến dịch theo lịch | — | ❌ Không có |
| Tính toán lần chạy tiếp theo | `api/routers/workflow.py` | ⚠️ Trường `next_run_at` tồn tại nhưng không có tiến trình nào đọc và thực thi |

**Thực tế:** Người dùng có thể lưu cài đặt lịch, nhưng hệ thống không tự động kích hoạt gì cả. Cần tích hợp thêm thư viện lên lịch (APScheduler) vào dịch vụ máy chủ.

**Cần làm tối thiểu để tính năng này hoạt động:**
```python
# api/services/scheduler.py — bộ lên lịch tự động
from apscheduler.schedulers.asyncio import AsyncIOScheduler
bo_len_lich = AsyncIOScheduler()

@bo_len_lich.scheduled_job("interval", minutes=5)
async def kiem_tra_va_chay_workflow():
    # Tìm các lịch có next_run_at <= bây giờ và is_active = true
    # Tạo chiến dịch mới + giao cho AI xử lý
    pass
```

---

### ❌ Tính năng 12 — Upload danh sách khách hàng → Tự động tạo chiến dịch

**Kết luận: Chưa có — chỉ tồn tại trong tài liệu kế hoạch**

| Bộ phận | Vị trí trong mã nguồn | Tình trạng |
|---|---|---|
| Nhận và xử lý file CSV | — | ❌ Không tồn tại |
| Cấu trúc dữ liệu danh sách khách hàng | — | ❌ Không có trong mã nguồn |
| Lưu trữ file | — | ❌ Không có |
| Tự động tạo chiến dịch sau khi upload | — | ❌ Không có |
| Giao diện upload | — | ❌ Không tồn tại |

**Thực tế:** Tính năng này hoàn toàn chưa được viết. Không có một dòng mã nguồn nào liên quan.

---

## Bảng rủi ro khi demo

| Tính năng | Nếu không sửa thì sao | Mức độ ưu tiên |
|---|---|---|
| Thử lại khi AI trả kết quả lỗi (T5) | Chiến dịch bị thất bại ngay khi AI trả định dạng sai một lần | 🔴 Phải sửa |
| Tự động cập nhật chiến dịch khi tất cả đã duyệt (T8) | Chiến dịch mãi ở trạng thái "Chờ duyệt" dù đã duyệt hết | 🔴 Phải sửa |
| Trang giao diện Workflow (T10) | Tính năng tự động hoá hoàn toàn vô hình với người xem | 🟡 Nên sửa |
| Kiểm tra ngày kết thúc (T4) | Dữ liệu không hợp lệ có thể lọt vào | 🟡 Nên sửa |
| Ghi số token AI đã dùng (T6) | Thiếu số liệu khi thuyết trình với hội đồng | 🟡 Nên sửa |
| Kích hoạt theo lịch định kỳ (T11) | Tính năng "nên có" không chạy được | 🟠 Làm sau |
| Upload danh sách khách hàng (T12) | Tính năng "nên có" chưa tồn tại | 🟠 Làm sau |
| Gửi email xác minh thật | Thông báo không đến tay người dùng | 🟢 Thấp — log ra terminal là đủ cho demo |

---

## Danh sách việc cần làm theo thứ tự ưu tiên

### Ưu tiên 1 — Sửa ngay (ảnh hưởng đến chất lượng demo)

1. Thêm logic thử lại khi AI trả kết quả sai định dạng trong cả 3 AI agents — khoảng 30 phút
2. Tự động cập nhật trạng thái chiến dịch khi tất cả nội dung đã được duyệt — khoảng 20 phút
3. Kiểm tra ngày kết thúc và kênh nội dung hợp lệ khi tạo chiến dịch — khoảng 15 phút

### Ưu tiên 2 — Nên làm (nâng chất lượng trình bày)

4. Ghi lại số token AI đã dùng trong mỗi bước — khoảng 1 giờ
5. Tạo trang giao diện Workflow tối giản — khoảng 2 giờ
6. Cảnh báo sớm nếu chưa thiết lập hồ sơ thương hiệu — khoảng 30 phút

### Ưu tiên 3 — Làm nếu còn thời gian

7. Bộ kích hoạt lịch định kỳ (APScheduler) — khoảng 3-4 giờ
8. Tính năng upload danh sách khách hàng cơ bản — khoảng 4-6 giờ
9. Bộ lọc trên trang Lịch marketing — khoảng 1 giờ

---

## Kết luận

AIMAP hiện tại **đã đủ để demo được khoảng 80% tính năng cốt lõi**. Các tính năng "bắt buộc phải có" theo thiết kế ban đầu đều có mã nguồn và chạy được — nhưng một số có lỗ hổng nhỏ cần vá trước khi trình bày với hội đồng.

Hai tính năng "nên có" là kích hoạt tự động theo lịch và upload danh sách khách hàng **hoàn toàn chưa được viết code**. Cần nêu rõ điều này trong báo cáo và xếp vào phần "định hướng phát triển tiếp theo".

Chỉ cần hoàn thành các việc trong Ưu tiên 1 và Ưu tiên 2 (ước tính 5-6 giờ), dự án sẽ đạt mức trình bày hội đồng một cách tự tin.
