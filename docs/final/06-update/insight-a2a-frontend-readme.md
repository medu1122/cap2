# Insight A2A Frontend README

## UX flow moi
1. Upload 1-sheet CSV/Excel (`.csv/.xlsx/.xls`)
2. Xem preview toan bo sheet dang table
3. Bam Phan tich va theo doi overlay model dang chay theo o vuong + %
4. Xem ket qua AI phan tich + diem chat luong du lieu + bang ket qua da luu
5. Open/reanalyze run cu

## Thanh phan UI chinh
- Upload box (drag/drop + template download)
- Sheet preview table (show header + rows)
- Loading overlay:
  - Chuoi o vuong theo buoc
  - Ten model tung buoc
  - % tien trinh va mui ten luong
- Saved runs table: time, report type, source file, fallback, actions
- Ket qua:
  - KPI cards quy ve % va mau muc uu tien
  - Bieu do tron diem chat luong du lieu (do-vang-xanh)
  - Insight cards
  - Canh bao va han che phan tich (neu du lieu thieu)

## Nhanh gon cho user SMB
- Van ban tieng Viet day du dau.
- An thong tin ky thuat gay nhieu nhu run id, mapping tho, loi HTTP raw.
- Moi insight phai tra loi: "Van de gi?" + "Nen lam gi ngay?".
