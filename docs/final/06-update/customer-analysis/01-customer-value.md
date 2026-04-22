# 01 - Customer Value

## Muc tieu

Do luong gia tri kinh doanh cua tap customer hien tai de biet nhom nao tao doanh thu chinh.

## Input can co

- `HoVaTen`
- `TongSoTienDaChiTra`
- `LoaiKhachHang` (neu co)

## KPI can tra

1. `total_revenue`: Tong doanh thu toan bo customer.
2. `top_20_percent_count`: So customer thuoc top 20% theo chi tieu chi tieu.
3. `top_spenders`: Danh sach customer chi nhieu nhat (mac dinh top 10).
4. `revenue_share_of_top_group`: Ty trong doanh thu den tu top group.

## Cong thuc tinh

- Sap xep giam dan theo `TongSoTienDaChiTra`.
- `top_n = ceil(total_customers * 0.2)`, toi thieu bang 1.
- `revenue_share_of_top_group = sum(top_n) / total_revenue * 100`.

## Xu ly du lieu loi/thieu

- Gia tri rong/null/chuoi khong parse duoc -> 0.
- Gia tri am -> clamp ve 0.
- Neu `total_revenue = 0` thi `revenue_share_of_top_group = 0`.

## Output contract (JSON)

```json
{
  "customer_value": {
    "total_revenue": 172.6,
    "currency": "relative_unit",
    "top_20_percent_count": 10,
    "revenue_share_of_top_group": 65.1,
    "top_spenders": [
      { "customer_name": "Nguyen Van A", "amount": 67.3, "customer_id": "optional-id" },
      { "customer_name": "Tran Thi B", "amount": 45.8, "customer_id": "optional-id" }
    ]
  }
}
```

## UI goi y

- Card lon: `Tong doanh thu`.
- Card nho: `% doanh thu tu top 20%`.
- Bang top spender: ten + muc chi + nut `Xem chi tiet`.

## Acceptance checklist

- [ ] Tong doanh thu tinh dung voi du lieu mau.
- [ ] Top 20% tinh dung khi so dong le.
- [ ] Khong vo pipeline khi cot tien bi thieu/loi dinh dang.
