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
