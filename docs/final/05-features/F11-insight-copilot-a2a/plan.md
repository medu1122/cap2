# F11 - Insight Copilot A2A: Plan (chuan hoa)

## 1) Bai toan thuc te

SMB co file CSV/XLSX nhung khong biet cach doc KPI va khong biet nen hanh dong gi tiep theo.
F11 chuyen file du lieu thanh:
- KPI tin cay
- insight de hieu
- danh sach hanh dong de xuat co the dung ngay

## 2) Pham vi user-facing

- User upload 1 file CSV/XLSX (sheet 1).
- User xem preview du lieu, tien trinh pipeline, ket qua phan tich.
- User xem "hanh dong de xuat" va bam tao campaign tu ket qua.
- User xem lai run history va reanalyze.

Ngoai pham vi dot nay:
- Kho data warehouse da bang.
- Chatbot hoi dap free-form tren moi run.

## 3) API contracts

- `POST /insights/a2a/deep-analysis`
- `POST /insights/a2a/deep-analysis-stream`
- `GET /insights/a2a/runs`
- `GET /insights/a2a/runs/{run_id}/result`
- `POST /insights/a2a/runs/{run_id}/reanalyze`

## 4) Data contracts (response chinh)

- `report_type_vi`
- `kpis`
- `friendly_model_trace`
- `data_quality_score`
- `limitations`
- `insights`
- `situations` (new)
- `suggested_actions` (new)
- `fallback.user_message`

## 5) Ke hoach coding

### Backend
- Chuan hoa output contract cho action:
  - `situations[]`: van de/co hoi phat hien tu KPI.
  - `suggested_actions[]`: hanh dong uu tien + ly do + expected_impact.
- Khong phu thuoc 100% vao LLM:
  - deterministic issues + KPI availability
  - fallback GPT khi local fail.
- Luu day du `model_used`, `fallback_reason` de debug va audit.

### Frontend
- Panel ket qua giu nguyen.
- Bo sung panel "Hanh dong de xuat".
- CTA:
  - "Tao campaign tu hanh dong"
  - "Gan voi customer list/segment"

### Test
- Contract test cho `situations[]` + `suggested_actions[]`.
- Case local model fail -> fallback van tra output hop le.
- Reanalyze van giu lich su trace.

## 6) Env lien quan

- `QWEN_BASE_URL`
- `QWEN_MODEL=qwen2.5:14b`
- `DEEPSEEK_MODEL=qwen2.5:14b` (compat)
- `QWEN_TIMEOUT=180`
- `OPENAI_API_KEY` (fallback)

## 7) Clean code checklist

- [ ] Tach helper build action contract khoi block narrative.
- [ ] Khong duplicate logic parse/fallback giua deep-analysis va reanalyze.
- [ ] Chuan hoa field name trong response (snake_case nhat quan).
