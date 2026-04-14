# Sprint 1 — Foundation

**Tuần 1–3 | Goal: Auth + Brand Vault + Infrastructure**

---

## Sprint Goal

> "Người dùng có thể đăng ký tài khoản, đăng nhập, cấu hình Brand Vault và hệ thống infrastructure chạy ổn định."

**Done when:**
- User đăng ký → nhận email verification → verify → đăng nhập thành công
- JWT refresh token hoạt động (không bị đăng xuất sau 15 phút)
- Forgot password flow hoạt động end-to-end
- Brand Vault: tạo mới, chỉnh sửa, xem lại sau reload vẫn còn data
- `docker compose up` → tất cả 4 services up, Alembic migration thành công
- Swagger UI (`/docs`) hiển thị tất cả auth + brand endpoints

---

## Sprint Backlog

| Story ID | User Story | Points | Assignee | Status |
|---|---|---|---|---|
| **INFRA-01** | Setup monorepo Docker Compose (web, api, agent, db) | 3 | Dev | To Do |
| **INFRA-02** | Alembic migration: 23 bảng từ database-init.sql | 3 | Dev | To Do |
| **INFRA-03** | Setup Next.js 14 + Tailwind + shadcn/ui | 2 | Dev | To Do |
| **INFRA-04** | FastAPI skeleton + CORS + health endpoint | 2 | Dev | To Do |
| US-01 | Register với email + password | 3 | Dev | To Do |
| US-02 | Email verification flow | 2 | Dev | To Do |
| US-03 | Login + JWT issuance | 3 | Dev | To Do |
| US-04 | Refresh token mechanism | 5 | Dev | To Do |
| US-05 | Forgot password / reset password | 3 | Dev | To Do |
| US-06 | View + update user profile | 2 | Dev | To Do |
| US-07 | Change password (in-app) | 2 | Dev | To Do |
| US-08 | Logout all devices | 1 | Dev | To Do |
| US-09 | Tạo Brand Vault lần đầu | 5 | Dev | To Do |
| US-10 | Cập nhật Brand Vault | 2 | Dev | To Do |
| US-11 | Forbidden words validation | 3 | Dev | To Do |
| US-12 | Upload logo | 2 | Dev | To Do |
| US-13 | Warning Brand Vault chưa đầy đủ | 1 | Dev | To Do |
| **Total** | | **44** | | |

---

## Timeline Chi tiết

### Tuần 1 — Infrastructure & Auth Backend

| Ngày | Task | Output |
|---|---|---|
| Ngày 1–2 | Setup Docker Compose, .env, Alembic migration | `docker compose up` thành công, 23 bảng tạo xong |
| Ngày 3 | FastAPI skeleton: main.py, routers, core/config.py, core/security.py | Swagger UI accessible tại /docs |
| Ngày 4 | POST /auth/register + email verification | User tạo được, email_verifications record |
| Ngày 5 | POST /auth/login + JWT + refresh token | Access + refresh token trả về |

### Tuần 2 — Auth Frontend + Forgot Password + Profile

| Ngày | Task | Output |
|---|---|---|
| Ngày 6–7 | Next.js: App shell (Sidebar + Layout), AuthContext, ApiClient | Layout render, auth state quản lý |
| Ngày 8 | Login page, Register page, form validation | Form submit → API call → redirect |
| Ngày 9 | Refresh token auto-retry trong ApiClient | Token expire → auto-refresh → retry |
| Ngày 10 | Forgot password: request + reset form | Email gửi, reset hoạt động |
| Ngày 11 | Profile page: view + edit | PUT /auth/me hoạt động |

### Tuần 3 — Brand Vault

| Ngày | Task | Output |
|---|---|---|
| Ngày 12–13 | Brand Vault API: GET/PUT /brands/me + upload endpoint | API test qua Swagger |
| Ngày 14 | Brand Vault page: form 2-column | Form render với tất cả fields |
| Ngày 15 | Logo upload + array fields (key_products, forbidden_words) | Upload + tag input hoạt động |
| Ngày 16 | Integration test + bug fixes | Sprint 1 pass all acceptance criteria |
| Ngày 17–21 | Buffer + Sprint Review + Retrospective | Docs cập nhật |

---

## Definition of Done (Sprint 1)

- [ ] Code được review (self-review với checklist)
- [ ] API endpoint có response schema đúng (test qua Swagger)
- [ ] Form validation hiển thị error message rõ ràng
- [ ] Không có console errors nghiêm trọng trên browser
- [ ] Database records được tạo/cập nhật đúng (verify qua psql)
- [ ] Environment variables qua .env, không hardcode secrets

---

## Daily Scrum Template

```
Ngày: ___________

Hôm qua tôi đã làm:
- [ ] ...

Hôm nay tôi sẽ làm:
- [ ] ...

Blockers:
- ...
```

---

## Rủi ro Sprint 1

| Rủi ro | Xác suất | Giải pháp |
|---|---|---|
| Docker port conflict (PostgreSQL 5432) | Cao | Map port 5433:5432 trong docker-compose |
| bcrypt version conflict với passlib | Trung bình | Pin bcrypt==4.2.1 trong requirements.txt |
| Email SMTP không cấu hình | Thấp | Log token ra console trong development mode |
| Alembic migration fail | Thấp | Test migration trên DB clean trước |

---

## Sprint Review Checklist

- [ ] Demo đăng ký → verify email → đăng nhập trên browser
- [ ] Demo refresh token: đợi token expire (hoặc shorten expiry) → auto-refresh
- [ ] Demo forgot password: request → nhận email → reset
- [ ] Demo Brand Vault: tạo mới → reload → data vẫn còn
- [ ] Show database: psql query confirm data đúng
- [ ] Show Swagger UI: tất cả endpoints có docs

---

## Sprint Retrospective Template

### What Went Well
- ...

### What Could Be Improved
- ...

### Action Items for Sprint 2
- ...

---

## Velocity Actual

| Metric | Planned | Actual |
|---|---|---|
| Story Points | 44 | ___ |
| Stories Completed | 17 | ___ |
| Stories Carried Over | 0 | ___ |
