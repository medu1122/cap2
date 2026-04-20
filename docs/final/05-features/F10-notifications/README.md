# F10 - Notifications and Customer Lists

## 1) Bai toan thuc te
SMB can duoc nhac viec dung luc (campaign loi, sap den lich, can review) va tan dung danh sach khach co san de mo campaign nhanh. Tinh nang nay giai quyet phan "nhac viec + kich hoat tu du lieu khach".

## 2) Tai lieu lien quan
- [plan.md](./plan.md)
- [coding.md](./coding.md)
- [test.md](./test.md)

## 3) Core code locations
- Notification models: `api/models/notification.py`, `api/models/notification_setting.py`
- Customer list models: `api/models/file_upload.py`, `api/models/customer_list.py`, `api/models/customer.py`
- Customer list APIs: `api/routers/workflow.py`
- Customer list UI: `web/app/(app)/customer-lists/page.tsx`
- Sample CSV: `web/public/maucsv.csv`
- Insight sample files: `web/public/mau-du-lieu-tro-ly-phan-tich.csv`, `web/public/dulieumauPhantich.xlsx`

## 4) Actual status (2026-04)
| Hang muc | Status | Ghi chu |
|---|---|---|
| DB models notification | done | Data layer da co |
| API notification center | missing | Chua co router `/notifications` day du |
| UI notification center | missing | Chua co bell/list page su dung thuc te |
| Upload CSV customer list | done (MVP) | Co parse va luu du lieu |
| Auto tao campaign tu customer list | done (MVP) | Da co luong tao campaign email |
| Validation CSV nang cao | partial | Can report loi tung dong va rules chat che hon |
| Insight upload CSV/Excel preview table | done (MVP) | Nam o `/insights`, co bang xem lai du lieu da nap |

## 5) Gap / risk hien tai
- Notification layer chua thong voi workflow/approval events nen user bo lo su kien quan trong.
- CSV import hien la MVP, can tang do ben cho file loi dinh dang.

## 6) Next steps de hoan thien
- Xay `notifications` router + service + event emitter tu campaign/workflow/content.
- Them UI bell + inbox page loc theo muc do uu tien.
- Nang cap CSV validation: duplicate email, invalid encoding, row-level error export.

## 7) Acceptance checklist
- [ ] User nhan duoc thong bao trong app cho su kien quan trong.
- [ ] CSV import tra ve bao cao ro rang so dong thanh cong/that bai.
- [ ] Tu danh sach khach co the tao campaign tu dong co trace day du.

---

## 8) Dinh huong san pham moi — *Smart CRM Lite + Action + Email* (`toanbotinhnang-updatemoi.md`)

| Muc trong tai lieu moi | Trang thai vs F10 | Giu / Bo |
|---|---|---|
| §2 Quan ly / import khach, loc nhom | Co MVP: upload CSV, luu customer, UI lists | **Giu** |
| §2 Phan loai VIP / tiem nang / inactive | Chua thay rule ro trong code (segment) | **Can lam moi** |
| §3 Hanh dong tu du lieu (vi du: mail inactive) | Co “auto campaign tu list” (email) — gan voi action | **Giu + mo rong** |
| §4 Gui email SMTP marketing | SMTP trong repo hien phuc vu **calendar reminder**, chua phai bulk marketing tu app | **Can quyet dinh:** mo rong F10 hoac service rieng, tranh nham SMTP calendar vs campaign |

**Plan coding:**
1. Them field hoac bang `segment` / `tags` (hoac tinh runtime tu spend, last_purchase) — uu tien **tinh runtime** truoc, tranh migration neu backlog chat.
2. UI: filter tabs VIP / inactive / potential + badge.
3. Noi F11: tu insight run chon “danh sach khach tac dong” (join customer_list_id).
4. Clean code: gom route customer list + notification draft vao service layer; bot logic lap trong `workflow.py` neu co cho tao campaign trung lap.

**Khong can:** xay CRM day du (ticket, pipeline ban hang) — ngoai pham vi “Lite”.

---

## 9) Luu y env cho email execution va notifications

- Tach ro 2 luong:
  - `SMTP_*` hien uu tien cho calendar reminder / notification emails.
  - Email marketing bulk (neu mo rong) nen di qua service rieng de tranh nham voi reminder.
- Cau hinh toi thieu:
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_USER`
  - `SMTP_PASSWORD`
  - `SMTP_FROM_EMAIL`
- Policy de xuat:
  1. Notification in-app la kenh chinh.
  2. SMTP la kenh bo tro cho reminder va su kien quan trong.
  3. Bulk campaign email chi bat sau khi F06/F12 co audit + retry ro rang.
