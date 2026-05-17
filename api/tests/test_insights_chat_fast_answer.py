from types import SimpleNamespace

from routers.insights_chat import build_fast_data_answer


def _source():
    return SimpleNamespace(
        name="sales_report",
        schema_json={
            "columns": [
                {"name": "Thang", "data_type": "date"},
                {"name": "Doanh_thu_VND", "data_type": "number"},
                {"name": "So_don_hang", "data_type": "number"},
                {"name": "Chi_phi_quang_cao_VND", "data_type": "number"},
            ]
        },
        data_json={
            "rows": [
                {"Thang": "2026-01", "Doanh_thu_VND": "74000000", "So_don_hang": "100", "Chi_phi_quang_cao_VND": "20000000"},
                {"Thang": "2026-02", "Doanh_thu_VND": "96000000", "So_don_hang": "120", "Chi_phi_quang_cao_VND": "24000000"},
                {"Thang": "2026-03", "Doanh_thu_VND": "50000000", "So_don_hang": "80", "Chi_phi_quang_cao_VND": "10000000"},
            ]
        },
    )


def test_fast_answer_total_revenue():
    answer = build_fast_data_answer("Tong doanh thu la bao nhieu?", _source())

    assert answer is not None
    text, extra = answer
    assert "220.000.000" in text
    assert extra["operation"] == "sum"


def test_fast_answer_top_month_by_orders():
    answer = build_fast_data_answer("thang nao co nhieu don nhat?", _source())

    assert answer is not None
    text, extra = answer
    assert "2026-02" in text
    assert "120" in text
    assert extra["operation"] == "group_extreme"


def test_fast_answer_roas_and_aov():
    roas = build_fast_data_answer("ROAS la bao nhieu?", _source())
    aov = build_fast_data_answer("AOV la bao nhieu?", _source())

    assert roas is not None
    assert "4.07" in roas[0]
    assert aov is not None
    assert "733.333,33" in aov[0]
