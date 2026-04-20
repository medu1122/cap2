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

---

## 8) Dinh huong san pham moi — *Data Insight + AI Action* (`toanbotinhnang-updatemoi.md`)

| Muc trong tai lieu moi | Trang thai vs F11 | Giu / Bo |
|---|---|---|
| §1 Data Insight Engine (upload, KPI, insight, phat hien van de) | Da co MVP (upload, pipeline, ket qua, quality score) | **Giu**, mo rong sau |
| §3 AI Action Engine — bien insight thanh hanh dong | Chua co nut/workflow “Generate Action Plan” noi insight -> campaign/goi y cu the | **Can lam moi** (lien F10/F03) |

**Plan coding (thu tu goi y):**
1. Chuan hoa output contract: them block JSON `situations[]` + `suggested_actions[]` (neu model cho phep) hoac rule-based tu KPI da tinh — tranh nhan insight chi la van ban dai.
2. API: `POST /insights/.../actions` hoac mo rong response snapshot de FE hien “hanh dong de xuat”.
3. UI `/insights`: panel “Han dong de xuat” + CTA “Tao campaign tu insight” (goi F03/F10 tuy luong).
4. Clean code: bo duplicate logic preview/parse neu da gom vao 1 hook/service; giu 1 nguon that cho “data quality + limitations”.

**Khong can:** lap lai man hinh phan tich day du tren Dashboard (F08 da tach vai tro); tranh 2 noi cung mot pipeline insight.

---

## 9) Cau hinh model/env khuyen nghi (VPS 12GB)

- Muc tieu van hanh: **1 model local chinh** + **OpenAI fallback**.
- Gia tri env khuyen nghi:
  - `QWEN_MODEL=qwen2.5:14b`
  - `DEEPSEEK_MODEL=qwen2.5:14b` (giu de tuong thich code insights hien tai)
  - `QWEN_TIMEOUT=180` (co the tang 240 neu run dai)
  - `OPENAI_API_KEY=<your_key>` de fallback cho run phuc tap/timeout local
- Rule runtime:
  1. Uu tien local model cho classify/map/compute.
  2. Neu local fail/timeout hoac output kem chat luong -> fallback GPT.
  3. Luu `model_used` va `fallback_reason` de debug/chat luong.
