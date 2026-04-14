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
