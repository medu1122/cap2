# UI Guidelines — AIMAP

Giao diện theo phong cách **productivity tool / AI workspace** — khô cứng, ít màu, tối giản giống Linear, Notion, hoặc Vercel Dashboard. Không dùng gradient, không dùng màu nền sặc sỡ, không animation phức tạp.

---

## 1. Design Principles

| Principle | Implementation |
|---|---|
| **Information density** | Compact spacing, nhiều thông tin trên 1 màn hình mà không rối |
| **Monochrome first** | Giao diện chủ đạo là xám + trắng; chỉ dùng màu accent 1 chỗ cho status/badge |
| **Data over decoration** | Không icon decoration, không illustration, không gradient background |
| **Readable above everything** | Font chữ đủ lớn, contrast cao, line-height thoải mái |
| **AI is a tool, not a character** | AI output hiển thị như kết quả, không dùng avatar robot hay animation "đang gõ" sặc mùi ChatGPT |

---

## 2. Color Palette

```
Background:     #FFFFFF (white)
Surface:        #F9FAFB (gray-50)
Border:         #E5E7EB (gray-200)
Text primary:   #111827 (gray-900)
Text secondary: #6B7280 (gray-500)
Text muted:     #9CA3AF (gray-400)

Accent (interactive):   #2563EB (blue-600)
Accent hover:           #1D4ED8 (blue-700)

Status colors (used only in badges):
  draft:              #9CA3AF (gray-400)
  pending_approval:   #D97706 (amber-600)
  approved:           #16A34A (green-600)
  rejected:           #DC2626 (red-600)
  running:            #2563EB (blue-600)
  failed:             #DC2626 (red-600)

Channel colors (used only as small dots in calendar):
  facebook_post:  #1D4ED8 (blue-700)
  email:          #7C3AED (violet-600)
  video_script:   #B45309 (amber-700)
```

**No dark mode in MVP.** Background is always white.

---

## 3. Typography

```
Font family:    Inter (via next/font or Google Fonts)
Fallback:       system-ui, sans-serif

Font scale:
  xs:   12px / 16px line-height  (table metadata, timestamps)
  sm:   13px / 20px              (secondary text, table rows)
  base: 14px / 22px              (body, labels, descriptions)
  md:   16px / 24px              (section headers, form labels)
  lg:   20px / 28px              (page titles)
  xl:   24px / 32px              (dashboard headline numbers)

Font weights:
  Regular (400): body text
  Medium (500):  labels, table headers, badge text
  Semibold (600): page titles, section headers, metric numbers
```

---

## 4. Layout System

### App Shell

```
┌──────────────────────────────────────────────────────────────┐
│  SIDEBAR (240px fixed)   │  MAIN CONTENT AREA               │
│                          │                                    │
│  AIMAP                   │  [Page Header]                    │
│  ─────────               │  Title + optional action button   │
│  Dashboard               │  ─────────────────────────────── │
│  Campaigns               │  [Page Content]                   │
│  Calendar                │                                    │
│  Brand Vault             │                                    │
│  ─────────               │                                    │
│  Approve (badge)         │                                    │
│                          │                                    │
│  [user email]            │                                    │
└──────────────────────────┴────────────────────────────────────┘
```

- Sidebar background: `#F9FAFB`
- Sidebar border-right: `1px solid #E5E7EB`
- Active nav item: left `2px solid #2563EB` + background `#EFF6FF`
- Main content area background: `#FFFFFF`
- Max content width: `1280px`, centered.

### Campaign Detail — with Agent Logs Panel

```
┌────────────────────────────┬─────────────────────────────┐
│  CAMPAIGN DETAIL (60%)     │  AGENT LOGS PANEL (40%)     │
│                            │                             │
│  Campaign name             │  Agent Activity Timeline    │
│  Status badge              │  ─────────────────────────  │
│  Brief info                │  ● Strategist  2.3s  ✓     │
│  ─────────────             │    "Đã phân tích brief..."  │
│  CONTENT ITEMS             │  ● Writer (fb_post) 4.1s ✓  │
│  [Tab: facebook_post]      │    "Đã viết bài đăng..."    │
│  [Tab: email]              │  ● Critic (fb_post) 3.2s ✓  │
│  [Tab: video_script]       │    "Đã kiểm tra và chỉnh..." │
│                            │                             │
│  [Content text display]    │                             │
│  [Approve] [Reject]        │                             │
└────────────────────────────┴─────────────────────────────┘
```

---

## 5. Component Specifications

### Button

```
Primary:    bg #2563EB, text white, hover #1D4ED8
Secondary:  border #E5E7EB, bg white, text #111827, hover bg #F9FAFB
Danger:     border #DC2626, text #DC2626, hover bg #FEF2F2
Sizes:      sm (h-8, px-3, text-sm) | md (h-9, px-4, text-sm) | lg (h-10, px-5, text-base)
Disabled:   opacity-50, cursor-not-allowed
```

### Badge / Status Chip

```
Shape:      rounded-full (pill)
Size:       text-xs, px-2 py-0.5
Colors:     follow Status colors from palette above
```

### Card

```
Background:  white
Border:      1px solid #E5E7EB
Border-radius: 6px
Padding:     16px
Shadow:      none (flat design)
```

### Input / Textarea

```
Border:     1px solid #E5E7EB
Focus:      1px solid #2563EB (outline)
Radius:     4px
Padding:    8px 12px
Font-size:  14px
Background: white
```

### Table

```
Header row:  bg #F9FAFB, text-sm font-medium text-gray-500, uppercase
Body rows:   bg white, border-bottom #E5E7EB
Hover row:   bg #F9FAFB
Cell padding: 12px 16px
```

### Agent Log Timeline

```
Layout: vertical list, each item has:
  - Left: colored dot (blue=running, green=success, red=error) + vertical line connector
  - Center: agent name + channel label + model badge + duration
  - Right: timestamp
  - Expandable: click to show full prompt/output preview in a code-like box
  
Background of expanded detail: #F9FAFB, font: monospace 12px
```

### Calendar Grid

```
Layout: CSS Grid 7 columns (Mon–Sun)
Day cell: border 1px #E5E7EB, min-height 100px, padding 8px
Content dot item: 
  - Full-width pill, text-xs, truncated
  - Color by channel (see palette)
  - Status shown as opacity: approved = full, pending = 70%, draft = 50%
Today highlight: border-top 2px solid #2563EB
```

---

## 6. Page Layouts

### Dashboard Page

```
[Page title: "Dashboard"] [date range selector: "This week"]

Row 1 — 4 stat cards side by side:
  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
  │ Campaigns  │ │ Content    │ │ Pending    │ │ Approved   │
  │    5       │ │   14       │ │    3       │ │    9       │
  │ total      │ │ items      │ │ approval   │ │ items      │
  └────────────┘ └────────────┘ └────────────┘ └────────────┘

Row 2:
  Left (60%): Recent activity feed (last 8 agent runs, compact list)
  Right (40%): Content by channel (horizontal bar chart or simple table)

Row 3:
  AI Summary box — bordered box, light gray bg, text in regular prose
  Label: "AI Insight"   right: "Refreshed just now"
```

### Campaigns List Page

```
[Page title: "Campaigns"]  [+ New Campaign button]

[Filter tabs: All | Running | Pending Approval | Approved | Failed]

Table:
  Name | Channels | Status | Deadline | Content | Created | Actions
  ...rows...
```

### New Campaign Page (Brief Form)

```
[Page title: "New Campaign"]

Form — single column, comfortable spacing:

  Campaign Name *
  [_________________________________]

  Objective *
  [_________________________________]

  Product or Service *
  [_________________________________]

  Target Audience
  [_________________________________]

  Offer / Hook
  [_________________________________]

  Deadline *
  [date picker]

  Channels *
  [x] Facebook Post  [x] Email  [ ] Video Script

  Additional Notes
  [textarea                        ]

  [Cancel]  [Create Campaign]
  
  Note: "After creating, AI will start generating your campaign content automatically."
```

### Brand Vault Page

```
[Page title: "Brand Vault"]  [Save Changes button]

Two-column form:
  Left:                          Right:
  Brand Name *                   Tone of Voice *
  Tagline                        [ playful / professional / warm / bold / informative ]
  Brand Description *            Primary Color
  Target Audience *              Logo URL
  Key Products                   Preferred CTA
  Forbidden Words                Preferred Salutation
  
  Sample Post (full width textarea)
  
  [Save Changes]
```

### Calendar Page

```
[Page title: "Marketing Calendar"]

[Filter: All channels | facebook_post | email | video_script]
[Month navigation: < July 2024 >]

[7-col calendar grid]

Clicking a content item → right panel slides in:
  Content channel + campaign name
  Status badge
  Full content text
  [Approve] [Reject] [Edit] [Change date]
```

### Approval Queue Page

```
[Page title: "Approval Queue"]  [badge: N pending]

Table:
  Content | Campaign | Channel | Created | Actions
  [preview truncated] | [campaign name] | [badge] | [date] | [Approve] [Reject] [View]
```

---

## 7. States to Always Handle

Every data-fetching view must handle:

| State | Display |
|---|---|
| Loading | Skeleton placeholder (gray animated bars, no spinners) |
| Empty | Simple centered text: "No campaigns yet. [Create your first campaign →]" |
| Error | Red-bordered inline error message with retry button |

---

## 8. Interaction Notes

- **No toast notifications for destructive actions**: use inline confirmation dialogs.
- **AI generation running**: show campaign row with a pulsing `Running...` status badge. Auto-refresh every 5 seconds until status changes.
- **Approval action**: immediate UI update optimistically; revert on error.
- **No modal overuse**: prefer in-page panels or new routes over stacked modals.

---

## 9. Admin UI Guidelines (bo sung)

- Admin area dung route namespace rieng: `/admin/*`.
- Sidebar admin toi thieu:
  - Overview
  - Users
  - AI Usage
  - Workflow Ops
  - Audit Logs
- Uu tien table-first layout, filter nhanh, bulk action ro rang.
- Cac thao tac nguy hiem (khoa user, retry job) phai co confirm dialog.
- Hien thi badge role ro rang trong user table (`admin`, `user`).
