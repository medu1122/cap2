# F03 - Campaign Brief Intake

## 1) Bai toan thuc te
SMB thuong mo ta campaign bang cach roi rac (chat, ghi chu, file). Tinh nang nay chuan hoa brief thanh du lieu co cau truc de he thong tao campaign va goi AI nhat quan.

## 2) Tai lieu lien quan
- [plan.md](./plan.md)
- [coding.md](./coding.md)
- [test.md](./test.md)

## 3) Core code locations
- Backend API: `api/routers/campaigns.py`
- Schema validation: `api/schemas/campaign.py`
- AI dispatch: `api/services/agent_dispatcher.py`
- Frontend form: `web/app/(app)/campaigns/new/page.tsx`
- Database model: `api/models/campaign.py`

## 4) Actual status (2026-04)
| Hang muc | Status | Ghi chu |
|---|---|---|
| Tao campaign tu form | done | Luu campaign va tra ve id |
| Validate channels hop le | done | Router kiem tra theo danh sach cho phep |
| Validate deadline khong qua khu | done | Da check o luong tao |
| Kich AI ngay sau khi tao | partial | Co luong run/background, can harden xu ly loi |
| Tao/upload anh campaign | done | Uu tien Cloudinary; fallback local neu chua cau hinh |
| UX thong bao loi cho user | partial | Can thong diep de hieu hon o form |

## 5) Gap / risk hien tai
- Loi dispatch AI de roi vao trang thai khong ro nguyen nhan voi user.
- Validation can giu dong bo giua schema, router va UI de tranh lech hanh vi.
- Neu deploy ma thieu `CLOUDINARY_*`, he thong se fallback local storage.

## 6) Next steps de hoan thien
- Chuan hoa bo message loi theo nhom (validation, dispatch, external model).
- Bo sung API tests cho case deadline qua khu, channel sai, missing fields.
- Them hint tren UI khi campaign tao xong nhung AI run bi tre/that bai.

## 7) Acceptance checklist
- [ ] User tao duoc campaign voi dau vao hop le.
- [ ] Input sai duoc bao loi ro ngay tren form.
- [ ] Campaign van duoc theo doi dung trang thai neu AI dispatch co van de.

---

## 8) Dinh huong san pham moi — *Campaign + Smart Planner + Execution* (`toanbotinhnang-updatemoi.md`)

| Muc trong tai lieu moi | Trang thai vs F03 | Giu / Bo |
|---|---|---|
| §4 Tao noi dung email / caption (AI) | Luong brief -> F04 da phu hop | **Giu** |
| §5 Smart Campaign Planner (goi y lich theo rule khach) | Brief + deadline co; **chua** goi y lich tu segment inactive/VIP | **Can lam moi** (gan F07 + F10) |
| §4 / §6 Hinh anh | Tao/upload anh campaign da co (Cloudinary / local) | **Giu**; mo rong “caption tu anh” la optional sau |

**Plan coding:**
1. Optional fields campaign: `source_insight_run_id`, `source_customer_segment` (JSON) de trace “tu dau ra campaign”.
2. Wizard buoc 2: “Goi y lich” — doc rule tu F10 segment + map sang `scheduled_date` goi y (user confirm).
3. Clean code: thong nhat message loi validation (api + fe); xoa dead code path preview anh neu khong dung.

**Khong can:** mo hinh “template campaign” phuc tap neu chua co user test — uu tien noi insight + segment truoc.

## 9) Pham vi user-facing

- User tao campaign tu form brief co cau truc.
- User co the tao campaign tu action goi y (insight/segment) thay vi nhap tu dau.
- User thay ro trang thai campaign neu AI dispatch tre/that bai.
- Ngoai pham vi dot nay: builder template campaign phuc tap.

## 10) Clean code checklist

- [ ] Chuan hoa 1 format error response cho validation + dispatch.
- [ ] Tach logic mapping payload campaign tu form/action thanh service dung chung.
- [ ] Xoa code path media preview khong con dung (neu co).
- [ ] Dong bo enum/channel list giua FE form va BE schema.

## 11) Cau hinh env lien quan

- Media:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
- Model dispatch/fallback:
  - `QWEN_MODEL=qwen2.5:14b`
  - `DEEPSEEK_MODEL=qwen2.5:14b` (compat)
  - `OPENAI_API_KEY`
