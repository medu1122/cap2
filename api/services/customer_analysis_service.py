from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
import math
from typing import Any


def _to_float(value: object) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    # Handle Vietnamese number format: "2.400.000 ₫", "4.000.000đ", "2,400,000" etc.
    text = str(value).strip()
    # Strip currency symbols and spaces
    for sym in ("₫", "đ", "Đ", "VND", "USD", "$", "€", "£"):
        text = text.replace(sym, "")
    text = text.strip()
    # Normalize thousands separators: 2.400.000 → 2400000
    # Vietnamese uses dot as thousands separator, comma for decimal
    # Check if text contains dot separators (thousands) vs comma separator (decimal)
    dot_count = text.count(".")
    comma_count = text.count(",")
    if dot_count > 0:
        # If dots are used as thousands separators, remove them
        # and convert comma decimal (if any) to dot
        text = text.replace(".", "")
        if comma_count == 1 and "," in text:
            text = text.replace(",", ".")
    elif comma_count == 1:
        # Only comma present - could be decimal separator
        parts = text.split(",")
        if len(parts) == 2 and len(parts[1]) <= 2:
            # Likely decimal: "1234,56"
            text = text.replace(",", ".")
    if not text:
        return 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


def _to_int(value: object) -> int:
    return int(_to_float(value))


def _to_date(value: object) -> datetime | None:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    formats = [
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d/%m/%y",
        "%d-%m-%Y",
        "%d-%m-%y",
        "%d.%m.%Y",
        "%d.%m.%y",
        "%m/%d/%y",
        "%m/%d/%Y",
        "%Y/%m/%d",
        # Handle DD/M/YY or D/M/YY (Vietnamese format from spreadsheets)
        "%d/%m/%y",
        "%d.%m.%y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    # Try flexible parse for D/M/YY variants
    import re
    m = re.match(r"^(\d{1,2})[/\.](\d{1,2})[/\.](\d{2,4})$", raw)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if y < 100:
            y += 2000
        try:
            return datetime(y, mo, d, tzinfo=timezone.utc)
        except ValueError:
            pass
    return None


def _segment_label(spend: float, repeat_count: int, days_since_last: int | None) -> str:
    if days_since_last is not None and days_since_last >= 60:
        return "churn_risk"
    if spend >= 30 and repeat_count >= 3:
        return "vip"
    if repeat_count >= 2 and spend < 30:
        return "potential"
    return "new"


def _inactive_bucket_key(days_since_last: int | None) -> str:
    """Bucket theo ngày kể từ lần chi trả cuối (phục vụ histogram churn)."""
    if days_since_last is None:
        return "unknown"
    if days_since_last < 7:
        return "0_7"
    if days_since_last < 30:
        return "7_30"
    if days_since_last < 60:
        return "30_60"
    return "over_60"


_INACTIVE_BUCKET_ORDER: tuple[tuple[str, str], ...] = (
    ("0_7", "0–7 ngày"),
    ("7_30", "7–30 ngày"),
    ("30_60", "30–60 ngày"),
    ("over_60", "Trên 60 ngày"),
    ("unknown", "Chưa có ngày chi trả"),
)


def _customer_type_canon(raw: str) -> tuple[str, str]:
    """Gom nhóm theo chữ thường; nhãn hiển thị giữ dạng gốc lần đầu gặp."""
    t = (raw or "").strip()
    if not t:
        return ("__empty__", "Chưa ghi loại")
    return (t.casefold(), t)


def analyze_customer_rows(rows: list[dict[str, Any]]) -> dict[str, Any]:
    normalized: list[dict[str, Any]] = []
    now = datetime.now(timezone.utc)
    invalid_rows: list[dict[str, Any]] = []

    for idx, row in enumerate(rows):
        name = str(row.get("HoVaTen", "")).strip() or f"Khach {idx + 1}"
        spend = max(0.0, _to_float(row.get("TongSoTienDaChiTra")))
        repeat_count = max(0, _to_int(row.get("TongSoLanQuayLai")))
        last_paid_at = _to_date(row.get("LanCuoiChiTra"))
        days_since_last = (now - last_paid_at).days if last_paid_at else None
        phone = str(row.get("SDT", "")).strip()
        email = str(row.get("Email", "")).strip()
        loai_raw = str(row.get("LoaiKhachHang", "")).strip()

        if not str(row.get("HoVaTen", "")).strip():
            invalid_rows.append({"row_index": idx, "reason": "Thiếu họ tên"})
        if not email:
            invalid_rows.append({"row_index": idx, "reason": "Thiếu email"})

        segment = _segment_label(spend, repeat_count, days_since_last)
        normalized.append(
            {
                "name": name,
                "spend": spend,
                "repeat_count": repeat_count,
                "days_since_last": days_since_last,
                "segment": segment,
                "phone": phone,
                "email": email,
                "customer_type_raw": loai_raw,
            }
        )

    total_customers = len(normalized)
    total_revenue = round(sum(item["spend"] for item in normalized), 2)

    sorted_by_spend = sorted(normalized, key=lambda x: x["spend"], reverse=True)
    top_n = max(1, math.ceil(total_customers * 0.2)) if total_customers > 0 else 0
    top_group = sorted_by_spend[:top_n]
    top_group_revenue = sum(item["spend"] for item in top_group)
    revenue_share = round((top_group_revenue / total_revenue) * 100, 2) if total_revenue > 0 else 0.0

    returning_customers = sum(1 for item in normalized if item["repeat_count"] >= 1)
    repeat_customer_rate = round((returning_customers / total_customers) * 100, 2) if total_customers > 0 else 0.0
    customers_active_in_last_30d = sum(
        1
        for item in normalized
        if item["days_since_last"] is not None and item["days_since_last"] < 30
    )
    recent_activity_30d_percent = (
        round((customers_active_in_last_30d / total_customers) * 100, 2) if total_customers > 0 else 0.0
    )
    top_returning = sorted(normalized, key=lambda x: x["repeat_count"], reverse=True)[:5]

    over_30 = [item for item in normalized if item["days_since_last"] is not None and item["days_since_last"] >= 30]
    over_60 = [item for item in normalized if item["days_since_last"] is not None and item["days_since_last"] >= 60]

    segment_counts = Counter(item["segment"] for item in normalized)
    segment_summary = {
        "vip": segment_counts.get("vip", 0),
        "potential": segment_counts.get("potential", 0),
        "churn_risk": segment_counts.get("churn_risk", 0),
        "new": segment_counts.get("new", 0),
    }

    inactive_bucket_counts = Counter(_inactive_bucket_key(item["days_since_last"]) for item in normalized)
    inactive_day_buckets = [
        {"key": key, "label": label, "count": inactive_bucket_counts.get(key, 0)}
        for key, label in _INACTIVE_BUCKET_ORDER
    ]

    # Doanh thu theo cột Loại khách hàng (dữ liệu gốc), không theo nhóm AI.
    ctype_acc: dict[str, dict[str, Any]] = {}
    for item in normalized:
        ck, clabel = _customer_type_canon(item["customer_type_raw"])
        if ck not in ctype_acc:
            ctype_acc[ck] = {"label": clabel, "count": 0, "revenue": 0.0}
        ctype_acc[ck]["count"] += 1
        ctype_acc[ck]["revenue"] += item["spend"]
    revenue_by_customer_type = sorted(
        (
            {
                "label": str(v["label"]),
                "count": int(v["count"]),
                "revenue": round(float(v["revenue"]), 2),
            }
            for v in ctype_acc.values()
        ),
        key=lambda x: x["revenue"],
        reverse=True,
    )

    def _arpu(seg: str) -> float:
        items = [i for i in normalized if i["segment"] == seg]
        if not items:
            return 0.0
        return round(sum(i["spend"] for i in items) / len(items), 2)

    arpu_by_segment = {
        "vip": _arpu("vip"),
        "potential": _arpu("potential"),
        "churn_risk": _arpu("churn_risk"),
        "new": _arpu("new"),
    }

    suggested_actions: list[dict[str, Any]] = []
    if segment_summary["churn_risk"] > 0:
        suggested_actions.append(
            {
                "title": "Kích hoạt lại nhóm có khả năng rời bỏ cao",
                "priority": "high",
                "target_segment": "churn_risk",
                "goal": "Tăng khách quay lại trong 7 ngày",
                "reason": "Nhóm này đã lâu chưa phát sinh giao dịch, cần tái kích hoạt sớm.",
                "expected_impact": "Tăng retention",
                "recommended_channels": ["email"],
            }
        )
    if segment_summary["vip"] > 0:
        suggested_actions.append(
            {
                "title": "Chăm sóc và upsell nhóm VIP",
                "priority": "medium",
                "target_segment": "vip",
                "goal": "Tăng doanh thu trên mỗi khách VIP",
                "reason": "Khách VIP có khả năng chi trả cao, phù hợp upsell/chăm sóc riêng.",
                "expected_impact": "Tăng doanh thu",
                "recommended_channels": ["email", "facebook_post"],
            }
        )
    if segment_summary["new"] > 0:
        suggested_actions.append(
            {
                "title": "Onboarding nhóm khách mới",
                "priority": "medium",
                "target_segment": "new",
                "goal": "Tăng chuyển đổi mua lần 2",
                "reason": "Khách mới cần chuỗi onboarding để tạo thói quen quay lại.",
                "expected_impact": "Tăng repeat order",
                "recommended_channels": ["email"],
            }
        )

    return {
        "overview": {
            "total_customers": total_customers,
            "total_revenue": total_revenue,
            "recent_activity_30d_percent": recent_activity_30d_percent,
            "customers_active_in_last_30d": customers_active_in_last_30d,
        },
        "customer_value": {
            "total_revenue": total_revenue,
            "top_20_percent_count": top_n,
            "revenue_share_of_top_group": revenue_share,
            "top_spenders": [
                {
                    "customer_name": item["name"],
                    "amount": item["spend"],
                    "email": item["email"],
                    "phone": item["phone"],
                }
                for item in top_group[:10]
            ],
        },
        "retention": {
            "total_customers": total_customers,
            "returning_customers": returning_customers,
            "new_customers": max(total_customers - returning_customers, 0),
            "recent_activity_30d_percent": recent_activity_30d_percent,
            "customers_active_in_last_30d": customers_active_in_last_30d,
            "repeat_customer_rate_percent": repeat_customer_rate,
            "top_returning_customers": [
                {"customer_name": item["name"], "return_count": item["repeat_count"]}
                for item in top_returning
            ],
        },
        "churn_risk": {
            "inactive_over_30_days": len(over_30),
            "inactive_over_60_days": len(over_60),
            "inactive_day_buckets": inactive_day_buckets,
            "high_risk_customers": [
                {
                    "customer_name": item["name"],
                    "days_since_last_payment": item["days_since_last"],
                    "email": item["email"],
                    "phone": item["phone"],
                }
                for item in over_60[:10]
            ],
            "medium_risk_customers": [
                {
                    "customer_name": item["name"],
                    "days_since_last_payment": item["days_since_last"],
                    "email": item["email"],
                    "phone": item["phone"],
                }
                for item in over_30[:10]
            ],
        },
        "segmentation": {
            "summary": segment_summary,
            "revenue_by_customer_type": revenue_by_customer_type,
            "arpu_by_segment": arpu_by_segment,
            "customers": [
                {"customer_name": item["name"], "segment": item["segment"]}
                for item in normalized
            ],
        },
        "suggested_actions": suggested_actions[:3],
        "data_quality": {
            "invalid_row_count": len(invalid_rows),
            "invalid_rows": invalid_rows[:20],
        },
        "ai_meta": {
            "model_used": "rule-engine",
            "fallback_used": False,
            "fallback_reason": None,
        },
    }
