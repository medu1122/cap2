# 05 - Action Recommendation

## Muc tieu

Chuyen tu chi so sang hanh dong de user bam duoc ngay tren UI.

## Nguyen tac

- Action tao tu rule truoc, AI de dien giai sau.
- Moi action phai co:
  - `target_segment`
  - `goal`
  - `channel`
  - `priority`
  - `expected_impact`
  - `next_step_cta`

## Rule map co ban

- `churn_risk`:
  - Goal: kich hoat quay lai.
  - Action: uu dai giam gia, nhac lai dich vu.
  - Channel uu tien: `email`, `sms`, `zalo` (neu co).
- `vip`:
  - Goal: tang gia tri don hang va giu trung thanh.
  - Action: upsell premium, cham soc rieng.
  - Channel: `email`, `facebook_post_private`, `call`.
- `potential`:
  - Goal: day tu potential len VIP.
  - Action: combo offer, loyalty milestone.
  - Channel: `facebook_post`, `email`.
- `new`:
  - Goal: onboarding va tao lan mua tiep theo.
  - Action: chuoi onboarding 3 buoc.
  - Channel: `email`, `facebook_post`.

## Output contract (JSON)

```json
{
  "suggested_actions": [
    {
      "action_id": "act_churn_01",
      "title": "Gui uu dai quay lai cho nhom nguy co roi bo",
      "target_segment": "churn_risk",
      "priority": "high",
      "goal": "Tang so khach quay lai trong 7 ngay",
      "expected_impact": "Tang retention +8%",
      "recommended_channels": ["email"],
      "next_step_cta": {
        "label": "Tao campaign",
        "route": "/campaigns/new",
        "prefill": {
          "objective": "Re-activate churn risk",
          "source_customer_segment": "churn_risk"
        }
      }
    }
  ]
}
```

## UI goi y

- Block `Hanh dong de xuat` voi max 3 action uu tien cao.
- Moi action co 1 dong mo ta + 1 CTA chinh.
- Nut phu: `Xem them`, `An action da xu ly`.

## Acceptance checklist

- [ ] Moi segment co it nhat 1 action co the bam.
- [ ] CTA tao campaign chuyen route + prefill dung.
- [ ] Priority phan bo hop ly theo metric hien tai.
