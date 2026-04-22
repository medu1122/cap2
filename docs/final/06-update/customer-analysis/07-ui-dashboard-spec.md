# 07 - UI Dashboard Spec (It chu, de dung)

## Muc tieu UI

- User nhin 5-10 giay la biet tinh hinh.
- Giam text dai, tang visual hierarchy.
- Moi khoi thong tin deu co hanh dong tiep theo.

## Bo cuc de xuat khi bam "Phan tich"

1. **Overview cards** (hang 1)
   - Tong khach
   - Tong doanh thu
   - Retention rate
2. **Charts** (hang 2)
   - Donut: phan bo segment
   - Bar: doanh thu theo segment
3. **Actionable lists** (hang 3)
   - Top VIP
   - Khach nguy co roi bo
   - Action de xuat (max 3 item)

## Mau sac de nhan biet nhanh

- VIP: `#1D4ED8`
- Potential: `#0EA5E9`
- Churn risk: `#DC2626`
- New: `#16A34A`
- Neutral text: `#6B7280`
- Border nen: `#E5E7EB`

Nguyen tac:
- Mau do chi dung cho canh bao.
- Mau xanh dam danh cho gia tri cao.
- Tranh qua 5 mau chinh tren 1 man hinh.

## Component va text guideline

- Card title toi da 3-4 tu.
- Subtitle 1 dong, khong qua 70 ky tu.
- Co tooltip cho metric kho hieu.
- Dung badge thay cho doan mo ta dai.

## Trang thai man hinh

- Loading: skeleton cards + chart placeholder.
- Empty: thong diep ngan + CTA `Upload data`.
- Error: 1 thong bao + nut `Thu lai`.

## CTA uu tien

- Chinh: `Tao campaign`
- Phu: `Xem nhom`, `Xem chi tiet`, `Danh dau uu tien`

## Mapping ve code hien tai

- UI hien thi tai:
  - `web/app/(app)/customer-lists/page.tsx`
- Neu can dong bo voi Insight page:
  - `web/app/(app)/insights/page.tsx`

## Acceptance checklist

- [ ] Khong co block text dai hon 2 dong trong man dashboard.
- [ ] Mau segment dung nhat quan tren card, chart, badge.
- [ ] Moi khoi co it nhat 1 CTA thao tac tiep.
