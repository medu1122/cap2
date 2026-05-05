# File Cleanup Report - AIMAP API

**Generated**: 2026-05-05
**Status**: Analysis Complete - Cleanup Attempted

---

## ⚠️ QUAN TRỌNG: Sau khi phân tích

### Files KHÔNG nên xóa (đang được sử dụng):

| Folder/File | Import bởi | Số lượng imports |
|-------------|------------|------------------|
| `schemas/` | routers (6 files) | 8 imports |
| `init_db.py` | Docker entry | Runtime |

### Files CÓ THỂ xóa (đã xóa):

| File | Status | Notes |
|------|--------|-------|
| `api/seed_demo.py` | ✅ ĐÃ XÓA | Chỉ chạy 1 lần |

---

## Phân tích chi tiết

### Schemas đang được sử dụng

```
schemas/
├── brand.py              ← routers/brands.py
├── campaign.py           ← routers/campaigns.py, content.py
├── campaign_idea.py      ← routers/campaign_idea.py
├── campaign_revenue.py   ← routers/campaigns.py
└── user.py              ← routers/auth.py
```

**Imports found**:
```python
# routers/campaigns.py
from schemas.campaign import ...
from schemas.campaign_revenue import ...

# routers/campaign_idea.py
from schemas.campaign_idea import ...

# routers/brands.py
from schemas.brand import BrandUpsert, BrandOut

# routers/auth.py
from schemas.user import UserCreate, UserLogin, UserOut, TokenResponse

# routers/content.py
from schemas.campaign import ContentItemOut
```

**Kết luận**: Schemas là Pydantic models cho request/response validation, đang được sử dụng.

---

## Structure sau cleanup

```
api/
├── main.py                   ✅ Giữ
├── init_db.py                ✅ Giữ (đã tạo lại)
├── seed_demo.py              ❌ ĐÃ XÓA
│
├── core/                    ✅ Giữ (4 files)
│   ├── config.py
│   ├── database.py
│   ├── security.py
│   └── deps.py
│
├── models/                  ✅ Giữ (28 files)
│   ├── __init__.py
│   └── ... (28 model files)
│
├── schemas/                 ✅ Giữ (5 files) - ĐANG DÙNG
│   ├── __init__.py
│   ├── brand.py
│   ├── campaign.py
│   ├── campaign_idea.py
│   ├── campaign_revenue.py
│   └── user.py
│
├── routers/                ✅ Giữ (14 files)
│   ├── auth.py
│   ├── brands.py
│   ├── campaigns.py
│   ├── campaign_idea.py
│   ├── calendar.py
│   ├── content.py
│   ├── dashboard.py
│   ├── insights.py
│   ├── insights_chat.py
│   ├── internal.py
│   ├── redirect.py
│   ├── tracking.py
│   ├── tracking_links.py
│   └── workflow.py
│
├── services/               ✅ Giữ (17 files)
│   ├── workflow_scheduler_service.py
│   ├── calendar_reminder_service.py
│   ├── campaign_delivery_service.py
│   ├── customer_analysis_service.py
│   ├── dashboard_service.py
│   ├── publish_schedule.py
│   ├── image_prompt_generator.py
│   ├── agent_dispatcher.py
│   └── insight_intelligence/ (8 files)
│
├── static/                 ✅ Giữ
│   └── uploads/
│
└── tests/                 ⚠️ Optional
    ├── test_insights_utils.py
    ├── test_workflow_utils.py
    ├── test_calendar_utils.py
    └── test_phase1_action_and_segment.py
```

---

## Thống kê

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Total files | 77 | 75 | -2 |
| seed_demo.py | 1 | 0 | -1 |

---

## Lessons Learned

1. **Luôn grep trước khi xóa** - `from schemas.` được tìm thấy trong 6 routers
2. **Schemas quan trọng** - Dùng cho Pydantic validation
3. **seed_demo.py an toàn** - Không có imports, đã xóa thành công

---

## Files có thể clean thêm (optional)

### Tests folder - có thể xóa nếu không cần

```bash
# Chỉ xóa nếu project không cần unit tests
rm -rf api/tests/
```

### __pycache__ folders

```bash
# Xóa cache files
find api/ -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
find api/ -name "*.pyc" -delete
```

---

## Kết luận

**Không nên xóa thêm gì nữa** trong production code. Các files còn lại đều đang được sử dụng.

**Đã cleanup**:
- Xóa seed_demo.py (1-time script)

**Giữ nguyên**:
- Tất cả core, models, routers, services, schemas

---

**Last Updated**: 2026-05-05
