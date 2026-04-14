# F07 - Marketing Calendar

## 1) Bai toan thuc te
SMB can biet "hom nay dang gi, kenh nao, trang thai nao" de phoi hop van hanh nhanh. Calendar la man hinh dieu phoi deployment sau khi noi dung duoc duyet.

## 2) Tai lieu lien quan
- [plan.md](./plan.md)
- [coding.md](./coding.md)
- [test.md](./test.md)

## 3) Core code locations
- Calendar APIs: `api/routers/calendar.py`
- Reminder service: `api/services/calendar_reminder_service.py`
- Scheduler bootstrap: `api/main.py`
- Calendar UI: `web/app/(app)/calendar/page.tsx`

## 4) Actual status (2026-04)
| Hang muc | Status | Ghi chu |
|---|---|---|
| Month view | done | API + UI on dinh |
| Week view | done | Da co toggle thang/tuan |
| Filter channel/status | done | Da co tren UI va API |
| Reschedule content | done | PATCH calendar item hoat dong |
| Detail panel trong ngay | done | Co view nhanh noi dung |
| Integration test cho bo loc | partial | Chua phu het case month/week/status |

## 5) Gap / risk hien tai
- Chua du test tich hop cho bo loc de bao dam khong hoi quy.
- Neu campaign co nhieu versions, can hien thi "latest approved" that ro.

## 6) Next steps de hoan thien
- Bo sung integration tests cho query month + week + filters.
- Hien thi nhan "latest" trong detail list khi co nhieu versions.
- Them thao tac reset filter 1-click tren UI.

## 7) Acceptance checklist
- [ ] User loc duoc lich theo kenh va status dung nhu mong doi.
- [ ] Week/month view khong mat du lieu va khong duplicate.
- [ ] Reschedule cap nhat dung DB va UI phan hoi ngay.
