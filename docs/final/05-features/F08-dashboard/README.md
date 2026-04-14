# F08 — Dashboard

## Muc dich
Tinh nang nay tong hop so lieu dot quang ba va noi dung, giup nguoi dung theo doi tinh hinh van hanh nhanh.

## Tai lieu trong thu muc
- [plan.md](./plan.md)
- [coding.md](./coding.md)
- [test.md](./test.md)

## Vi tri ma nguon chinh
- `api/routers/dashboard.py`
- `api/services/dashboard_service.py`
- `web/app/(app)/dashboard/page.tsx`
- `web/app/(app)/dashboard/channel-insights/page.tsx`

## Trang thai thuc te (kiem tra 2026-04-14)
| Hang muc | Trang thai | Ghi chu |
|---|---|---|
| KPI tong quan | Da | Tong dot quang ba, cho duyet, da duyet... |
| Tong hop noi dung theo kenh | Da | Co man hinh chi tiet channel insights |
| Quan sat nhanh Brand Vault tren dashboard | Da | Co bang brand va nut tao brand moi |
| AI summary ngay tren dashboard chinh | Chua | Da bo khoi nay khoi UI chinh |
| Danh sach ket qua phan tich duoc luu va xem lai | Da (di chuyen sang Insights) | Theo flow moi, run history nam trong `/insights` |

## Viec tiep theo
- Neu can cho bao cao, dua AI summary thanh trang rieng hoac widget tu chon.
- Them bieu do truc quan hon cho xu huong theo thoi gian.
- Bo sung cache ngan cho endpoint thong ke de giam tai.
- Tach ro vai tro: dashboard cho tong quan marketing, insights cho phan tich bao cao da nap.
