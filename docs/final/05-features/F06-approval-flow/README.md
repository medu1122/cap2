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
