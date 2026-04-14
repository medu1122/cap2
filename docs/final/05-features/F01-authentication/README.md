# F01 — Authentication & Profile

## Muc dich
Tinh nang nay quan ly dang ky, dang nhap, cap token va xac thuc nguoi dung cho toan bo he thong.

## Tai lieu trong thu muc
- [plan.md](./plan.md)
- [coding.md](./coding.md)
- [test.md](./test.md)

## Vi tri ma nguon chinh
- `api/routers/auth.py`
- `api/core/security.py`
- `api/core/deps.py`
- `web/app/(auth)/login/page.tsx`
- `web/app/(auth)/register/page.tsx`

## Trang thai thuc te (kiem tra 2026-04-14)
| Hang muc | Trang thai | Ghi chu |
|---|---|---|
| Dang ky, dang nhap, refresh token | Da | Luong co ban hoat dong on dinh |
| Ma hoa mat khau | Da | Dung bcrypt qua passlib |
| Bao ve route bang bearer token | Da | Co dependency lay current user |
| Xac minh email moi truong demo | Mot phan | Co flow, gui email that tuy thuoc SMTP |

## Viec tiep theo
- Chuyen cach luu access token sang cookie httpOnly neu muon tang bao mat.
- Them rate limit cho endpoint dang nhap de tranh brute-force.
- Bo sung test E2E cho refresh token va logout tat ca thiet bi.
