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
| Kiểm tra deadline không được trong quá khứ | `api/routers/campaigns.py` | ✅ Đã có |
| Kiểm tra kênh nội dung hợp lệ | `api/routers/campaigns.py` | ✅ Đã có |
| Cảnh báo nếu chưa thiết lập hồ sơ thương hiệu | Giao diện | ❌ Chưa có |

**Rủi ro khi demo:**
Phần kiểm tra đầu vào chính đã có. Rủi ro còn lại là thông báo hướng dẫn trên giao diện chưa thật rõ khi lỗi xảy ra.

**Cần thêm vào để hoàn thiện:**
- Bổ sung validation song song ở `api/schemas/campaign.py` để thống nhất tầng kiểm tra.
- Cải thiện thông điệp lỗi và hiển thị lỗi ngay tại form tạo đợt quảng bá.

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
| Thử lại khi AI trả kết quả sai định dạng | `agent/agents/strategist.py`, `agent/agents/writer.py`, `agent/agents/critic.py` | ✅ Đã có retry parse cơ bản |
| Ghi lại số token đã dùng | `agent/agents/base.py` | ❌ Chưa ghi được trường `input_tokens`, `output_tokens` |
| Liên kết nội dung với bước AI đã tạo | `agent/orchestrator.py` | ❌ Không truyền mã bước khi lưu nội dung |

**Rủi ro khi demo:**
Đã có retry parse cơ bản trong từng agent. Rủi ro còn lại là lỗi mạng/model ở mức request vẫn có thể làm chiến dịch thất bại.

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
| Xem theo tuần | Giao diện | ✅ Đã có toggle tháng/tuần |
| Lọc theo kênh hoặc trạng thái | Giao diện | ✅ Đã có bộ lọc |
| Click vào ngày mở panel chi tiết | Giao diện | ⚠️ Cần kiểm tra thêm — có thể chỉ chuyển sang trang chiến dịch |

---

### ⚠️ Tính năng 10 — Lịch tự động hoá công việc (Workflow)

**Kết luận: Đã triển khai phần lớn — Có trigger thủ công và lịch chạy định kỳ**

| Bộ phận | Vị trí trong mã nguồn | Tình trạng |
|---|---|---|
| Các endpoint quản lý lịch | `api/routers/workflow.py` | ✅ Tạo/sửa/xóa/toggle schedule, xem lịch sử chạy |
| Cấu trúc dữ liệu | `api/models/workflow_job.py`, `api/models/workflow_schedule.py` | ✅ |
| Trang giao diện Workflow | `web/app/(app)/workflow/page.tsx` | ✅ Đã có |
| Đường dẫn trong thanh điều hướng | `web/components/layout/Sidebar.tsx` | ✅ Đã có |

**Rủi ro khi demo:** Luồng cron đã có, nhưng cần thêm logging/monitoring để theo dõi khi chạy tải cao.

---

### ⚠️ Tính năng 11 — Kích hoạt tự động theo lịch (Cron)

**Kết luận: Làm một phần — Đã có worker định kỳ, cần hardening**

| Bộ phận | Vị trí trong mã nguồn | Tình trạng |
|---|---|---|
| Dịch vụ chạy lịch định kỳ | `api/services/workflow_scheduler_service.py` | ✅ Có |
| Tự động tạo chiến dịch theo lịch | `api/services/workflow_scheduler_service.py` | ✅ Có |
| Tính toán lần chạy tiếp theo | `api/routers/workflow.py` + `api/services/workflow_scheduler_service.py` | ✅ Có |

**Thực tế:** Hệ thống đã tự quét `next_run_at` bằng APScheduler và tạo campaign tự động theo preset.

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

### ⚠️ Tính năng 12 — Upload danh sách khách hàng → Tự động tạo chiến dịch

**Kết luận: Làm một phần (MVP) — Đã có upload/parse/tạo campaign, chưa có validation nâng cao**

| Bộ phận | Vị trí trong mã nguồn | Tình trạng |
|---|---|---|
| Nhận và xử lý file CSV | `api/routers/workflow.py` | ✅ Có |
| Cấu trúc dữ liệu danh sách khách hàng | `api/models/customer_list.py`, `api/models/customer.py`, `api/models/file_upload.py` | ✅ Có |
| Lưu trữ file | `api/routers/workflow.py` | ✅ Có |
| Tự động tạo chiến dịch sau khi upload | `api/routers/workflow.py` | ✅ Có |
| Giao diện upload | `web/app/(app)/customer-lists/page.tsx` | ✅ Có |

**Thực tế:** Đã có luồng MVP phục vụ demo. Cần bổ sung validate định dạng CSV và báo cáo lỗi từng dòng.

---

## Bảng rủi ro khi demo

| Tính năng | Nếu không sửa thì sao | Mức độ ưu tiên |
|---|---|---|
| Thử lại khi AI trả kết quả lỗi (T5) | Chiến dịch bị thất bại ngay khi AI trả định dạng sai một lần | 🔴 Phải sửa |
| Tự động cập nhật chiến dịch khi tất cả đã duyệt (T8) | Chiến dịch mãi ở trạng thái "Chờ duyệt" dù đã duyệt hết | 🔴 Phải sửa |
| Workflow chạy định kỳ tự động (T10/T11) | Người dùng vẫn cần bấm chạy thủ công, chưa có cron workflow thực thụ | 🟡 Nên sửa |
| Kiểm tra ngày kết thúc (T4) | Đã có ở router; cần đồng bộ thêm ở schema/UI để chặt hơn | 🟢 Thấp |
| Ghi số token AI đã dùng (T6) | Thiếu số liệu khi thuyết trình với hội đồng | 🟡 Nên sửa |
| Kích hoạt theo lịch định kỳ (T11) | Đã có worker; rủi ro chính là monitoring và hardening khi tải cao | 🟡 Nên sửa |
| Upload danh sách khách hàng (T12) | Đã có MVP; rủi ro chính là validation nâng cao và báo lỗi theo từng dòng | 🟡 Nên sửa |
| Gửi email xác minh thật | Thông báo không đến tay người dùng | 🟢 Thấp — log ra terminal là đủ cho demo |

---

## Danh sách việc cần làm theo thứ tự ưu tiên

### Ưu tiên 1 — Sửa ngay (ảnh hưởng đến chất lượng demo)

1. Thêm retry ở mức request model (không chỉ parse JSON) cho các lỗi tạm thời — khoảng 45 phút
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

Hai tính năng "nên có" là kích hoạt tự động theo lịch và upload danh sách khách hàng **đã có code ở mức chạy được (MVP)**. Giai đoạn tiếp theo tập trung vào hardening, monitoring, và validation nâng cao.

Chỉ cần hoàn thành các việc trong Ưu tiên 1 và Ưu tiên 2 (ước tính 5-6 giờ), dự án sẽ đạt mức trình bày hội đồng một cách tự tin.

---

## Cập nhật tài liệu mở rộng AI (2026-04-14)

Da bo sung cum tai lieu cho huong phat trien "Insight Copilot" trong `docs/final/06-update/`:
- `insight-copilot-readme.md`
- `insight-copilot-plan.md`
- `insight-copilot-ai-quality.md`

Luu y: Day la tai lieu thiet ke va quality framework de mo rong he thong, khong phai khang dinh da co day du code production cho module moi.

## Cập nhật coding Insight Copilot (2026-04-14, MVP)

Da bo sung khung code ban dau cho Insight Copilot:
- Backend:
  - Models: `insight_data_sources`, `insight_raw_snapshots`, `insight_metrics_daily`, `insight_cards`, `insight_actions`, `insight_feedback`
  - Migration: `api/alembic/versions/0005_insight_copilot_tables.py`
  - API: `api/routers/insights.py` voi cac endpoint ingest/recompute/cards/actions/feedback
- Frontend:
  - `web/app/(app)/insights/page.tsx`
  - `web/app/(app)/insights/actions/page.tsx`
  - Sidebar da them menu `Insight Copilot`
  - Bo sung nut `Nạp dữ liệu từ CSV` + link `Tải file CSV mẫu` cho luong user thuc te

- Du lieu mau va huong dan:
  - `web/public/mau-du-lieu-tro-ly-phan-tich.csv`
  - `docs/final/06-update/insight-copilot-data-template-readme.md`

Trang thai hien tai: **MVP khung ky thuat da co**, can tiep tuc hardening (rule engine nang cao, Qwen reasoning layer day du, evaluation pipeline).

## Cap nhat DeepSeek A2A flow moi (2026-04-14 toi)

- `/insights` da doi sang huong "bao cao CSV -> deep analysis A2A".
- Backend bo sung run-trace tables cho audit model usage.
- Luong model:
  - DeepSeek Coder 6.7B cho classify/map/plan.
  - Qwen cho narrative.
  - GPT fallback khi khong dat quality gate.
- Cac docs thiet ke/van hanh da duoc bo sung trong `docs/final/06-update/*`.
