# F11 - Insight Copilot A2A

## 1) Bai toan thuc te
SMB co nhieu file bao cao roi rac (doanh thu, chi phi, lead, don hang) nhung khong du thoi gian va ky nang de phan tich. F11 giai bai toan "nap file 1 lan, nhan ket qua phan tich de hanh dong".

## 2) Tai lieu lien quan
- [plan.md](./plan.md)
- [coding.md](./coding.md)
- [test.md](./test.md)

## 3) Core code locations
- API A2A: `api/routers/insights.py`
- Insight models: `api/models/insight_report_run.py`, `api/models/insight_report_schema_map.py`, `api/models/insight_agent_trace.py`, `api/models/insight_result_snapshot.py`
- Migration: `api/alembic/versions/0006_insight_a2a_run_tables.py`
- UI page: `web/app/(app)/insights/page.tsx`
- Sample files: `web/public/mau-du-lieu-tro-ly-phan-tich.csv`, `web/public/dulieumauPhantich.xlsx`

## 4) Actual status (2026-04)
| Hang muc | Status | Ghi chu |
|---|---|---|
| Upload CSV | done | Parse va preview du lieu tren UI |
| Upload Excel (.xlsx/.xls) | done | Parse sheet 1 qua `xlsx` tren frontend |
| Deep analysis API | done (MVP) | Classify/map/compute/narrative/fallback |
| Data quality score + limitations | done | Hien thi % + canh bao + han che phan tich |
| Run history + reanalyze | done | Co `GET result` va `POST reanalyze` |
| Hardening model reliability | partial | Van phu thuoc ha tang model VPS |

## 5) Gap / risk hien tai
- Chat luong output phu thuoc vao tinh san sang cua DeepSeek/Qwen.
- Khi model VPS thieu RAM hoac die, ket qua se fallback va giam do sau.

## 6) Next steps de hoan thien
- Bo sung health-check model truoc khi bat dau run.
- Them quality gate chat hon cho insight text (chong hallucination).
- Mo rong mapping schema cho nhieu loai bao cao ke toan/tai chinh.

## 7) Acceptance checklist
- [ ] Upload CSV/Excel thanh cong va preview dung cot.
- [ ] Pipeline hien thi ro step/model/status.
- [ ] Ket qua co KPI + data quality score + limitations.
- [ ] Run history co the xem lai va phan tich lai.
