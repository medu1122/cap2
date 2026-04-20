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

---

## 8) Dinh huong san pham moi — *Content & AI Execution* (`toanbotinhnang-updatemoi.md`)

| Muc trong tai lieu moi | Trang thai vs F04 | Giu / Bo |
|---|---|---|
| Sinh email / caption da kenh | Strategist / Writer / Critic da phu hop | **Giu** |
| Ca nhan hoa theo nhom khach | Chua co prompt injection tu segment (F10) | **Can lam moi** khi F10 co segment |

**Plan coding:**
1. Truyen them `customer_segment_summary` hoac `personalization_notes` tu API vao agent context (gioi han token).
2. Retry/backoff nhu muc 6 cu — uu tien on dinh truoc khi them bien prompt.
3. Clean code: thu gon duplicate parse JSON giua cac agent; 1 validator schema chung cho output writer.

**Khong can:** them agent thu 4 neu chua do benchmark — tang phuc tap, kho demo.

---

## 9) Cau hinh model/env khuyen nghi (VPS 12GB)

- Dinh huong: chay **mot model local manh hon** (`qwen2.5:14b`) thay vi giu dong thoi 2 model 7B/6.7B.
- Env de xuat:
  - `QWEN_MODEL=qwen2.5:14b`
  - `DEEPSEEK_MODEL=qwen2.5:14b` (backward-compatible)
  - `OPENAI_API_KEY` de fallback cho buoc can suy luan sau.
- Chinh sach dieu phoi de tranh qua tai VPS:
  1. Writer/critic uu tien local.
  2. Strategy hoac task dai -> cho phep fallback GPT khi local timeout/khong dat schema.
  3. Bat buoc log `latency`, `token_usage`, `fallback_reason` theo tung buoc.
