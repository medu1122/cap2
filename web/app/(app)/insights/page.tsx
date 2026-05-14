"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter,
} from "recharts";
import { api, postNdjsonStream, type DeepAnalysisStreamEvent } from "@/lib/api-client";
import HelpDialogButton from "@/components/common/HelpDialogButton";
import {
  Upload, Table2, MessageSquare, TrendingUp, AlertTriangle,
  CheckCircle2, Sparkles, BarChart3, FileSpreadsheet, ChevronRight,
  Loader2, Maximize2, X, Plus,
} from "lucide-react";

// ============= TYPES =============

interface Column {
  id: string;
  name: string;
  dataType: "text" | "number" | "date";
}

interface TableRow {
  [key: string]: string | number;
}

interface DataSource {
  id: string;
  name: string;
  source_type: string;
  row_count: number;
  column_count: number;
  original_filename: string | null;
  created_at: string;
  updated_at: string;
}

interface DataSourceDetail {
  id: string;
  name: string;
  source_type: string;
  original_filename: string | null;
  schema: { columns: Array<{ name: string }> };
  data: { rows: TableRow[] };
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  message_context?: Record<string, unknown>;
  suggested_visualizations?: unknown[];
  created_at: string;
}

interface ChatSession {
  id: string;
  data_source_id: string;
  title: string | null;
  messages: ChatMessage[];
  data_source_context?: {
    name: string;
    schema: { columns: Column[] };
    row_count: number;
    sample_rows: TableRow[];
  };
}

interface ChartDataItem {
  name: string;
  value?: number;
  planned?: number;
  actual?: number;
}

interface ChartData {
  type: string;
  title: string;
  data: ChartDataItem[];
  group_by?: string;
}

interface ComputedKPI {
  [key: string]: string | number | Record<string, number> | string[] | undefined;
}

interface DeepAnalysisResult {
  run_id?: string;
  business_name?: string;
  report_type?: string;
  report_type_label?: string;
  report_description?: string;
  kpis?: {
    revenue: number;
    ad_spend: number;
    orders: number;
    leads: number;
    roas: number;
    conversion_rate: number;
    repeat_rate: number;
    aov: number;
  };
  computed_kpis?: ComputedKPI;
  chart_data?: {
    primary: ChartData | null;
    secondary: ChartData[];
  };
  enrichment?: {
    summary?: string | null;
    trend_data?: Record<string, unknown>;
    top_items?: Array<{
      rank: number;
      name: string;
      value: number;
      metric: string;
      metric_label?: string;
    }>;
    bottom_items?: Array<{
      rank: number;
      name: string;
      value: number;
      metric: string;
    }>;
    segment_breakdown?: Array<{
      name: string;
      value: number;
      count: number;
      percentage: number;
    }>;
    anomalies?: Array<{
      column: string;
      outlier_count: number;
      total_count: number;
      outlier_pct: number;
      examples: string[];
      direction: string;
    }>;
    key_numbers?: Array<{
      key: string;
      label: string;
      value: number;
      format: string;
    }>;
  };
  insights?: Array<{
    title: string;
    severity: string;
    evidence: Record<string, number>;
    recommendation: string;
  }>;
  suggested_actions?: Array<{
    id: string;
    title: string;
    priority: string;
    target_segment: string;
    reason: string;
  }>;
  data_quality_score?: number;
}


// Type alias for enrichment data
type EnrichmentData = {
  summary?: string | null;
  trend_data?: Record<string, unknown>;
  top_items?: Array<{
    rank: number;
    name: string;
    value: number;
    metric: string;
    metric_label?: string;
  }>;
  bottom_items?: Array<{
    rank: number;
    name: string;
    value: number;
    metric: string;
  }>;
  segment_breakdown?: Array<{
    name: string;
    value: number;
    count: number;
    percentage: number;
  }>;
  anomalies?: Array<{
    column: string;
    outlier_count: number;
    total_count: number;
    outlier_pct: number;
    examples: string[];
    direction: string;
  }>;
  key_numbers?: Array<{
    key: string;
    label: string;
    value: number;
    format: string;
  }>;
};

type KeyNumbers = EnrichmentData["key_numbers"];
type SegmentBreakdown = EnrichmentData["segment_breakdown"];
type AnomalyItem = {
  column: string;
  outlier_count: number;
  total_count: number;
  outlier_pct: number;
  examples: string[];
  direction: string;
};
type TrendData = EnrichmentData["trend_data"];

// ============= TYPES FOR UI STATE =============

type AppStep = "input" | "analyzing" | "results";

// ============= HELPERS =============

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("vi-VN");
}

function formatCurrencyFull(value: number): string {
  return value.toLocaleString("vi-VN");
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

function parseCsvText(text: string): { headers: string[]; rows: TableRow[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("File CSV không có dữ liệu hợp lệ.");
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: TableRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
    const row: TableRow = {};
    headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });
    rows.push(row);
  }
  return { headers, rows };
}

function detectColumnType(values: string[]): "text" | "number" | "date" {
  const sample = values.slice(0, 20).filter(Boolean);
  if (sample.every((v) => !isNaN(Number(v)) && v !== "")) return "number";
  if (sample.every((v) => !isNaN(Date.parse(v)) && v !== "")) return "date";
  return "text";
}

// ============= METRIC & CHART HELPERS =============

const CHART_COLORS = [
  "#93c5fd", "#86efac", "#fde68a", "#fbcfe8",
  "#c4b5fd", "#fed7aa", "#99f6e4", "#d1d5db",
];

function formatMetricValue(value: number, fmt: string): string {
  if (typeof value !== "number" || !isFinite(value)) return "—";
  if (value === 0) return "0";

  if (fmt === "percent") return `${(value * 100).toFixed(2)}%`;
  if (fmt === "ratio") return value.toFixed(2);

  // Currency + generic number: unified B/M/K abbreviation, always 2 decimal
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  if (Math.abs(value) < 1) return value.toFixed(2);
  return Math.round(value).toLocaleString("vi-VN");
}

function isMetricComputable(value: unknown): boolean {
  return typeof value === "number" && isFinite(value) && value !== 0;
}

const METRIC_GROUP_LABELS: Record<string, string> = {
  tong_hop: "Tổng hợp",
  trung_binh: "Trung bình",
  ti_le: "Tỷ lệ",
  chenh_lech: "Chênh lệch",
  ton_kho: "Tồn kho / Đơn hàng",
  luong: "Lương",
  nhan_su: "Nhân sự",
  du_an: "Dự án",
  khach_hang: "Khách hàng",
  san_pham: "Sản phẩm",
  doanh_so: "Doanh số",
  chat_luong: "Chất lượng",
  khac: "Khác",
};

const CHART_TYPE_LABELS: Record<string, string> = {
  bar: "Biểu đồ cột",
  horizontal_bar: "Biểu đồ cột ngang",
  pie: "Biểu đồ tròn",
  donut: "Biểu đồ tròn (vòng)",
  line: "Biểu đồ đường",
  area: "Biểu đồ vùng",
  comparison: "So sánh kế hoạch",
  gauge: "Chỉ số hiệu suất",
  rank: "Xếp hạng",
  scatter: "Phân tán",
};

const KPI_LABEL_VI: Record<string, string> = {
  revenue: "Doanh thu",
  total_revenue: "Tổng doanh thu",
  ad_spend: "Chi phí quảng cáo",
  total_cost: "Tổng chi phí",
  product_cost: "Chi phí sản phẩm",
  other_cost: "Chi phí khác",
  gross_profit: "Lợi nhuận gộp",
  net_profit: "Lợi nhuận ròng",
  total_income: "Tổng thu nhập",
  total_expense: "Tổng chi phí",
  total_profit: "Tổng lợi nhuận",
  total_budget: "Tổng ngân sách",
  total_stock_value: "Giá trị tồn kho",
  orders: "Số đơn hàng",
  repeat_orders: "Đơn hàng lặp lại",
  leads: "Khách tiềm năng",
  new_customers: "Khách hàng mới",
  repeat_customers: "Khách quay lại",
  qty_sold: "Số sản phẩm bán",
  total_units_sold: "Tổng sản phẩm bán",
  roas: "ROAS",
  conversion_rate: "Tỷ lệ chuyển đổi",
  repeat_rate: "Tỷ lệ quay lại",
  new_customer_rate: "Tỷ lệ khách mới",
  profit_margin: "Biên lợi nhuận ròng",
  gross_margin: "Biên lợi nhuận gộp",
  budget_utilization: "Sử dụng ngân sách",
  return_rate: "Tỷ lệ trả hàng",
  churn_rate: "Tỷ lệ mất khách",
  completion_rate: "Tỷ lệ hoàn thành",
  on_time_rate: "Tỷ lệ đúng hạn",
  active_rate: "Tỷ lệ hoạt động",
  turnover_rate_hr: "Tỷ lệ nghỉ việc",
  expense_ratio: "Tỷ lệ chi phí",
  aov: "Giá trị đơn TB",
  avg_revenue: "Doanh thu TB",
  avg_cost: "Chi phí TB",
  avg_order_value: "Giá trị đơn TB",
  avg_ltv: "Giá trị vòng đời TB",
  avg_salary: "Lương TB",
  avg_kpi: "KPI TB",
  avg_price: "Giá TB",
  avg_leads_per_day: "Khách/ngày TB",
  avg_stock: "Tồn kho TB",
  avg_progress: "Tiến độ TB",
  total_payroll: "Tổng quỹ lương",
  headcount: "Số nhân viên",
  total_headcount: "Tổng nhân viên",
  active_headcount: "Nhân viên hoạt động",
  total_allowance: "Phụ cấp",
  total_bonus: "Thưởng",
  total_deduction: "Khấu trừ",
  min_salary: "Lương thấp nhất",
  max_salary: "Lương cao nhất",
  salary_range: "Khoảng lương",
  new_hires: "Tuyển mới",
  on_leave_count: "Nghỉ phép",
  turnover_count: "Nghỉ việc",
  productivity_score: "Năng suất",
  total_stock: "Tổng tồn kho",
  total_stock_in: "Nhập kho",
  total_stock_out: "Xuất kho",
  low_stock_count: "Hàng sắp hết",
  dead_stock_count: "Hàng ứ đọng",
  total_projects: "Tổng dự án",
  completed_projects: "Hoàn thành",
  in_progress_projects: "Đang thực hiện",
  overdue_projects: "Quá hạn",
  over_budget_projects: "Vượt ngân sách",
  variance: "Chênh lệch",
  variance_pct: "Tỷ lệ chênh",
  growth_rate: "Tăng trưởng",
  cagr: "CAGR",
  data_quality_score: "Chất lượng dữ liệu",
  data_completeness: "Độ đầy đủ",
  data_accuracy: "Độ chính xác",
};

// ============= CONSTANTS =============

const REPORT_TYPE_LABEL_VI: Record<string, string> = {
  sales_report: "Báo cáo bán hàng",
  expense_report: "Báo cáo chi phí",
  payroll_report: "Báo cáo lương",
  budget_report: "Báo cáo ngân sách",
  inventory_report: "Báo cáo tồn kho",
  customer_report: "Báo cáo khách hàng",
  financial_summary: "Tóm tắt tài chính",
  project_report: "Báo cáo dự án",
  hr_report: "Báo cáo nhân sự",
  product_report: "Báo cáo sản phẩm",
  generic_report: "Báo cáo tổng hợp",
};

const STREAM_STEP_LABEL_VI: Record<string, string> = {
  classify_report: "Phân loại báo cáo",
  map_schema: "Ánh xạ cột dữ liệu",
  compute_metrics: "Tính toán chỉ số",
  narrative: "Diễn giải kết quả",
  polish_result: "Chuẩn hóa tiếng Việt",
};

const PIPELINE_STEPS = [
  { label: "Phân loại báo cáo", model: "DeepSeek" },
  { label: "Ánh xạ cột dữ liệu", model: "DeepSeek" },
  { label: "Tính toán chỉ số", model: "Pandas" },
  { label: "Diễn giải kết quả", model: "Qwen/GPT" },
  { label: "Chuẩn hóa kết quả", model: "DeepSeek" },
] as const;

// ============= SUB-COMPONENTS =============

// Hero Section Component
function HeroSection() {
  return (
    <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-6 text-white mb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">AI Analyst</h1>
            <p className="text-blue-100 text-sm mt-0.5">
              Phân tích dữ liệu thông minh với AI
            </p>
          </div>
        </div>
        <HelpDialogButton
          title="Hướng dẫn AI Analyst"
          summary="AI Analyst giúp bạn phân tích dữ liệu: upload file hoặc tạo bảng, AI phân tích và trả lời mọi câu hỏi."
          steps={[
            "Nhập dữ liệu: Upload file CSV/Excel hoặc tạo bảng mới",
            "Nhấn 'Phân tích' để AI xử lý dữ liệu",
            "Xem KPIs, Insights và Actions được AI đề xuất",
            "Trò chuyện với AI để hiểu sâu hơn về dữ liệu",
          ]}
        />
      </div>
    </div>
  );
}

// File Upload Button
function FileUploadButton({
  onUpload,
  uploading,
}: {
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.currentTarget.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Upload className="w-4 h-4" />
        )}
        Upload file
      </button>
      <span className="text-xs text-gray-400">CSV, XLSX</span>
    </div>
  );
}

// Table Builder Component
function TableBuilder({
  columns,
  rows,
  onColumnsChange,
  onRowsChange,
  tableName,
  onTableNameChange,
  fullscreen,
  onFullscreen,
}: {
  columns: Column[];
  rows: TableRow[];
  onColumnsChange: (cols: Column[]) => void;
  onRowsChange: (rows: TableRow[]) => void;
  tableName: string;
  onTableNameChange: (name: string) => void;
  fullscreen: boolean;
  onFullscreen: () => void;
}) {
  const [editingCol, setEditingCol] = useState<string | null>(null);
  const [newColName, setNewColName] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);

  // Auto-add row when typing in last row
  function addRowIfNeeded(rowIndex: number) {
    if (rowIndex === rows.length - 1) {
      const newRow: TableRow = {};
      columns.forEach((c) => { newRow[c.name] = ""; });
      onRowsChange([...rows, newRow]);
    }
  }

  // Auto-add column when typing in column input
  function handleColumnInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && newColName.trim()) {
      const newCol: Column = {
        id: generateId(),
        name: newColName.trim(),
        dataType: "text",
      };
      onColumnsChange([...columns, newCol]);
      const updatedRows = rows.map((r) => ({ ...r, [newCol.name]: "" }));
      onRowsChange(updatedRows);
      setNewColName("");
    }
  }

  function updateColumn(id: string, updates: Partial<Column>) {
    const oldCol = columns.find((c) => c.id === id);
    if (!oldCol) return;
    const updated = columns.map((c) => c.id === id ? { ...c, ...updates } : c);
    onColumnsChange(updated);
    if (updates.name && updates.name !== oldCol.name) {
      const updatedRows = rows.map((r) => {
        const val = r[oldCol.name];
        const { [oldCol.name]: _, ...rest } = r;
        return { ...rest, [updates.name!]: val };
      });
      onRowsChange(updatedRows);
    }
    setEditingCol(null);
  }

  function deleteColumn(id: string) {
    const col = columns.find((c) => c.id === id);
    if (!col) return;
    const updated = columns.filter((c) => c.id !== id);
    onColumnsChange(updated);
    const updatedRows = rows.map((r) => {
      const { [col.name]: _, ...rest } = r;
      return rest;
    });
    onRowsChange(updatedRows);
  }

  function updateCell(rowIndex: number, colName: string, value: string) {
    const updatedRows = rows.map((r, i) =>
      i === rowIndex ? { ...r, [colName]: value } : r
    );
    onRowsChange(updatedRows);
    // Auto add row if typing in last row
    addRowIfNeeded(rowIndex);
  }

  function deleteRow(index: number) {
    onRowsChange(rows.filter((_, i) => i !== index));
  }

  return (
    <div 
      ref={tableRef}
      className={`border border-gray-200 rounded-xl overflow-hidden bg-white ${
        fullscreen ? "fixed inset-4 z-50 flex flex-col" : ""
      }`}
    >
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Table2 className="w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={tableName}
            onChange={(e) => onTableNameChange(e.target.value)}
            className="font-medium text-gray-900 bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
            placeholder="Tên bảng..."
          />
          <span className="text-sm text-gray-400">
            {columns.length} cột · {rows.length} dòng
          </span>
        </div>
        <button
          onClick={onFullscreen}
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title={fullscreen ? "Thu nhỏ" : "Phóng to"}
        >
          {fullscreen ? <X className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Column Management - Only show existing columns */}
      {columns.length > 0 && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Các cột:</span>
            {columns.map((col) => (
              <div key={col.id} className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1">
                {editingCol === col.id ? (
                  <input
                    type="text"
                    value={col.name}
                    onChange={(e) => updateColumn(col.id, { name: e.target.value })}
                    onBlur={() => setEditingCol(null)}
                    onKeyDown={(e) => e.key === "Enter" && setEditingCol(null)}
                    className="w-28 text-sm bg-transparent border-0 focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => setEditingCol(col.id)}
                    className="text-sm text-gray-700 hover:text-blue-600"
                  >
                    {col.name}
                  </button>
                )}
                <span className="text-xs text-gray-400">({col.dataType})</span>
                <button
                  onClick={() => deleteColumn(col.id)}
                  className="text-gray-400 hover:text-red-500 ml-1"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table Data */}
      <div className={`overflow-auto ${fullscreen ? "flex-1" : "max-h-[400px]"}`}>
        <table className="w-full text-sm">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="border-b border-gray-200 px-3 py-2 w-12 text-left text-gray-500 font-medium">#</th>
              {columns.map((col) => (
                <th key={col.id} className="border-b border-gray-200 px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap">
                  {col.name}
                </th>
              ))}
              <th className="border-b border-gray-200 px-3 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(columns.length + 2, 3)} className="px-3 py-8 text-center text-gray-400">
                  Thêm cột bên dưới để bắt đầu
                </td>
              </tr>
            ) : (
              rows.map((row, rowIdx) => (
                <tr 
                  key={rowIdx} 
                  className={`${rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50/50"} ${
                    rowIdx === rows.length - 1 ? "border-b-2 border-blue-200" : ""
                  }`}
                >
                  <td className="border-b border-gray-100 px-3 py-1.5 text-gray-400">{rowIdx + 1}</td>
                  {columns.map((col) => (
                    <td key={col.id} className="border-b border-gray-100 px-3 py-1.5">
                      <input
                        type="text"
                        value={String(row[col.name] ?? "")}
                        onChange={(e) => updateCell(rowIdx, col.name, e.target.value)}
                        className="w-full bg-transparent border-0 p-0 focus:outline-none focus:ring-1 focus:ring-blue-400 whitespace-nowrap"
                      />
                    </td>
                  ))}
                  <td className="border-b border-gray-100 px-3 py-1.5">
                    {rows.length > 1 && (
                      <button
                        onClick={() => deleteRow(rowIdx)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer - Add Column */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center gap-2">
        <Plus className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={newColName}
          onChange={(e) => setNewColName(e.target.value)}
          onKeyDown={handleColumnInputKeyDown}
          placeholder="Nhập tên cột mới và nhấn Enter..."
          className="flex-1 text-sm bg-transparent border-0 focus:outline-none focus:ring-0 placeholder:text-gray-400"
        />
      </div>

      {/* Fullscreen backdrop */}
      {fullscreen && (
        <div 
          className="fixed inset-0 bg-black/20 -z-10"
          onClick={onFullscreen}
        />
      )}
    </div>
  );
}

// KPI Card Component
function KpiCard({ label, value, format = "number", icon, trend }: {
  label: string;
  value: number;
  format?: "number" | "currency" | "percent";
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
}) {
  const display = format === "currency"
    ? formatMetricValue(Math.round(value), "currency")
    : format === "percent"
    ? `${(value * 100).toFixed(2)}%`
    : formatMetricValue(Math.round(value), "number");

  const valueColor = value >= 0 ? "text-gray-900" : "text-red-500";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        {icon && <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
          {icon}
        </div>}
      </div>
      <p className={`text-2xl font-bold mb-1 ${valueColor}`}>{display}</p>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-medium ${
          trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-gray-500"
        }`}>
          {trend === "up" && <TrendingUp className="w-3 h-3" />}
          {trend === "down" && <TrendingUp className="w-3 h-3 rotate-180" />}
          {trend === "neutral" && "—"}
        </div>
      )}
    </div>
  );
}

// Insight Card Component
function InsightCard({ insight }: { 
  insight: {
    title: string;
    severity: string;
    recommendation: string;
  };
}) {
  const severityConfig = {
    high: { color: "red", bg: "bg-red-50", border: "border-red-200", label: "Cao" },
    medium: { color: "amber", bg: "bg-amber-50", border: "border-amber-200", label: "TB" },
    low: { color: "green", bg: "bg-green-50", border: "border-green-200", label: "Thấp" },
  };
  
  const config = severityConfig[insight.severity as keyof typeof severityConfig] || severityConfig.medium;
  const SeverityIcon = config.color === "red" ? AlertTriangle : config.color === "green" ? CheckCircle2 : AlertTriangle;
  
  return (
    <div className={`${config.bg} border ${config.border} rounded-xl p-4`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          config.color === "red" ? "bg-red-100 text-red-600" :
          config.color === "green" ? "bg-green-100 text-green-600" :
          "bg-amber-100 text-amber-600"
        }`}>
          <SeverityIcon className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-gray-900">{insight.title}</h4>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              config.color === "red" ? "bg-red-100 text-red-700" :
              config.color === "green" ? "bg-green-100 text-green-700" :
              "bg-amber-100 text-amber-700"
            }`}>
              {config.label}
            </span>
          </div>
          <p className="text-sm text-gray-600">{insight.recommendation}</p>
        </div>
      </div>
    </div>
  );
}

// Action Card Component
function ActionCard({ action }: { 
  action: {
    title: string;
    priority: string;
    reason: string;
  };
}) {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
          <ChevronRight className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-gray-900 mb-1">{action.title}</h4>
          <p className="text-sm text-gray-600">{action.reason}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CHART ZOOM MODAL
// ============================================================
function ChartZoomModal({
  chart,
  onClose,
}: {
  chart: ChartData;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              {CHART_TYPE_LABELS[chart.type] || ""}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">{chart.title}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chart */}
        <div className="p-5">
          <ResponsiveContainer width="100%" height={400}>
            <SmartChart chart={chart} />
          </ResponsiveContainer>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 text-center">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium rounded-lg transition-all"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

// Smart Chart Component
function SmartChart({ chart, compact = false }: { chart: ChartData; compact?: boolean }) {
  const { type, title, data } = chart;
  const [zoomOpen, setZoomOpen] = useState(false);
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

    if (type === "gauge") {
      // Single value gauge: show the first data point as a ring
      const gaugeVal = data[0]?.value ?? 0;
      const gaugeMax = Math.max(...data.map((d) => d.value ?? 0)) || gaugeVal || 1;
      const pct = Math.min(gaugeVal / gaugeMax, 1);
      const circ = 2 * Math.PI * 36;
      const color = pct >= 0.7 ? "#86efac" : pct >= 0.4 ? "#fde68a" : "#fca5a5";
      return (
        <div className="flex flex-col items-center justify-center h-full py-4">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="36" fill="none" stroke="#f0f0f0" strokeWidth="10" />
            <circle cx="60" cy="60" r="36" fill="none" stroke={color} strokeWidth="10"
              strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
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
      // Rank: show as horizontal bars sorted by value descending
      const sortedData = [...data].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 8);
      const maxVal = sortedData[0]?.value ?? 1;
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
          <XAxis dataKey="x" name="X" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
            tickFormatter={(v) => formatMetricValue(v, "currency")} />
          <YAxis dataKey="y" name="Y" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
            tickFormatter={(v) => formatMetricValue(v, "currency")} />
          <Tooltip
            formatter={(v: number) => [formatMetricValue(v, "currency"), ""]}
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

    // Fallback for unknown types — treat as bar
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
    <div className="relative">
      <div
        className="bg-white border border-gray-200 rounded-xl p-4"
      >
        <div className="flex items-start justify-between mb-1">
          <div>
            <h4 className="text-sm font-medium text-gray-700">{CHART_TYPE_LABELS[type] || ""}</h4>
            <p className="text-xs text-gray-500">{title}</p>
          </div>
          <button
            onClick={() => setZoomOpen(true)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all flex-shrink-0"
            title="Phóng to"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <ResponsiveContainer width="100%" height={height}>
          {renderContent()}
        </ResponsiveContainer>
      </div>
      {zoomOpen && <ChartZoomModal chart={chart} onClose={() => setZoomOpen(false)} />}
    </div>
  );
}

// Smart Metric Card — chi hien thi khi gia tri hop le
function SmartMetricCard({ label, value, format = "number" }: {
  label: string;
  value: number;
  format?: string;
}) {
  if (!isMetricComputable(value)) return null;
  const display = formatMetricValue(value, format);
  const [showPopover, setShowPopover] = useState(false);

  // Color: green for positive, red for negative
  const valueColor = value >= 0 ? "text-emerald-600" : "text-red-500";

  return (
    <div className="relative">
      <div
        onClick={() => setShowPopover(!showPopover)}
        className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-col gap-1 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group"
      >
        <span className="text-xs font-medium text-gray-400">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className={`text-base font-bold ${valueColor}`}>{display}</span>
          <span className="text-gray-300 group-hover:text-indigo-400 transition-colors text-xs opacity-0 group-hover:opacity-100">ⓘ</span>
        </div>
      </div>
      {showPopover && (
        <MetricPopover label={label} value={value} format={format || "number"} onClose={() => setShowPopover(false)} />
      )}
    </div>
  );
}

// Metric Popover — explains what a metric means and how it was calculated
function MetricPopover({ label, value, format, onClose }: {
  label: string;
  value: number;
  format: string;
  onClose: () => void;
}) {
  // Detect metric type from label
  const labelLower = label.toLowerCase();

  function getExplanation(l: string): { what: string; how: string; tip: string } {
    if (l.includes("doanh thu") || l.includes("revenue")) {
      return {
        what: "Tổng doanh thu = Tổng giá trị tất cả đơn hàng đã bán trong kỳ.",
        how: `Giá trị được tính bằng cách cộng tất cả giá trị cột "Doanh thu" trong bảng dữ liệu của bạn.`,
        tip: "Nếu doanh thu cao nhưng lợi nhuận thấp → chi phí đang cao. Cần kiểm tra bảng chi phí.",
      };
    }
    if (l.includes("chi phí") || l.includes("cost") || l.includes("ad spend")) {
      return {
        what: "Tổng chi phí = Tổng tất cả các khoản chi (quảng cáo, vận hành, nhân sự...).",
        how: `Cộng tất cả giá trị trong các cột chi phí tương ứng.`,
        tip: "Chi phí chiếm bao nhiêu % doanh thu? Nếu > 60% → cần tối ưu.",
      };
    }
    if (l.includes("roas")) {
      return {
        what: "ROAS = Doanh thu ÷ Chi phí quảng cáo. Đo lường hiệu quả đồng vốn quảng cáo.",
        how: `ROAS = Tổng doanh thu ÷ Tổng chi phí quảng cáo. Ví dụ: ROAS = 4.0 nghĩa là 1 đồng quảng cáo tạo ra 4 đồng doanh thu.`,
        tip: "ROAS ≥ 3.0: Xuất sắc | 1.5–3.0: Tốt | < 1.5: Cần cải thiện",
      };
    }
    if (l.includes("chuyển đổi") || l.includes("conversion")) {
      return {
        what: "Tỷ lệ chuyển đổi = Số đơn hàng ÷ Số khách tiềm năng × 100%.",
        how: `Tỷ lệ bao nhiêu % khách tiềm năng thực sự mua hàng.`,
        tip: "Tỷ lệ > 10%: Tốt | 5-10%: TB | < 5%: Cần cải thiện landing page / giá",
      };
    }
    if (l.includes("quay lại") || l.includes("repeat")) {
      return {
        what: "Tỷ lệ quay lại = Đơn hàng lặp ÷ Tổng đơn hàng × 100%.",
        how: `Đo lường tỷ lệ khách hàng quay lại mua thêm.`,
        tip: "Tỷ lệ > 20%: Khách trung thành tốt | < 10%: Cần chương trình giữ chân",
      };
    }
    if (l.includes("lợi nhuận") || l.includes("profit")) {
      return {
        what: "Lợi nhuận = Doanh thu − Chi phí. Số tiền thực nhận sau khi trừ mọi chi phí.",
        how: `Lợi nhuận ròng = Tổng doanh thu − (Chi phí quảng cáo + Chi phí sản phẩm + Chi phí khác).`,
        tip: "Biên lợi nhuận > 20%: Tốt | 10-20%: TB | < 10%: Cần giảm chi phí hoặc tăng giá",
      };
    }
    if (l.includes("khách") || l.includes("customer")) {
      return {
        what: "Số khách hàng = Tổng số khách hàng có trong danh sách.",
        how: `Đếm tổng số dòng trong cột khách hàng. Phân biệt khách mới vs khách cũ qua cột riêng.`,
        tip: "Theo dõi tỷ lệ khách mới / khách cũ để đánh giá chiến lược marketing.",
      };
    }
    if (l.includes("đơn") || l.includes("order")) {
      return {
        what: "Số đơn hàng = Tổng số giao dịch bán hàng thành công.",
        how: `Đếm tất cả các dòng có giá trị trong cột đơn hàng.`,
        tip: "Số đơn = Doanh thu ÷ Giá trị TB mỗi đơn (AOV).",
      };
    }
    if (l.includes("lead")) {
      return {
        what: "Số khách tiềm năng (Lead) = Tổng số người quan tâm hoặc liên hệ ban đầu.",
        how: `Đếm tất cả giá trị trong cột khách tiềm năng / lead.`,
        tip: "Lead nhiều nhưng đơn ít → tỷ lệ chuyển đổi đang thấp. Cần cải thiện.",
      };
    }
    if (l.includes("lương") || l.includes("salary")) {
      return {
        what: "Tổng quỹ lương = Tổng lương + Phụ cấp + Thưởng − Khấu trừ của tất cả nhân viên.",
        how: `Cộng tất cả các giá trị trong cột lương tương ứng.`,
        tip: "Quỹ lương nên chiếm < 40% doanh thu để đảm bảo hiệu quả.",
      };
    }
    if (l.includes("tồn kho") || l.includes("inventory")) {
      return {
        what: "Tồn kho = Số lượng sản phẩm hiện có trong kho.",
        how: `Lấy giá trị tồn kho hiện tại từ cột tương ứng.`,
        tip: "Hàng tồn > 90 ngày bán → cần khuyến mãi hoặc giảm nhập.",
      };
    }
    // Generic fallback
    return {
      what: `${label} = Chỉ số được tính toán từ dữ liệu bảng của bạn.`,
      how: `Giá trị = ${formatMetricValue(value, format)} được làm tròn từ dữ liệu gốc.`,
      tip: "Nhấn vào metric để xem giải thích chi tiết.",
    };
  }

  const info = getExplanation(labelLower);

  return (
    <div className="absolute top-full left-0 mt-1 z-50 w-72 bg-white rounded-xl shadow-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-900">{label}</h4>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-sm font-medium text-indigo-700 mb-2">{info.what}</p>
      <div className="bg-gray-50 rounded-lg p-2.5 mb-2">
        <p className="text-xs text-gray-500 mb-0.5">Cách tính:</p>
        <p className="text-xs text-gray-700">{info.how}</p>
      </div>
      <div className="flex items-start gap-1.5 bg-blue-50 rounded-lg p-2.5">
        <TrendingUp className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">{info.tip}</p>
      </div>
    </div>
  );
}

// Smart Metric Group
function SmartMetricGroup({ metrics, groupLabel }: {
  metrics: Array<{ key: string; label: string; value: number; format?: string }>;
  groupLabel: string;
}) {
  const computable = metrics.filter((m) => isMetricComputable(m.value));
  if (computable.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{groupLabel}</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {computable.map((m) => (
          <SmartMetricCard key={m.key} label={m.label} value={m.value} format={m.format} />
        ))}
      </div>
    </div>
  );
}

// Metric Summary Panel
function MetricsPanel({ computedKpis }: { computedKpis?: ComputedKPI }) {
  if (!computedKpis) return null;

  const groups: Record<string, Array<{ key: string; label: string; value: number; format?: string }>> = {};

  for (const [key, val] of Object.entries(computedKpis)) {
    if (typeof val !== "number" || !isFinite(val) || val === 0) continue;

    // Determine group + label from key
    let group = "khac";
    let label = KPI_LABEL_VI[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    if (["total_revenue", "total_cost", "total_payroll", "total_income", "total_expense",
         "total_profit", "total_budget", "total_stock_value", "revenue", "ad_spend",
         "gross_profit", "net_profit", "product_cost", "other_cost"].includes(key)) {
      group = "tong_hop"; if (!KPI_LABEL_VI[key]) label = label.replace("Total ", "Tổng ");
    } else if (["avg_salary", "avg_revenue", "avg_cost", "avg_order_value", "avg_ltv",
                "avg_kpi", "avg_price", "avg_stock", "aov", "avg_leads_per_day"].includes(key)) {
      group = "trung_binh"; if (!KPI_LABEL_VI[key]) label = label.replace("Avg ", "TB ");
    } else if (["roas", "conversion_rate", "repeat_rate", "profit_margin", "expense_ratio",
                "budget_utilization", "turnover_rate_hr", "churn_rate", "completion_rate",
                "on_time_rate", "return_rate", "new_customer_rate", "active_rate"].includes(key)) {
      group = "ti_le";
    } else if (["variance", "variance_pct", "growth_rate", "cagr"].includes(key)) {
      group = "chenh_lech";
    } else if (["total_stock", "total_stock_in", "total_stock_out", "low_stock_count", "dead_stock_count",
                 "total_units_sold", "qty_sold", "headcount"].includes(key)) {
      group = "ton_kho";
    } else if (["total_allowance", "total_bonus", "total_deduction", "min_salary", "max_salary", "salary_range"].includes(key)) {
      group = "luong";
    } else if (["new_hires", "active_headcount", "on_leave_count", "turnover_count", "productivity_score"].includes(key)) {
      group = "nhan_su";
    } else if (["completed_projects", "in_progress_projects", "overdue_projects", "avg_progress", "over_budget_projects"].includes(key)) {
      group = "du_an";
    } else if (["new_customers", "active_customers", "inactive_customers", "vip_customers", "churned_customers",
                 "leads", "orders", "repeat_orders", "qty_sold"].includes(key)) {
      group = "khach_hang";
    } else if (["total_units_sold", "top_product_revenue", "return_count", "avg_rating"].includes(key)) {
      group = "san_pham";
    }

    let fmt: string = "number";
    // margin/rate/ratio -> percent (check before profit to avoid "profit_margin" being currency)
    if (key.includes("margin") || key.includes("rate") || key.includes("ratio") ||
        key.includes("utilization") || key.includes("completion") || key.includes("return") ||
        key.includes("churn") || key.includes("turnover") || key.includes("active")) {
      fmt = "percent";
    } else if (key.includes("salary") || key.includes("revenue") || key.includes("cost") ||
               key.includes("budget") || key.includes("allowance") ||
               key.includes("bonus") || key.includes("deduction") || key.includes("price") ||
               key.includes("ltv")) {
      fmt = "currency";
    }

    if (!groups[group]) groups[group] = [];
    groups[group].push({ key, label, value: val, format: fmt });
  }

  const groupOrder = ["tong_hop", "trung_binh", "ti_le", "chenh_lech", "luong",
                       "nhan_su", "du_an", "khach_hang", "san_pham", "ton_kho", "doanh_so", "khac"];
  const orderedGroups = groupOrder.filter((g) => groups[g]?.length > 0);

  if (orderedGroups.length === 0) return null;

  return (
    <div className="space-y-4">
      {orderedGroups.map((group) => (
        <SmartMetricGroup
          key={group}
          metrics={groups[group]}
          groupLabel={METRIC_GROUP_LABELS[group] || group}
        />
      ))}
    </div>
  );
}

// Charts Panel
function ChartsPanel({ chartData }: { chartData?: { primary: ChartData | null; secondary?: ChartData[] } }) {
  if (!chartData) return null;
  if (!chartData.primary && (chartData.secondary?.length ?? 0) === 0) return null;

  return (
    <div className="space-y-4">
      {chartData.primary && (
        <SmartChart chart={chartData.primary} />
      )}
      {(chartData.secondary?.length ?? 0) > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(chartData.secondary ?? []).map((chart, i) => (
            <SmartChart key={i} chart={chart} compact />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ENRICHMENT COMPONENTS — diverse result display
// ============================================================

// 1. Report Summary Banner
function ReportSummaryBanner({ enrichment }: { enrichment: EnrichmentData }) {
  if (!enrichment.summary) return null;
  return (
    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl px-5 py-4 mb-5">
      <p className="text-sm text-indigo-800 leading-relaxed font-medium">
        {enrichment.summary}
      </p>
    </div>
  );
}

// 2. Key Numbers — highlight row of 4 KPIs
function KeyNumbersRow({ keyNumbers }: { keyNumbers: KeyNumbers }) {
  if (!keyNumbers || keyNumbers.length === 0) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      {keyNumbers.map((kn) => {
        const isPositive = kn.value >= 0;
        const isPercent = kn.format === "percent";
        // For percent/ratio, positive is good; for cost/expense, positive is bad
        const valueColor = kn.format === "percent" || kn.format === "ratio"
          ? (isPositive ? "text-emerald-600" : "text-red-500")
          : "text-gray-900";
        return (
          <div key={kn.key} className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-center">
            <p className="text-xs font-medium text-gray-400 mb-1">{kn.label}</p>
            <p className={`text-lg font-bold ${valueColor}`}>{formatMetricValue(kn.value, kn.format)}</p>
          </div>
        );
      })}
    </div>
  );
}

// 3. Trend Badge — colored label
function TrendBadge({ label }: { label: string }) {
  const config: Record<string, { bg: string; text: string; dot: string }> = {
    "Tăng trưởng": { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
    "Xuất sắc": { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
    "Tốt": { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
    "Ổn định": { bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400" },
    "Cần cải thiện": { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
    "Lãi": { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
    "Lỗ": { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
    "Hòa vốn": { bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400" },
    "Trong ngân sách": { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
    "Vượt ngân sách": { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
    "Ngân sách thấp": { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
    "Chưa có dữ liệu": { bg: "bg-gray-50", text: "text-gray-400", dot: "bg-gray-300" },
  };
  const c = config[label] || { bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {label}
    </span>
  );
}

// 4. Trend Summary Row
function TrendSummaryRow({ trendData }: { trendData: TrendData }) {
  if (!trendData || Object.keys(trendData).length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 mb-5">
      {Object.entries(trendData).map(([key, val]) => {
        if (typeof val !== "string") return null;
        const cleanLabel = key.replace(/_label$/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        return <TrendBadge key={key} label={String(val)} />;
      })}
    </div>
  );
}

// 5. Ranking List — top / bottom performers
function RankingRow({ rank, name, value, isBottom = false }: { rank: number; name: string; value: number; isBottom?: boolean }) {
  const medalColors = ["text-yellow-600", "text-gray-500", "text-amber-600"];
  const valueColor = isBottom
    ? (value >= 0 ? "text-amber-600" : "text-emerald-600")
    : (value >= 0 ? "text-emerald-600" : "text-red-500");
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
        rank <= 3 ? medalColors[rank - 1] : "text-gray-400"
      }`}>
        {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}
      </span>
      <span className="flex-1 text-sm text-gray-700 truncate">{name}</span>
      <span className={`text-sm font-semibold ${valueColor}`}>
        {formatMetricValue(value, "currency")}
      </span>
    </div>
  );
}

function TopBottomSection({ enrichment }: { enrichment: EnrichmentData }) {
  const hasTop = enrichment.top_items && enrichment.top_items.length > 0;
  const hasBottom = enrichment.bottom_items && enrichment.bottom_items.length > 0;
  if (!hasTop && !hasBottom) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
      {hasTop && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-green-50 px-4 py-2.5 border-b border-green-100">
            <h4 className="text-sm font-semibold text-green-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Top hiệu suất cao
            </h4>
          </div>
          <div className="px-4 py-1">
            {enrichment.top_items!.slice(0, 5).map((item) => (
              <RankingRow key={item.rank} rank={item.rank} name={item.name} value={item.value} />
            ))}
          </div>
        </div>
      )}
      {hasBottom && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-100">
            <h4 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Cần chú ý
            </h4>
          </div>
          <div className="px-4 py-1">
            {enrichment.bottom_items!.slice(0, 5).map((item) => (
              <RankingRow key={item.rank} rank={item.rank} name={item.name} value={item.value} isBottom />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 6. Segment Breakdown — mini pie + list
function SegmentBreakdownCard({ segments }: { segments: SegmentBreakdown }) {
  if (!segments || segments.length === 0) return null;
  const totalPct = segments.reduce((s, seg) => s + seg.percentage, 0);
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100">
        <h4 className="text-sm font-semibold text-gray-700">Phân bổ theo nhóm</h4>
      </div>
      <div className="p-4">
        <div className="space-y-2">
          {segments.map((seg, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="text-sm text-gray-700 truncate max-w-[120px]">{seg.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{seg.count} dòng</span>
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

// 7. Anomaly Detection Card
function AnomalyCard({ anomaly }: { anomaly: AnomalyItem }) {
  return (
    <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-medium text-red-800 truncate">{KPI_LABEL_VI[anomaly.column] || anomaly.column}</span>
            <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded-full flex-shrink-0">
              {anomaly.outlier_pct}% bất thường
            </span>
          </div>
          {anomaly.examples.length > 0 && (
            <p className="text-xs text-red-600 mb-1">
              Ví dụ: {anomaly.examples.slice(0, 2).join(" | ")}
            </p>
          )}
          <p className="text-xs text-red-500">
            {anomaly.outlier_count}/{anomaly.total_count} giá trị lệch khỏi phân bổ thông thường
          </p>
        </div>
      </div>
    </div>
  );
}

function AnomalySection({ anomalies }: { anomalies?: Array<AnomalyItem> | null }) {
  if (!anomalies || anomalies.length === 0) return null;
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-red-500" />
        <h4 className="text-sm font-semibold text-gray-700">Phát hiện bất thường</h4>
      </div>
      <div className="space-y-2">
        {anomalies.slice(0, 3).map((a, i) => (
          <AnomalyCard key={i} anomaly={a} />
        ))}
      </div>
    </div>
  );
}

// 8. Data Quality Details Card
function DataQualityCard({ score }: { score: number }) {
  if (!score) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Điểm chất lượng dữ liệu</span>
        <span className={`text-sm font-bold ${
          score >= 80 ? "text-green-600" : score >= 50 ? "text-amber-600" : "text-red-600"
        }`}>
          {score}%
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            score >= 80 ? "bg-green-400" : score >= 50 ? "bg-amber-400" : "bg-red-400"
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// 9. Comparison vs Benchmark Card
function ComparisonCard({ computedKpis }: { computedKpis?: ComputedKPI }) {
  if (!computedKpis) return null;
  const comparisons: Array<{ label: string; value: number; benchmark: number; format: string }> = [];

  if (computedKpis.roas) {
    comparisons.push({ label: "ROAS", value: Number(computedKpis.roas), benchmark: 3.0, format: "ratio" });
  }
  if (computedKpis.profit_margin) {
    comparisons.push({ label: "Biên lợi nhuận", value: Number(computedKpis.profit_margin), benchmark: 0.15, format: "percent" });
  }
  if (computedKpis.conversion_rate) {
    comparisons.push({ label: "Tỷ lệ chuyển đổi", value: Number(computedKpis.conversion_rate), benchmark: 0.05, format: "percent" });
  }
  if (computedKpis.gross_margin) {
    comparisons.push({ label: "Biên gộp", value: Number(computedKpis.gross_margin), benchmark: 0.20, format: "percent" });
  }
  if (computedKpis.repeat_rate) {
    comparisons.push({ label: "Tỷ lệ khách quay lại", value: Number(computedKpis.repeat_rate), benchmark: 0.20, format: "percent" });
  }
  if (computedKpis.new_customer_rate) {
    comparisons.push({ label: "Tỷ lệ khách mới", value: Number(computedKpis.new_customer_rate), benchmark: 0.30, format: "percent" });
  }
  if (computedKpis.aov) {
    comparisons.push({ label: "Giá trị đơn TB", value: Number(computedKpis.aov), benchmark: 0, format: "currency" });
  }

  if (comparisons.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100">
        <h4 className="text-sm font-semibold text-gray-700">So sánh với ngưỡng tham chiếu</h4>
      </div>
      <div className="p-4 space-y-3">
        {comparisons.map((comp) => {
          // Normalize for bar width: percent values are *100, currency values use value/max ratio
          const rawPct = comp.format === "percent"
            ? Math.round(comp.value * 100)
            : comp.benchmark > 0
              ? Math.round((comp.value / comp.benchmark) * 100)
              : Math.round(comp.value);
          const rawBench = comp.format === "percent"
            ? Math.round(comp.benchmark * 100)
            : Math.round(comp.benchmark);
          const isGood = comp.format === "percent" ? comp.value > comp.benchmark : comp.value >= comp.benchmark;
          const ratio = rawBench > 0 ? Math.min(rawPct / rawBench, 1.5) : 0;
          return (
            <div key={comp.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-700">{comp.label}</span>
                <span className={`text-sm font-semibold ${isGood ? "text-green-600" : "text-amber-600"}`}>
                  {formatMetricValue(comp.value, comp.format)}
                </span>
              </div>
              <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-gray-300 rounded-full"
                  style={{ width: `${Math.min(rawBench / 1.5, 100)}%` }}
                />
                <div
                  className={`absolute h-full rounded-full transition-all duration-700 ${isGood ? "bg-green-400" : "bg-amber-400"}`}
                  style={{ width: `${Math.min(ratio * 66, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Ngưỡng: {formatMetricValue(comp.benchmark, comp.format)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 10. Progress Ring — simple SVG ring
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

// 11. Mini KPI with Sparkline (fake sparkline from bar heights)
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
          <div
            key={i}
            className="w-1.5 rounded-sm bg-indigo-200"
            style={{ height: `${Math.max(h * 32, 2)}px` }}
          />
        ))}
      </div>
    </div>
  );
}

// 12. Enrichment Panel — wraps all enrichment sections
function EnrichmentPanel({ enrichment, computedKpis }: { enrichment: EnrichmentData; computedKpis?: ComputedKPI }) {
  if (!enrichment) return null;
  return (
    <div className="space-y-4">
      {enrichment.summary && <ReportSummaryBanner enrichment={enrichment} />}
      {enrichment.trend_data && <TrendSummaryRow trendData={enrichment.trend_data} />}
      {enrichment.key_numbers && enrichment.key_numbers.length > 0 && (
        <KeyNumbersRow keyNumbers={enrichment.key_numbers} />
      )}
      <TopBottomSection enrichment={enrichment} />
      {enrichment.segment_breakdown && enrichment.segment_breakdown.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SegmentBreakdownCard segments={enrichment.segment_breakdown} />
          <ComparisonCard computedKpis={computedKpis} />
        </div>
      )}
      <AnomalySection anomalies={enrichment.anomalies} />
    </div>
  );
}

// Collapsible Results Panel — inline, không nhảy page
function CollapsibleResultsPanel({
  analysisResult,
  chatSession,
  onSendMessage,
  onEditData,
}: {
  analysisResult: DeepAnalysisResult;
  chatSession: ChatSession | null;
  onSendMessage: (content: string) => Promise<void>;
  onEditData: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [activeSection, setActiveSection] = useState<"overview" | "insights" | "chat">("overview");

  const qualityPct = Math.round((analysisResult.data_quality_score ?? 0) * 100);
  const qualityColor = qualityPct >= 80 ? "green" : qualityPct >= 50 ? "amber" : "red";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Collapsible Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            analysisResult.report_type === "sales_report" ? "bg-blue-50" :
            analysisResult.report_type === "expense_report" ? "bg-amber-50" :
            analysisResult.report_type === "payroll_report" ? "bg-green-50" :
            "bg-indigo-50"
          }`}>
            <BarChart3 className={`w-4 h-4 ${
              analysisResult.report_type === "sales_report" ? "text-blue-500" :
              analysisResult.report_type === "expense_report" ? "text-amber-500" :
              analysisResult.report_type === "payroll_report" ? "text-green-500" :
              "text-indigo-500"
            }`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Kết quả phân tích</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                {REPORT_TYPE_LABEL_VI[analysisResult.report_type ?? ""] || analysisResult.report_type?.replace(/_/g, " ") || "Báo cáo"}
              </span>
              {analysisResult.report_description && (
                <span className="text-sm text-gray-400">· {analysisResult.report_description}</span>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-0.5">
              {analysisResult.enrichment?.summary || "Đã phân tích xong"}
              {" "}
              <span className={`inline-flex items-center gap-1 text-xs font-medium text-${qualityColor}-600`}>
                <span className={`w-1.5 h-1.5 rounded-full bg-${qualityColor}-400`} />
                Chất lượng {qualityPct}%
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); onEditData(); }}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Chỉnh sửa dữ liệu
          </button>
          {expanded ? (
            <ChevronRight className="w-4 h-4 text-gray-400 rotate-90" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expandable Content */}
      {expanded && (
        <div className="border-t border-gray-100">
          {/* Section Tabs */}
          <div className="flex border-b border-gray-100 px-5">
            {[
              { key: "overview", label: "Tổng quan" },
              { key: "insights", label: "Nhận định AI" },
              { key: "chat", label: "Trò chuyện" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveSection(tab.key as typeof activeSection)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeSection === tab.key
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
                {tab.key === "insights" && (analysisResult.insights?.length ?? 0) > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                    {analysisResult.insights?.length ?? 0}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeSection === "overview" && (
            <div className="p-5 space-y-5">
              {/* Metrics + Charts 2-column */}
              {(analysisResult.computed_kpis || analysisResult.chart_data) && (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                  <div className="lg:col-span-2">
                    <MetricsPanel computedKpis={analysisResult.computed_kpis} />
                  </div>
                  <div className="lg:col-span-3">
                    <ChartsPanel chartData={analysisResult.chart_data} />
                  </div>
                </div>
              )}

              {/* Enrichment */}
              {analysisResult.enrichment && (
                <EnrichmentPanel enrichment={analysisResult.enrichment} computedKpis={analysisResult.computed_kpis} />
              )}

              {/* Fallback KPI cards */}
              {!analysisResult.computed_kpis && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(analysisResult.kpis?.revenue ?? 0) > 0 && (
                    <KpiCard label="Doanh thu" value={analysisResult.kpis!.revenue} format="currency" icon={<TrendingUp className="w-4 h-4" />} />
                  )}
                  {(analysisResult.kpis?.orders ?? 0) > 0 && (
                    <KpiCard label="Đơn hàng" value={analysisResult.kpis!.orders} format="number" icon={<FileSpreadsheet className="w-4 h-4" />} />
                  )}
                  {(analysisResult.kpis?.roas ?? 0) > 0 && (
                    <KpiCard label="Chỉ số ROAS" value={analysisResult.kpis!.roas} format="number" icon={<BarChart3 className="w-4 h-4" />} />
                  )}
                  {(analysisResult.kpis?.aov ?? 0) > 0 && (
                    <KpiCard label="Giá trị đơn TB" value={analysisResult.kpis!.aov} format="currency" icon={<TrendingUp className="w-4 h-4" />} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Insights Tab */}
          {activeSection === "insights" && (
            <div className="p-5 space-y-5">
              {(analysisResult.insights?.length ?? 0) > 0 && (
                <div className="space-y-3">
                  {(analysisResult.insights ?? []).map((insight, idx) => (
                    <InsightCard key={idx} insight={insight} />
                  ))}
                </div>
              )}
              {(analysisResult.suggested_actions?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Hành động gợi ý</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(analysisResult.suggested_actions ?? []).map((action) => (
                      <ActionCard key={action.id} action={action} />
                    ))}
                  </div>
                </div>
              )}
              {(analysisResult.insights?.length ?? 0) === 0 && (analysisResult.suggested_actions?.length ?? 0) === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">Đang phân tích...</p>
              )}
            </div>
          )}

          {/* Chat Tab */}
          {activeSection === "chat" && (
            <div className="p-5">
              <ChatPanel chatSession={chatSession} onSendMessage={onSendMessage} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Chat Panel Component
function ChatPanel({
  chatSession,
  onSendMessage,
}: {
  chatSession: ChatSession | null;
  onSendMessage: (content: string) => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatSession?.messages.length]);

  async function handleSend() {
    if (!message.trim() || sending) return;
    const content = message;
    setMessage("");
    setSending(true);
    try {
      await onSendMessage(content);
    } finally {
      setSending(false);
    }
  }

  const suggestedQuestions = [
    "Tổng doanh thu theo tháng?",
    "Có dòng nào bất thường?",
    "Xu hướng tăng hay giảm?",
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl flex flex-col h-[500px]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">AI Analyst</h3>
            <p className="text-xs text-gray-500">Trả lời câu hỏi về dữ liệu</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {!chatSession ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 mb-4">Phân tích dữ liệu để bắt đầu trò chuyện</p>
            <p className="text-sm text-gray-400">Hoặc hỏi tôi về cách bắt đầu</p>
          </div>
        ) : chatSession.messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">Bạn có thể hỏi tôi:</p>
            <div className="space-y-2">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setMessage(q)}
                  className="text-sm text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : chatSession.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`w-full flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-md ml-auto"
                        : "bg-gray-100 text-gray-800 rounded-bl-md"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                    <p
                      className={`text-xs mt-1 ${
                        msg.role === "user"
                          ? "text-blue-100 text-right"
                          : "text-gray-400"
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
          
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Hỏi AI về dữ liệu..."
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={sending || !chatSession}
          />
          <button
            onClick={handleSend}
            disabled={sending || !message.trim() || !chatSession}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Gửi"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Data Source Pills
function DataSourcePills({
  dataSources,
  activeSourceId,
  onSelect,
}: {
  dataSources: DataSource[];
  activeSourceId: string | null;
  onSelect: (ds: DataSource) => void;
}) {
  if (dataSources.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <span className="text-sm font-medium text-gray-500 py-1">Bảng đã lưu:</span>
      {dataSources.map((ds) => (
        <button
          key={ds.id}
          onClick={() => onSelect(ds)}
          className={`text-sm px-3 py-1.5 rounded-lg border transition-all flex items-center gap-2 ${
            activeSourceId === ds.id
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Table2 className="w-3.5 h-3.5" />
          {ds.name}
          <span className="text-xs text-gray-400">({ds.row_count})</span>
        </button>
      ))}
    </div>
  );
}

// Analysis Progress
function AnalysisProgress({ analyzing, streamHint, progress, elapsedSec }: {
  analyzing: boolean;
  streamHint: string;
  progress: number;
  elapsedSec: number;
}) {
  if (!analyzing) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Đang phân tích dữ liệu</h3>
          <p className="text-sm text-gray-500">{streamHint || "Đang khởi tạo..."}</p>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center text-sm text-gray-500 mt-2">{progress}%</p>
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {PIPELINE_STEPS.map((step, idx) => (
            <div key={idx} className="flex items-center gap-3 text-sm">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                progress >= (idx + 1) * 20
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}>
                {progress >= (idx + 1) * 20 ? "✓" : idx + 1}
              </div>
              <span className={progress >= (idx + 1) * 20 ? "text-gray-900" : "text-gray-400"}>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Đã chờ: {elapsedSec}s
        </p>
      </div>
    </div>
  );
}

// ============= MAIN PAGE =============

export default function InsightsPage() {
  // State
  const [columns, setColumns] = useState<Column[]>([]);
  const [rows, setRows] = useState<TableRow[]>([]);
  const [tableName, setTableName] = useState("Bảng dữ liệu mới");
  const [tableSourceType, setTableSourceType] = useState<"manual" | "csv_upload" | "xlsx_upload">("manual");
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [analysisResult, setAnalysisResult] = useState<DeepAnalysisResult | null>(null);
// Partial result shown immediately when computed KPIs/charts are ready (before AI narrative)
const [partialResult, setPartialResult] = useState<Partial<DeepAnalysisResult> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [streamProgress, setStreamProgress] = useState({ current: -1, running: null as number | null, success: false });
  const [streamHint, setStreamHint] = useState("");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [appStep, setAppStep] = useState<AppStep>("input");
  const [tableFullscreen, setTableFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load data sources on mount
  useEffect(() => {
    void loadDataSources();
  }, []);

  // Timer for analysis
  useEffect(() => {
    if (!analyzing) return;
    const clock = setInterval(() => setElapsedSec((n) => n + 1), 1000);
    return () => clearInterval(clock);
  }, [analyzing]);

  // Stream event handler
  const applyStreamEvent = useCallback((evt: DeepAnalysisStreamEvent) => {
    if (evt.type === "computed") {
      // KPIs + charts are ready — show immediately, don't wait for AI narrative
      const data = evt.data as Partial<DeepAnalysisResult>;
      setPartialResult(data);
      // Switch to results view so user sees charts right away
      setAppStep("results");
      setStreamHint("Đã có số liệu! Đang phân tích AI…");
      return;
    }
    if (evt.type !== "progress") return;
    const label = STREAM_STEP_LABEL_VI[evt.step_key] ?? evt.step_key;
    if (evt.status === "started") {
      setStreamProgress((p) => ({ ...p, running: evt.overlay_step }));
      if (!partialResult) {
        setStreamHint(`Đang: ${label}…`);
      }
    } else if (evt.status === "finished") {
      setStreamProgress((p) => ({ ...p, current: evt.overlay_step, running: null }));
      setStreamHint(`Xong: ${label}`);
    }
  }, [partialResult]);

  async function loadDataSources() {
    try {
      const data = await api.get<DataSource[]>("/insights/data-sources");
      setDataSources(data);
    } catch {
      // Ignore errors
    }
  }

  async function loadChatSession(chatId: string) {
    try {
      const data = await api.get<ChatSession>(`/insights/chats/${chatId}`);
      setChatSession(data);
    } catch {
      // Ignore errors
    }
  }

  async function handleFileUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const lowerName = file.name.toLowerCase();
      let headers: string[] = [];
      let parsedRows: TableRow[] = [];

      if (lowerName.endsWith(".csv")) {
        const text = await file.text();
        const parsed = parseCsvText(text);
        headers = parsed.headers;
        parsedRows = parsed.rows;
      } else if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        if (rawData.length > 0) {
          headers = Object.keys(rawData[0]);
          parsedRows = rawData.map((row) => {
            const mapped: TableRow = {};
            headers.forEach((h) => { mapped[h] = String(row[h] ?? ""); });
            return mapped;
          });
        }
      } else {
        throw new Error("Định dạng không hỗ trợ. Chỉ CSV hoặc Excel.");
      }

      const detectedColumns: Column[] = headers.map((h) => ({
        id: generateId(),
        name: h,
        dataType: detectColumnType(parsedRows.map((r) => String(r[h] ?? ""))),
      }));

      setColumns(detectedColumns);
      setRows(parsedRows);
      setTableName(file.name.replace(/\.[^/.]+$/, ""));
      setTableSourceType(lowerName.endsWith(".csv") ? "csv_upload" : "xlsx_upload");
      setActiveSourceId(null);
      setAnalysisResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể đọc file.");
    } finally {
      setUploading(false);
    }
  }

  async function handleAnalyze() {
    if (rows.length === 0 || columns.length === 0) {
      setError("Cần thêm ít nhất 1 cột và dữ liệu để phân tích.");
      return;
    }
    setAnalyzing(true);
    setAppStep("analyzing");
    setStreamProgress({ current: -1, running: null, success: false });
    setStreamHint("");
    setElapsedSec(0);
    setError(null);
    setTableFullscreen(false);
    setPartialResult(null);
    setAnalysisResult(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15 * 60 * 1000);

    try {
      // Save data source first if not saved
      let sourceId = activeSourceId;
      if (!sourceId) {
        const created = await api.post<{ id: string }>("/insights/data-sources", {
          name: tableName,
          source_type: tableSourceType,
          table_data: {
            columns: columns.map((c) => ({ name: c.name, data_type: c.dataType })),
            rows,
          },
        });
        sourceId = created.id;
        setActiveSourceId(sourceId);
        await loadDataSources();
      } else {
        await api.put(`/insights/data-sources/${sourceId}`, {
          name: tableName,
          table_data: {
            columns: columns.map((c) => ({ name: c.name, data_type: c.dataType })),
            rows,
          },
        });
      }

      // Run analysis
      const raw = await postNdjsonStream("/insights/a2a/deep-analysis-stream", {
        business_name: tableName,
        industry: null,
        source_filename: tableSourceType !== "manual" ? tableName : null,
        report_rows: rows,
      }, { signal: controller.signal, onEvent: applyStreamEvent });

      const result = raw as DeepAnalysisResult;
      setAnalysisResult(result);
      // Merge full result on top of partial — AI narrative replaces partial
      setPartialResult(null);

      // Cache to localStorage (no DB needed)
      try {
        localStorage.setItem(`insights_result_${sourceId}`, JSON.stringify(result));
      } catch {
        // ignore quota errors
      }

      setStreamProgress((p) => ({ ...p, success: true }));

      // Create a chat session linked to this analysis result.
      const chat = await api.post<{ id: string }>("/insights/chats", null, {
        params: { data_source_id: sourceId, insight_run_id: result.run_id ?? "" },
      });

      await loadChatSession(chat.id);

      // Refresh data sources
      await loadDataSources();

      setTimeout(() => {
        setAnalyzing(false);
        setAppStep("results");
        setStreamProgress((p) => ({ ...p, current: 4, running: null }));
      }, 500);
    } catch (e) {
      console.error("Analysis error:", e);
      const errorMessage = e instanceof Error ? e.message : "Phân tích thất bại. Vui lòng thử lại.";
      setError(errorMessage);
      setAnalyzing(false);
      setAppStep("input");
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function handleSendMessage(content: string) {
    if (!chatSession) return;
    try {
      const result = await api.post<{
        user_message: ChatMessage;
        assistant_message: ChatMessage;
      }>(`/insights/chats/${chatSession.id}/messages`, {
        content,
        message_context: null,
      });

      setChatSession((prev) => prev ? {
        ...prev,
        messages: [
          ...prev.messages,
          result.user_message,
          result.assistant_message,
        ],
      } : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không gửi được tin nhắn.");
    }
  }

  async function handleSelectDataSource(ds: DataSource) {
    setActiveSourceId(ds.id);
    setTableName(ds.name);
    try {
      const detail = await api.get<DataSourceDetail>(`/insights/data-sources/${ds.id}`);
      setColumns(
        detail.schema.columns.map((c) => ({
          id: generateId(),
          name: c.name,
          dataType: "text" as const,
        }))
      );
      setRows(detail.data.rows);
      setTableSourceType((detail.source_type as "manual" | "csv_upload" | "xlsx_upload") || "manual");
      setAnalysisResult(null);
      setChatSession(null);
      setAppStep("input");

      // Restore cached analysis result from localStorage if available
      try {
        const cached = localStorage.getItem(`insights_result_${ds.id}`);
        if (cached) {
          setAnalysisResult(JSON.parse(cached));
          setAppStep("results");
        }
      } catch {
        // ignore cache errors
      }
    } catch {
      // Ignore
    }
  }

  const progress = useMemo(() => {
    if (streamProgress.success) return 100;
    if (streamProgress.running !== null) return Math.min(92, (streamProgress.current + 1) * 20 + 12);
    return Math.min(90, Math.max(0, (streamProgress.current + 1) * 20));
  }, [streamProgress]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <HeroSection />

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm mb-6 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Data Source Pills */}
        <DataSourcePills
          dataSources={dataSources}
          activeSourceId={activeSourceId}
          onSelect={handleSelectDataSource}
        />

        {/* Input Step */}
        {appStep === "input" && (
          <div className="space-y-4">
            {/* Table Header with Actions */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Table2 className="w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    className="font-semibold text-gray-900 bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
                    placeholder="Tên bảng..."
                  />
                </div>
                <div className="flex items-center gap-2">
                  {analysisResult ? (
                    <>
                      <button
                        onClick={() => setAppStep("results")}
                        className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition-all flex items-center gap-2"
                      >
                        <BarChart3 className="w-4 h-4" />
                        Xem lại phân tích
                      </button>
                      <button
                        onClick={handleAnalyze}
                        disabled={analyzing || rows.length === 0 || columns.length === 0}
                        className="px-4 py-2 border border-blue-200 text-blue-600 rounded-lg font-medium text-sm hover:bg-blue-50 transition-all flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        Phân tích lại
                      </button>
                    </>
                  ) : (
                    <>
                      <FileUploadButton onUpload={handleFileUpload} uploading={uploading} />
                      <button
                        onClick={handleAnalyze}
                        disabled={analyzing || rows.length === 0 || columns.length === 0}
                        className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium text-sm hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-blue-500/25"
                      >
                        <Sparkles className="w-4 h-4" />
                        Phân tích với AI
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Table Builder */}
              <TableBuilder
                columns={columns}
                rows={rows}
                onColumnsChange={setColumns}
                onRowsChange={setRows}
                tableName={tableName}
                onTableNameChange={setTableName}
                fullscreen={tableFullscreen}
                onFullscreen={() => setTableFullscreen(!tableFullscreen)}
              />
            </div>
          </div>
        )}

        {/* Results Panel — shows partial result (KPIs+charts) immediately,
             then full result (with AI narrative) when ready */}
        {(partialResult || analysisResult) && (
          <CollapsibleResultsPanel
            analysisResult={(partialResult as DeepAnalysisResult) || analysisResult!}
            chatSession={chatSession}
            onSendMessage={handleSendMessage}
            onEditData={() => setAppStep("input")}
          />
        )}

        {/* Analysis Progress Overlay */}
        <AnalysisProgress
          analyzing={analyzing}
          streamHint={streamHint}
          progress={progress}
          elapsedSec={elapsedSec}
        />
      </div>
    </div>
  );
}
