# Insight Copilot - README

## 1) Bai toan thuc te
SMB thuong co du lieu marketing nam o nhieu noi:
- doanh thu theo ngay (POS/offline),
- don online (website/san),
- comment/inbox,
- chi phi ads,
- lich khuyen mai.

Van de lon nhat khong phai thieu du lieu, ma la thieu nguoi phan tich. Quyết dinh vi vay de dua vao cam tinh, den khi doanh thu giam moi phat hien.

## 2) Muc tieu tinh nang
Insight Copilot dong vai tro "analyst ao", moi ngay tra loi 3 cau hoi:
1. Dieu gi dang xay ra?
2. Tai sao no xay ra?
3. Nen hanh dong gi trong 24-72h toi?

Gia tri cho SMB:
- Giam thoi gian tong hop du lieu thu cong.
- Phat hien som van de (giam ROAS, giam conversion, ads spend bat thuong).
- Dua khuyen nghi hanh dong ro rang, co muc uu tien va tac dong uoc tinh.

## 3) Scope MVP (thuc dung)
- Ingest du lieu tu CSV/API co ban cho 5 nguon chinh (POS, orders, ads, inbox/comment, promotions).
- Tinh bo metric cot loi: revenue, orders, conversion rate, AOV, ad spend, ROAS, repeat rate.
- Rule engine phat hien bat thuong theo nguong.
- Qwen reasoner tao insight card co "evidence + recommendation + confidence".
- UI dashboard hien Top insights theo muc uu tien.

## 4) Non-goals giai doan nay
- Khong train model tu dau.
- Khong xay forecasting phuc tap da bien.
- Khong thay the BI system day du cho enterprise.

## 5) Dau ra chinh cho nguoi dung
- Daily briefing (5-8 insight cards/ngay).
- Action pack theo kenh (ads/content/ops) voi muc uu tien P1/P2/P3.
- Alert khi metric vuot nguong rui ro.

## 6) Lien ket tai lieu thiet ke
- [insight-copilot-plan.md](./insight-copilot-plan.md)
- [insight-copilot-ai-quality.md](./insight-copilot-ai-quality.md)
- [feature-reality-audit.md](./feature-reality-audit.md)
