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

---

## 8) Dinh huong san pham moi — *Tu dong sau khi co Action Plan* (`toanbotinhnang-updatemoi.md`)

| Vai tro | Ghi chu | Giu / Bo |
|---|---|---|
| Lap lai campaign / job nen | Da co cron + schedule | **Giu** |
| Gan voi “AI Action Engine” | Co the trigger job tu insight/segment (sau nay) | **Mo rong** |

**Plan coding:** preset schedule “inactive weekly” map voi segment F10; structured logs (muc 6 cu).

**Khong can:** thay the hoan toan bang tay action — workflow van huu ich cho SMB lap lai.

## 9) Pham vi user-facing

- User tao/sua/bat-tat lich workflow tren UI.
- User trigger job thu cong khi can.
- User xem lich su job de theo doi ket qua.
- Ngoai pham vi dot nay: workflow engine da tenant / visual builder phuc tap.

## 10) Clean code checklist

- [ ] Gom toan bo scheduler tick log theo 1 format structured.
- [ ] Tach logic CRUD lich va logic runner job de de test.
- [ ] Chuan hoa status job (`queued/running/done/failed/retrying`) giua BE/FE.
- [ ] Bo sung test race-condition co ban khi nhieu schedule cung den han.

## 11) Cau hinh env lien quan

- `WORKFLOW_SCHEDULER_ENABLED`
- `WORKFLOW_SCHEDULER_INTERVAL_MINUTES`
- Neu job co goi AI/model thi tai su dung env model chung, khong set rieng cho workflow.
