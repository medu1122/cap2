# README - Vai tro Admin trong AIMAP

## Muc tieu

Tai lieu nay dinh nghia ro vai tro `admin` trong AIMAP va pham vi tac dong den he thong thuc te.

## Tai sao can Admin

- Van hanh an toan khi so luong user tang.
- Kiem soat chi phi AI (token, model, fallback).
- Co diem kiem soat chat luong va xu ly su co.
- Co audit trail phuc vu bao cao va truy vet loi.

## Gia tri thuc te cua Admin

1. **Quan tri nguoi dung**
   - Khoa/mo tai khoan.
   - Dat lai mat khau khi user gap su co.
   - Theo doi user dang hoat dong.
2. **Giam sat AI**
   - Xem tong token theo ngay/tuần/thang.
   - Xem campaign nao dung nhieu token bat thuong.
   - Kiem soat fallback Qwen/OpenAI.
3. **Quan tri Workflow**
   - Theo doi workflow job loi.
   - Retry thu cong cac job quan trong.
4. **Audit va bao cao**
   - Log hanh dong admin.
   - Truy vet ai da thay doi gi, vao luc nao.

## Nguyen tac trien khai

- Admin la vai tro van hanh, khong can duoc can thiep vao noi dung user neu khong co ly do.
- Tat ca hanh dong admin co tac dong du lieu phai duoc log.
- Giao dien admin tach khoi user workspace de tranh nham luong.
