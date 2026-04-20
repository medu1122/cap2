# F10 - Notifications & Customer Lists: Coding guide (chuan hoa)

## Backend

### Core files
- `api/routers/workflow.py` (customer list APIs)
- `api/models/customer_list.py`
- `api/models/customer.py`
- `api/models/file_upload.py`
- (mo rong sau) `api/routers/notifications.py`

### Implementation notes (phase hien tai)
- Add segment runtime helper:
  - input: `email`, `full_name`, `phone`, `extra_fields`
  - output: `vip|potential|inactive|unknown`
- Extend response:
  - `GET /workflow/customer-lists`: them `segment_summary`.
  - `GET /workflow/customer-lists/{id}/customers`: them `segment`.
- Keep backward compatibility:
  - neu khong co field trong CSV -> segment = `unknown`.

### Validation notes
- Validate email basic format.
- Count duplicate emails trong 1 file.
- Return summary nhat quan: `total_records`, `valid_records`, `invalid_records`.

## Frontend

### Core files
- `web/app/(app)/customer-lists/page.tsx`

### Implementation notes
- Them filter theo segment.
- Hien badge segment.
- Hien summary count theo segment o dau trang.

## Test checklist

- [ ] Segment function pass bo test mau.
- [ ] API list customers co field `segment`.
- [ ] API list customer lists co `segment_summary`.
- [ ] CSV khong du cot van khong crash.

## Env checklist

- Notification email bo tro:
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_USER`
  - `SMTP_PASSWORD`
  - `SMTP_FROM_EMAIL`
