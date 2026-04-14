# Checklist Nghiệm thu — AIMAP Phase Update

Dùng checklist này để xác nhận phase update đã hoàn thành đủ điều kiện demo.

---

## A. Progress UI (đã implement trong phase này)

- [ ] Trang `/campaigns/{id}` hiển thị panel "Tiến trình AI Pipeline" khi campaign đang `running` hoặc `pending_agent`
- [ ] Panel hiển thị đúng số bước theo số channel (1 + channels.length × 2)
- [ ] Bước đang chạy có spinner và label "đang xử lý..."
- [ ] Bước đã xong hiển thị checkmark xanh + tên model + thời gian xử lý
- [ ] Bước chưa tới hiển thị vòng tròn xám
- [ ] Progress bar hiển thị đúng % (doneCount / totalCount)
- [ ] Polling tự dừng khi campaign chuyển sang `pending_approval` hoặc `failed`
- [ ] Agent Activity Log chỉ hiển thị `success`/`failed` entries, không hiển thị `running` placeholder entries
- [ ] Panel hiển thị lỗi rõ ràng khi campaign `failed` kèm `error_message`

## B. Telemetry Agent (đã implement trong phase này)

- [ ] Mỗi agent step emit 1 log `status=running` trước khi gọi LLM
- [ ] Mỗi agent step emit 1 log `status=success` sau khi LLM trả về
- [ ] Log `running` có `model_used="pending"` (chưa biết model trước khi gọi)
- [ ] Log `success` có `model_used` đúng tên model thật đã dùng
- [ ] Nếu agent bị lỗi, không crash toàn bộ pipeline do log fail (try/except bọc đủ)

## C. Bug fixes cần làm thêm (Priority 1 theo audit)

- [ ] Campaign Brief: validate deadline không được trong quá khứ
- [ ] Campaign Brief: validate channels phải thuộc `VALID_CHANNELS`
- [ ] Approval: sau khi approve content, tự động check và update campaign status nếu all approved
- [ ] Agent parser: thêm retry/cleanup logic khi JSON parse fail lần đầu

## D. Chất lượng demo tổng thể

- [ ] `docker compose up --build` thành công, không có lỗi startup
- [ ] Tạo campaign mới → pipeline AI chạy end-to-end → nội dung xuất hiện
- [ ] Progress UI hiển thị đúng các bước khi campaign đang chạy
- [ ] Approve 1 content item → status chuyển thành `approved` ngay
- [ ] Calendar hiển thị đúng nội dung đã approve theo ngày
- [ ] Dashboard hiển thị đúng số liệu + AI summary
- [ ] Agent logs hiển thị timeline đầy đủ với model và thời gian

## E. Tài liệu

- [ ] `docs/final/06-update/feature-reality-audit.md` đã có và phản ánh đúng trạng thái code
- [ ] `docs/final/06-update/done-criteria.md` được update nếu scope thay đổi

---

## Ghi chú về Scope

Các tính năng **đã được đưa vào scope phase hiện tại**:
- Cron scheduler (APScheduler) cho workflow automation
- CSV upload + customer list (MVP)
- Calendar week view + filter theo channel/status

Các hạng mục vẫn để phase tiếp theo:
- Token usage logging chi tiết
- Approval history table

Những thứ trên có thể làm trong phase tiếp theo nếu còn thời gian trước báo cáo.
