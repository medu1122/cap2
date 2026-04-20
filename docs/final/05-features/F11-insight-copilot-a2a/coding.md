# F11 - Insight Copilot A2A: Coding guide (chuan hoa)

## Backend

### Core files
- `api/routers/insights.py`
- `api/models/insight_report_run.py`
- `api/models/insight_agent_trace.py`
- `api/models/insight_result_snapshot.py`

### Implementation notes
- Pipeline:
  1. classify report
  2. map schema
  3. compute deterministic KPIs
  4. narrative + polish
  5. build `situations[]` + `suggested_actions[]`
- Action contract uu tien deterministic rules tu KPI + issue, LLM chi bo sung wording.
- Moi run phai luu:
  - trace tung buoc
  - model provider/model name
  - fallback reason

### Reliability
- Retry/backoff cho local model.
- Fallback sang GPT neu local timeout/fail.
- Neu ca 2 fail: van tra output toi thieu co cau truc + canh bao ro.

## Frontend

### Core files
- `web/app/(app)/insights/page.tsx`

### Implementation notes
- Parse file o client -> `report_rows`.
- Ho tro `.csv`, `.xlsx`, `.xls`.
- UI ket qua tach 3 khoi:
  - KPI + data quality
  - Insights
  - Suggested actions (co CTA tao campaign)

## Test checklist

- [ ] API tra du `kpis`, `insights`, `situations`, `suggested_actions`.
- [ ] Truong hop khong tinh duoc KPI van tra reason ro rang.
- [ ] Reanalyze khong mat source rows.

## Env checklist

- [ ] `QWEN_MODEL=qwen2.5:14b`
- [ ] `DEEPSEEK_MODEL=qwen2.5:14b`
- [ ] `OPENAI_API_KEY` da set cho fallback
- [ ] `QWEN_TIMEOUT` >= 180
