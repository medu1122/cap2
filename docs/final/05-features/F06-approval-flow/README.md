# F06 - Approval Flow

## 1) Bai toan thuc te
Noi dung AI can "human-in-the-loop" truoc khi dang de tranh sai thuong hieu, sai thong tin, hoac tone khong phu hop. Approval flow giup SMB kiem soat rui ro truoc khi xuat ban.

## 2) Tai lieu lien quan
- [plan.md](./plan.md)
- [coding.md](./coding.md)
- [test.md](./test.md)

## 3) Core code locations
- Approval APIs: `api/routers/content.py`
- Campaign detail review UI: `web/app/(app)/campaigns/[id]/page.tsx`
- Pending approve page: `web/app/(app)/approve/page.tsx`
- Related campaign status: `api/models/campaign.py`

## 4) Actual status (2026-04)
| Hang muc | Status | Ghi chu |
|---|---|---|
| Approve/Reject content | done | Endpoint va UI da co |
| Reject note | done | Luu ly do reject |
| Edit tao version moi | done | Khong ghi de ban cu |
| Auto update campaign status khi duyet xong | partial | Da co logic co ban, can harden edge cases |
| Approval history theo nguoi duyet | missing | Chua co bang/luong audit day du |

## 5) Gap / risk hien tai
- Nhieu version trong cung campaign co the gay khong ro status "hoan tat".
- Chua co approval audit history day du cho nhu cau truy vet.

## 6) Next steps de hoan thien
- Chuan hoa state machine campaign/content de tranh xung dot trang thai.
- Them approval history model + API query timeline.
- Bo sung test scenario: approve het, reject va edit, approve lai ban moi.

## 7) Acceptance checklist
- [ ] Duyet/tu choi hoat dong dung voi tung status hop le.
- [ ] Campaign duoc cap nhat dung trang thai khi tat ca content hop le.
- [ ] Co du lich su ai duyet gi, khi nao, va ly do lien quan.

---

## 8) Dinh huong san pham moi — *Human gate truoc khi gui / dang* (`toanbotinhnang-updatemoi.md`)

| Muc §4 | Trang thai | Giu / Bo |
|---|---|---|
| Duyet / reject / sua truoc trien khai | Da co | **Giu** |
| Gui email sau duyet | Chua ro trong product — can tich hop SMTP marketing tach reminder | **Mo rong sau F06** |

**Plan coding:** state machine ro “approved -> ready_to_send” (neu co SMTP); approval history (muc 6 cu) nen lam truoc khi mo gui hang loat.

**Khong can:** skip auto-approve — trai voi SMB kiem soat rui ro.

## 9) Pham vi user-facing

- User duyet/tu choi/sua noi dung truoc khi dua vao ke hoach xuat ban.
- User xem ly do reject va lich su thao tac de truy vet.
- User thay trang thai campaign cap nhat dong bo khi duyet xong.
- Ngoai pham vi dot nay: auto-approve khong can thao tac nguoi dung.

## 10) Clean code checklist

- [ ] Chuan hoa state machine campaign/content trong 1 noi khai bao.
- [ ] Tach approval history writer thanh service, tranh ghi log phan tan.
- [ ] Xoa logic cap nhat status trung lap giua router/content service.
- [ ] Bo sung test edge case approve lai sau khi edit version moi.

## 11) Cau hinh env lien quan

- Neu mo rong gui email sau duyet se dung:
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`
- Dot hien tai uu tien hoan thien state machine + audit truoc khi mo SMTP bulk.
