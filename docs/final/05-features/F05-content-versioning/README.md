# F05 - Content Storage and Versioning

## 1) Bai toan thuc te
SMB can sua noi dung AI de phu hop nganh hang va ngu canh thuc te. He thong phai giu lich su phien ban de tranh mat ban cu va de audit khi can.

## 2) Tai lieu lien quan
- [plan.md](./plan.md)
- [coding.md](./coding.md)
- [test.md](./test.md)

## 3) Core code locations
- Data model: `api/models/content_item.py`
- User actions: `api/routers/content.py`
- Agent write path: `api/routers/internal.py`
- Campaign detail UI: `web/app/(app)/campaigns/[id]/page.tsx`

## 4) Actual status (2026-04)
| Hang muc | Status | Ghi chu |
|---|---|---|
| Luu content theo campaign/channel | done | Co version, source, schedule fields |
| Edit tao version moi | done | Tao row moi, giu ban cu |
| API version history | partial | Co du lieu, can endpoint/view de dung manh hon |
| UI xem lich su day du | partial | Trang detail chu yeu hien ban moi nhat |
| So sanh diff giua 2 version | missing | Chua co cong cu so sanh |

## 5) Gap / risk hien tai
- Nguoi dung kho truy vet ly do thay doi neu khong co view lich su ro rang.
- Khong co diff view se lam review va approval cham hon.

## 6) Next steps de hoan thien
- Them panel lich su theo channel, co metadata nguoi sua/thoi gian/nguon.
- Ho tro so sanh 2 version lien tiep (text diff toi gian).
- Bo sung test cho edit flow + list versions + permission boundaries.

## 7) Acceptance checklist
- [ ] Moi lan edit tao version moi va khong ghi de du lieu cu.
- [ ] User xem duoc danh sach cac version da co.
- [ ] Co the doc nhanh ai sua gi, khi nao, va noi dung thay doi ra sao.

---

## 8) Dinh huong san pham moi (`toanbotinhnang-updatemoi.md`)

| Muc §4 (chinh sua noi dung truoc khi gui/dang) | Trang thai | Giu / Bo |
|---|---|---|
| Luu phien ban, edit truoc approve | Da co core | **Giu** |

**Plan coding:** uu tien UI lich su version + diff nhe (da ghi trong muc 6) — ho tro user kiem soat noi dung truoc “execution” (gui mail / dang).

**Khong can:** diff visual cuc phuc tap (syntax highlight) — MVP text diff la du.

## 9) Pham vi user-facing

- User xem danh sach version cua noi dung theo campaign/channel.
- User xem thay doi giua 2 version lien tiep de de quyet dinh approve.
- User biet ro ai sua va sua luc nao.
- Ngoai pham vi dot nay: cong cu merge/noi dung da nhanh phuc tap.

## 10) Clean code checklist

- [ ] Tach response mapper cho history/version de FE dung 1 contract.
- [ ] Xoa duplicate query "latest version" trong router.
- [ ] Dat ten status/source thong nhat giua content va approval.
- [ ] Bo sung test permission boundaries cho version history.

## 11) Cau hinh env lien quan

- Khong co env rieng cho F05.
- Phu thuoc gian tiep vao env model khi tao version tu AI output.
