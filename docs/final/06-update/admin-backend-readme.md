# README - Admin Backend va Database

## Pham vi Backend

## 1) Authentication va Authorization

- Giu co che JWT hien tai.
- Role hop le: `admin`, `user`.
- Cac endpoint quan tri dung guard rieng (`require_admin`).

## 2) Database can cap nhat

### Bang `users`
- Tiep tuc dung cot `role`, nhung quy uoc ro:
  - `admin`: van hanh he thong.
  - `user`: nguoi dung su dung AIMAP de tao va duyet noi dung.

### Bang moi de phuc vu admin
- `admin_action_logs`:
  - `id`, `admin_user_id`, `action_type`, `target_type`, `target_id`, `payload_json`, `created_at`.
- `system_settings`:
  - `key`, `value_json`, `updated_by`, `updated_at`.

## 3) API quan tri de xay dung

- `GET /admin/users` - danh sach user.
- `PATCH /admin/users/{id}/status` - khoa/mo user.
- `GET /admin/usage/ai` - thong ke token usage.
- `GET /admin/workflow/jobs` - xem toan bo workflow jobs.
- `POST /admin/workflow/jobs/{id}/retry` - retry job loi.

## 4) Logging va Audit

- Moi thao tac admin phai ghi vao `admin_action_logs`.
- Khong ghi plaintext thong tin nhay cam.
- Ho tro filter theo admin, action, khoang thoi gian.
