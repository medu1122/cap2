# DeepSeek A2A Feasibility (DeepSeek + Qwen + GPT fallback)

## 1) Muc tieu
- Xac nhan kien truc DeepSeek Coder 6.7B + Qwen 2.5 7B + GPT fallback co kha thi voi do an capstone.
- Dam bao nguoi dung SMB upload 1 sheet CSV van nhan duoc ket qua huu dung, de hieu, co hanh dong.

## 2) Kha thi ky thuat
- **Ha tang hien co**: du an da co `api` (FastAPI), `web` (Next.js), `docker compose`, router LLM va `/insights`.
- **Mo rong model router**: co the them route:
  - DeepSeek: classify loai bao cao, map cot, lap ke hoach phan tich.
  - Qwen: dien giai ket qua, viet khuyen nghi theo business language.
  - GPT: fallback khi timeout/schema fail/do phuc tap qua nguong.
- **Du lieu CSV da dang**: kha thi o muc capstone bang header mapping + heuristic, khong can huan luyen model moi.
- **Rui ro chinh**:
  - Sai map cot khi CSV xau.
  - Latency tang neu chain qua nhieu buoc.
  - Hallucination neu bo guardrails.
- **Giam rui ro**:
  - Bat buoc output contract JSON.
  - Confidence gate + evidence gate.
  - Retry/fallback co log ly do.

## 3) Kha thi van hanh
- **Persona SMB**: chu shop/coordinator chi co file bao cao Excel/CSV, khong co team data.
- **Flow toi thieu**:
  1. Upload 1 sheet CSV.
  2. He thong nhan dang loai bao cao.
  3. Tra ve 3-5 insight + action 30/60/90 ngay.
- **Dieu kien de co ket qua huu dung**:
  - Co cot ngay + it nhat 2 cot gia tri so.
  - Toi thieu 20 dong data.
  - Khong can schema tuyet doi, nhung can cot du lieu co y nghia kinh doanh.

## 4) Kha thi capstone
- **Trong pham vi lam duoc**:
  - 1 sheet/lan upload.
  - 3-5 loai bao cao pho bien (doanh thu, chi phi, luong, ton kho co ban, tong hop).
  - Hien thi A2A pipeline + model dang chay tren UI.
  - Luu trace/fallback de demo minh bach.
- **De phase sau**:
  - Multi-sheet parser.
  - Fine-tune domain model.
  - Dashboard BI nang cao + forecasting.

## 5) Ket luan kha thi
- Kien truc DeepSeek + Qwen + GPT fallback **kha thi cho capstone** neu giu dung nguyen tac:
  - facts-first,
  - output contract nghiem ngat,
  - confidence/fallback gate ro rang.
- Huong nay tao gia tri thuc te hon cho SMB: phan tich bao cao va dua hanh dong cu the, khong chi tao content.
