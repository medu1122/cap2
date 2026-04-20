# F03 - Campaign Brief Intake: Plan (chuan hoa)

## 1) Bai toan thuc te

User can tao campaign nhanh, dung cau truc, va co the khoi tao campaign tu insight/action thay vi nhap lai tu dau.

## 2) Pham vi user-facing

- User tao campaign bang form.
- User tao campaign tu action de xuat (nguon tu F11/F10).
- User thay trang thai dispatch ro rang (running/failed/pending_approval...).

Ngoai pham vi dot nay:
- template engine phuc tap nhieu buoc.

## 3) API contracts

- `POST /campaigns`
- `GET /campaigns`
- `GET /campaigns/{id}`
- `POST /campaigns/ai-suggest`
- `POST /campaigns/{id}/run`

## 4) Data contracts can bo sung

Trong payload tao campaign:
- `source_insight_run_id` (optional UUID)
- `source_customer_segment` (optional string: vip|potential|inactive|unknown)

Luu metadata nguon trong `campaign_plan_json.source_context` de tranh migration ngay.

## 5) Ke hoach coding

### Backend
- Mo rong schema `CampaignCreate` cho source metadata.
- Khi tao campaign:
  - khong pass field source metadata truc tiep vao model columns,
  - merge vao `campaign_plan_json.source_context`.
- Dam bao backward compatible campaign cu.

### Frontend
- Form tao campaign tu action auto-dien source metadata an.
- Hien thi trong campaign detail: "Nguon tao campaign".

### Test
- Tao campaign thu cong khong source metadata van chay.
- Tao campaign co source metadata duoc luu dung.
- Validation deadline/channels giu nguyen.

## 6) Env lien quan

- Model suggest:
  - `QWEN_BASE_URL`
  - `QWEN_MODEL=qwen2.5:14b`
  - `OPENAI_API_KEY` fallback
- Media storage:
  - `CLOUDINARY_*`

## 7) Clean code checklist

- [ ] Tach build source context helper khoi endpoint.
- [ ] Chuan hoa message loi validation + dispatch.
- [ ] Xoa logic check channels/deadline trung lap neu da co validator.
