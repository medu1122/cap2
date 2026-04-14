# F09 - Workflow Automation

## 1) Bai toan thuc te
SMB can "dat lich mot lan, he thong tu chay" cho cac campaign lap lai, thay vi thao tac tay moi tuan. Workflow automation giam phu thuoc vao nguoi van hanh.

## 2) Tai lieu lien quan
- [plan.md](./plan.md)
- [coding.md](./coding.md)
- [test.md](./test.md)

## 3) Core code locations
- Workflow APIs: `api/routers/workflow.py`
- Models: `api/models/workflow_job.py`, `api/models/workflow_schedule.py`
- Cron worker: `api/services/workflow_scheduler_service.py`
- UI page: `web/app/(app)/workflow/page.tsx`
- Navigation: `web/components/layout/Sidebar.tsx`

## 4) Actual status (2026-04)
| Hang muc | Status | Ghi chu |
|---|---|---|
| Presets + manual trigger | done | API va UI da co |
| Schedule CRUD + toggle | done | Tao/sua/xoa/bat tat lich |
| Job history | done | Theo doi queued/running/done/failed |
| Cron quet `next_run_at` | done | Worker tu dong tao workflow jobs |
| Observability chi tiet theo run | partial | Can bo sung log va metric monitoring |

## 5) Gap / risk hien tai
- Chua co bo log/metric du sau de truy vet issue tai production.
- Chua co kiem thu stress khi nhieu schedules cung den han.

## 6) Next steps de hoan thien
- Bo sung structured logs cho tung scheduler tick va tung job.
- Them metrics: due_count, success_rate, avg_delay, retry_count.
- Bo sung tests cho CRUD + scheduler interval + race conditions co ban.

## 7) Acceptance checklist
- [ ] Schedule bat/tat dung ngay tren giao dien va DB.
- [ ] Job tao dung thoi diem va co trace day du.
- [ ] Khi worker gap loi tam thoi, he thong van bao toan du lieu va de retry.
