# F02 — Brand Vault

## Muc dich
Tinh nang nay luu ho so thuong hieu de AI viet noi dung dong nhat theo giong van, doi tuong va thong diep cua doanh nghiep.

## Tai lieu trong thu muc
- [plan.md](./plan.md)
- [coding.md](./coding.md)
- [test.md](./test.md)

## Vi tri ma nguon chinh
- `api/routers/brands.py`
- `api/models/brand.py`
- `api/schemas/brand.py`
- `web/app/(app)/brand-vault/page.tsx`
- `agent/agents/base.py`

## Trang thai thuc te (kiem tra 2026-04-14)
| Hang muc | Trang thai | Ghi chu |
|---|---|---|
| Tao, cap nhat, xoa va liet ke nhieu brand | Da | API da ho tro danh sach va thao tac theo id |
| Form nhap thong tin brand | Da | Giao dien da co trong app |
| Truyen context brand vao prompt AI | Da | Agent da doc thong tin thuong hieu |
| Bat buoc setup brand truoc khi tao dot quang ba | Mot phan | Co check truoc khi run, chua canh bao som tren UI tao moi |

## Viec tiep theo
- Them canh bao tren trang tao dot quang ba neu chua co brand.
- Them co che chon "brand mac dinh" ro rang khi user co nhieu brand.
- Bo sung bo test cho route `DELETE /brands/id/{id}`.
