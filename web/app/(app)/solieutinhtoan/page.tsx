"use client";

import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter,
} from "recharts";

// ============================================================
// HELPERS
// ============================================================

const CHART_COLORS = [
  "#93c5fd", "#86efac", "#fde68a", "#fbcfe8",
  "#c4b5fd", "#fed7aa", "#99f6e4", "#d1d5db",
];

function formatMetricValue(value: number, fmt: string): string {
  if (typeof value !== "number" || !isFinite(value)) return "—";
  if (value === 0) return "0";
  if (fmt === "percent") return `${(value * 100).toFixed(1)}%`;
  if (fmt === "ratio") return value.toFixed(2);
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (value < 1) return value.toFixed(2);
  return Math.round(value).toLocaleString("vi-VN");
}

function isMetricComputable(value: unknown): boolean {
  return typeof value === "number" && isFinite(value) && value !== 0;
}

function TrendBadge({ label }: { label: string }) {
  const config: Record<string, { bg: string; text: string; dot: string }> = {
    "Tăng trưởng": { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
    "Xuất sắc": { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
    "Cần cải thiện": { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
    "Ổn định": { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
    "Thấp": { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
  };
  const c = config[label] || { bg: "bg-gray-100", text: "text-gray-700", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {label}
    </span>
  );
}

function ProgressRing({ value, label }: { value: number; label: string }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(value, 1));
  const color = value >= 0.8 ? "#86efac" : value >= 0.5 ? "#fde68a" : "#fca5a5";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#f0f0f0" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={radius} fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
        <text x="36" y="36" textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="bold" fill={color}>
          {Math.round(value * 100)}%
        </text>
      </svg>
      <span className="text-xs text-gray-500 text-center">{label}</span>
    </div>
  );
}

function MiniKpiWithSparkline({ label, value, format, sparkData }: {
  label: string; value: number; format: string; sparkData: number[];
}) {
  if (!isMetricComputable(value)) return null;
  const max = Math.max(...sparkData.filter(isFinite));
  const bars = sparkData.map((v) => (max > 0 ? v / max : 0));
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-400 mb-1">{label}</p>
        <p className="text-base font-bold text-gray-900">{formatMetricValue(value, format)}</p>
      </div>
      <div className="flex items-end gap-0.5 h-8 flex-shrink-0">
        {bars.slice(-12).map((h, i) => (
          <div key={i} className="w-1.5 rounded-sm bg-indigo-200" style={{ height: `${Math.max(h * 32, 2)}px` }} />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// SMART CHART — supports all chart types
// ============================================================

type ChartData = {
  type: string;
  title: string;
  data: Array<{
    name: string;
    value?: number;
    planned?: number;
    actual?: number;
    income?: number;
    expense?: number;
    [key: string]: string | number | undefined;
  }>;
};

function SmartChart({ chart, compact = false }: { chart: ChartData; compact?: boolean }) {
  const { type, title, data } = chart;
  if (!data || data.length === 0) return null;

  const height = compact ? 180 : 260;

  const renderContent = () => {
    if (type === "bar") {
      return (
        <BarChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatMetricValue(v, "currency")} />
          <Tooltip formatter={(v: number) => [formatMetricValue(v, "currency"), "Giá trị"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
          <Bar dataKey="value" fill="#93c5fd" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      );
    }

    if (type === "horizontal_bar") {
      return (
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatMetricValue(v, "currency")} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v: number) => [formatMetricValue(v, "currency"), "Giá trị"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
          <Bar dataKey="value" fill="#86efac" radius={[0, 4, 4, 0]} maxBarSize={20} />
        </BarChart>
      );
    }

    if (type === "pie" || type === "donut") {
      return (
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={compact ? 60 : 90}
            innerRadius={type === "donut" ? (compact ? 35 : 55) : 0}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => [formatMetricValue(v, "currency"), "Giá trị"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
          <Legend iconType="circle" iconSize={8} formatter={(val) => <span style={{ fontSize: 11 }}>{val}</span>} />
        </PieChart>
      );
    }

    if (type === "line") {
      return (
        <LineChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatMetricValue(v, "currency")} />
          <Tooltip formatter={(v: number) => [formatMetricValue(v, "currency"), "Giá trị"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
          <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: "#6366f1" }} />
        </LineChart>
      );
    }

    if (type === "comparison") {
      return (
        <BarChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatMetricValue(v, "currency")} />
          <Tooltip formatter={(v: number, n: string) => [formatMetricValue(v, "currency"), n]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
          <Legend iconType="square" iconSize={8} formatter={(val) => <span style={{ fontSize: 11 }}>{val === "planned" ? "Kế hoạch" : "Thực tế"}</span>} />
          <Bar dataKey="planned" fill="#93c5fd" radius={[4, 4, 0, 0]} maxBarSize={32} />
          <Bar dataKey="actual" fill="#86efac" radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      );
    }

    if (type === "area") {
      return (
        <LineChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatMetricValue(v, "currency")} />
          <Tooltip formatter={(v: number) => [formatMetricValue(v, "currency"), ""]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
          <Legend iconType="square" iconSize={8} />
          {data[0] && "income" in data[0] && <Line type="monotone" dataKey="income" stroke="#93c5fd" fill="#93c5fd" fillOpacity={0.2} strokeWidth={2} />}
          {data[0] && "expense" in data[0] && <Line type="monotone" dataKey="expense" stroke="#fca5a5" fill="#fca5a5" fillOpacity={0.2} strokeWidth={2} />}
          {!data[0] || !("income" in data[0]) ? <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} /> : null}
        </LineChart>
      );
    }

    if (type === "gauge") {
      const gaugeVal = (data[0]?.value ?? 0);
      // gaugeVal is already a 0-1 ratio (for percent) or absolute (for ratio)
      // Use 1 as max if it's a ratio, otherwise use the max value in data
      const maxVal = Math.max(...data.map((d) => Math.abs(d.value ?? 0)));
      const isRatio = gaugeVal <= 1;
      const pct = isRatio ? gaugeVal : Math.min(gaugeVal / (maxVal || 1), 1);
      const circ = 2 * Math.PI * 36;
      const color = pct >= 0.7 ? "#86efac" : pct >= 0.4 ? "#fde68a" : "#fca5a5";
      return (
        <div className="flex flex-col items-center justify-center h-full py-4">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="36" fill="none" stroke="#f0f0f0" strokeWidth="10" />
            <circle cx="60" cy="60" r="36" fill="none" stroke={color} strokeWidth="10"
              strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
              strokeLinecap="round" transform="rotate(-90 60 60)"
            />
            <text x="60" y="56" textAnchor="middle" fontSize="18" fontWeight="bold" fill={color}>
              {formatMetricValue(gaugeVal, "percent")}
            </text>
            <text x="60" y="72" textAnchor="middle" fontSize="10" fill="#9ca3af">
              {data[0]?.name || ""}
            </text>
          </svg>
          <p className="text-xs text-gray-500 mt-1 text-center">{title}</p>
        </div>
      );
    }

    if (type === "rank") {
      const sortedData = [...data].sort((a, b) => ((b.value ?? 0) as number) - ((a.value ?? 0) as number)).slice(0, 8);
      const maxVal = (sortedData[0]?.value ?? 1) as number;
      return (
        <div className="space-y-2 py-2">
          {sortedData.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 text-xs font-bold text-gray-400 text-right">{i + 1}</span>
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-gray-700 truncate">{item.name}</span>
                  <span className="text-gray-900 font-semibold ml-2">{formatMetricValue(item.value ?? 0, "currency")}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-300 transition-all"
                    style={{ width: `${Math.min(((item.value ?? 0) / maxVal) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (type === "scatter") {
      const scatterData: Array<{ x: number; y: number; name: string }> = data.map((d) => ({
        x: Number(d.planned ?? 0),
        y: Number(d.actual ?? d.value ?? 0),
        name: d.name,
      }));
      return (
        <ScatterChart margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="x" name="X" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis dataKey="y" name="Y" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(v: number) => [formatMetricValue(v, "number"), ""]}
            content={({ active, payload }: any) => {
              if (active && payload && payload.length) {
                const pt = payload[0]?.payload;
                return (
                  <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs shadow">
                    <p className="font-medium text-gray-700">{pt?.name}</p>
                    <p className="text-gray-500">X: {formatMetricValue(pt?.x ?? 0, "number")} · Y: {formatMetricValue(pt?.y ?? 0, "number")}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Scatter data={scatterData} fill="#6366f1" />
        </ScatterChart>
      );
    }

    // Fallback
    return (
      <BarChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip formatter={(v: number) => [formatMetricValue(v, "currency"), "Giá trị"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
        <Bar dataKey="value" fill="#93c5fd" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-3">{title}</h4>
      <ResponsiveContainer width="100%" height={height}>
        {renderContent()}
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================
// MOCK DATA
// ============================================================

const MOCK_CHART_DATA = {
  bar: {
    type: "bar" as const,
    title: "Doanh thu theo tháng",
    data: [
      { name: "Tháng 1", value: 420000000 },
      { name: "Tháng 2", value: 380000000 },
      { name: "Tháng 3", value: 510000000 },
      { name: "Tháng 4", value: 460000000 },
      { name: "Tháng 5", value: 580000000 },
      { name: "Tháng 6", value: 620000000 },
    ],
  },
  horizontal_bar: {
    type: "horizontal_bar" as const,
    title: "Chi phí theo kênh quảng cáo",
    data: [
      { name: "Google Ads", value: 85000000 },
      { name: "Facebook Ads", value: 62000000 },
      { name: "Tiktok Ads", value: 41000000 },
      { name: "Zalo Ads", value: 28000000 },
      { name: "SEO / Organic", value: 12000000 },
    ],
  },
  pie: {
    type: "pie" as const,
    title: "Cơ cấu doanh thu theo danh mục",
    data: [
      { name: "Sản phẩm A", value: 320000000 },
      { name: "Sản phẩm B", value: 210000000 },
      { name: "Sản phẩm C", value: 145000000 },
      { name: "Dịch vụ", value: 98000000 },
      { name: "Khác", value: 37000000 },
    ],
  },
  donut: {
    type: "donut" as const,
    title: "Tỷ lệ đơn hàng theo kênh",
    data: [
      { name: "Website", value: 42 },
      { name: "App mobile", value: 31 },
      { name: "Cửa hàng", value: 18 },
      { name: "Đại lý", value: 9 },
    ],
  },
  line: {
    type: "line" as const,
    title: "Xu hướng doanh thu 6 tháng",
    data: [
      { name: "T1", value: 420000000 },
      { name: "T2", value: 380000000 },
      { name: "T3", value: 510000000 },
      { name: "T4", value: 460000000 },
      { name: "T5", value: 580000000 },
      { name: "T6", value: 620000000 },
    ],
  },
  area: {
    type: "area" as const,
    title: "Thu chi theo tháng",
    data: [
      { name: "T1", income: 420000000, expense: 280000000 },
      { name: "T2", income: 380000000, expense: 250000000 },
      { name: "T3", income: 510000000, expense: 310000000 },
      { name: "T4", income: 460000000, expense: 290000000 },
      { name: "T5", income: 580000000, expense: 340000000 },
      { name: "T6", income: 620000000, expense: 360000000 },
    ],
  },
  comparison: {
    type: "comparison" as const,
    title: "Kế hoạch vs Thực tế theo quý",
    data: [
      { name: "Q1", planned: 400000000, actual: 420000000 },
      { name: "Q2", planned: 480000000, actual: 460000000 },
      { name: "Q3", planned: 520000000, actual: 580000000 },
      { name: "Q4", planned: 600000000, actual: 620000000 },
    ],
  },
  gauge: {
    type: "gauge" as const,
    title: "Tỷ lệ ROAS trung bình",
    data: [{ name: "ROAS", value: 3.8 }],
  },
  gaugeMargin: {
    type: "gauge" as const,
    title: "Biên lợi nhuận",
    data: [{ name: "Biên", value: 0.28 }],
  },
  gaugeConv: {
    type: "gauge" as const,
    title: "Tỷ lệ chuyển đổi",
    data: [{ name: "Chuyển đổi", value: 0.127 }],
  },
  rank: {
    type: "rank" as const,
    title: "Top sản phẩm bán chạy",
    data: [
      { name: "Bánh mì sandwich", value: 124000000 },
      { name: "Nước ép trái cây", value: 98000000 },
      { name: "Salad rau trộn", value: 76000000 },
      { name: "Cà phê đen", value: 65000000 },
      { name: "Trà sữa trân châu", value: 54000000 },
      { name: "Bánh cookie", value: 42000000 },
      { name: "Nước suối", value: 31000000 },
      { name: "Sữa chua", value: 28000000 },
    ],
  },
  scatter: {
    type: "scatter" as const,
    title: "Doanh thu vs Số đơn hàng",
    data: [
      { name: "Ngày 1", planned: 42000000, actual: 192 },
      { name: "Ngày 2", planned: 38000000, actual: 184 },
      { name: "Ngày 3", planned: 51000000, actual: 211 },
      { name: "Ngày 4", planned: 46000000, actual: 200 },
      { name: "Ngày 5", planned: 58000000, actual: 217 },
      { name: "Ngày 6", planned: 62000000, actual: 227 },
      { name: "Ngày 7", planned: 54000000, actual: 203 },
    ],
  },
};

const MOCK_COMPUTED_KPIS = {
  // Tổng hợp
  revenue: 2970000000,
  gross_profit: 832000000,
  net_profit: 486000000,
  ad_spend: 218000000,
  product_cost: 1650000000,
  other_cost: 280000000,
  total_cost: 2148000000,
  // Khách hàng
  orders: 1372,
  leads: 10214,
  repeat_orders: 294,
  new_customers: 487,
  qty_sold: 2841,
  // Tỷ lệ
  roas: 3.82,
  conversion_rate: 0.134,
  repeat_rate: 0.214,
  new_customer_rate: 0.348,
  profit_margin: 0.164,
  gross_margin: 0.280,
  // Trung bình
  aov: 2164000,
  avg_leads_per_day: 58,
  avg_salary: 18500000,
  // Khác
  total_payroll: 888000000,
  total_budget: 3200000000,
  headcount: 48,
  budget_utilization: 0.71,
};

const MOCK_ANOMALIES = [
  {
    column: "doanh_thu",
    outlier_count: 1,
    total_count: 30,
    outlier_pct: 3.3,
    examples: ["Ngày 15: 12.3M — cao bất thường (+47% so với TB)"],
    direction: "Cao bất thường",
  },
  {
    column: "chi_phi_quang_cao",
    outlier_count: 2,
    total_count: 30,
    outlier_pct: 6.7,
    examples: ["Ngày 8: 19.8M (+32%)", "Ngày 22: 21.2M (+41%)"],
    direction: "Cao bất thường",
  },
];

const MOCK_SEGMENTS = [
  { name: "Khách online", value: 1782000000, count: 847, percentage: 60.0 },
  { name: "Khách offline", value: 594000000, count: 312, percentage: 20.0 },
  { name: "Khách VIP", value: 445500000, count: 89, percentage: 15.0 },
  { name: "Khách bán sỉ", value: 148500000, count: 124, percentage: 5.0 },
];

const MOCK_TOP_ITEMS = [
  { rank: 1, name: "Ngày 23", value: 94275276, metric: "revenue" },
  { rank: 2, name: "Ngày 29", value: 91538179, metric: "revenue" },
  { rank: 3, name: "Ngày 25", value: 85486131, metric: "revenue" },
  { rank: 4, name: "Ngày 27", value: 82980284, metric: "revenue" },
  { rank: 5, name: "Ngày 28", value: 82595178, metric: "revenue" },
];

const MOCK_BOTTOM_ITEMS = [
  { rank: 1, name: "Ngày 24", value: 79970414, metric: "revenue" },
  { rank: 2, name: "Ngày 26", value: 81795079, metric: "revenue" },
  { rank: 3, name: "Ngày 28", value: 82595178, metric: "revenue" },
  { rank: 4, name: "Ngày 27", value: 82980284, metric: "revenue" },
  { rank: 5, name: "Ngày 25", value: 85486131, metric: "revenue" },
];

const MOCK_TRENDS = {
  revenue: "Tăng trưởng",
  profit: "Xuất sắc",
  roas: "Ổn định",
  orders: "Cần cải thiện",
};

const MOCK_KEY_NUMBERS = [
  { key: "revenue", label: "Tổng doanh thu", value: 2970000000, format: "currency" },
  { key: "orders", label: "Tổng đơn hàng", value: 1372, format: "number" },
  { key: "roas", label: "ROAS TB", value: 3.82, format: "ratio" },
  { key: "profit_margin", label: "Biên lợi nhuận", value: 0.164, format: "percent" },
];

const METRIC_GROUPS = [
  {
    label: "Tổng hợp",
    metrics: [
      { label: "Tổng doanh thu", value: MOCK_COMPUTED_KPIS.revenue, format: "currency" },
      { label: "Tổng chi phí", value: MOCK_COMPUTED_KPIS.total_cost, format: "currency" },
      { label: "Lợi nhuận gộp", value: MOCK_COMPUTED_KPIS.gross_profit, format: "currency" },
      { label: "Lợi nhuận ròng", value: MOCK_COMPUTED_KPIS.net_profit, format: "currency" },
      { label: "Chi phí quảng cáo", value: MOCK_COMPUTED_KPIS.ad_spend, format: "currency" },
    ],
  },
  {
    label: "Khách hàng & Đơn hàng",
    metrics: [
      { label: "Tổng đơn hàng", value: MOCK_COMPUTED_KPIS.orders, format: "number" },
      { label: "Khách tiềm năng", value: MOCK_COMPUTED_KPIS.leads, format: "number" },
      { label: "Đơn hàng lặp lại", value: MOCK_COMPUTED_KPIS.repeat_orders, format: "number" },
      { label: "Khách hàng mới", value: MOCK_COMPUTED_KPIS.new_customers, format: "number" },
      { label: "Số lượng sản phẩm", value: MOCK_COMPUTED_KPIS.qty_sold, format: "number" },
    ],
  },
  {
    label: "Tỷ lệ & Hiệu suất",
    metrics: [
      { label: "ROAS", value: MOCK_COMPUTED_KPIS.roas, format: "ratio" },
      { label: "Tỷ lệ chuyển đổi", value: MOCK_COMPUTED_KPIS.conversion_rate, format: "percent" },
      { label: "Tỷ lệ quay lại", value: MOCK_COMPUTED_KPIS.repeat_rate, format: "percent" },
      { label: "Tỷ lệ khách mới", value: MOCK_COMPUTED_KPIS.new_customer_rate, format: "percent" },
      { label: "Biên lợi nhuận ròng", value: MOCK_COMPUTED_KPIS.profit_margin, format: "percent" },
      { label: "Biên lợi nhuận gộp", value: MOCK_COMPUTED_KPIS.gross_margin, format: "percent" },
    ],
  },
  {
    label: "Trung bình",
    metrics: [
      { label: "Giá trị đơn TB (AOV)", value: MOCK_COMPUTED_KPIS.aov, format: "currency" },
      { label: "TB khách/ngày", value: MOCK_COMPUTED_KPIS.avg_leads_per_day, format: "number" },
    ],
  },
];

// ============================================================
// COMPONENTS
// ============================================================

function SectionHeader({ emoji, title, subtitle }: { emoji: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
        <span>{emoji}</span>
        {title}
      </h2>
      {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}

function MetricCard({ label, value, format }: { label: string; value: number; format: string }) {
  if (!isMetricComputable(value)) return null;
  const isSmall = value < 1 || format === "percent" || format === "ratio";
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all">
      <p className="text-xs font-medium text-gray-400 mb-1.5">{label}</p>
      <p className={`font-bold text-gray-900 ${isSmall ? "text-lg" : "text-base"}`}>
        {formatMetricValue(value, format)}
      </p>
    </div>
  );
}

function MetricGroupCard({ label, metrics }: { label: string; metrics: Array<{ label: string; value: number; format: string }> }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <h4 className="text-sm font-semibold text-gray-700">{label}</h4>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-2">
          {metrics.map((m) => (
            <MetricCard key={m.label} label={m.label} value={m.value} format={m.format} />
          ))}
        </div>
      </div>
    </div>
  );
}

function KeyNumbersRow() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      {MOCK_KEY_NUMBERS.map((kn) => (
        <div key={kn.key} className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl px-4 py-3 text-center">
          <p className="text-xs font-medium text-indigo-400 mb-1">{kn.label}</p>
          <p className="text-lg font-bold text-indigo-700">{formatMetricValue(kn.value, kn.format)}</p>
        </div>
      ))}
    </div>
  );
}

function TopBottomSection() {
  const maxVal = MOCK_TOP_ITEMS[0]?.value ?? 1;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
      {/* Top performers */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-green-50 px-4 py-2.5 border-b border-green-100 flex items-center gap-2">
          <span className="text-green-600">↑</span>
          <h4 className="text-sm font-semibold text-green-800">Top hiệu suất cao</h4>
        </div>
        <div className="p-4 space-y-2">
          {MOCK_TOP_ITEMS.map((item) => (
            <div key={item.rank} className="flex items-center gap-2">
              <span className="w-5 text-xs font-bold text-green-500 text-right">#{item.rank}</span>
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-gray-700">{item.name}</span>
                  <span className="font-semibold text-gray-900">{formatMetricValue(item.value, "currency")}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-green-400" style={{ width: `${(item.value / maxVal) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom performers */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-100 flex items-center gap-2">
          <span className="text-amber-600">↓</span>
          <h4 className="text-sm font-semibold text-amber-800">Cần chú ý</h4>
        </div>
        <div className="p-4 space-y-2">
          {MOCK_BOTTOM_ITEMS.map((item) => (
            <div key={item.rank} className="flex items-center gap-2">
              <span className="w-5 text-xs font-bold text-amber-500 text-right">#{item.rank}</span>
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-gray-700">{item.name}</span>
                  <span className="font-semibold text-gray-900">{formatMetricValue(item.value, "currency")}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${(item.value / maxVal) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SegmentBreakdownCard() {
  const totalPct = MOCK_SEGMENTS.reduce((s, seg) => s + seg.percentage, 0);
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100">
        <h4 className="text-sm font-semibold text-gray-700">Phân bổ theo nhóm khách hàng</h4>
      </div>
      <div className="p-4">
        <div className="space-y-3">
          {MOCK_SEGMENTS.map((seg, i) => (
            <div key={seg.name}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="text-sm text-gray-700">{seg.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{seg.count} khách</span>
                  <span className="text-sm font-semibold text-gray-900 w-12 text-right">
                    {seg.percentage}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(seg.percentage, 100)}%`,
                    backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnomalySection() {
  return (
    <div className="bg-white border border-red-100 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 flex items-center gap-2">
        <span className="text-red-500 text-sm">⚠️</span>
        <h4 className="text-sm font-semibold text-red-700">Phát hiện bất thường</h4>
      </div>
      <div className="p-4 space-y-3">
        {MOCK_ANOMALIES.map((a, i) => (
          <div key={i} className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-red-700">{a.column}</span>
              <span className="text-xs font-medium text-red-500 bg-red-100 px-2 py-0.5 rounded-full">
                {a.outlier_pct}% lệch
              </span>
            </div>
            {a.examples.map((ex, j) => (
              <p key={j} className="text-xs text-red-600">{ex}</p>
            ))}
            <p className="text-xs text-red-400 mt-1">{a.outlier_count}/{a.total_count} giá trị lệch khỏi phân bổ thông thường</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComparisonCard() {
  const comparisons = [
    { label: "ROAS", value: 3.82, benchmark: 3.0, format: "ratio" },
    { label: "Biên lợi nhuận", value: 0.164, benchmark: 0.15, format: "percent" },
    { label: "Tỷ lệ chuyển đổi", value: 0.134, benchmark: 0.05, format: "percent" },
    { label: "Tỷ lệ quay lại", value: 0.214, benchmark: 0.20, format: "percent" },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100">
        <h4 className="text-sm font-semibold text-gray-700">So sánh với ngưỡng tham chiếu</h4>
      </div>
      <div className="p-4 space-y-3">
        {comparisons.map((comp) => {
          const pct = Math.round(comp.format === "percent" ? comp.value * 100 : comp.value * 100);
          const benchPct = Math.round(comp.format === "percent" ? comp.benchmark * 100 : comp.benchmark * 100);
          const isGood = comp.format === "percent" ? comp.value > comp.benchmark : comp.value >= comp.benchmark;
          const ratio = benchPct > 0 ? Math.min(pct / benchPct, 1.5) : 0;
          return (
            <div key={comp.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-700">{comp.label}</span>
                <span className={`text-sm font-semibold ${isGood ? "text-green-600" : "text-amber-600"}`}>
                  {formatMetricValue(comp.value, comp.format)}
                </span>
              </div>
              <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="absolute h-full bg-gray-300 rounded-full" style={{ width: `${Math.min(benchPct / 1.5, 100)}%` }} />
                <div className={`absolute h-full rounded-full transition-all duration-700 ${isGood ? "bg-green-400" : "bg-amber-400"}`}
                  style={{ width: `${Math.min(ratio * 66, 100)}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Ngưỡng: {formatMetricValue(comp.benchmark, comp.format)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendSummaryRow() {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {Object.entries(MOCK_TRENDS).map(([key, label]) => (
        <div key={key} className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">{key}:</span>
          <TrendBadge label={label} />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// PAGE
// ============================================================

export default function SoLieuTinhToanPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                📊 Số liệu tính toán — Kho Chart & Metric Demo
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Trang xem trước toàn bộ biểu đồ và chỉ số có thể hiển thị trên hệ thống Insights
              </p>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium">
                Mock data
              </span>
              <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-medium">
                Demo page
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-12">

        {/* ── SECTION 1: All Chart Types ── */}
        <section>
          <SectionHeader
            emoji="📈"
            title="Tất cả loại biểu đồ"
            subtitle="10 loại biểu đồ được hỗ trợ — bar, horizontal_bar, pie, donut, line, area, comparison, gauge, rank, scatter"
          />

          {/* Primary charts (full width) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <SmartChart chart={MOCK_CHART_DATA.line} />
            <SmartChart chart={MOCK_CHART_DATA.area} />
          </div>

          {/* Gauge row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <SmartChart chart={MOCK_CHART_DATA.gauge} />
            <SmartChart chart={MOCK_CHART_DATA.gaugeMargin} />
            <SmartChart chart={MOCK_CHART_DATA.gaugeConv} />
          </div>

          {/* Secondary charts grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <SmartChart chart={MOCK_CHART_DATA.bar} compact />
            <SmartChart chart={MOCK_CHART_DATA.pie} compact />
            <SmartChart chart={MOCK_CHART_DATA.donut} compact />
            <SmartChart chart={MOCK_CHART_DATA.horizontal_bar} compact />
            <SmartChart chart={MOCK_CHART_DATA.comparison} compact />
            <SmartChart chart={MOCK_CHART_DATA.rank} compact />
          </div>

          {/* Scatter */}
          <div className="mt-5">
            <SmartChart chart={MOCK_CHART_DATA.scatter} />
          </div>
        </section>

        {/* ── SECTION 2: All Metric Groups ── */}
        <section>
          <SectionHeader
            emoji="🔢"
            title="Tất cả nhóm chỉ số (Metric Groups)"
            subtitle="16 KPIs được tính cho báo cáo bán hàng, nhóm theo 4 danh mục"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {METRIC_GROUPS.map((g) => (
              <MetricGroupCard key={g.label} label={g.label} metrics={g.metrics} />
            ))}
          </div>
        </section>

        {/* ── SECTION 3: Key Numbers + Trends ── */}
        <section>
          <SectionHeader emoji="⭐" title="Key Numbers & Trends" />
          <KeyNumbersRow />
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Xu hướng các chỉ số chính</h4>
            <TrendSummaryRow />
          </div>
        </section>

        {/* ── SECTION 4: Top / Bottom Performers ── */}
        <section>
          <SectionHeader
            emoji="🏆"
            title="Top & Bottom Performers"
            subtitle="Top 5 ngày có doanh thu cao nhất và cần chú ý"
          />
          <TopBottomSection />
        </section>

        {/* ── SECTION 5: Segment Breakdown ── */}
        <section>
          <SectionHeader
            emoji="📊"
            title="Phân bổ theo nhóm"
            subtitle="Cơ cấu khách hàng theo 4 nhóm chính"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <SegmentBreakdownCard />
            <ComparisonCard />
          </div>
        </section>

        {/* ── SECTION 6: Anomalies ── */}
        <section>
          <SectionHeader
            emoji="⚠️"
            title="Phát hiện bất thường"
            subtitle="Z-score outlier detection trên các cột số"
          />
          <AnomalySection />
        </section>

        {/* ── SECTION 7: Mini KPI with Sparkline ── */}
        <section>
          <SectionHeader emoji="📉" title="Mini KPI với Sparkline" subtitle="Biểu đồ nhỏ dạng thanh cho xu hướng" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MiniKpiWithSparkline label="Doanh thu" value={2970000000} format="currency" sparkData={[42, 38, 51, 46, 58, 62, 54, 60, 63, 57, 65, 68]} />
            <MiniKpiWithSparkline label="Đơn hàng" value={1372} format="number" sparkData={[180, 195, 210, 185, 220, 230, 205, 225, 235, 218, 240, 248]} />
            <MiniKpiWithSparkline label="ROAS" value={3.82} format="ratio" sparkData={[3.2, 2.9, 3.5, 3.1, 3.8, 4.1, 3.6, 3.9, 4.2, 3.7, 4.0, 3.8]} />
            <MiniKpiWithSparkline label="Khách hàng mới" value={487} format="number" sparkData={[38, 42, 45, 40, 48, 52, 44, 50, 55, 46, 53, 58]} />
          </div>
        </section>

        {/* ── SECTION 8: Progress Rings ── */}
        <section>
          <SectionHeader emoji="⭕" title="Progress Rings" subtitle="Vòng tròn tiến độ cho các chỉ số tỷ lệ" />
          <div className="bg-white border border-gray-200 rounded-xl px-6 py-6">
            <div className="flex flex-wrap gap-8 justify-center">
              <ProgressRing value={0.82} label="Chất lượng dữ liệu" />
              <ProgressRing value={0.71} label="Sử dụng ngân sách" />
              <ProgressRing value={0.94} label="Hoàn thành KPI" />
              <ProgressRing value={0.58} label="Tỷ lệ chuyển đổi" />
              <ProgressRing value={0.36} label="Tỷ lệ quay lại" />
            </div>
          </div>
        </section>

        {/* ── SECTION 9: Full 2-Column Overview Mock ── */}
        <section>
          <SectionHeader
            emoji="🗂️"
            title="Layout Tổng quan hoàn chỉnh"
            subtitle="Mock layout 2 cột — Metrics (2/5) + Charts (3/5) như trên trang Insights thực"
          />
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Banner */}
            <div className="bg-indigo-50 px-5 py-3 border-b border-indigo-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-xs">📋</span>
                  <div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                      Báo cáo bán hàng
                    </span>
                    <p className="text-sm text-indigo-700 mt-0.5">
                      Tổng doanh thu đạt 2.97B VNĐ — Xuất sắc
                    </p>
                  </div>
                </div>
                <span className="text-xs text-indigo-400">Chất lượng 82%</span>
              </div>
            </div>

            {/* 2-column layout */}
            <div className="p-5">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                {/* Metrics (left) */}
                <div className="lg:col-span-2 space-y-4">
                  {METRIC_GROUPS.slice(0, 2).map((g) => (
                    <MetricGroupCard key={g.label} label={g.label} metrics={g.metrics} />
                  ))}
                </div>

                {/* Charts (right) */}
                <div className="lg:col-span-3 space-y-3">
                  <SmartChart chart={MOCK_CHART_DATA.line} compact />
                  <div className="grid grid-cols-2 gap-3">
                    <SmartChart chart={MOCK_CHART_DATA.pie} compact />
                    <SmartChart chart={MOCK_CHART_DATA.gauge} compact />
                  </div>
                </div>
              </div>

              {/* Enrichment below */}
              <div className="mt-5 space-y-4">
                <KeyNumbersRow />
                <TopBottomSection />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SegmentBreakdownCard />
                  <ComparisonCard />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 10: Report Type Catalog ── */}
        <section>
          <SectionHeader
            emoji="🗂️"
            title="Danh mục loại báo cáo"
            subtitle="10 loại báo cáo được hỗ trợ — mỗi loại có KPI và chart riêng"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { type: "sales_report", icon: "🛒", color: "blue", desc: "Doanh thu, đơn hàng, khách hàng" },
              { type: "marketing_report", icon: "📢", color: "purple", desc: "Chiến dịch, ROAS, chi phí quảng cáo" },
              { type: "expense_report", icon: "💸", color: "amber", desc: "Chi phí theo danh mục, bộ phận" },
              { type: "payroll_report", icon: "💰", color: "green", desc: "Lương, phụ cấp, thưởng, khấu trừ" },
              { type: "budget_report", icon: "📋", color: "indigo", desc: "Kế hoạch vs Thực tế" },
              { type: "inventory_report", icon: "📦", color: "teal", desc: "Tồn kho, nhập, xuất" },
              { type: "customer_report", icon: "👥", color: "pink", desc: "Phân loại, LTV, churn" },
              { type: "financial_summary", icon: "🏦", color: "cyan", desc: "Thu chi, lãi lỗ, dòng tiền" },
              { type: "project_report", icon: "🏗️", color: "orange", desc: "Tiến độ, chi phí dự án" },
              { type: "hr_report", icon: "👷", color: "gray", desc: "Nhân sự, tuyển dụng, KPI" },
            ].map((r) => (
              <div key={r.type} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{r.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{r.type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 py-8 border-t border-gray-200">
          <p>Kho chart & metric demo — Insights AI Analyst — Dữ liệu ảo chỉ để xem trước UI</p>
        </div>
      </div>
    </div>
  );
}
