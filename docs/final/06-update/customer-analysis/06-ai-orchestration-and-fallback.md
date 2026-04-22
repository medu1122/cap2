# 06 - AI Orchestration va Fallback

## Cau hoi chinh: co can 2 AI local khong?

Khong can. Voi VPS 12GB, chien luoc on dinh la:

- 1 model local chinh: `qwen2.5:14b`
- 1 fallback cloud: OpenAI GPT

KPI tinh toan va segmentation khong dung AI.

## Phan bo vai tro

- **Rule Engine (non-AI):**
  - Tinh metrics value/retention/churn/segment.
  - Sinh base actions theo mapping.
- **Local AI (`qwen2.5:14b`):**
  - Dien giai ket qua (narrative ngan).
  - Chuyen base action thanh copy de hieu.
- **GPT fallback:**
  - Chi goi khi local timeout/loi/quality fail.

## Luong xu ly

1. Tinh metrics deterministic.
2. Validate contract structure.
3. Goi local AI de dien giai.
4. Chay quality gate (do dai, schema, key phrase).
5. Neu fail -> fallback GPT.
6. Tra output cuoi + metadata model.

## Fallback policy

- Retry local toi da 1 lan voi timeout ngan hon.
- Dieu kien fallback:
  - timeout
  - HTTP error
  - output khong dung schema
  - quality score < nguong
- Bắt buộc log:
  - `model_used`
  - `fallback_used`
  - `fallback_reason`
  - `latency_ms`

## Output metadata bat buoc

```json
{
  "ai_meta": {
    "model_used": "qwen2.5:14b",
    "fallback_used": false,
    "fallback_reason": null,
    "generation_latency_ms": 1220
  }
}
```

## Acceptance checklist

- [ ] KPI khong thay doi khi tat AI.
- [ ] Fallback kich hoat dung dieu kien.
- [ ] Log du de debug chat luong va chi phi.
