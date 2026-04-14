# Sprint 2 — Core AI Features

**Tuần 4–6 | Goal: Multi-Agent Orchestration + Content Pipeline + Calendar**

---

## Sprint Goal

> "Người dùng có thể tạo campaign brief và nhận nội dung AI cho 3 kênh trong vòng dưới 90 giây, sau đó duyệt và xem trên Marketing Calendar."

**Done when:**
- Tạo campaign brief → AI pipeline chạy → 3 content items xuất hiện với status `pending_approval`
- Agent Log Timeline hiển thị từng bước với tên agent, model, tokens, duration
- Approve/Reject content hoạt động, approval_history lưu đầy đủ
- User chỉnh sửa content → version mới được tạo
- Calendar tháng hiển thị content items theo ngày, click xem chi tiết được
- Brand Vault context được inject vào mọi agent prompt (kiểm tra qua logs)

---

## Sprint Backlog

| Story ID | User Story | Points | Assignee | Status |
|---|---|---|---|---|
| US-14 | Tạo campaign brief form | 5 | Dev | To Do |
| US-15 | Chọn channels để generate | 2 | Dev | To Do |
| US-16 | Set campaign deadline | 2 | Dev | To Do |
| US-17 | Lưu campaign làm template | 2 | Dev | To Do |
| US-19 | Strategist Agent: phân tích brief → campaign plan | 8 | Dev | To Do |
| US-20 | Writer Agent: viết content per channel | 8 | Dev | To Do |
| US-21 | Critic Agent: review và revise content | 5 | Dev | To Do |
| US-22 | Agent Log Timeline UI | 3 | Dev | To Do |
| US-23 | Notification khi content sẵn sàng | 2 | Dev | To Do |
| US-24 | Content versioning (version+1 khi edit) | 5 | Dev | To Do |
| US-25 | Xem version history của content | 3 | Dev | To Do |
| US-26 | Filter content by channel | 2 | Dev | To Do |
| US-27 | Approve content | 3 | Dev | To Do |
| US-28 | Reject content với note | 3 | Dev | To Do |
| US-29 | Edit content rồi approve | 5 | Dev | To Do |
| US-30 | Approval history audit trail | 2 | Dev | To Do |
| US-31 | Calendar month view với content | 5 | Dev | To Do |
| US-32 | Click ngày xem content detail | 3 | Dev | To Do |
| US-33 | Reassign scheduled date | 3 | Dev | To Do |
| US-34 | Filter calendar by channel | 2 | Dev | To Do |
| **Total** | | **73** | | |

---

## Timeline Chi tiết

### Tuần 4 — Agent Service + Campaign API

| Ngày | Task | Output |
|---|---|---|
| Ngày 22 | Agent service skeleton: FastAPI, folder structure | Agent service start trên port 8001 |
| Ngày 23 | LLM Router + OpenAI Client + Qwen Client | LLM clients test được qua script |
| Ngày 24 | Strategist Agent: prompt template + parse CampaignPlan | Unit test strategist với mock LLM |
| Ngày 25 | Writer Agent: 3 channel templates (facebook, email, video) | Unit test writer per channel |
| Ngày 26 | Critic Agent: review prompt + parse issues | Unit test critic |
| Ngày 27 | Orchestrator: state machine + agent logs + callbacks | Integration test end-to-end |
| Ngày 28 | Campaign API: POST /campaigns, dispatch to agent | API test: create campaign → agent runs |

### Tuần 5 — Content, Approval, Campaign UI

| Ngày | Task | Output |
|---|---|---|
| Ngày 29 | Internal API: /internal/content, /internal/campaigns/{id}, /internal/agent-logs | Agent callback test |
| Ngày 30 | Content API: GET /content?status=, PATCH /content/{id}/approve, /reject | Approval API test |
| Ngày 31 | Content versioning: PUT /content/{id} tạo version mới | Versioning test |
| Ngày 32 | Campaigns page: list + create form | Form submit hoạt động |
| Ngày 33 | Campaign detail page: status polling + agent log timeline | Timeline hiển thị real-time |
| Ngày 34 | Approve page: content queue + approve/reject/edit | Full approval flow UI |
| Ngày 35 | Approval history panel | History audit trail visible |

### Tuần 6 — Calendar + Integration + Polish

| Ngày | Task | Output |
|---|---|---|
| Ngày 36–37 | Calendar API: GET /calendar?month=&year=, PATCH schedule-date | Calendar data API |
| Ngày 38–39 | Calendar page: month grid, color dots, sidebar panel | Calendar renders đúng |
| Ngày 40 | Date reassign UX (date picker trong calendar) | Drag/pick date → API call |
| Ngày 41 | End-to-end integration test: brief → approve → calendar | Full flow in < 90s |
| Ngày 42 | Bug fixes + Sprint Review + Retrospective | Sprint 2 done |

---

## Definition of Done (Sprint 2, nâng chuẩn)

- [ ] Agent pipeline pass integration test: 1 campaign → 3 content items created
- [ ] Brand Vault data xuất hiện trong agent prompt (verify qua agent_run_logs.prompt_preview)
- [ ] Tất cả agent steps có agent_run_log record với tokens + duration
- [ ] Approval: approve/reject/edit đều tạo approval_history record
- [ ] Calendar: content item có scheduled_date xuất hiện đúng ngày
- [ ] Không có unhandled exceptions trong agent service (chỉ graceful failure → campaign status='failed')
- [ ] API latency cho GET /campaigns/{id}: < 500ms

---

## Risk Register Sprint 2

| Rủi ro | Xác suất | Tác động | Giải pháp |
|---|---|---|---|
| LLM output không đúng JSON format | Cao | Cao | JSON extraction + retry (max 3 lần) + fallback parsing |
| Qwen VPS timeout (> 15s) | Trung bình | Cao | Fallback sang OpenAI sau 15s timeout |
| OpenAI API rate limit | Thấp | Trung bình | Backoff retry, log lỗi rõ ràng, campaign status='failed' |
| Orchestrator chạy lâu (> 2 phút) | Trung bình | Trung bình | Background task, frontend poll, timeout cứng 5 phút |
| Race condition khi nhiều campaign chạy cùng lúc | Thấp | Thấp | Each campaign là independent background task |

---

## Daily Scrum Template

```
Ngày: ___________

Hôm qua tôi đã làm:
- [ ] ...

Hôm nay tôi sẽ làm:
- [ ] ...

Blockers:
- ...
```

---

## Sprint Review Checklist

- [ ] Demo end-to-end: điền brief → submit → chờ < 90s → thấy 3 content items
- [ ] Show agent log timeline: 5 steps (Strategist + 2xWriter + 2xCritic) với model/tokens
- [ ] Verify Brand Vault trong prompt: mở prompt_preview của 1 log, thấy brand context
- [ ] Demo approve 1 item → calendar cập nhật
- [ ] Demo reject 1 item với note → rejection_note lưu
- [ ] Demo edit + approve → version 2 xuất hiện
- [ ] Show calendar: tháng hiện tại với content dots

---

## Sprint Retrospective Template

### What Went Well
- ...

### What Could Be Improved
- ...

### Action Items for Sprint 3
- ...

---

## Velocity Actual

| Metric | Planned | Actual |
|---|---|---|
| Story Points | 73 | ___ |
| Stories Completed | 20 | ___ |
| Stories Carried Over | 0 | ___ |
