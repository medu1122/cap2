# README - Mau du lieu CSV cho Tro ly phan tich

## Muc tieu
Tai lieu nay huong dan nguoi dung Viet Nam chuan bi file CSV de nap du lieu vao tinh nang `http://localhost:3000/insights` mot cach de hieu va dung cau truc.

## File mau co san
- Duong dan tai file mau: `web/public/mau-du-lieu-tro-ly-phan-tich.csv`
- Link tren UI: nut `Tai file CSV mau` o Bước 1 - Nap du lieu.

## Cau truc cot bat buoc
| Cot | Y nghia | Vi du |
|---|---|---|
| `ngay_du_lieu` | Ngay tong hop so lieu (dinh dang YYYY-MM-DD) | `2026-04-12` |
| `kenh` | Kenh marketing/chot don | `facebook`, `zalo`, `tiktok`, `email` |
| `doanh_thu_vnd` | Tong doanh thu trong ngay theo kenh (VND) | `20100000` |
| `so_don_hang` | So don thanh cong | `141` |
| `chi_phi_quang_cao_vnd` | Tong chi phi ads theo kenh (VND) | `7900000` |
| `so_khach_tiem_nang` | So lead/comment/inbox hop le | `1520` |
| `so_don_hang_lap_lai` | So don tu khach cu quay lai | `33` |

## Quy tac file CSV
- Header phai dung dung ten cot nhu bang tren.
- Co the dung dau `;` (khuyen nghi cho Excel tieng Viet) hoac `,`.
- Khong de trong cot `ngay_du_lieu`.
- Cac cot so nen de dang so thuần (khong them chu, ky hieu).

## Quy trinh su dung tren giao dien
1. Mo trang `Trợ lý phân tích`.
2. O Bước 1, bam `Nạp dữ liệu từ CSV`.
3. Chon file CSV theo mau.
4. He thong tu nap du lieu va chay phan tich theo ngay.
5. Sang Bước 2/Bước 3 de xem insight va hang doi hanh dong.

## Goi y cho doanh nghiep nho (SMB)
- Nen tong hop du lieu moi ngay theo tung kenh chinh.
- Neu du lieu chua du, co the nap file mau de hoc cach van hanh truoc.
- Nen phan tich lai vao cuoi ngay de he thong cap nhat khuyen nghi moi nhat.
