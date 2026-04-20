# F03 - Campaign Brief Intake: Coding guide (chuan hoa)

## Backend

### Core files
- `api/routers/campaigns.py`
- `api/schemas/campaign.py`
- `api/services/agent_dispatcher.py`
- `api/models/campaign.py`

### Implementation notes
- `CampaignCreate` bo sung optional:
  - `source_insight_run_id`
  - `source_customer_segment`
- Khi create:
  - build `campaign_data` tu field thuc cua table.
  - merge source metadata vao `campaign_plan_json.source_context`.
- Validate:
  - deadline khong qua khu
  - channels hop le
  - brand_id thuoc user hien tai

### Image storage
- Cloudinary first, local fallback.
- Luu `image_url` trong `campaign_plan_json`.

## Frontend

### Core files
- `web/app/(app)/campaigns/new/page.tsx`
- `web/app/(app)/campaigns/[id]/page.tsx`

### Implementation notes
- Form tao campaign thong thuong giu nguyen UX.
- Neu den tu action flow:
  - inject source metadata an.
  - hien badge "tao tu insight/segment".

## Test checklist

- [ ] Create campaign basic pass.
- [ ] Create campaign co source metadata pass.
- [ ] Dispatch fail -> status/error_message ro rang.
- [ ] Image upload/generate khong anh huong create campaign flow.

## Env checklist

- Model suggest:
  - `QWEN_BASE_URL`
  - `QWEN_MODEL`
  - `OPENAI_API_KEY`
- Image:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
