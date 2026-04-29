"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, postNdjsonStream, type DeepAnalysisStreamEvent } from "@/lib/api-client";
import HelpDialogButton from "@/components/common/HelpDialogButton";

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

// ============= HELPERS =============

function formatCurrency(value: number): string {
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

// ============= COMPONENTS =============

function TableBuilder({
  columns,
  rows,
  onColumnsChange,
  onRowsChange,
}: {
  columns: Column[];
  rows: TableRow[];
  onColumnsChange: (cols: Column[]) => void;
  onRowsChange: (rows: TableRow[]) => void;
}) {
  const [editingCol, setEditingCol] = useState<string | null>(null);
  const [newColName, setNewColName] = useState("");

  function addColumn() {
    if (!newColName.trim()) return;
    const newCol: Column = {
      id: generateId(),
      name: newColName.trim(),
      dataType: "text",
    };
    onColumnsChange([...columns, newCol]);
    // Add empty value for new column in all rows
    const updatedRows = rows.map((r) => ({ ...r, [newCol.name]: "" }));
    onRowsChange(updatedRows);
    setNewColName("");
    setEditingCol(newCol.id);
  }

  function updateColumn(id: string, updates: Partial<Column>) {
    const oldCol = columns.find((c) => c.id === id);
    if (!oldCol) return;
    const updated = columns.map((c) => c.id === id ? { ...c, ...updates } : c);
    onColumnsChange(updated);
    // If name changed, update rows
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

  function addRow() {
    const newRow: TableRow = {};
    columns.forEach((c) => { newRow[c.name] = ""; });
    onRowsChange([...rows, newRow]);
  }

  function updateCell(rowIndex: number, colName: string, value: string) {
    const updatedRows = rows.map((r, i) =>
      i === rowIndex ? { ...r, [colName]: value } : r
    );
    onRowsChange(updatedRows);
  }

  function deleteRow(index: number) {
    onRowsChange(rows.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      {/* Column management */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Cột:</span>
        {columns.map((col) => (
          <div key={col.id} className="flex items-center gap-1">
            {editingCol === col.id ? (
              <input
                type="text"
                value={col.name}
                onChange={(e) => updateColumn(col.id, { name: e.target.value })}
                onBlur={() => setEditingCol(null)}
                onKeyDown={(e) => e.key === "Enter" && setEditingCol(null)}
                className="input w-28 text-xs"
                autoFocus
              />
            ) : (
              <button
                onClick={() => setEditingCol(col.id)}
                className="border border-gray-200 bg-gray-50 px-2 py-1 text-xs hover:bg-gray-100"
              >
                {col.name}
                <span className="ml-1 text-gray-400">({col.dataType})</span>
              </button>
            )}
            <button
              onClick={() => deleteColumn(col.id)}
              className="text-red-500 hover:text-red-700"
              title="Xóa cột"
            >
              ×
            </button>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={newColName}
            onChange={(e) => setNewColName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addColumn()}
            placeholder="Tên cột mới"
            className="input w-28 text-xs"
          />
          <button onClick={addColumn} className="btn-secondary text-xs">+ Thêm</button>
        </div>
      </div>

      {/* Table data */}
      <div className="max-h-[300px] overflow-auto border border-gray-200">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="border-b border-gray-200 px-2 py-2 w-8">#</th>
              {columns.map((col) => (
                <th key={col.id} className="border-b border-gray-200 px-2 py-2 text-left font-medium text-gray-700">
                  {col.name}
                  <span className="ml-1 text-gray-400">({col.dataType})</span>
                </th>
              ))}
              <th className="border-b border-gray-200 px-2 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className={rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                <td className="border-b border-gray-100 px-2 py-1 text-gray-400">{rowIdx + 1}</td>
                {columns.map((col) => (
                  <td key={col.id} className="border-b border-gray-100 px-1 py-1">
                    <input
                      type="text"
                      value={String(row[col.name] ?? "")}
                      onChange={(e) => updateCell(rowIdx, col.name, e.target.value)}
                      className="w-full bg-transparent border-0 p-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </td>
                ))}
                <td className="border-b border-gray-100 px-1 py-1">
                  <button
                    onClick={() => deleteRow(rowIdx)}
                    className="text-red-400 hover:text-red-600"
                    title="Xóa dòng"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={addRow} className="btn-secondary text-xs">+ Thêm dòng</button>
    </div>
  );
}

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

  return (
    <div className="border border-gray-200 bg-white flex flex-col" style={{ height: "400px" }}>
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
        <h3 className="font-medium text-gray-800">Trò chuyện với AI</h3>
        <p className="text-xs text-gray-500">Hỏi về dữ liệu, xu hướng, hoặc nhận gợi ý phân tích</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!chatSession ? (
          <div className="text-center text-gray-400 text-sm py-8">
            Chưa có cuộc trò chuyện. Phân tích dữ liệu để bắt đầu chat.
          </div>
        ) : chatSession.messages.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">
            <p>Bạn có thể hỏi:</p>
            <ul className="mt-2 text-left list-disc list-inside text-xs">
              <li>Tổng doanh thu theo tháng?</li>
              <li>Cột nào có giá trị bất thường?</li>
              <li>Xu hướng tăng/giảm của doanh số?</li>
              <li>Nên tạo biểu đồ gì để visualize dữ liệu?</li>
            </ul>
          </div>
        ) : (
          chatSession.messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-xs mt-1 ${msg.role === "user" ? "text-blue-100" : "text-gray-400"}`}>
                  {new Date(msg.created_at).toLocaleTimeString("vi-VN")}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3 flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Hỏi AI về dữ liệu..."
          className="input flex-1 text-sm"
          disabled={sending || !chatSession}
        />
        <button
          onClick={handleSend}
          disabled={sending || !message.trim() || !chatSession}
          className="btn-primary text-sm"
        >
          {sending ? "..." : "Gửi"}
        </button>
      </div>
    </div>
  );
}

function KpiCard({ label, value, format = "number" }: { label: string; value: number; format?: string }) {
  const display = format === "currency"
    ? `${formatCurrency(Math.round(value))} đ`
    : format === "percent"
    ? `${(value * 100).toFixed(2)}%`
    : formatCurrency(Math.round(value));

  return (
    <div className="border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-gray-900 mt-1">{display}</p>
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
  const [activeTab, setActiveTab] = useState<"table" | "upload">("table");
  const [showChat, setShowChat] = useState(true);
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

  async function createDataSource() {
    if (columns.length === 0) {
      setError("Cần tạo ít nhất 1 cột trước.");
      return;
    }
    try {
      const created = await api.post<{ id: string }>("/insights/data-sources", {
        name: tableName,
        source_type: "manual",
        table_data: {
          columns: columns.map((c) => ({ name: c.name, data_type: c.dataType })),
          rows,
        },
      });
      await loadDataSources();
      setActiveSourceId(created.id);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu bảng.");
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

      // Detect column types
      const detectedColumns: Column[] = headers.map((h) => ({
        id: generateId(),
        name: h,
        dataType: detectColumnType(parsedRows.map((r) => String(r[h] ?? ""))),
      }));

      setColumns(detectedColumns);
      setRows(parsedRows);
      setTableName(file.name);
      setActiveTab("table");
      setActiveSourceId(null);
      setAnalysisResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể đọc file.");
    } finally {
      setUploading(false);
    }
  }

  async function handleAnalyze() {
    if (rows.length === 0) {
      setError("Cần có dữ liệu để phân tích.");
      return;
    }
    setAnalyzing(true);
    setStreamProgress({ current: -1, running: null, success: false });
    setStreamHint("");
    setElapsedSec(0);
    setError(null);

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
      }

      // Create chat session
      const chat = await api.post<{ id: string }>("/insights/chats", null, {
        params: { data_source_id: sourceId },
      });

      // Run analysis
      const raw = await postNdjsonStream("/insights/a2a/deep-analysis-stream", {
        business_name: tableName,
        industry: null,
        source_filename: tableName,
        report_rows: rows,
      }, { signal: controller.signal, onEvent: applyStreamEvent });

      setAnalysisResult(raw as DeepAnalysisResult);
      setStreamProgress((p) => ({ ...p, success: true }));

      // Load chat session
      await loadChatSession(chat.id);

      // Refresh data sources
      await loadDataSources();

      setTimeout(() => {
        setAnalyzing(false);
        setStreamProgress((p) => ({ ...p, current: 4, running: null }));
      }, 500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Phân tích thất bại.");
      setAnalyzing(false);
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

  const progress = useMemo(() => {
    if (streamProgress.success) return 100;
    if (streamProgress.running !== null) return Math.min(92, (streamProgress.current + 1) * 20 + 12);
    return Math.min(90, Math.max(0, (streamProgress.current + 1) * 20));
  }, [streamProgress]);

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>Phân tích dữ liệu</h1>
          <p className="text-sm text-gray-500 mt-1">Tạo bảng hoặc upload file CSV/Excel để phân tích với AI</p>
        </div>
        <div className="flex items-center gap-2">
          <HelpDialogButton
            title="Hướng dẫn Phân tích dữ liệu"
            summary="Tạo bảng dữ liệu hoặc upload file CSV/Excel, sau đó để AI phân tích và trả lời câu hỏi của bạn."
            steps={[
              "Tạo bảng mới với các cột tùy ý",
              "Nhập dữ liệu hoặc upload file CSV/Excel",
              "Bấm Phân tích để AI xử lý",
              "Hỏi AI về dữ liệu trong panel trò chuyện",
            ]}
          />
          <button
            onClick={() => setShowChat(!showChat)}
            className="btn-secondary text-sm"
          >
            {showChat ? "Ẩn chat" : "Hiện chat"}
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Data sources list */}
      {dataSources.length > 0 && (
        <div className="border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-medium text-gray-600 mb-2">Bảng đã lưu:</p>
          <div className="flex flex-wrap gap-2">
            {dataSources.map((ds) => (
              <button
                key={ds.id}
                onClick={() => {
                  setActiveSourceId(ds.id);
                  setTableName(ds.name);
                  // Load data source details
                  void (async () => {
                    try {
                      const detail = await api.get<{
                        schema: { columns: Array<{ name: string }> };
                        data: { rows: TableRow[] };
                      }>(`/insights/data-sources/${ds.id}`);
                      setColumns(
                        detail.schema.columns.map((c, i) => ({
                          id: generateId(),
                          name: c.name,
                          dataType: "text" as const,
                        }))
                      );
                      setRows(detail.data.rows);
                    } catch {
                      // Ignore
                    }
                  })();
                }}
                className={`text-xs px-2 py-1 border ${
                  activeSourceId === ds.id
                    ? "border-blue-400 bg-blue-50 text-blue-700"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {ds.name} ({ds.row_count} dòng)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Table builder / Upload */}
        <div className={`space-y-4 ${showChat ? "lg:col-span-2" : "lg:col-span-3"}`}>
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("table")}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "table"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Tạo bảng
            </button>
            <button
              onClick={() => setActiveTab("upload")}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "upload"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Upload file
            </button>
          </div>

          {activeTab === "table" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Tên bảng:</label>
                <input
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  className="input w-64 text-sm"
                />
                <button onClick={createDataSource} className="btn-secondary text-sm">
                  Lưu bảng
                </button>
              </div>
              <TableBuilder
                columns={columns}
                rows={rows}
                onColumnsChange={setColumns}
                onRowsChange={setRows}
              />
            </div>
          )}

          {activeTab === "upload" && (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                id="file-upload"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                  e.currentTarget.value = "";
                }}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="text-gray-600">
                  <p className="font-medium">Kéo thả file hoặc click để chọn</p>
                  <p className="text-sm text-gray-400 mt-1">Hỗ trợ CSV, XLSX, XLS</p>
                </div>
              </label>
              {uploading && <p className="mt-2 text-sm text-blue-600">Đang đọc file...</p>}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleAnalyze}
              disabled={analyzing || rows.length === 0}
              className="btn-primary"
            >
              {analyzing ? "Đang phân tích..." : "Phân tích với AI"}
            </button>
          </div>

          {/* Analysis Results */}
          {analysisResult && (
            <div className="space-y-4 border border-gray-200 bg-white p-4">
              <h2 className="font-medium text-gray-800">Kết quả phân tích</h2>

              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Doanh thu" value={analysisResult.kpis.revenue} format="currency" />
                <KpiCard label="Đơn hàng" value={analysisResult.kpis.orders} />
                <KpiCard label="ROAS" value={analysisResult.kpis.roas} />
                <KpiCard label="AOV" value={analysisResult.kpis.aov} format="currency" />
              </div>

              {/* Quality Score */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Chất lượng dữ liệu:</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${Math.round(analysisResult.data_quality_score * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {Math.round(analysisResult.data_quality_score * 100)}%
                  </span>
                </div>
              </div>

              {/* Insights */}
              {analysisResult.insights.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-700">Nhận định từ AI</h3>
                  <div className="space-y-2">
                    {analysisResult.insights.map((insight, idx) => (
                      <div key={idx} className="border-l-2 border-blue-300 pl-3 py-1">
                        <p className="text-sm font-medium">
                          {insight.title}
                          <span className="ml-2 text-xs text-gray-500">({insight.severity})</span>
                        </p>
                        <p className="text-xs text-gray-600 mt-1">{insight.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Actions */}
              {analysisResult.suggested_actions && analysisResult.suggested_actions.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-700">Hành động gợi ý</h3>
                  <div className="space-y-2">
                    {analysisResult.suggested_actions.map((action) => (
                      <div key={action.id} className="border border-green-200 bg-green-50 p-2">
                        <p className="text-sm font-medium">{action.title}</p>
                        <p className="text-xs text-gray-600 mt-1">{action.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Chat Panel */}
        {showChat && (
          <div className="lg:col-span-1">
            <ChatPanel
              chatSession={chatSession}
              onSendMessage={handleSendMessage}
            />
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {analyzing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
            <p className="text-center font-medium text-gray-800">Đang phân tích dữ liệu</p>
            <p className="text-center text-sm text-gray-500 mt-1">Tiến trình: {progress}%</p>
            {streamHint && <p className="text-center text-xs text-gray-400 mt-1">{streamHint}</p>}
            <p className="text-center text-xs text-gray-400 mt-1">
              Đã chờ: {elapsedSec}s
            </p>

            {/* Pipeline steps */}
            <div className="mt-4 flex justify-center gap-1 overflow-x-auto">
              {PIPELINE_STEPS.map((step, idx) => {
                const isDone = streamProgress.success || idx <= streamProgress.current;
                const isActive = !streamProgress.success && streamProgress.running === idx;
                return (
                  <Fragment key={step.label}>
                    <div
                      className={`px-2 py-1 text-xs border ${
                        isActive ? "border-blue-400 bg-blue-50" : isDone ? "border-green-300 bg-green-50" : "border-gray-200"
                      }`}
                    >
                      <p className="font-medium whitespace-nowrap">{step.label}</p>
                      <p className={`${isDone ? "text-green-600" : isActive ? "text-blue-600 animate-pulse" : "text-gray-400"}`}>
                        {isDone ? "✓" : isActive ? "..." : "chờ"}
                      </p>
                    </div>
                    {idx < PIPELINE_STEPS.length - 1 && (
                      <span className="self-center text-gray-300">→</span>
                    )}
                  </Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
