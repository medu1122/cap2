# 03 - Churn Risk Analysis

## Muc tieu

Phat hien customer co nguy co roi bo dua tren thoi gian tu lan chi tra gan nhat.

## Input can co

- `HoVaTen`
- `LanCuoiChiTra`
- `SDT` / `Email` (de lien he)

## Rule phan muc rui ro

- `>= 60 ngay`: `high_risk`
- `>= 30 ngay va < 60 ngay`: `medium_risk`
- `< 30 ngay`: `active`
- Khong parse duoc ngay: `unknown`

## KPI can tra

1. `inactive_over_30_days`
2. `inactive_over_60_days`
3. `high_risk_customers` (top uu tien lien he)
4. `medium_risk_customers`

## Parse date

- Uu tien parse format:
  - `YYYY-MM-DD`
  - `MM/DD/YY` hoac `M/D/YY`
  - `DD/MM/YYYY` (neu map tu locale)
- Neu date invalid -> dua vao `unknown` va khong dua vao >30/>60.

## Output contract (JSON)

```json
{
  "churn_risk": {
    "inactive_over_30_days": 12,
    "inactive_over_60_days": 5,
    "high_risk_customers": [
      { "customer_name": "Tran Thi B", "days_since_last_payment": 62, "priority": "high" }
    ],
    "medium_risk_customers": [
      { "customer_name": "Nguyen Van A", "days_since_last_payment": 45, "priority": "medium" }
    ],
    "unknown_date_count": 2
  }
}
```

## UI goi y

- Card canh bao mau do: `Khach >60 ngay`.
- Card cam: `Khach >30 ngay`.
- Bang "Sap roi bo": ten, so ngay, CTA `Lien he ngay`.

## Acceptance checklist

- [ ] Dem dung >30 va >60 theo ngay hien tai.
- [ ] Parse duoc cac format date pho bien.
- [ ] Khach unknown date duoc thong ke rieng.
