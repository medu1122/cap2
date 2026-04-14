# F01 — Authentication & User Profile: Plan

**Feature ID**: F01 | **Epic**: Authentication & User Management | **Sprint**: Sprint 1

---

## Mô tả

Hệ thống xác thực toàn diện bao gồm đăng ký, đăng nhập, quản lý phiên (session), đặt lại mật khẩu, xác minh email, và quản lý hồ sơ người dùng. Đây là nền tảng bảo mật cho toàn bộ platform.

---

## User Stories

| ID | Story | Acceptance Criteria | Points | Priority |
|---|---|---|---|---|
| US-01 | As a user, I want to register with email + password | Email unique, password hashed, verification email sent | 3 | M |
| US-02 | As a user, I want to verify my email | Token valid 24h, sets email_verified=TRUE | 2 | M |
| US-03 | As a user, I want to login | Returns access_token (15min) + refresh_token (30d) | 3 | M |
| US-04 | As a user, I want to stay logged in | Auto-refresh token trước khi expire | 5 | M |
| US-05 | As a user, I want to reset forgotten password | Token 1h, invalidates old sessions | 3 | M |
| US-06 | As a user, I want to view and update my profile | PUT /auth/me cập nhật được full_name, phone, city, business_type | 2 | M |
| US-07 | As a user, I want to change my password | Verify old pw, hash new pw | 2 | S |
| US-08 | As a user, I want to logout from all devices | DELETE all sessions cho user_id | 1 | S |

---

## Data Model

### Bảng liên quan

**`users`** — Primary table
```
id UUID PK | email VARCHAR UNIQUE | hashed_pw VARCHAR
full_name VARCHAR | phone VARCHAR | avatar_url VARCHAR
business_type VARCHAR | city VARCHAR | website VARCHAR
role VARCHAR DEFAULT 'user' | is_active BOOLEAN DEFAULT TRUE
email_verified BOOLEAN DEFAULT FALSE
created_at TIMESTAMPTZ | updated_at TIMESTAMPTZ
```

**`user_sessions`** — Refresh token store
```
id UUID PK | user_id UUID FK → users
refresh_token VARCHAR UNIQUE | device_info VARCHAR
ip_address VARCHAR | expires_at TIMESTAMPTZ | created_at TIMESTAMPTZ
```

**`password_reset_tokens`** — One-time reset tokens
```
id UUID PK | user_id UUID FK → users
token VARCHAR UNIQUE | used BOOLEAN DEFAULT FALSE
expires_at TIMESTAMPTZ | created_at TIMESTAMPTZ
```

**`email_verifications`** — Email verification tokens
```
id UUID PK | user_id UUID FK → users
token VARCHAR UNIQUE | verified BOOLEAN DEFAULT FALSE
expires_at TIMESTAMPTZ | created_at TIMESTAMPTZ
```

---

## API Endpoints

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/auth/register` | Đăng ký tài khoản mới | No |
| POST | `/auth/verify-email` | Xác minh email với token | No |
| POST | `/auth/login` | Đăng nhập, nhận JWT | No |
| POST | `/auth/refresh` | Làm mới access token | No (refresh token) |
| POST | `/auth/logout` | Đăng xuất (xóa session) | Yes |
| POST | `/auth/logout-all` | Đăng xuất tất cả thiết bị | Yes |
| POST | `/auth/forgot-password` | Yêu cầu reset password | No |
| POST | `/auth/reset-password` | Đặt lại mật khẩu mới | No (reset token) |
| GET | `/auth/me` | Lấy thông tin user hiện tại | Yes |
| PUT | `/auth/me` | Cập nhật profile | Yes |
| PUT | `/auth/me/password` | Đổi mật khẩu | Yes |

---

## UI Screens

1. **`/login`** — Form 2 fields (email + password) + "Quên mật khẩu?" link + link sang Register
2. **`/register`** — Form 4 fields (email, password, confirm password, full_name) + điều khoản
3. **`/verify-email`** — Page nhận token từ URL query, tự động verify, redirect login
4. **`/forgot-password`** — Form 1 field (email), hiển thị success message
5. **`/reset-password`** — Form 2 fields (new_password, confirm), nhận token từ URL
6. **`/(app)/profile`** — Form chỉnh sửa profile (full_name, phone, city, business_type, website, avatar)

---

## Dependencies

- Không có dependencies vào feature khác
- Cần: bcrypt, python-jose (JWT), email service (SMTP hoặc log to console)
- Phải xong trước: F02, F03, F04, F05, F06, F07, F08

---

## Security Considerations

- Password hashed bằng bcrypt, cost factor 12
- Access token expire 15 phút (ngắn để giảm rủi ro nếu bị lộ)
- Refresh token 30 ngày, lưu DB, có thể revoke
- Password reset token 1 lần dùng (`used=TRUE` sau khi dùng)
- Email enumeration protection: forgot-password luôn trả 200 dù email không tồn tại
- Đổi mật khẩu → invalidate tất cả sessions hiện tại
