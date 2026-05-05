# Database Analysis Report - AIMAP Project

**Generated**: 2026-05-05
**Database**: 103.116.38.96:5432/aimap
**Total Tables**: 42

---

## 1. Tổng quan Tables

| Category | Count | Tables |
|----------|-------|--------|
| **Có dữ liệu** | 25 | Đang sử dụng |
| **Không có dữ liệu** | 16 | Cần xem xét xóa |
| **System tables** | 1 | alembic_version |

---

## 2. Tables CÓ DỮ LIỆU (25 tables)

| Table | Rows | Import Count | Đánh giá |
|-------|------|--------------|-----------|
| agent_run_logs | 129 | 3 | ✅ Cần thiết |
| insight_agent_traces | 80 | 1 | ✅ Có thể cần |
| customers | 60 | 2 | ✅ Cần thiết |
| campaigns | 15 | 13 | ✅ **Quan trọng** |
| insight_report_runs | 12 | 1 | ✅ Có thể cần |
| insight_result_snapshots | 12 | 1 | ✅ Có thể cần |
| insight_report_schema_maps | 27 | 1 | ✅ Có thể cần |
| content_items | 27 | 8 | ✅ **Quan trọng** |
| users | 11 | 12 | ✅ **Quan trọng** |
| campaign_execution_logs | 40 | 3 | ✅ Cần thiết |
| campaign_ideas | 7 | 1 | ✅ Có thể cần |
| brands | 5 | 6 | ✅ **Quan trọng** |
| workflow_jobs | 4 | 2 | ✅ Cần thiết |
| campaign_tags | 3 | 0 | ⚠️ Không import |
| customer_lists | 3 | 3 | ✅ Cần thiết |
| customer_analysis_snapshots | 3 | 1 | ⚠️ Ít dùng |
| insight_actions | 2 | 0 | ⚠️ Không import |
| insight_cards | 2 | 0 | ⚠️ Không import |
| content_analytics | 2 | 0 | ⚠️ Không import |
| notifications | 2 | 0 | ⚠️ Không import |
| ai_usage_stats | 2 | 0 | ⚠️ Không import |
| notification_settings | 1 | 0 | ⚠️ Không import |
| insight_data_sources | 1 | 1 | ⚠️ Ít dùng |
| insight_metrics_daily | 1 | 0 | ⚠️ Không import |
| insight_raw_snapshots | 1 | 0 | ⚠️ Không import |

---

## 3. Tables KHÔNG CÓ DỮ LIỆU (16 tables)

### 3.1 Có thể XÓA AN TOÀN (8 tables)

| Table | Lý do |
|-------|-------|
| `approval_history` | Không import, không dùng |
| `campaign_tag_assignments` | Không import, có thể trùng với tags |
| `customer_list_members` | Junction table thừa - đã có FK trong customers |
| `email_verifications` | Auth feature chưa implement |
| `outreach_logs` | Import 1 lần nhưng không có data |
| `password_reset_tokens` | Auth feature chưa implement |
| `user_sessions` | JWT stateless - không cần session |
| `workflow_schedules` | Import 2 lần nhưng không có data |

### 3.2 Cần XEM XÉT TRƯỚC (5 tables)

| Table | Import | Data | Khuyến nghị |
|-------|--------|------|--------------|
| `brand_assets` | 0 | 0 | Xóa nếu không dùng Cloudinary |
| `campaign_revenue` | 1 | 0 | Giữ - feature revenue tracking |
| `campaign_tracking_links` | 3 | 0 | Giữ - tracking feature |
| `content_templates` | 0 | 0 | Xóa nếu không dùng template |
| `file_uploads` | 1 | 0 | Giữ - upload feature |
| `insight_chats` | 1 | 0 | Giữ - chat feature đang develop |
| `insight_chat_messages` | 0 | 0 | Giữ - phụ thuộc insight_chats |
| `insight_feedback` | 0 | 0 | Xóa - chưa implement |

---

## 4. PHÂN TÍCH CHI TIẾT

### 4.1 Tables NÊN XÓA (Không dùng + Không có data)

| # | Table | Model tương ứng | Xóa model? |
|---|-------|-----------------|-------------|
| 1 | approval_history | Có | ✅ Xóa |
| 2 | campaign_tag_assignments | Có | ✅ Xóa |
| 3 | customer_list_members | Có | ✅ Xóa |
| 4 | email_verifications | Có | ✅ Xóa |
| 5 | insight_feedback | Có | ✅ Xóa |
| 6 | password_reset_tokens | Có | ✅ Xóa |
| 7 | user_sessions | Có | ✅ Xóa |
| 8 | workflow_schedules | Có | ⚠️ Kiểm tra code |

### 4.2 Tables CẦN GIỮ

| # | Table | Lý do |
|---|-------|-------|
| 1 | users | Core - đăng nhập |
| 2 | brands | Core - brand vault |
| 3 | campaigns | Core - chiến dịch |
| 4 | content_items | Core - nội dung |
| 5 | customers | Core - khách hàng |
| 6 | customer_lists | Core - danh sách KH |
| 7 | agent_run_logs | AI tracking |
| 8 | workflow_jobs | Workflow execution |
| 9 | campaign_execution_logs | Campaign execution |
| 10 | campaign_ideas | AI ideas |
| 11 | insight_* | AI insights (8 tables) |

### 4.3 Tables TRÙNG LẶP/CẦN GỘP

| Table A | Table B | Vấn đề | Giải pháp |
|---------|---------|---------|-----------|
| customer_list_members | customers.customer_list_id | Junction thừa | Xóa A |
| insight_raw_snapshots | insight_result_snapshots | Raw vs Processed | Xóa raw |
| ai_usage_stats | agent_run_logs | Trùng tracking | Xóa stats |

---

## 5. KẾ HOẠCH XÓA AN TOÀN

### Phase 1: Xóa Tables thừa (8 tables)

```sql
-- Tables không dùng + không có data
DROP TABLE IF EXISTS approval_history;
DROP TABLE IF EXISTS campaign_tag_assignments;
DROP TABLE IF EXISTS customer_list_members;
DROP TABLE IF EXISTS email_verifications;
DROP TABLE IF EXISTS insight_feedback;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS user_sessions;
-- Chỉ xóa sau khi kiểm tra code
-- DROP TABLE IF EXISTS workflow_schedules;
```

### Phase 2: Xóa Models tương ứng (8 files)

```
api/models/approval_history.py
api/models/campaign_tag_assignment.py (nếu có)
api/models/customer_list_member.py (nếu có)
api/models/email_verification.py (nếu có)
api/models/insight_feedback.py
api/models/password_reset_token.py (nếu có)
api/models/user_session.py (nếu có)
api/models/workflow_schedule.py (nếu kiểm tra xong)
```

### Phase 3: Kiểm tra và xóa thêm (sau review)

---

## 6. THỐNG KÊ SAU KHI XÓA

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Total Tables | 42 | ~34 | -8 |
| Empty Tables | 16 | ~8 | -8 |
| Core Tables | 15 | 15 | 0 |
| AI Tables | 11 | 11 | 0 |
| Unused Tables | 16 | 8 | -8 |

---

## 7. RECOMMENDATION

### XÓA NGAY (8 tables)

1. `approval_history` - Không dùng
2. `campaign_tag_assignments` - Junction thừa
3. `customer_list_members` - Junction thừa
4. `email_verifications` - Auth chưa implement
5. `insight_feedback` - Chưa implement
6. `password_reset_tokens` - Auth chưa implement
7. `user_sessions` - JWT stateless
8. `workflow_schedules` - Không có data

### GIỮ LẠI

Tất cả tables còn lại có dữ liệu hoặc đang được sử dụng.

---

## 8. SQL DROP STATEMENTS

```sql
-- Backup trước khi xóa
-- pg_dump -h 103.116.38.96 -U thinh -d aimap > backup_$(date +%Y%m%d).sql

-- Xóa tables không cần thiết
DROP TABLE IF EXISTS approval_history CASCADE;
DROP TABLE IF EXISTS campaign_tag_assignments CASCADE;
DROP TABLE IF EXISTS customer_list_members CASCADE;
DROP TABLE IF EXISTS email_verifications CASCADE;
DROP TABLE IF EXISTS insight_feedback CASCADE;
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS workflow_schedules CASCADE;

-- Xóa sau khi kiểm tra kỹ
-- DROP TABLE IF EXISTS insight_raw_snapshots CASCADE;
-- DROP TABLE IF EXISTS ai_usage_stats CASCADE;
```

---

**Status**: Ready to execute cleanup
**Risk Level**: Medium (cần backup trước)
