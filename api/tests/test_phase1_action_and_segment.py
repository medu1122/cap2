from routers.insights import _build_situations_and_actions
from routers.workflow import _segment_customer


def test_segment_customer_runtime_rules():
    assert _segment_customer({"days_since_last_purchase": 80}) == "churn"
    assert _segment_customer({"total_spend": 15_000_000}) == "vip"
    assert _segment_customer({"order_count": 12}) == "vip"
    assert _segment_customer({"days_since_last_purchase": 15}) == "potential"
    assert _segment_customer({}) == "unknown"


def test_build_situations_and_actions_low_kpis():
    kpi_availability = {
        "roas": {"computable": True},
        "conversion_rate": {"computable": True},
        "repeat_rate": {"computable": True},
    }
    situations, actions = _build_situations_and_actions(
        kpi_availability=kpi_availability,
        kpis={"roas": 1.2, "conversion_rate": 0.05, "repeat_rate": 0.1},
        issues=["ROAS đang thấp hơn ngưỡng an toàn 2.0"],
    )
    assert len(situations) >= 3
    assert any(a["target_segment"] == "churn" for a in actions)
    assert any(a["priority"] in {"high", "medium"} for a in actions)


def test_build_situations_and_actions_insufficient_data():
    kpi_availability = {
        "roas": {"computable": False},
        "conversion_rate": {"computable": False},
        "repeat_rate": {"computable": False},
    }
    situations, actions = _build_situations_and_actions(
        kpi_availability=kpi_availability,
        kpis={"roas": 0, "conversion_rate": 0, "repeat_rate": 0},
        issues=["Thiếu dữ liệu"],
    )
    assert situations[0]["id"] == "insufficient_kpi_signals"
    assert actions[0]["id"] == "improve_data_quality_first"

