# F11 Plan - Insight Copilot A2A

## Scope
- Input: 1 file CSV hoac Excel (1 sheet).
- Process: classify report -> map columns -> compute metrics -> narrative -> fallback neu can.
- Output: KPI, insights, data quality score, limitations, run trace.

## API contracts
- `POST /insights/a2a/deep-analysis`
- `GET /insights/a2a/runs`
- `GET /insights/a2a/runs/{run_id}/result`
- `POST /insights/a2a/runs/{run_id}/reanalyze`

## Data contracts (response chinh)
- `report_type_vi`
- `kpis`
- `friendly_model_trace`
- `data_quality_score`
- `data_quality_breakdown`
- `limitations`
- `fallback.user_message`

## UI contracts
- Form nap du lieu va preview sheet.
- Overlay pipeline dang chay (step/model/%).
- Panel ket qua AI phan tich.
- Bang run da luu + nut xem/phan tich lai.
