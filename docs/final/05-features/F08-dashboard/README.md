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

---

## Dinh huong san pham moi (`toanbotinhnang-updatemoi.md`)

| Muc §1 “Dashboard phan tich” | Giai phap | Giu / Bo |
|---|---|---|
| KPI tong quan + huong nguoi dung den insight | F08 = **van hanh marketing**; phan tich file = **/insights** | **Giu** tach bach |

**Plan coding:** them 1-2 widget “Huong dan hanh dong” (link toi `/insights`, `/customer-lists`) thay vi nhan insight nang tren dashboard. Xoa code dead neu con endpoint/widget AI summary khong dung.

**Khong can:** nhan ban pipeline F11 tren dashboard.

## 9) Pham vi user-facing

- User vao dashboard de nam nhanh KPI van hanh marketing.
- User duoc dieu huong sang `/insights` va `/customer-lists` khi can hanh dong tiep.
- User khong phai xu ly phan tich file nang ngay tren dashboard.
- Ngoai pham vi dot nay: xay dashboard data science phuc tap.

## 10) Clean code checklist

- [ ] Xoa widget/endpoint AI summary cu khong con su dung.
- [ ] Tach ro API KPI tong quan va API channel insights.
- [ ] Toi uu query thong ke va bo sung cache ngan.
- [ ] Chuan hoa ten chi so hien thi giua FE va BE.

## 11) Cau hinh env lien quan

- Khong co env rieng cho F08.
- Neu co widget AI tom tat tro lai, phai tai su dung dung model router hien tai (khong hardcode model rieng).
