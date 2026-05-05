from routers.insights import _build_metrics


def test_build_metrics_computes_core_ratios():
    payload = {
        "revenue": 1000,
        "orders": 20,
        "ad_spend": 250,
        "leads": 100,
        "repeat_orders": 5,
    }
    result = _build_metrics(payload)
    assert result["revenue"] == 1000
    assert result["orders"] == 20
    assert result["ad_spend"] == 250
    assert result["computed_json"]["aov"] == 50
    assert result["computed_json"]["roas"] == 4
    assert result["computed_json"]["conversion_rate"] == 0.2
    assert result["computed_json"]["repeat_rate"] == 0.25
