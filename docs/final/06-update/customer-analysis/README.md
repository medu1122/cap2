# Customer Analysis - Insight Actionable

Tai lieu nay mo ta bo phan tich danh sach customer theo huong "it chu, nhieu hanh dong", dung truc tiep cho nut `Phan tich` tren trang customer list.

## Muc tieu tong the

- Tra loi nhanh 4 cau hoi kinh doanh:
  1. Ai mang doanh thu cao nhat?
  2. Khach co quay lai khong?
  3. Ai co nguy co roi bo?
  4. Nen hanh dong gi tiep theo?
- KPI cot loi tinh theo rule-engine de dam bao tin cay.
- AI chi dung de dien giai, tom tat, va goi y cach hanh dong de user bam duoc ngay.

## Danh sach tai lieu chi tiet

- [01-customer-value.md](./01-customer-value.md)
- [02-retention.md](./02-retention.md)
- [03-churn-risk.md](./03-churn-risk.md)
- [04-segmentation.md](./04-segmentation.md)
- [05-action-recommendation.md](./05-action-recommendation.md)
- [06-ai-orchestration-and-fallback.md](./06-ai-orchestration-and-fallback.md)
- [07-ui-dashboard-spec.md](./07-ui-dashboard-spec.md)
- [08-customer-interaction-automation.md](./08-customer-interaction-automation.md)

## Luong xu ly tong quan

1. Frontend gui `report_rows` tu list user hien tai.
2. Backend normalize + validate cot du lieu.
3. Metric engine tinh KPI value/retention/churn/segment.
4. Action engine tao danh sach hanh dong theo rule.
5. LLM tao narrative ngan gon + muc uu tien.
6. Tra ve contract JSON de render dashboard.

## Nguyen tac implementation

- Uu tien output co cau truc, khong tra ve doan van dai.
- Kiem soat fallback model co ly do va co log.
- Tat ca chi so phai co don vi ro rang (`%`, `VND`, `khach`).
- Moi khoi UI phai co CTA tiep theo de user thao tac ngay.
