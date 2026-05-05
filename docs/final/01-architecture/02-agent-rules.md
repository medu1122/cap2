# Agent Coding Rules - AIMAP Project

## ⚠️ Mục đích

File này là **RÀNG BUỘC** cho tất cả AI agents khi làm việc với codebase AIMAP.

**Agent phải đọc và TUYỆT ĐỐI tuân thủ các quy tắc này trước khi bắt đầu bất kỳ thay đổi nào.**

---

## 📋 Mục lục

1. [Cấu trúc dự án bắt buộc](#1-cấu-trúc-dự-án-bắt-buộc)
2. [Quy tắc Database](#2-quy-tắc-database)
3. [Quy tắc API/Routers](#3-quy-tắc-apirouters)
4. [Quy tắc Models](#4-quy-tắc-models)
5. [Quy tắc Services](#5-quy-tắc-services)
6. [Quy tắc Configuration](#6-quy-tắc-configuration)
7. [Files được phép xóa](#7-files-được-phép-xóa)
8. [Files KHÔNG được phép xóa](#8-files-không-được-phép-xóa)
9. [Quy trình thay đổi](#9-quy-trình-thay-đổi)

---

## 1. Cấu trúc dự án bắt buộc

### ✅ ĐÚNG

```
api/
├── main.py                    # Entry point
├── core/                      # Config, DB, Security
│   ├── config.py
│   ├── database.py
│   ├── security.py
│   └── deps.py
├── models/                    # SQLAlchemy ORM
│   ├── __init__.py
│   ├── user.py
│   ├── campaign.py
│   └── ...
├── routers/                   # FastAPI routers
│   ├── auth.py
│   ├── campaigns.py
│   └── ...
├── services/                  # Business logic
│   ├── workflow_scheduler_service.py
│   └── ...
└── schemas/                   # Pydantic schemas (optional)
    └── ...
```

### ❌ KHÔNG ĐƯỢC thay đổi

```
❌ Không tạo thêm folders mới ở root api/
❌ Không tạo thêm modules mới ở core/
❌ Không tạo cấu trúc phức tạp hơn (clean architecture quá đà)
```

---

## 2. Quy tắc Database

### 2.1 Kết nối Database

```python
# ✅ ĐÚNG: Import từ core.database
from core.database import Base, engine, AsyncSessionLocal, get_db

# ❌ SAI: Không tạo kết nối mới
from sqlalchemy import create_engine  # KHÔNG DÙNG
```

### 2.2 Model Base

```python
# ✅ ĐÚNG
from core.database import Base

class MyModel(Base):
    __tablename__ = "my_table"
    ...

# ❌ SAI: Không import từ models.base
from models.base import Base  # KHÔNG TỒN TẠI
```

### 2.3 Database URL Format

```
✅ postgresql+asyncpg://user:pass@host:5432/db
❌ postgresql://user:pass@host:5432/db (sync driver)
```

### 2.4 External Database

- Database nằm NGOÀI Docker (host machine)
- Host trong Docker: `host.docker.internal` (Mac/Windows) hoặc IP address (Linux)
- KHÔNG sử dụng container db trong docker-compose.yml

---

## 3. Quy tắc API/Routers

### 3.1 Router Structure

```python
# ✅ Template chuẩn
from fastapi import APIRouter, Depends, HTTPException
from core.database import get_db
from core.deps import get_current_user

router = APIRouter()

@router.post("/items")
async def create_item(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # ...
    return {"status": "ok"}
```

### 3.2 Import Dependencies

```python
# ✅ ĐÚNG
from core.database import get_db
from core.deps import get_current_user

# ❌ SAI
from core.security import get_current_user  # KHÔNG TỒN TẠI
```

### 3.3 Đăng ký Router trong main.py

```python
# Khi tạo router mới, phải import và đăng ký trong main.py
from routers import my_new_router

app.include_router(my_new_router.router, prefix="/my-resource", tags=["my-resource"])
```

---

## 4. Quy tắc Models

### 4.1 Model Template

```python
# ✅ Template chuẩn
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from core.database import Base
import uuid
from datetime import datetime, timezone

class MyModel(Base):
    __tablename__ = "my_table"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
```

### 4.2 Timestamps

- Luôn có `created_at` và `updated_at`
- Sử dụng `DateTime(timezone=True)` cho UTC
- Default = `lambda: datetime.now(timezone.utc)`

### 4.3 UUID Primary Key

```python
id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
```

### 4.4 Export trong __init__.py

```python
# Khi tạo model mới, thêm vào models/__init__.py
from .my_model import MyModel

__all__ = [
    # ... existing models
    "MyModel",
]
```

---

## 5. Quy tắc Services

### 5.1 Service Structure

```python
# ✅ Template chuẩn
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import AsyncSessionLocal

async def my_service_function(db: AsyncSession, param: str):
    async with AsyncSessionLocal() as db:
        # business logic
        pass
```

### 5.2 Scheduler Jobs

```python
# Trong services/workflow_scheduler_service.py hoặc calendar_reminder_service.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
```

---

## 6. Quy tắc Configuration

### 6.1 Settings

```python
# ✅ ĐÚNG: Import từ core.config
from core.config import settings

# Sử dụng
url = settings.DATABASE_URL
secret = settings.JWT_SECRET
```

### 6.2 .env Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | ✅ | PostgreSQL connection string |
| JWT_SECRET | ✅ | JWT signing key (min 32 chars) |
| JWT_ALGORITHM | ❌ | Default: HS256 |
| OPENAI_API_KEY | ❌ | For AI features |
| CORS_ORIGINS | ❌ | Default: http://localhost:3000 |

---

## 7. Files được phép xóa

### ⚠️ XÓA AN TOÀN (không có code gọi)

| File | Lý do |
|------|-------|
| `schemas/*.py` | Không được import bởi routers |
| `init_db.py` | Chỉ chạy 1 lần khi setup |
| `seed_demo.py` | Chỉ chạy 1 lần khi demo |

### ⚠️ XÓA CẨN THẬN (kiểm tra trước)

| File | Cần kiểm tra |
|------|---------------|
| `services/image_prompt_generator.py` | AI image feature |
| `services/agent_dispatcher.py` | Agent integration |

---

## 8. Files KHÔNG được phép xóa

### 🚨 NGUY HIỂM - KHÔNG ĐƯỢC XÓA

| File/Folder | Lý do |
|-------------|-------|
| `core/config.py` | Tất cả settings |
| `core/database.py` | Database connection |
| `core/security.py` | JWT, password hashing |
| `core/deps.py` | Dependency injection |
| `models/*.py` | Database schema |
| `routers/*.py` | API endpoints |
| `services/*.py` | Business logic |
| `main.py` | App entry point |

### 🚨 KHÔNG ĐƯỢC thay đổi format import

```python
# KHÔNG ĐƯỢC đổi
from core.database import Base  # ✅
from models.base import Base   # ❌ File này không tồn tại
```

---

## 9. Quy trình thay đổi

### 9.1 Thêm Model mới

```
1. Tạo file: models/my_new_model.py
2. Định nghĩa class với Base
3. Thêm vào: models/__init__.py
4. Chạy: docker compose exec api python init_db.py
```

### 9.2 Thêm Router mới

```
1. Tạo file: routers/my_new_router.py
2. Import vào main.py
3. Đăng ký router với prefix và tags
```

### 9.3 Thêm Service mới

```
1. Tạo file: services/my_new_service.py
2. Import từ routers khi cần
3. KHÔNG tạo circular import
```

### 9.4 Xóa file cũ

```
1. Grep toàn bộ codebase để tìm references
2. Nếu không có references → xóa an toàn
3. Nếu có references → xóa references trước
4. Backup trước khi xóa
```

---

## 10. Kiểm tra trước khi commit

### Checklist

```bash
# 1. Kiểm tra import
python -c "from main import app; print('Import OK')"

# 2. Kiểm tra database connection
docker compose exec api python -c "from core.database import engine; print('DB OK')"

# 3. Kiểm tra routers
curl http://localhost:8000/health

# 4. Kiểm tra imports không break
grep -r "from models.base" api/
```

---

## 11. Anti-patterns (Tránh xa)

### ❌ KHÔNG BAO GIỜ làm những điều này

1. **Không tạo service mới trong routers/**
   ```python
   # ❌ SAI
   @router.post("/items")
   async def create_item(db: AsyncSession = Depends(get_db)):
       # Tất cả logic ở đây
       pass
   
   # ✅ ĐÚNG
   # Tách logic vào services/my_service.py
   ```

2. **Không hardcode config**
   ```python
   # ❌ SAI
   DATABASE_URL = "postgresql://..."
   
   # ✅ ĐÚNG
   from core.config import settings
   DATABASE_URL = settings.DATABASE_URL
   ```

3. **Không tạo file trùng tên**
   ```python
   # ❌ SAI - Two files with same name
   models/campaign.py
   models/Campaign.py
   
   # ✅ ĐÚNG - Naming convention
   models/campaign.py  # lowercase, underscore
   ```

4. **Không bỏ qua type hints**
   ```python
   # ❌ SAI
   async def my_func(data):
       return data
   
   # ✅ ĐÚNG
   async def my_func(data: str) -> dict:
       return {"result": data}
   ```

---

## 12. Troubleshooting

### Lỗi "ModuleNotFoundError: No module named 'models.base'"

**Nguyên nhân**: File đang import từ `models.base` thay vì `core.database`

**Sửa**:
```python
# ❌ Sai
from models.base import Base

# ✅ Đúng
from core.database import Base
```

### Lỗi "relation does not exist"

**Nguyên nhân**: Table chưa được tạo trong database

**Sửa**:
```bash
docker compose exec api python init_db.py
```

### Lỗi "Connection refused" database

**Nguyên nhân**: DATABASE_URL sai hoặc database server không chạy

**Sửa**:
1. Kiểm tra DATABASE_URL trong .env
2. Kiểm tra database server đang chạy
3. Kiểm tra firewall cho phép kết nối

---

## 13. Database Rules (QUAN TRỌNG)

### 13.1 Khi cần thêm bảng mới

**BẮT BUỘC tuân theo quy tắc sau:**

```
1. KIỂM TRA TRƯỚC KHI TẠO
   - Xem xét có bảng nào có thể TÁI SỬ DỤNG không?
   - Kiểm tra bảng hiện có: docs/final/02-architecture/database-overview.md
   
2. NẾU CẦN TẠO MỚI
   - Tên bảng: snake_case, số nhiều (VD: customer_lists, campaign_items)
   - KHÔNG tạo junction table nếu đã có Foreign Key
   - KHÔNG tạo bảng trùng chức năng với bảng có sẵn

3. SAU KHI TẠO
   - Cập nhật: database-overview.md
   - Cập nhật: models/__init__.py
   - Tạo migration hoặc chạy init_db.py
```

### 13.2 Danh sách bảng HIỆN CÓ (32 bảng)

```
CORE TABLES:
- users           (Tài khoản)
- brands          (Thương hiệu)
- campaigns       (Chiến dịch)
- content_items   (Nội dung)
- customers       (Khách hàng)
- customer_lists  (Danh sách KH)

AI & INSIGHTS:
- agent_run_logs           (Log AI)
- insight_report_runs      (Báo cáo)
- insight_result_snapshots (Kết quả)
- insight_agent_traces     (Trace)
- insight_data_sources     (Nguồn data)
- insight_cards           (Cards)
- insight_actions         (Actions)
- insight_metrics_daily   (Metrics)
- insight_raw_snapshots   (Raw data)
- insight_chats           (Chat)
- insight_chat_messages   (Messages)
- insight_report_schema_maps (Schema)

WORKFLOW & TRACKING:
- workflow_jobs            (Job)
- campaign_execution_logs  (Log thực thi)
- campaign_tracking_links  (Tracking links)
- campaign_revenue        (Revenue)
- campaign_ideas          (Ý tưởng)
- campaign_tags           (Tags)

SYSTEM:
- notifications           (Thông báo)
- notification_settings   (Cài đặt TB)
- ai_usage_stats         (AI stats)
- content_analytics      (Analytics)
- file_uploads           (Upload)
- brand_assets           (Assets)
- customer_analysis_snapshots (Customer snapshots)
```

### 13.3 Anti-patterns về Database

```
❌ SAI: Tạo bảng mới khi có thể dùng bảng cũ
   VD: Tạo campaign_status_logs thay vì dùng campaign_execution_logs

❌ SAI: Tạo junction table khi đã có FK
   VD: Tạo user_campaigns thay vì campaigns.user_id

❌ SAI: Tạo bảng với tên khác nhưng cùng chức năng
   VD: Tạo campaign_tracking thay vì dùng campaign_tracking_links

✅ ĐÚNG: Kiểm tra database-overview.md trước khi tạo bảng mới
```

### 13.4 Checklist trước khi tạo bảng

```bash
# 1. Kiểm tra bảng đã tồn tại chưa
grep -r "tablename" api/models/

# 2. Kiểm tra có thể mở rộng bảng hiện có không
# VD: Thêm cột vào campaigns thay vì tạo campaign_extra

# 3. Nếu cần tạo mới, thêm vào:
# - models/my_new_table.py
# - models/__init__.py
# - database-overview.md
```

---

## 14. Contacts & Resources

- **Architecture**: `docs/final/01-architecture/01-system-architecture.md`
- **Database Schema**: `docs/final/02-architecture/database-overview.md`
- **Demo Credentials**: demo@cafebohho.vn / demo1234

---

**Agent phải đọc file này TRƯỚC KHI bắt đầu bất kỳ task nào**

**Version**: 1.1
**Last Updated**: 2026-05-05
