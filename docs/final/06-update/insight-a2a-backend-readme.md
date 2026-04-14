# Insight A2A Backend README

## API scope MVP
- `POST /insights/a2a/deep-analysis`
  - Input: business metadata + `report_rows[]`
  - Output: pipeline steps, model usage, kpis, insights, action plan

## Pipeline backend
1. ClassifierAgent (DeepSeek): nhan dang loai bao cao
2. MapperAgent (DeepSeek): map cot ve schema chuan
3. PlannerAgent (DeepSeek): lap analysis plan
4. Executor (Python): tinh metric deterministic
5. NarratorAgent (Qwen): viet insight + action business
6. QualityGate: check output contract
7. GPT fallback neu fail gate/timeout

## Output contract chuan
- `model_trace[]`: buoc nao dung model nao
- `kpis`: bo so da tinh
- `insights[]`: title, severity, evidence, recommendation
- `action_plan_30_60_90`
- `fallback`: provider + reason (neu co)

## Guardrails
- Khong co evidence => khong duoc tao claim.
- JSON schema fail => retry 1 lan, sau do fallback GPT.
- Luu run trace vao DB de audit.
