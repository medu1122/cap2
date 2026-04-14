# F06 — Human Approval Flow: Plan

**Feature ID**: F06 | **Sprint**: Sprint 2

---

## Mô tả

Luồng phê duyệt đảm bảo không có nội dung nào được dùng mà chưa qua mắt người. User có thể approve, reject với ghi chú, hoặc chỉnh sửa inline rồi approve.

---

## User Stories

| ID | Story | Points | Priority |
|---|---|---|---|
| US-27 | Approve content → xuất hiện trên calendar | 3 | M |
| US-28 | Reject content với rejection note | 3 | M |
| US-29 | Edit content inline rồi approve | 5 | M |
| US-30 | Xem approval history | 2 | S |

---

## State Machine

```
draft → pending_approval → approved
                        ↘ rejected → (optional) → revised_draft → pending_approval
```

---

## Data Model

### Bảng `approval_history`

```
id UUID PK
content_item_id UUID FK → content_items (CASCADE)
user_id UUID FK → users
action VARCHAR(20)     -- 'approved' | 'rejected' | 'edited'
note TEXT
content_version INTEGER -- phiên bản tại thời điểm action
created_at TIMESTAMPTZ
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/content?status=pending_approval` | Queue các items chờ duyệt |
| PATCH | `/content/{id}/approve` | Approve content |
| PATCH | `/content/{id}/reject` | Reject với note |
| GET | `/content/{id}/approval-history` | Lịch sử approve/reject |

---

## UI: Approval Queue Page

**`/(app)/approve`:**
- Tabs: "Chờ duyệt" / "Đã duyệt" / "Đã từ chối"
- Mỗi card: campaign name, channel badge, content preview, action buttons
- Approve button (xanh lá)
- Reject button → modal với textarea ghi chú
- Edit button → inline editor → Save & Approve

---

## Business Rules

- Approve: status → 'approved', item xuất hiện trên calendar
- Reject: status → 'rejected', rejection_note lưu
- Khi tất cả content items của 1 campaign đều 'approved': campaign.status → 'approved'
- Mọi action đều ghi vào approval_history

---

## Dependencies

- Depends on: F05 (Content Items)
- Feeds: F07 (Calendar — chỉ hiển thị approved items)
