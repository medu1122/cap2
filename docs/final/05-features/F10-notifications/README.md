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
