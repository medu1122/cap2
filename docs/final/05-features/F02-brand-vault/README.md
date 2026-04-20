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
| Email / SĐT / địa chỉ trên hồ sơ | Da | Cột `contact_email`, `phone`, `address` trên `brands` (migration `0007`); bắt buộc `alembic upgrade head` sau khi pull |
| Truyen context brand vao prompt AI | Da | Agent da doc thong tin thuong hieu |
| Bat buoc setup brand truoc khi tao dot quang ba | Mot phan | Co check truoc khi run, chua canh bao som tren UI tao moi |

## Viec tiep theo
- Them canh bao tren trang tao dot quang ba neu chua co brand.
- Them co che chon "brand mac dinh" ro rang khi user co nhieu brand.
- Bo sung bo test cho route `DELETE /brands/id/{id}`.

---

## Dinh huong san pham moi (`toanbotinhnang-updatemoi.md`)

Tai lieu moi khong dat ten “Brand Vault” nhung **van bat buoc ve mat ky thuat**: ca nhan hoa noi dung (§4) va chat luong email/caption can giong thuong hieu.

| Viec | Giu / Bo |
|---|---|
| Brand Vault + prompt AI | **Giu** |
| Bo Brand Vault | **Khong** — se lam lo tone khi mo rong action/email |

**Plan coding:** canh bao som tren wizard campaign + action flow; default brand khi nhieu brand.

**Clean code:** giu mot nguon `brand` inject vao agent (khong duplicate JSON thu cong o nhieu router).

## 9) Pham vi user-facing

- User tao/cap nhat ho so thuong hieu tren trang Brand Vault.
- User chon brand mac dinh (khi co nhieu brand) de cac campaign sau dung dung context.
- User nhan canh bao som neu tao campaign/action khi brand chua day du.
- Ngoai pham vi dot nay: bo trinh sua guideline nang cao theo version.

## 10) Clean code checklist

- [ ] Gom 1 ham/service de lay `active_brand_context`, tranh lap logic trong nhieu router.
- [ ] Xoa payload mapping thu cong trung lap giua BE va agent prompt.
- [ ] Chuan hoa ten field/contact metadata giua schema va UI.
- [ ] Bo sung test route xoa brand va case chon default brand.

## 11) Cau hinh env lien quan

- Khong co env dac thu rieng cho F02.
- Phu thuoc gian tiep vao model env khi prompt AI su dung brand context:
  - `QWEN_MODEL`
  - `DEEPSEEK_MODEL`
  - `OPENAI_API_KEY` (fallback)
