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

---

## 8) Dinh huong san pham moi — *Smart Campaign Planner* (`toanbotinhnang-updatemoi.md`)

| Muc trong tai lieu moi | Trang thai vs F07 | Giu / Bo |
|---|---|---|
| Lich noi dung da duyet, doi lich | Da co day du | **Giu** |
| Goi y lich theo hanh vi khach (inactive -> re-engagement, VIP -> cham soc) | Chua co engine rule gan voi CRM/insight | **Can lam moi** (input tu F03/F10) |

**Plan coding:**
1. Service `suggest_slots` (rule-based dau tien): inactive -> uu tien 3-7 ngay toi; VIP -> spacing deu.
2. API: `GET /calendar/suggestions?campaign_id=` hoac embed trong campaign detail.
3. UI: panel “De xuat lich” + apply bulk reschedule.
4. Clean code: tach logic query calendar vs reminder SMTP (khong tron business rule vao `calendar_reminder_service`).

**Khong can:** toi uu “gio cao diem” bang ML trong MVP — rule + config la du cho thuyet trinh.

## 9) Pham vi user-facing

- User xem lich theo thang/tuan va loc theo kenh/trang thai.
- User doi lich noi dung nhanh tren UI.
- User nhan de xuat lich rule-based khi tao campaign tu insight/segment.
- Ngoai pham vi dot nay: toi uu lich bang machine learning phuc tap.

## 10) Clean code checklist

- [ ] Tach service `calendar_query` va `calendar_suggestion` ro rang.
- [ ] Khong dat business rule campaign trong `calendar_reminder_service`.
- [ ] Chuan hoa date-time timezone handling giua API va UI.
- [ ] Bo sung integration tests cho month/week/filter + suggestion apply.

## 11) Cau hinh env lien quan

- Reminder:
  - `CALENDAR_REMINDER_ENABLED`
  - `CALENDAR_REMINDER_HOUR`
  - `SMTP_*` (neu gui nhac qua email)
