# F10 - Notifications & Customer Lists: Plan (chuan hoa)

## 1) Bai toan thuc te

SMB can:
- quan ly danh sach khach de chay campaign nhanh,
- duoc nhac su kien quan trong ma khong can kiem tra tay.

## 2) Pham vi user-facing

- User upload CSV danh sach khach.
- User xem danh sach khach + loc theo segment:
  - VIP
  - potential
  - inactive
- User tao campaign tu customer list.
- User nhan in-app notification (giai doan mo rong tiep).

Ngoai pham vi dot nay:
- CRM enterprise (pipeline sales/ticket).
- bulk email sender day du.

## 3) API contracts

- `POST /workflow/customer-lists/upload`
- `GET /workflow/customer-lists`
- `GET /workflow/customer-lists/{id}/customers`
- (mo rong sau) `/notifications`, `/notification-settings`

## 4) Ke hoach coding

### Backend
- Them segment runtime (khong migration):
  - dua tren `extra_fields` (`total_spend`, `order_count`, `days_since_last_purchase`...).
- Tra ve `segment` trong API list customers.
- Tra ve summary segment trong API list customer lists.
- Nang cap validation import:
  - duplicate email
  - dong loi format
  - report so dong hop le/khong hop le.

### Frontend
- Them tabs/filter segment trong `/customer-lists`.
- Hien badge segment tren bang khach hang.
- Hien import summary ro rang.

### Test
- Segment classifier test theo sample rows.
- Upload file loi van tra du summary va message de hieu.
- Auto tao campaign tu list co trace payload.

## 5) Env lien quan

- `SMTP_*` (chi cho reminder/notification email bo tro).
- Khong dung `SMTP_*` lam bulk marketing ngay trong phase nay.

## 6) Clean code checklist

- [ ] Tach segment classifier thanh helper rieng.
- [ ] Khong de business logic segment tron trong endpoint.
- [ ] Chuan hoa response shape list/list-detail/summaries.
