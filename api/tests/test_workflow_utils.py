from datetime import datetime, timezone

from routers.workflow import _compute_next_run


def test_compute_next_run_returns_future_datetime():
    base = datetime(2026, 4, 14, 8, 0, tzinfo=timezone.utc)
    next_run = _compute_next_run("0 9 * * *", "Asia/Ho_Chi_Minh", base=base)
    assert next_run > base
    assert next_run.tzinfo is not None
