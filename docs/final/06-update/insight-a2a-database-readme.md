# Insight A2A Database README

## Muc tieu schema moi
- Luu du metadata cua file bao cao upload.
- Luu mapping schema da duoc AI chuan hoa.
- Luu trace tung buoc A2A + model su dung.
- Luu snapshot ket qua + ly do fallback.

## Nhom bang
- `insight_report_runs`: run-level metadata
- `insight_report_schema_maps`: mapping header goc -> canonical key
- `insight_agent_traces`: step, model, status, duration, tokens
- `insight_result_snapshots`: JSON output contract cho moi run

## Quy tac audit
- Moi run phai co it nhat 1 trace step.
- Neu fallback xay ra: bat buoc co `fallback_reason`.
- Khong xoa trace trong MVP (chi soft status).
