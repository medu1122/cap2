"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, postNdjsonStream, type DeepAnalysisStreamEvent } from "@/lib/api-client";
import HelpDialogButton from "@/components/common/HelpDialogButton";
import { Upload, Table2, MessageSquare, TrendingUp, AlertTriangle, CheckCircle2, Sparkles, BarChart3, FileSpreadsheet, ChevronRight, Loader2, Maximize2, X, Plus } from "lucide-react";

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

interface DeepAnalysisResult {
  run_id: string;
  business_name: string;
  report_type: string;
  kpis: {
    revenue: number;
    ad_spend: number;
    orders: number;
    leads: number;
    roas: number;
    conversion_rate: number;
    repeat_rate: number;
    aov: number;
  };
  insights: Array<{
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
  data_quality_score: number;
}

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

// ============= CONSTANTS =============

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
    ? `${formatCurrencyFull(Math.round(value))} đ`
    : format === "percent"
    ? `${(value * 100).toFixed(1)}%`
    : formatCurrency(Math.round(value));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        {icon && <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
          {icon}
        </div>}
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-1">{display}</p>
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
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [analysisResult, setAnalysisResult] = useState<DeepAnalysisResult | null>(null);
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
    if (evt.type !== "progress") return;
    const label = STREAM_STEP_LABEL_VI[evt.step_key] ?? evt.step_key;
    if (evt.status === "started") {
      setStreamProgress((p) => ({ ...p, running: evt.overlay_step }));
      setStreamHint(`Đang: ${label}…`);
    } else if (evt.status === "finished") {
      setStreamProgress((p) => ({ ...p, current: evt.overlay_step, running: null }));
      setStreamHint(`Xong: ${label}`);
    }
  }, []);

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15 * 60 * 1000);

    try {
      // Save data source first if not saved
      let sourceId = activeSourceId;
      if (!sourceId) {
        const created = await api.post<{ id: string }>("/insights/data-sources", {
          name: tableName,
          source_type: "manual",
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
        source_filename: tableName,
        report_rows: rows,
      }, { signal: controller.signal, onEvent: applyStreamEvent });

      const result = raw as DeepAnalysisResult;
      setAnalysisResult(result);
      setStreamProgress((p) => ({ ...p, success: true }));

      // Create a chat session linked to this analysis result.
      const chat = await api.post<{ id: string }>("/insights/chats", null, {
        params: { data_source_id: sourceId, insight_run_id: result.run_id },
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
      const detail = await api.get<{
        schema: { columns: Array<{ name: string }> };
        data: { rows: TableRow[] };
      }>(`/insights/data-sources/${ds.id}`);
      setColumns(
        detail.schema.columns.map((c) => ({
          id: generateId(),
          name: c.name,
          dataType: "text" as const,
        }))
      );
      setRows(detail.data.rows);
      setAnalysisResult(null);
      setChatSession(null);
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
                  <FileUploadButton onUpload={handleFileUpload} uploading={uploading} />
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing || rows.length === 0 || columns.length === 0}
                    className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium text-sm hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-blue-500/25"
                  >
                    <Sparkles className="w-4 h-4" />
                    Phân tích với AI
                  </button>
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

        {/* Results Step */}
        {appStep === "results" && analysisResult && (
          <div className="space-y-6">
            {/* KPIs Section */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Kết quả phân tích</h2>
                <button
                  onClick={() => setAppStep("input")}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  Chỉnh sửa dữ liệu
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <KpiCard
                  label="Doanh thu"
                  value={analysisResult.kpis.revenue}
                  format="currency"
                  icon={<TrendingUp className="w-4 h-4" />}
                />
                <KpiCard
                  label="Đơn hàng"
                  value={analysisResult.kpis.orders}
                  format="number"
                  icon={<FileSpreadsheet className="w-4 h-4" />}
                />
                <KpiCard
                  label="ROAS"
                  value={analysisResult.kpis.roas}
                  format="number"
                  icon={<BarChart3 className="w-4 h-4" />}
                />
                <KpiCard
                  label="AOV"
                  value={analysisResult.kpis.aov}
                  format="currency"
                  icon={<TrendingUp className="w-4 h-4" />}
                />
              </div>

              {/* Data Quality */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Chất lượng dữ liệu</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {Math.round(analysisResult.data_quality_score * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      analysisResult.data_quality_score >= 0.8 ? "bg-green-500" :
                      analysisResult.data_quality_score >= 0.5 ? "bg-amber-500" : "bg-red-500"
                    }`}
                    style={{ width: `${Math.round(analysisResult.data_quality_score * 100)}%` }}
                  />
                </div>
              </div>

              {/* Insights */}
              {analysisResult.insights.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Nhận định từ AI</h3>
                  <div className="space-y-3">
                    {analysisResult.insights.map((insight, idx) => (
                      <InsightCard key={idx} insight={insight} />
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Actions */}
              {analysisResult.suggested_actions && analysisResult.suggested_actions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Hành động gợi ý</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {analysisResult.suggested_actions.map((action) => (
                      <ActionCard key={action.id} action={action} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Chat Section */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Trò chuyện với AI</h2>
              <ChatPanel chatSession={chatSession} onSendMessage={handleSendMessage} />
            </div>
          </div>
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
