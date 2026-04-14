# F12 Plan - Admin Operations

## Scope
- Quan tri user co role `admin`.
- Dashboard van hanh: AI usage, workflow health, error summary.
- Workflow ops: xem failed jobs va retry.
- Audit logs cho thao tac admin.

## Kien truc de xuat
- API namespace: `/admin/users`, `/admin/usage`, `/admin/workflow-ops`, `/admin/audit`.
- Frontend namespace: `/(app)/admin/*`.
- Role guard: check `current_user.role == "admin"` tai backend va hide menu tren frontend.

## Data dependencies
- `users`, `ai_usage_stats`, `workflow_jobs`, `admin_action_logs`, `system_settings`.
