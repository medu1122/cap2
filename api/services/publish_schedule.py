"""
Heuristic đặt lịch đăng (VN, đa kênh).
Logic gợi ý nên khớp tinh thần với agent/orchestrator._plan_publish_dates khi chỉnh sửa.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

_VN_FIXED_HOLIDAYS = {
    (1, 1),
    (4, 30),
    (5, 1),
    (9, 2),
}

# weekday Python: Mon=0 ... Sun=6
_CHANNEL_WEEKDAY_PREFERENCE = {
    "facebook_post": {1, 3, 5},  # T3, T5, CN
    "email": {1, 3},
    "video_script": {2, 4, 5},
}

_CHANNEL_LABEL_VI = {
    "facebook_post": "Facebook",
    "email": "Email",
    "video_script": "Video",
}


def is_vn_fixed_holiday(d: date) -> bool:
    return (d.month, d.day) in _VN_FIXED_HOLIDAYS


def plan_publish_dates(deadline_str: str | None, channels: list[str]) -> list[str | None]:
    """Giống agent: dàn đều trong [today, deadline], ưu tiên ngày hợp kênh, tránh lễ."""
    num_channels = len(channels)
    if not deadline_str or num_channels == 0:
        return [deadline_str] * num_channels

    try:
        today = date.today()
        deadline = date.fromisoformat(deadline_str)
    except ValueError:
        return [deadline_str] * num_channels

    if deadline < today:
        deadline = today

    horizon_days = max((deadline - today).days, 0)
    candidates = [today + timedelta(days=i) for i in range(horizon_days + 1)]
    used_dates: set[date] = set()
    planned: list[str | None] = []

    for idx, channel in enumerate(channels):
        preferred = _CHANNEL_WEEKDAY_PREFERENCE.get(channel, {1, 2, 3, 4, 5})
        target_offset = round((idx + 1) * (horizon_days + 1) / (num_channels + 1)) - 1
        target_offset = max(0, min(horizon_days, target_offset))
        target_day = today + timedelta(days=target_offset)

        def score(d: date) -> tuple[int, int, int, int]:
            distance_penalty = abs((d - target_day).days)
            weekday_penalty = 0 if d.weekday() in preferred else 2
            holiday_penalty = 4 if is_vn_fixed_holiday(d) else 0
            weekend_penalty = 2 if channel == "email" and d.weekday() >= 5 else 0
            return (
                distance_penalty + weekday_penalty + holiday_penalty + weekend_penalty,
                abs((deadline - d).days),
                1 if d in used_dates else 0,
                (d - today).days,
            )

        best = min(candidates, key=score)
        used_dates.add(best)
        planned.append(str(best))

    return planned


def _weekday_name_vi(d: date) -> str:
    names = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
    return names[d.weekday()]


def _explain_choice(channel: str, d: date, avoid_dates: set[date]) -> list[str]:
    """Lý do ngắn (tiếng Việt) để user hiểu vì sao ngày đó được đề xuất."""
    lines: list[str] = []
    pref = _CHANNEL_WEEKDAY_PREFERENCE.get(channel, {1, 2, 3, 4, 5})
    label = _CHANNEL_LABEL_VI.get(channel, "kênh này")

    if d.weekday() in pref:
        lines.append(f"Khớp ngày trong tuần thường dùng cho {label} (ưu tiên engagement).")
    else:
        lines.append(f"Không nằm trong nhóm ngày mặc định cho {label}, vẫn khả thi nếu phù hợp audience.")

    if is_vn_fixed_holiday(d):
        lines.append("Trùng ngày nghỉ/lễ cố định ở VN — kiểm tra team vận hành có đăng không.")

    if channel == "email" and d.weekday() >= 5:
        lines.append("Cuối tuần: open rate email B2B thường thấp hơn; cân nhắc nếu là B2C.")

    if d in avoid_dates:
        lines.append("Trùng ngày với mục khác trong cùng chiến dịch — chỉ nên chọn nếu cố ý gom lịch.")

    if d == date.today():
        lines.append("Là hôm nay — chỉ chọn nếu còn thời gian duyệt và đăng.")

    lines.append(f"Thứ trong tuần: {_weekday_name_vi(d)}.")

    return lines


def suggest_reschedule_dates(
    channel: str,
    deadline: date,
    today: date | None = None,
    avoid_dates: set[date] | None = None,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """
    Trả về các ngày đăng gợi ý khi user dời lịch (điểm thấp = tốt hơn).
    avoid_dates: ngày đã có bài khác trong cùng chiến dịch (tránh dồn một ngày).
    """
    today = today or date.today()
    avoid_dates = avoid_dates or set()

    if deadline < today:
        deadline = today

    preferred = _CHANNEL_WEEKDAY_PREFERENCE.get(channel, {1, 2, 3, 4, 5})

    candidates: list[date] = []
    d = today
    while d <= deadline:
        candidates.append(d)
        d += timedelta(days=1)
    if not candidates:
        candidates = [today]

    def total_score(day: date) -> tuple[int, int]:
        weekday_penalty = 0 if day.weekday() in preferred else 2
        holiday_penalty = 3 if is_vn_fixed_holiday(day) else 0
        weekend_penalty = 2 if channel == "email" and day.weekday() >= 5 else 0
        collision_penalty = 4 if day in avoid_dates else 0
        urgency_bonus = 0 if (day - today).days >= 1 else 1
        s = weekday_penalty + holiday_penalty + weekend_penalty + collision_penalty + urgency_bonus
        return (s, day.toordinal())

    ranked = sorted(candidates, key=total_score)
    out: list[dict[str, Any]] = []
    seen: set[date] = set()
    for day in ranked:
        if day in seen:
            continue
        seen.add(day)
        score, _ = total_score(day)
        out.append(
            {
                "date": day.isoformat(),
                "score": score,
                "reasons": _explain_choice(channel, day, avoid_dates),
            }
        )
        if len(out) >= limit:
            break

    return out
