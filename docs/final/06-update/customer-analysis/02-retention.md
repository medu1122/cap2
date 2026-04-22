# 02 - Retention Analysis

## Muc tieu

Danh gia hanh vi quay lai de xac dinh chat luong tap customer va muc do "giu chan".

## Input can co

- `HoVaTen`
- `TongSoLanQuayLai`
- `LanCuoiChiTra` (ho tro context active)

## KPI can tra

1. `total_customers`
2. `returning_customers` (quay lai >= 1 lan)
3. `new_customers` (quay lai = 0 hoac rong)
4. `retention_rate_percent`
5. `top_returning_customers`

## Cong thuc tinh

- `returning_customers = count(TongSoLanQuayLai >= 1)`
- `new_customers = total_customers - returning_customers`
- `retention_rate_percent = returning_customers / total_customers * 100`

## Xu ly du lieu

- `TongSoLanQuayLai` parse int; loi -> 0.
- Gia tri am -> clamp 0.
- `total_customers = 0` => retention = 0.

## Output contract (JSON)

```json
{
  "retention": {
    "total_customers": 50,
    "returning_customers": 30,
    "new_customers": 20,
    "retention_rate_percent": 60.0,
    "top_returning_customers": [
      { "customer_name": "A", "return_count": 12 },
      { "customer_name": "B", "return_count": 10 }
    ]
  }
}
```

## UI goi y

- Overview card: `Retention rate`.
- Chip doi xung: `Quay lai` vs `Moi`.
- Danh sach top quay lai: hien ten + so lan.

## Acceptance checklist

- [ ] Ty le retention dung voi du lieu test.
- [ ] Tach dung khach moi/khach quay lai.
- [ ] Top quay lai sap xep dung thu tu giam dan.
