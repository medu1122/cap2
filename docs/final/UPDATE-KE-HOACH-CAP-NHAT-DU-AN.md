# Ke hoach cap nhat du an (ban moi nhat)

Tai lieu nay tong hop toan bo cong viec can lam de cap nhat du an theo dinh huong moi trong `docs/final/toanbotinhnang-updatemoi.md`, doi chieu voi he thong hien tai trong `docs/final/05-features`.

---

## 0) Cap nhat ha tang model (VPS 12GB)

- Cau hinh da chot:
  - Local primary: `qwen2.5:14b`
  - API fallback: OpenAI GPT (qua `OPENAI_API_KEY`)
- Khong can giu 2 model local cung luc tren VPS 12GB (de tranh swap/cham/oome).
- De tuong thich code hien tai, co the dat ca:
  - `QWEN_MODEL=qwen2.5:14b`
  - `DEEPSEEK_MODEL=qwen2.5:14b`
- Khi coding:
  1. Uu tien local cho task thuong.
  2. Fallback GPT cho task phuc tap / timeout / low-quality output.
  3. Bat buoc log model da dung + fallback reason.

---

## 1) Muc tieu cap nhat

- Chuyen trong tam tu "chi phan tich / chi tao content" sang "Data -> Action -> Execution".
- Giu cac luong dang chay on dinh, tranh dap di lam lai.
- Bo sung cac diem con thieu de user co the thao tac lien mach tu insight den campaign.
- Don code cu/dead code de source gon, de maintain.

---

## 2) Nguyen tac khi cap nhat

- Uu tien nang cap tren module san co, khong tach them nhieu file neu khong can thiet.
- Khong sua file `.env` that trong task nay.
- Khong them migration DB neu chua can; uu tien runtime rule truoc.
- Moi tinh nang phai co: API ro rang, UI su dung duoc, test toi thieu.
- Tach ro vai tro man hinh:
  - `dashboard`: tong quan van hanh marketing
  - `insights`: phan tich du lieu va goi y hanh dong

---

## 3) Tong quan giu / mo rong / chua can

### 3.1 Giu va tiep tuc dung

- F02 Brand Vault
- F03 Campaign Brief
- F04 Agent Orchestrator
- F05 Content Versioning
- F06 Approval Flow
- F07 Marketing Calendar
- F08 Dashboard (vai tro tong quan)
- F09 Workflow Automation
- F10 Customer Lists (MVP hien tai)
- F11 Insight Copilot A2A
- F12 Admin Operations

### 3.2 Can mo rong de khop dinh huong moi

- "AI Action Engine" (noi F11 + F10 + F03 thanh 1 luong thao tac duoc).
- Segment khach hang (VIP / potential / inactive).
- Smart campaign planner rule-based tu segment.
- Nut/luong tao campaign tu insight action.

### 3.3 Chua can lam ngay (de tranh over-scope)

- CRM day du kieu enterprise (pipeline sales, ticketing...).
- ML phuc tap de toi uu gio dang bai.
- Dashboard nhan ban toan bo pipeline insight.
- He thong thiet ke hinh anh nang cao.

---

## 4) Backlog chi tiet theo feature (FE + BE)

## F11 - Insight Copilot (Data Insight -> Action)

**Can lam (BE):**
- Chuan hoa output action duoi dang may doc duoc:
  - `situations[]`
  - `suggested_actions[]`
  - `priority`
  - `expected_impact`
- Them endpoint lay/goi y hanh dong (hoac mo rong snapshot API hien tai).
- Dam bao fallback khi model loi van tra duoc output co cau truc toi thieu.

**Can lam (FE):**
- Them panel "Hanh dong de xuat" trong `/insights`.
- Them CTA:
  - "Tao campaign tu hanh dong nay"
  - "Gan voi danh sach khach hang"
- Hien thi muc do uu tien + ly do de user ra quyet dinh nhanh.

**Test can co:**
- Parse output action schema.
- Truong hop model fail/fallback.
- Reanalyze van giu duoc lich su action.

---

## F10 - Customer Lists + Notifications

**Can lam (BE):**
- Segment runtime truoc (khong bat buoc migration):
  - VIP
  - potential
  - inactive
- Chuan hoa validation import CSV:
  - duplicate email
  - format sai
  - report loi theo dong
- Chot huong notification:
  - in-app notification center (uu tien)
  - tach bai toan SMTP reminder vs email marketing

**Can lam (FE):**
- Them tabs/filter theo segment.
- Hien thi badge segment tren bang khach hang.
- Hien thi ket qua import ro: thanh cong/that bai, file loi.

**Test can co:**
- Segment tinh dung theo mau du lieu.
- Import file loi va bao loi dung dong.
- Tao campaign tu nhom khach co trace.

---

## F03 - Campaign Brief

**Can lam (BE):**
- Bo sung truong trace nguon tao campaign:
  - `source_insight_run_id` (optional)
  - `source_customer_segment` (optional)
- Chuan hoa error response de FE hien thi de hieu.

**Can lam (FE):**
- Mo rong form/wizard tao campaign tu action.
- Hien thi nguon de xuat (insight nao, segment nao).
- Canh bao som neu chua co Brand Vault.

**Test can co:**
- Tao campaign thu cong van chay binh thuong.
- Tao campaign tu insight action luu dung metadata.

---

## F07 - Marketing Calendar (Smart Planner rule-based)

**Can lam (BE):**
- Them service de xuat lich theo rule:
  - inactive -> re-engagement som
  - VIP -> cham soc dinh ky
- Them API lay de xuat lich.

**Can lam (FE):**
- Panel "De xuat lich" + nut apply nhanh.
- Cho phep apply 1 hoac nhieu item.

**Test can co:**
- Rule cho tung segment dung.
- Apply xong lich cap nhat UI + DB dung.

---

## F04 - Agent Orchestrator

**Can lam (BE/Agent):**
- Truyen context segment/personalization vao prompt co gioi han token.
- Retry/backoff cap request model on dinh hon.
- Chuan hoa 1 schema validator dung chung sau moi buoc quan trong.

**Can lam (FE):**
- Hien thi ro hon nguon context da dung (brand + segment + goal).

**Test can co:**
- Loi model tam thoi khong lam vo campaign.
- Output van dung schema.

---

## F05 - Content Versioning

**Can lam (BE):**
- Them endpoint/version history tot hon neu chua du.
- Ho tro metadata version day du (nguoi sua, nguon sua, thoi gian).

**Can lam (FE):**
- Hien thi panel lich su version.
- So sanh text diff don gian giua 2 ban.

**Test can co:**
- Moi lan edit tao version moi, khong ghi de.
- Diff hien thi dung noi dung thay doi.

---

## F06 - Approval Flow

**Can lam (BE):**
- Chuan hoa state machine content/campaign ro rang.
- Bo sung approval history de audit.
- Chuan bi trang thai "ready_to_send" (neu mo rong email execution).

**Can lam (FE):**
- Hien thi timeline duyet (ai, khi nao, ly do).
- Giao dien de user nhan dien trang thai de tranh nham.

**Test can co:**
- Approve/reject/edit chuoi trang thai khong loi.
- Campaign status cap nhat dung khi tat ca content hop le.

---

## F08 - Dashboard

**Can lam (BE):**
- Don endpoint/widget AI summary khong con su dung.
- Toi uu cache nhe cho KPI endpoint.

**Can lam (FE):**
- Them widget dieu huong hanh dong:
  - den `/insights`
  - den `/customer-lists`
- Giu dashboard o muc tong quan, khong trung lap insight.

**Test can co:**
- KPI van dung.
- Link dieu huong dung va de hieu.

---

## F09 - Workflow Automation

**Can lam (BE):**
- Them preset workflow theo segment (vi du inactive weekly).
- Structured logs + metrics cho scheduler.

**Can lam (FE):**
- UI preset de user chon nhanh.
- Hien thi trace job theo segment/preset.

**Test can co:**
- Scheduler tao job dung lich.
- Retry/failed case co trace ro.

---

## F02 - Brand Vault

**Can lam (BE/FE):**
- Bat buoc/nhac som setup brand truoc cac luong AI quan trong.
- Co che brand mac dinh khi user co nhieu brand.

**Test can co:**
- Chua co brand -> canh bao dung cho tao campaign/action.
- Co nhieu brand -> chon mac dinh dung.

---

## F12 - Admin Operations

**Can lam (BE/FE):**
- Monitor cho insight/action/workflow:
  - failed runs
  - retry actions
  - audit logs
- Chuan bi monitor cho luong email execution neu bat dau mo rong.

**Test can co:**
- Admin xem duoc log su kien quan trong.
- Retry thao tac co ghi nhat ky day du.

---

## 5) Thu tu trien khai de giam rui ro

### Phase 1 - Nen du lieu va mapping action

1. F10 segment runtime + import validation.
2. F11 output action schema + panel de xuat hanh dong.
3. F03 nhan metadata tu insight/segment khi tao campaign.

### Phase 2 - Execution va lap ke hoach

4. F07 de xuat lich rule-based.
5. F04 personalization context theo segment.
6. F06 state machine + approval history.
7. F05 version history + diff don gian.

### Phase 3 - Van hanh, toi uu, don code

8. F08 don dashboard + widget dieu huong.
9. F09 preset workflow theo segment + logs/metrics.
10. F12 bo sung monitor/audit cho luong moi.

---

## 6) Cong viec clean code bat buoc

- Xoa hoac tach dead code/route UI khong con dung (dac biet AI summary cu o dashboard neu con sot).
- Gom logic parse/validate trung lap (customer import, insight parse).
- Chuan hoa error shape API de FE xu ly thong nhat.
- Chuan hoa naming status/state giua campaign/content/workflow.
- Bo sung comment ngan cho logic kho (tieng Viet), tranh comment thua.

---

## 7) Definition of Done (DoD) cho dot cap nhat

- User co the di het luong:
  1) Upload data / co customer list
  2) Nhan action de xuat
  3) Tao campaign tu action
  4) AI tao content + user duyet
  5) Len lich va theo doi
- Moi module co test toi thieu cho happy path + error path quan trong.
- Khong con dead UI/endpoint ro rang sau khi cap nhat.
- Tai lieu `README.md` moi feature duoc cap nhat dong bo voi code thuc te.

---

## 8) Checklist thuc thi nhanh (de ban task)

- [ ] Chot API contract cho `suggested_actions`.
- [ ] Lam F10 segment runtime + UI filter.
- [ ] Lam F11 action panel + CTA tao campaign.
- [ ] Noi F03 nhan metadata nguon insight/segment.
- [ ] Lam F07 rule-based schedule suggestions.
- [ ] Harden F04 retry/backoff + output validation.
- [ ] Lam F06 approval history + state machine clean.
- [ ] Lam F05 version history + diff don gian.
- [ ] Don F08 dashboard, bo trung lap insight.
- [ ] Bo sung F09 preset workflow theo segment.
- [ ] Cap nhat monitor F12 cho luong moi.
- [ ] Chay regression test va clean code pass.

---

## 9) Chuan hoa README tung feature (de vibe coding)

Moi `docs/final/05-features/Fxx-*/README.md` nen theo cung 1 khung:

1. `Bai toan thuc te` (ngon ngu business)
2. `Pham vi user-facing` (user bam gi, thay gi)
3. `Core code locations` (FE/BE)
4. `Trang thai hien tai`
5. `Gap/risk`
6. `Plan coding` (chia BE/FE/Test)
7. `Clean code checklist` (dead code, duplicate logic, naming)
8. `Cau hinh env lien quan` (neu co)
9. `Acceptance checklist`

**Uu tien chi tiet truoc cho:** F11, F10, F03, F04, F07.  
Sau do moi nang cap tiep F05, F06, F08, F09, F12, F02.

