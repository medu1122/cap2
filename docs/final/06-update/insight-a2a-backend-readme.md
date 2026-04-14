# Insight A2A Backend README

## API scope MVP
- `POST /insights/a2a/deep-analysis`
  - Input: business metadata + `report_rows[]`
  - Output: pipeline steps, kpis, insights, data quality score, limitations, fallback message than thien
- `GET /insights/a2a/runs`
  - Output: danh sach run da luu
- `GET /insights/a2a/runs/{run_id}/result`
  - Output: ket qua snapshot cua run cu
- `POST /insights/a2a/runs/{run_id}/reanalyze`
  - Input: optional business metadata override
  - Output: ket qua moi duoc phan tich lai tu source rows da luu

## Pipeline backend
1. ClassifierAgent (DeepSeek): nhan dang loai bao cao
2. MapperAgent (DeepSeek): map cot ve schema chuan
3. PlannerAgent (DeepSeek): lap analysis plan
4. Executor (Python): tinh metric deterministic
5. NarratorAgent (Qwen): viet insight + action business
6. GPT fallback neu Qwen fail/timed out
7. ResultPolisherAgent (DeepSeek): chuan hoa cau chuyen ket qua cho user business
8. Quality scoring: cham diem chat luong du lieu 0-100%

## Output contract chuan
- `model_trace[]`: buoc nao dung model nao
- `friendly_model_trace[]`: ten buoc tieng Viet de frontend hien thi
- `kpis`: bo so da tinh
- `insights[]`: title, severity, evidence, recommendation
- `data_quality_score`: diem tong hop 0..1 (frontend doi thanh %)
- `data_quality_breakdown`: diem theo nhom (do day du cot, so dong, hop le)
- `limitations[]`: cac phan tich chua thuc hien day du do thieu cot du lieu
- `fallback`: provider + reason ky thuat + `user_message` tieng Viet gon

## Guardrails
- Khong co evidence => khong duoc tao claim.
- JSON schema fail => retry ngan voi backoff, sau do fallback GPT.
- Luu run trace vao DB de audit.
- Luu `mapping_confidence` + `data_warnings` de canh bao user khi du lieu kem chat luong.
