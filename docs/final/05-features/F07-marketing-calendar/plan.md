# F07 — Marketing Calendar: Plan

**Feature ID**: F07 | **Sprint**: Sprint 2

---

## Mô tả

Calendar trực quan hiển thị tất cả nội dung đã lên lịch theo ngày và kênh, giúp user có cái nhìn toàn cảnh về kế hoạch marketing cả tháng.

---

## User Stories

| ID | Story | Points | Priority |
|---|---|---|---|
| US-31 | Calendar tháng hiển thị content items theo ngày | 5 | M |
| US-32 | Click ngày xem content detail | 3 | M |
| US-33 | Thay đổi scheduled_date | 3 | M |
| US-34 | Filter theo channel | 2 | S |

---

## Data Model

Sử dụng `content_items.scheduled_date` (DATE) làm ngày hiển thị trên calendar.

**Query calendar:**
```sql
SELECT ci.id, ci.channel, ci.status, ci.scheduled_date,
       ci.content_json, c.campaign_name
FROM content_items ci
JOIN campaigns c ON c.id = ci.campaign_id
WHERE c.user_id = $1
  AND ci.scheduled_date BETWEEN $2 AND $3  -- month range
  AND ci.version = (
    SELECT MAX(version) FROM content_items ci2
    WHERE ci2.campaign_id = ci.campaign_id AND ci2.channel = ci.channel
  )
ORDER BY ci.scheduled_date, ci.channel;
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/calendar?month=4&year=2025` | Lấy content items trong tháng |
| PATCH | `/content/{id}/schedule-date` | Cập nhật scheduled_date |

---

## UI Design

**`/(app)/calendar`:**
- Month grid (7 cột × 4-5 hàng)
- Mỗi ô ngày: dot màu cho mỗi content item
  - Xanh dương: facebook_post
  - Vàng: email
  - Đỏ: video_script
- Status opacity: pending = 50%, approved = 100%
- Click ngày → sidebar panel bên phải hiển thị items trong ngày đó
- Navigation: tháng trước / tháng sau

---

## Dependencies

- Depends on: F05 (Content), F06 (Approval — chỉ approved items fully visible)
