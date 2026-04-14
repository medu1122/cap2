# F11 Coding Notes - Insight Copilot A2A

## Backend implementation notes
- Router tap trung o `api/routers/insights.py`.
- Chien luoc map cot: DeepSeek + heuristic tieng Viet de fallback.
- KPI deterministic tinh bang python de giam phu thuoc LLM.
- Luu trace theo tung step vao `insight_agent_traces`.
- Luu output snapshot de ho tro replay.

## Frontend implementation notes
- Parse file o client de thong nhat `report_rows`.
- Ho tro `.csv`, `.xlsx`, `.xls`.
- Hien preview table co pagination + vertical scroll.
- Hien data quality score dang vong tron %.
- Form va button theo quy tac giao dien goc vuong.

## Reliability notes
- Co retry ngắn cho deepseek/qwen call.
- Neu narrative fail, fallback sang GPT neu co API key.
- Neu model khong san sang, van tra deterministic output voi canh bao ro rang.
