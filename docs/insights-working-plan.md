# Working Plan — Insights Results UI & Chart System
# Last updated: 2026-05-13 — ✅ COMPLETED + ENRICHED

## MỤC TIÊU
Thiết kế phần kết quả đầu ra cho page /insights:
- 1 bên: các số liệu tính toán (metrics)
- 1 bên: biểu đồ phân tích phù hợp (charts)
- Chỉ show cái nào TÍNH ĐƯỢC mới hiện
- Flexible: hỗ trợ 50-100 loại kết quả khác nhau
- Không AI abuse look: màu nhẹ, số gọn, không thừa thải

---

## ✅ IMPLEMENTED — Backend

### Taxonomy: 50+ Metric Types (METRIC_DEFINITIONS)
Mỗi metric thuộc 1 trong các nhóm: summary, count, average, rate/ratio, variance, inventory, payroll, HR, project, customer, product, data quality

### Taxonomy: Chart Types (CHART_TYPES)
bar, horizontal_bar, pie, donut, line, area, scatter, comparison, gauge, rank

### REPORT_TYPE_METADATA mở rộng
Mỗi entry có: label, description, expected_columns, kpis[], chart_suggestions[]

### Helper functions đã thêm vào insights.py:
- `_get_metric_definitions_for_report_type()`
- `_get_chart_suggestions_for_report_type()`
- `_round_metric()`, `_safe_sum()`, `_safe_avg()`, `_safe_max()`, `_safe_min()`
- `_build_numeric_groups()`
- `_build_chart_data_for_suggestion()` — build chart data từ suggestion + rows + column_mapping
- `_build_comparison_chart_data()` — build comparison chart (planned vs actual)

### chart_data generation đã thêm vào
- Sau khi compute_metrics, hệ thống duyệt chart_suggestions của report_type
- Build chart_data cho mỗi suggestion hợp lệ
- chart_data bao gồm: primary (chart đầu tiên) + secondary (các chart còn lại)
- Đã thêm vào cả result payload và narrative_payload

---

## ✅ IMPLEMENTED — Frontend

### Layout 2 cột (5/2 split)
- Metrics Panel (2/5) + Charts Panel (3/5) trên màn wide
- Responsive: stacked trên mobile

### Color Palette (soft pastel — không AI abuse)
```
#93c5fd (blue) | #86efac (green) | #fde68a (yellow) | #fbcfe8 (pink)
#c4b5fd (purple) | #fed7aa (orange) | #99f6e4 (teal) | #d1d5db (gray)
```

### NumberFormatter (formatMetricValue)
- currency: >= 1B → "1.5B", >= 1M → "1.5M", >= 1K → "1.5K"
- percent: "12.5%", ratio: "2.30", < 1: "0.8"
- Không dài, ổn định, làm tròn hợp lý

### SmartMetricCard
- Chỉ render khi `value !== 0 && isFinite(value)`
- Ẩn hoàn toàn metric không có dữ liệu

### SmartMetricGroup + MetricsPanel
- Nhóm metrics theo group: tong_hop, trung_binh, ti_le, luong, nhan_su...
- Collapsible sections, mỗi group có label + divider
- Group order cố định: tổng hợp → trung bình → tỷ lệ → ...

### SmartChart + ChartsPanel
- Hỗ trợ: bar, horizontal_bar, pie, donut, line, area, comparison
- Soft colors, responsive, tooltip nhẹ
- Primary chart: height 260px
- Secondary charts: height 180px, grid 2 columns

---

## FILES CHANGED

### Backend: api/routers/insights.py
1. Thêm CHART_TYPES dict
2. Thêm METRIC_DEFINITIONS dict (50+ metrics)
3. Mở rộng REPORT_TYPE_METADATA — 11 report types, mỗi cái có chart_suggestions
4. Thêm helper functions
5. Thêm chart_data generation trong _run_deep_analysis_gen
6. Thêm chart_data vào result payload

### Frontend: web/app/(app)/insights/page.tsx
1. Thêm recharts imports
2. Thêm ChartData, ComputedKPI interfaces vào DeepAnalysisResult type
3. Thêm helpers: formatMetricValue, isMetricComputable, CHART_COLORS, METRIC_GROUP_LABELS, CHART_TYPE_LABELS
4. Viết SmartChart component (bar, horizontal_bar, pie, donut, line, comparison, area)
5. Viết SmartMetricCard component (chỉ render khi computable)
6. Viết SmartMetricGroup + MetricsPanel component
7. Viết ChartsPanel component
8. Update Results section: header với report_type badge, layout 2 cột, data quality bar

---

## BACKLOG / NEXT PHASE
- [ ] Drill-down chart (click bar → filter)
- [ ] Export chart as PNG
- [ ] Metric comparison mode
- [ ] Real-time annotation on charts
- [ ] Storytelling flow (phân tích từng bước)
- [ ] Gauge chart component (chưa implement — cần custom SVG)
- [ ] Scatter plot component (chưa implement)
- [ ] Kiểm tra thực tế với data thật (end-to-end test)

## ✅ IMPLEMENTED — Enrichment (Round 2)

### Backend enrichment data (7 loại)
1. **summary** — câu tổng kết ngắn từ số liệu (1-4 câu)
2. **trend_data** — labels: "Tăng trưởng/Tốt/Cần cải thiện" cho revenue, ROAS, profit, budget
3. **top_items** — top 5 performers (rank, name, value, metric)
4. **bottom_items** — bottom 5 performers cần chú ý
5. **segment_breakdown** — phân bổ theo danh mục (name, value, count, percentage)
6. **anomalies** — phát hiện outlier bằng z-score (column, outlier_pct, examples)
7. **key_numbers** — 4 KPIs nổi bật nhất (label, value, format)

### Frontend enrichment components (12 components)
1. **ReportSummaryBanner** — gradient banner indigo với câu tổng kết
2. **KeyNumbersRow** — grid 4 KPIs nổi bật
3. **TrendBadge** — colored pill label (green/blue/amber/red)
4. **TrendSummaryRow** — hàng các TrendBadge
5. **RankingRow** — 1 dòng xếp hạng với medal emoji 🥇🥈🥉
6. **TopBottomSection** — 2-column: top performers (green) + bottom items (amber)
7. **SegmentBreakdownCard** — bar chart nhẹ với color-coded + percentage
8. **AnomalyCard** — red alert card với outlier details
9. **AnomalySection** — wrapper hiện max 3 anomaly cards
10. **ComparisonCard** — bar so sánh với ngưỡng benchmark
11. **ProgressRing** — SVG ring chart cho single metric
12. **MiniKpiWithSparkline** — KPI card với mini sparkline bar
13. **EnrichmentPanel** — wrapper tổng hợp tất cả enrichment sections

### Files changed
**Backend**: api/routers/insights.py — enrichment block ~300 lines
**Frontend**: web/app/(app)/insights/page.tsx — +400 lines enrichment components

## MỤC TIÊU
Thiết kế phần kết quả đầu ra cho page /insights:
- 1 bên: các số liệu tính toán (metrics)
- 1 bên: biểu đồ phân tích phù hợp (charts)
- Chỉ show cái nào TÍNH ĐƯỢC mới hiện
- Flexible: hỗ trợ 50-100 loại kết quả khác nhau
- Không AI abuse look: màu nhẹ, số gọn, không thừa thải

---

## BACKEND SIDE

### Taxonomy: 50+ Metric Types
Mỗi metric thuộc 1 trong các nhóm:
1. **Summary metrics** — tổng hợp (total, count, avg, min, max)
2. **Ratio metrics** — tỷ lệ (%, ratio)
3. **Trend metrics** — so sánh theo thời gian (QoQ, MoM, YoY)
4. **Distribution metrics** — phân bố (top N, bottom N, percentile)
5. **Quality metrics** — chất lượng (data quality score, coverage)
6. **Segment metrics** — phân đoạn (by category, by department)
7. **Anomaly metrics** — bất thường (outliers, spikes, drops)
8. **Rank metrics** — xếp hạng (top performer, bottom performer)

### Taxonomy: Chart Types
```
BAR_CHART         — phân bố theo category/department (biểu đồ cột)
LINE_CHART        — xu hướng theo thời gian (đường)
PIE_CHART         — tỷ lệ phần trăm (tròn)
DONUT_CHART       — tỷ lệ có center label
HORIZONTAL_BAR   — xếp hạng top/bottom (cột ngang)
AREA_CHART        — tích lũy theo thời gian
SCATTER_PLOT      — correlation giữa 2 metrics
HEATMAP           — phân bố matrix (category x time)
GAUGE_CHART       — single KPI vs threshold
COMPARISON_BAR    — planned vs actual
STACKED_BAR       — breakdown có nhiều thành phần
```
CHỈ show chart khi có DỮ LIỆU tương ứng.

### Quy tắc chọn chart (Chart Picker Logic)
```
IF has_date_column AND has_numeric_column
  → LINE_CHART (xu hướng)

IF has_category_column AND has_numeric_column
  AND unique_categories <= 8
  → PIE_CHART / DONUT_CHART

IF has_category_column AND has_numeric_column
  AND unique_categories > 8
  → BAR_CHART (top 8)

IF has_two_numeric_columns
  → SCATTER_PLOT

IF has_planned AND has_actual
  → COMPARISON_BAR

IF has_time_bucket AND has_multiple_metrics
  → AREA_CHART / LINE_CHART

IF report_type == payroll AND has_department
  → HORIZONTAL_BAR (salary by dept)

IF report_type == inventory
  → GAUGE_CHART (stock level)
```

### REPORT_TYPE_METADATA mở rộng
Thêm vào mỗi entry:
- `metrics[]`: danh sách metric definitions (key, label, format, group)
- `chart_suggestions[]`: gợi ý chart kèm điều kiện
- `default_view`: layout preference (metrics_only | metrics_and_charts | charts_heavy)

---

## FRONTEND SIDE

### Layout
```
┌─────────────────────────────────────────────────────┐
│ Report Type Badge: "Báo cáo lương Q1/2026"           │
│ Description: "Tổng hợp lương 50 nhân viên"          │
├──────────────────────────┬──────────────────────────┤
│ METRICS PANEL (40%)      │ CHARTS PANEL (60%)        │
│ ┌──────────────────────┐│┌─────────────────────────┐│
│ │ Summary KPIs          │││ Primary Chart           ││
│ │ (4 cards max)        │││ (LINE / BAR)           ││
│ └──────────────────────┘│└─────────────────────────┘│
│ ┌──────────────────────┐│┌──────────┬──────────────┐│
│ │ Detailed Metrics      │││ Subchart │  Subchart   ││
│ │ (collapsible)        │││ (PIE)    │  (BAR)      ││
│ │ - Group 1           ││└──────────┴──────────────┘│
│ │ - Group 2           ││                             │
│ └──────────────────────┘│                             │
├──────────────────────────┴──────────────────────────┤
│ Nhận định AI (insights cards)                      │
│ Hành động gợi ý (action cards)                    │
├─────────────────────────────────────────────────────┤
│ Trò chuyện với AI                                 │
└─────────────────────────────────────────────────────┘
```

### Số liệu (Number Formatter)
```
formatMetric(value, format):
  IF value >= 1_000_000_000 → "1.5B"
  IF value >= 1_000_000     → "1.5M"
  IF value >= 1_000          → "1.5K"
  IF format == percent        → "12.5%"
  IF value < 1              → "0.8"
  ELSE                      → số nguyên gọn
```

### Color Palette (soft, không AI abuse)
```
Primary:      #6366f1 (indigo-500) — badge, accent
Surface:      #ffffff (white) — card bg
Border:       #e5e7eb (gray-200)
Text Primary: #111827 (gray-900)
Text Muted:  #6b7280 (gray-500)

Chart Colors (pastel):
  Blue:    #93c5fd
  Green:   #86efac
  Yellow:  #fde68a
  Pink:    #fbcfe8
  Purple:  #c4b5fd
  Orange:  #fed7aa
  Teal:    #99f6e4
  Gray:    #d1d5db
```

### Smart Metric Display
- Chỉ render metric card khi:
  1. Giá trị != 0 (hoặc metric đó là summary count)
  2. Column tương ứng đã được map thành công
  3. Computable = true trong kpi_availability
- Metrics có giá trị 0 → KHÔNG show, không hiện 0.00
- Insights không có dữ liệu → KHÔNG show insight card rỗng

### Chart Component
- Dùng recharts (đã có trong web/package.json)
- Auto-select chart type dựa trên chart_data từ backend
- Responsive, có tooltip nhẹ
- Legend bên dưới, không quá crowded

---

## IMPLEMENTATION STEPS

### Step 1: Backend — mở rộng REPORT_TYPE_METADATA
Thêm vào mỗi report_type:
```python
"metrics": [
    {"key": "total_payroll", "label": "Tổng quỹ lương", "format": "currency", "group": "summary"},
    {"key": "avg_salary", "label": "Lương TB", "format": "currency", "group": "summary"},
    ...
],
"chart_suggestions": [
    {"type": "horizontal_bar", "data_key": "cost_by_department", "label": "Chi phí theo phòng"},
    {"type": "pie", "data_key": "cost_by_category", "label": "Tỷ lệ chi phí"},
    ...
]
```

### Step 2: Backend — compute_metrics bổ sung chart_data
Với mỗi loại báo cáo, tính thêm:
```python
chart_data = {
    "primary": {
        "type": "bar_chart" | "pie_chart" | "line_chart" | ...,
        "title": "Biểu đồ ...",
        "data": [{"name": "A", "value": 100}, ...],
        "description": "..."
    },
    "secondary": [
        {"type": "...", "data": [...]}
    ]
}
```

### Step 3: Backend — thêm computed_metrics + chart_data vào result payload
```python
result = {
    ...
    "computed_kpis": {...},
    "chart_data": {...},
    "metrics_summary": [...],  # flat list de frontend render
    "report_type_label": "...",
}
```

### Step 4: Frontend — cài recharts
```bash
npm install recharts
```

### Step 5: Frontend — viết chart engine
SmartChart component:
- Props: chart_data (type, data, title)
- Render đúng chart type
- Handle empty / loading state

### Step 6: Frontend — viết MetricCard thông minh
SmartMetricCard:
- Props: metric (key, label, value, format, trend)
- CHỈ render khi value > 0 hoặc count
- Format số gọn, không dài

### Step 7: Frontend — viết MetricsPanel
- Nhóm metrics theo group
- Collapsible sections
- Badge cho mỗi group

### Step 8: Frontend — viết ChartsPanel
- Primary chart lớn
- Secondary charts nhỏ grid 2x
- Responsive

### Step 9: Frontend — gắn vào Results section
- Thay thế hardcoded KPI cards
- 2-column layout
- Insight + Action cards giữ nguyên
- Soft colors throughout

---

## BACKLOG / NEXT PHASE
- [ ] Drill-down chart (click bar → filter)
- [ ] Export chart as PNG
- [ ] Metric comparison mode (2 columns side by side)
- [ ] Real-time annotation on charts
- [ ] Storytelling flow (phân tích từng bước)
