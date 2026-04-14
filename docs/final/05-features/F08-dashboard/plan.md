# F08 — Dashboard & AI Summary: Plan

**Feature ID**: F08 | **Sprint**: Sprint 3

---

## Mô tả

Dashboard là trang đầu tiên user thấy sau khi đăng nhập. Hiển thị tổng quan metrics, phân phối theo kênh, hoạt động gần đây, thống kê AI usage và AI-generated weekly summary.

---

## User Stories

| ID | Story | Points | Priority |
|---|---|---|---|
| US-35 | Dashboard: 4 metric widgets | 5 | M |
| US-36 | Content distribution by channel chart | 3 | M |
| US-37 | AI-generated weekly summary từ Qwen | 5 | M |

---

## Data Model

Không có bảng mới — sử dụng aggregate queries từ:
- `campaigns` — total_campaigns, by status
- `content_items` — total_content, pending, approved, by channel
- `agent_run_logs` — recent activity
- `ai_usage_stats` — token usage

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/dashboard/stats` | Aggregate stats cho user | 
| GET | `/dashboard/ai-summary` | AI-generated text summary từ Qwen |

---

## Dashboard Widgets

| Widget | Data | Visualization |
|---|---|---|
| Total Campaigns | COUNT(campaigns) | Number card |
| Content Items | COUNT(content_items) | Number card |
| Pending Approvals | COUNT WHERE status='pending_approval' | Number card + link |
| Approved Items | COUNT WHERE status='approved' | Number card |
| Content by Channel | GROUP BY channel | Bar chart hoặc pie |
| Recent Agent Activity | Last 10 agent_run_logs | Timeline list |
| AI Usage This Month | ai_usage_stats | Input/output tokens |
| AI Weekly Summary | LLM-generated text | Text card |

---

## AI Summary Generation

**Input context cho Qwen:**
```
Thống kê marketing tuần này:
- Tổng campaigns: 5 (2 đang xử lý, 3 đã duyệt)
- Nội dung tạo ra: 12 items
- Chờ duyệt: 4 items
- Kênh phổ biến nhất: Facebook Post (6 items)
Hãy tóm tắt tình hình và đưa ra 1-2 gợi ý ngắn gọn (2-3 câu).
```

**Expected output:** "Tuần này bạn đã tạo 5 chiến dịch thành công, Facebook Post đang là kênh được sử dụng nhiều nhất. Bạn còn 4 nội dung đang chờ duyệt — hãy vào xem và phê duyệt sớm để không bỏ lỡ thời điểm đăng bài tốt."

---

## Dependencies

- Depends on: F01 (Auth), F03-F07 (all campaign/content features để có data)
