# F12 Test Plan - Admin Operations

## Authorization test
- User role `user` truy cap `/admin/*` -> bi chan.
- User role `admin` truy cap -> thanh cong.

## Functional test
- Admin lock user -> user khong login duoc.
- Admin unlock user -> user login lai duoc.
- Admin retry workflow job failed -> job moi duoc tao, trace duoc luu.

## Audit test
- Moi action admin tao 1 record trong `admin_action_logs`.
- Log co day du: admin_user_id, action_type, target_type, target_id, created_at.

## Regression test
- Feature user thong thuong khong bi anh huong khi them admin guard.
