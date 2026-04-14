# F12 - Admin Operations

## 1) Bai toan thuc te
Khi he thong co nhieu user va workflow AI, can co vai tro admin de giam sat suc khoe he thong, xu ly su co va audit thao tac van hanh.

## 2) Tai lieu lien quan
- [plan.md](./plan.md)
- [coding.md](./coding.md)
- [test.md](./test.md)

## 3) Core code locations
- Admin docs tong quan: `docs/final/06-update/admin-overview-readme.md`
- Admin backend docs: `docs/final/06-update/admin-backend-readme.md`
- Admin frontend docs: `docs/final/06-update/admin-frontend-readme.md`
- Bang du lieu: `admin_action_logs`, `system_settings` (xem `02-architecture/database-overview.md`)

## 4) Actual status (2026-04)
| Hang muc | Status | Ghi chu |
|---|---|---|
| User lock/unlock | backlog | Chua co endpoint runtime |
| AI usage dashboard admin | backlog | Chua co page tong hop rieng cho admin |
| Workflow failed jobs retry | backlog | Chua co luong admin retry |
| Audit logs admin action | partial | Bang DB da co, can wiring runtime |

## 5) Gap / risk hien tai
- Khong co dashboard van hanh trung tam cho admin.
- Su co workflow/model hien xu ly thu cong, kho truy vet.

## 6) Next steps de hoan thien
- Tao namespace `/admin/*` tren API va web.
- Bo sung event log cho moi thao tac nhay cam.
- Them role guard `admin` cho endpoint va page.

## 7) Acceptance checklist
- [ ] Admin xem duoc he thong usage va health.
- [ ] Admin lock/unlock duoc user.
- [ ] Admin retry duoc workflow jobs loi.
- [ ] Tat ca thao tac admin duoc ghi audit log.
