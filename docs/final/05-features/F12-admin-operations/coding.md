# F12 Coding Notes - Admin Operations

## Backend
- Them dependency role guard cho admin endpoints.
- Tiep can an toan: moi thao tac lock/unlock/retry deu ghi `admin_action_logs`.
- Admin usage service can tong hop theo ngay/thang va theo model provider.

## Frontend
- Sidebar hien menu admin chi khi role = `admin`.
- Cac trang admin tach nhe: users, usage, workflow ops, audit logs.
- UI uu tien bang va filter nhanh de truy vet su co.

## Security
- Khong expose endpoint admin cho user role thong thuong.
- Khong hien payload nhay cam trong audit log UI.
