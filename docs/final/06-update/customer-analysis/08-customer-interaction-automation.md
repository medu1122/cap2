# 08 - Customer Interaction Automation

## Muc tieu

Tang tinh "thong minh tu dong" nhung van giu duoc kiem soat, tranh spam va tranh thao tac du thua.

## Tuong tac theo tung customer

Moi dong customer can quick actions:

- `Tao campaign` tu segment hien tai.
- `Danh dau uu tien` (pin).
- `Them ghi chu` (note ngan cho lan xu ly tiep).
- `Chuyen list` (neu can).

## Rule goi y tu dong

- Neu customer vao `churn_risk` va >60 ngay:
  - De xuat action high priority + reminder ngay.
- Neu customer `vip` nhung 30 ngay khong phat sinh:
  - De xuat luong cham soc rieng.
- Neu retention rate toan list giam manh:
  - De xuat campaign re-engagement o muc list level.

## Guardrails de tranh spam

- Cooldown theo customer:
  - Khong gui qua 1 hanh dong cung loai trong 7 ngay.
- Daily cap:
  - Gioi han so customer duoc auto-goi-y high priority moi ngay.
- Manual confirmation:
  - Action gui ra kenh that (email/sms) phai qua 1 buoc xac nhan.

## Contract event de trace

```json
{
  "customer_action_event": {
    "customer_id": "uuid-or-row-id",
    "segment": "churn_risk",
    "trigger_type": "risk_threshold_crossed",
    "recommended_action_id": "act_churn_01",
    "cooldown_blocked": false,
    "created_at": "2026-04-21T10:00:00Z"
  }
}
```

## UX de than thien

- Uu tien icon + tooltip thay vi text dai.
- Popover ngan gon:
  - Vi sao goi y?
  - Muc tac dong ky vong?
  - Nut thao tac ngay.

## Acceptance checklist

- [ ] Moi quick action co trace event.
- [ ] Guardrails cooldown hoat dong dung.
- [ ] User luon co quyen override truoc khi gui kenh that.
