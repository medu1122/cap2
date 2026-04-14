# F04 - Multi-Agent Orchestrator

## 1) Bai toan thuc te
SMB can noi dung da kenh nhanh, dung giong thuong hieu, nhung khong co doi content rieng. Tinh nang nay tu dong hoa theo chuoi Strategist -> Writer -> Critic de dam bao vua nhanh vua co chat luong.

## 2) Tai lieu lien quan
- [plan.md](./plan.md)
- [coding.md](./coding.md)
- [test.md](./test.md)

## 3) Core code locations
- Orchestration: `agent/orchestrator.py`
- Agents: `agent/agents/strategist.py`, `agent/agents/writer.py`, `agent/agents/critic.py`
- LLM router: `agent/llm/router.py`
- LLM clients: `agent/llm/openai_client.py`, `agent/llm/qwen_client.py`
- Log receiver: `api/routers/internal.py`

## 4) Actual status (2026-04)
| Hang muc | Status | Ghi chu |
|---|---|---|
| Chay dung chuoi 3 agent | done | Theo campaign va tung channel |
| Dinh tuyen model theo vai tro | done | Writer uu tien Qwen, co fallback |
| Retry parse JSON co ban | done | Moi agent co xu ly parse loi |
| Retry cap request model | partial | Chua bao phu tot loi mang/tam thoi |
| Token usage tracking day du | partial | Co field, can chuan hoa ghi nhan |

## 5) Gap / risk hien tai
- Loi tam thoi tu model provider van co the lam hong luong campaign.
- Chat luong log chua dong nhat, kho root-cause khi can debug nhanh.

## 6) Next steps de hoan thien
- Them retry/backoff cap model request voi timeout, retry budget, idempotency key.
- Chuan hoa output contract + schema validation truoc khi luu vao DB.
- Bo sung test bo prompt loi (malformed JSON, missing fields, hallucinated keys).

## 7) Acceptance checklist
- [ ] Luong khong vo campaign khi model tra loi xau 1-2 lan.
- [ ] Moi buoc agent co log ro input version, output status, token va error reason.
- [ ] Ket qua cuoi cung pass schema validation truoc khi tra ve API.
