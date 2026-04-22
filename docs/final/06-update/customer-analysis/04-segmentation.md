# 04 - Customer Segmentation

## Muc tieu

Phan nhom customer tu dong de he thong goi y hanh dong dung doi tuong, dung uu tien.

## Input can co

- `TongSoTienDaChiTra`
- `TongSoLanQuayLai`
- `LanCuoiChiTra`
- `LoaiKhachHang` (chi de doi chieu, khong bat buoc dung lam su that)

## Rule segmentation runtime (de xuat)

- `VIP`:
  - Chi tieu >= nguong cao va quay lai >= nguong cao.
- `Potential`:
  - Quay lai cao, chi tieu chua dat nguong VIP.
- `ChurnRisk`:
  - `days_since_last_payment >= 30`.
- `New`:
  - So lan quay lai thap + tong chi tieu thap.

Neu 1 customer trung nhieu dieu kien, uu tien:
`ChurnRisk > VIP > Potential > New`.

## Tham so threshold de tune

- `spend_high_threshold`
- `return_high_threshold`
- `days_churn_medium_threshold` (mac dinh 30)
- `days_churn_high_threshold` (mac dinh 60)

## Output contract (JSON)

```json
{
  "segmentation": {
    "summary": {
      "vip": 5,
      "potential": 12,
      "churn_risk": 8,
      "new": 10
    },
    "distribution_percent": {
      "vip": 10.0,
      "potential": 24.0,
      "churn_risk": 16.0,
      "new": 20.0
    },
    "customers": [
      { "customer_name": "A", "segment": "vip", "confidence": 0.91 },
      { "customer_name": "B", "segment": "churn_risk", "confidence": 0.88 }
    ]
  }
}
```

## UI goi y

- Bieu do donut phan bo segment.
- Danh sach theo tab segment.
- Badge mau theo segment tren tung customer.

## Acceptance checklist

- [ ] Rule phan nhom deterministic, chay giong nhau cho cung input.
- [ ] Co the tune threshold khong can doi code business logic.
- [ ] Segment summary khop voi danh sach customer chi tiet.
