# F02 — Brand Vault: Plan

**Feature ID**: F02 | **Epic**: Brand Management | **Sprint**: Sprint 1

---

## Mô tả

Brand Vault là "bộ nhớ dài hạn" của AI agents — nơi lưu toàn bộ DNA thương hiệu. Mọi agent prompt đều đọc Brand Vault trước khi sinh nội dung, đảm bảo tất cả output nhất quán với phong cách thương hiệu.

---

## User Stories

| ID | Story | Acceptance Criteria | Points | Priority |
|---|---|---|---|---|
| US-09 | As an owner, I want to set up Brand Vault | Required fields validated, brand saved, AI có thể đọc | 5 | M |
| US-10 | As an owner, I want to update Brand Vault | Update thành công, campaigns mới dùng data mới | 2 | M |
| US-11 | As an owner, I want to define forbidden words | AI không dùng các từ trong list khi viết | 3 | M |
| US-12 | As an owner, I want to upload my logo | logo_url lưu, hiển thị trên brand vault page | 2 | S |
| US-13 | As an owner, I want warning if Brand Vault incomplete | Warning khi tạo campaign nếu thiếu required fields | 1 | S |

---

## Data Model

### Bảng `brands` (1:1 với users)

```
id UUID PK
user_id UUID FK → users (UNIQUE — 1 user : 1 brand)
brand_name VARCHAR(255) NOT NULL
tagline VARCHAR(512)
brand_description TEXT NOT NULL
tone_of_voice VARCHAR(50) NOT NULL    -- playful|professional|warm|bold|informative
logo_url VARCHAR(1024)
primary_color VARCHAR(7)              -- hex #RRGGBB
target_audience TEXT NOT NULL
key_products TEXT[]                   -- ['Cà phê sữa đá', 'Bạc xỉu']
forbidden_words TEXT[]               -- ['rẻ', 'siêu rẻ', 'bình dân']
preferred_cta VARCHAR(255)           -- 'Ghé thăm ngay'
preferred_salutation VARCHAR(50)     -- 'bạn', 'quý khách'
sample_post TEXT
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### Bảng `brand_assets`

```
id UUID PK
brand_id UUID FK → brands (CASCADE)
asset_type VARCHAR(50)    -- 'logo' | 'banner' | 'product_image'
file_url VARCHAR(1024) NOT NULL
file_name VARCHAR(255)
file_size_bytes INTEGER
created_at TIMESTAMPTZ
```

---

## API Endpoints

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/brands/me` | Lấy brand vault của user | Yes |
| PUT | `/brands/me` | Tạo hoặc cập nhật brand vault (upsert) | Yes |
| GET | `/brands/me/assets` | Lấy danh sách brand assets | Yes |
| POST | `/brands/me/assets` | Upload brand asset | Yes |
| DELETE | `/brands/me/assets/{id}` | Xóa brand asset | Yes |

---

## Brand Vault trong AI Context

Khi Agent Service cần brand context, nó gọi `GET /internal/campaigns/{id}/detail` và nhận:

```json
{
  "brand_context": {
    "brand_name": "Cafe Bờ Hồ",
    "tone_of_voice": "warm",
    "target_audience": "Sinh viên 18-25",
    "key_products": ["Cà phê sữa đá", "Bạc xỉu"],
    "forbidden_words": ["rẻ", "bình dân"],
    "preferred_cta": "Ghé thăm ngay",
    "preferred_salutation": "bạn",
    "sample_post": "..."
  }
}
```

Prompt injection pattern:
```
<brand_context>
Thương hiệu: Cafe Bờ Hồ
Giọng văn: Ấm áp, gần gũi
Khách hàng: Sinh viên 18-25
Từ cấm: rẻ, bình dân
CTA: Ghé thăm ngay
</brand_context>

[Task-specific instructions here]
```

---

## UI Screens

**`/(app)/brand-vault`** — Form 2 cột:
- Cột trái: brand_name, tagline, brand_description, tone_of_voice (radio/select), primary_color (color picker)
- Cột phải: target_audience, key_products (tag input), forbidden_words (tag input), preferred_cta, preferred_salutation, sample_post
- Logo upload section ở phần dưới
- Warning banner nếu required fields chưa điền

---

## Validation Rules

| Field | Rule |
|---|---|
| brand_name | Required, 1-255 chars |
| brand_description | Required, min 20 chars |
| tone_of_voice | Required, enum: playful/professional/warm/bold/informative |
| target_audience | Required, min 10 chars |
| primary_color | Optional, regex `#[0-9A-Fa-f]{6}` |
| key_products | Optional, mỗi item max 100 chars |
| forbidden_words | Optional, mỗi item max 50 chars |

---

## Dependencies

- Depends on: F01 (Authentication)
- Required by: F03 (Campaign Brief), F04 (Agent Orchestrator)
