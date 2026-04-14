"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

/** fetch mac dinh khong timeout — deep-analysis co the lau nhung khong nen treo vo han. */
const DEEP_ANALYSIS_FETCH_TIMEOUT_MS = 15 * 60 * 1000;

function formatWaitSeconds(total: number): string {
  if (total < 60) return `${total} giây`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s === 0 ? `${m} phút` : `${m} phút ${s} giây`;
}

function isAbortError(e: unknown): boolean {
  return typeof e === "object" && e !== null && "name" in e && (e as { name: string }).name === "AbortError";
}

function deepAnalysisErrorMessage(e: unknown, reanalyze: boolean): string {
  if (isAbortError(e)) {
    return "Chờ quá lâu không nhận được phản hồi từ máy chủ. Kiểm tra API hoặc thử lại sau.";
  }
  if (e instanceof Error) return e.message;
  return reanalyze ? "Không thể phân tích lại run cũ." : "Không thể chạy phân tích.";
}
import HelpDialogButton from "@/components/common/HelpDialogButton";
import { api, postNdjsonStream, type DeepAnalysisStreamEvent } from "@/lib/api-client";

const STREAM_STEP_LABEL_VI: Record<string, string> = {
  classify_report: "Phân loại báo cáo",
  map_schema: "Ánh xạ cột dữ liệu",
  compute_metrics: "Tính toán chỉ số",
  narrative: "Diễn giải kết quả",
  polish_result: "Chuẩn hóa tiếng Việt",
};

interface DeepAnalysisResult {
  run_id: string;
  business_name: string;
  report_type: string;
  report_type_vi?: string;
  industry?: string;
  model_trace: Array<{ step: string; agent: string; provider: string; model: string; status: string }>;
  friendly_model_trace?: Array<{ step: string; model: string; provider: string; status: string }>;
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
  insights: Array<{ title: string; severity: string; evidence: Record<string, number>; recommendation: string }>;
  issues: string[];
  action_plan_30_60_90: { day_30: string[]; day_60: string[]; day_90: string[] };
  schema_mapping?: Record<string, string | null>;
  mapping_confidence?: Record<string, number>;
  data_warnings?: string[];
  data_quality_score?: number;
  data_quality_breakdown?: Record<string, number>;
  limitations?: string[];
  fallback: { provider?: string | null; reason?: string | null; user_message?: string | null };
}

interface AnalysisRun {
  id: string;
  business_name: string;
  industry: string | null;
  report_type: string;
  source_filename: string | null;
  status: string;
  fallback_provider: string | null;
  fallback_reason: string | null;
  created_at: string;
}

function coerceFiniteNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function normalizeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? ""));
}

/** Dam bao render khong vo do thieu field / LLM tra sai kieu. */
function normalizeDeepAnalysisResult(raw: unknown): DeepAnalysisResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("Máy chủ trả về rỗng hoặc không phải JSON hợp lệ.");
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.detail === "string" && r.detail) {
    throw new Error(r.detail);
  }
  if (r.run_id == null || String(r.run_id).trim() === "") {
    throw new Error("Phản hồi thiếu run_id — không thể hiển thị kết quả.");
  }

  const kr = (r.kpis && typeof r.kpis === "object" ? r.kpis : {}) as Record<string, unknown>;
  const kpis: DeepAnalysisResult["kpis"] = {
    revenue: coerceFiniteNumber(kr.revenue),
    ad_spend: coerceFiniteNumber(kr.ad_spend),
    orders: coerceFiniteNumber(kr.orders),
    leads: coerceFiniteNumber(kr.leads),
    roas: coerceFiniteNumber(kr.roas),
    conversion_rate: coerceFiniteNumber(kr.conversion_rate),
    repeat_rate: coerceFiniteNumber(kr.repeat_rate),
    aov: coerceFiniteNumber(kr.aov),
  };

  const insights: DeepAnalysisResult["insights"] = [];
  if (Array.isArray(r.insights)) {
    for (const item of r.insights) {
      const o = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const evRaw =
        o.evidence && typeof o.evidence === "object" && !Array.isArray(o.evidence)
          ? (o.evidence as Record<string, unknown>)
          : {};
      const evidence: Record<string, number> = {};
      for (const [k, val] of Object.entries(evRaw)) {
        evidence[k] = coerceFiniteNumber(val);
      }
      insights.push({
        title: String(o.title ?? "Nhận định"),
        severity: String(o.severity ?? "Vừa"),
        evidence,
        recommendation: String(o.recommendation ?? ""),
      });
    }
  }

  const model_trace: DeepAnalysisResult["model_trace"] = [];
  if (Array.isArray(r.model_trace)) {
    for (const item of r.model_trace) {
      if (!item || typeof item !== "object") continue;
      const m = item as Record<string, unknown>;
      model_trace.push({
        step: String(m.step ?? ""),
        agent: String(m.agent ?? ""),
        provider: String(m.provider ?? ""),
        model: String(m.model ?? ""),
        status: String(m.status ?? ""),
      });
    }
  }

  let friendly_model_trace: DeepAnalysisResult["friendly_model_trace"];
  if (Array.isArray(r.friendly_model_trace) && r.friendly_model_trace.length > 0) {
    friendly_model_trace = r.friendly_model_trace
      .filter((x) => x && typeof x === "object")
      .map((x) => {
        const f = x as Record<string, unknown>;
        return {
          step: String(f.step ?? ""),
          model: String(f.model ?? ""),
          provider: String(f.provider ?? ""),
          status: String(f.status ?? ""),
        };
      });
  } else {
    friendly_model_trace = undefined;
  }

  const ar =
    r.action_plan_30_60_90 && typeof r.action_plan_30_60_90 === "object"
      ? (r.action_plan_30_60_90 as Record<string, unknown>)
      : {};
  const action_plan_30_60_90 = {
    day_30: normalizeStringArray(ar.day_30),
    day_60: normalizeStringArray(ar.day_60),
    day_90: normalizeStringArray(ar.day_90),
  };

  const fr = r.fallback && typeof r.fallback === "object" ? (r.fallback as Record<string, unknown>) : {};
  const fallback: DeepAnalysisResult["fallback"] = {
    provider: fr.provider == null ? undefined : String(fr.provider),
    reason: fr.reason == null ? undefined : String(fr.reason),
    user_message: fr.user_message == null ? undefined : String(fr.user_message),
  };

  let data_quality_breakdown: Record<string, number> | undefined;
  if (r.data_quality_breakdown && typeof r.data_quality_breakdown === "object" && !Array.isArray(r.data_quality_breakdown)) {
    data_quality_breakdown = {};
    for (const [k, v] of Object.entries(r.data_quality_breakdown as Record<string, unknown>)) {
      data_quality_breakdown[k] = coerceFiniteNumber(v);
    }
  }

  let schema_mapping: Record<string, string | null> | undefined;
  if (r.schema_mapping && typeof r.schema_mapping === "object" && !Array.isArray(r.schema_mapping)) {
    schema_mapping = {};
    for (const [k, v] of Object.entries(r.schema_mapping as Record<string, unknown>)) {
      schema_mapping[k] = v == null ? null : String(v);
    }
  }

  let mapping_confidence: Record<string, number> | undefined;
  if (r.mapping_confidence && typeof r.mapping_confidence === "object" && !Array.isArray(r.mapping_confidence)) {
    mapping_confidence = {};
    for (const [k, v] of Object.entries(r.mapping_confidence as Record<string, unknown>)) {
      mapping_confidence[k] = coerceFiniteNumber(v);
    }
  }

  const limitations = normalizeStringArray(r.limitations).filter(Boolean);
  const data_warnings = normalizeStringArray(r.data_warnings).filter(Boolean);

  return {
    run_id: String(r.run_id),
    business_name: String(r.business_name ?? ""),
    report_type: String(r.report_type ?? "generic_report"),
    report_type_vi: r.report_type_vi != null ? String(r.report_type_vi) : undefined,
    industry: r.industry != null ? String(r.industry) : undefined,
    model_trace,
    friendly_model_trace,
    kpis,
    insights,
    issues: normalizeStringArray(r.issues).filter(Boolean),
    action_plan_30_60_90,
    schema_mapping,
    mapping_confidence,
    data_warnings: data_warnings.length ? data_warnings : undefined,
    data_quality_score: coerceFiniteNumber(r.data_quality_score, 0),
    data_quality_breakdown,
    limitations: limitations.length ? limitations : undefined,
    fallback,
  };
}

function displayInsightBusiness(name: string | undefined): string {
  const t = (name ?? "").trim();
  if (!t) return "Chưa rõ";
  if (t.toLowerCase() === "doanh nghiệp") return "Chưa rõ";
  return t;
}

function displayInsightIndustry(industry: string | undefined | null): string {
  const t = (industry ?? "").trim();
  if (!t) return "Chưa rõ";
  if (t.toLowerCase() === "tổng hợp") return "Chưa rõ";
  return t;
}

export default function InsightsPage() {
  const [error, setError] = useState<string | null>(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [deepAnalyzing, setDeepAnalyzing] = useState(false);
  const [deepResult, setDeepResult] = useState<DeepAnalysisResult | null>(null);
  const [deepRows, setDeepRows] = useState<Array<Record<string, string | number>>>([]);
  const [businessName] = useState("Doanh nghiệp");
  const [industry] = useState("Tổng hợp");
  const [sourceFilename, setSourceFilename] = useState<string | undefined>(undefined);
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  /** Buoc da xong tren may chu (-1 = chua buoc nao xong). */
  const [streamMaxDone, setStreamMaxDone] = useState(-1);
  /** Buoc dang chay LLM/metrics (null = khong trong buoc await). */
  const [streamRunning, setStreamRunning] = useState<number | null>(null);
  const [streamSuccess, setStreamSuccess] = useState(false);
  const [streamPhaseHint, setStreamPhaseHint] = useState("");
  const [analyzeElapsedSec, setAnalyzeElapsedSec] = useState(0);
  const [previewLimit, setPreviewLimit] = useState(50);
  const [previewPage, setPreviewPage] = useState(1);

  const pipelineSteps = [
    { label: "Phân loại báo cáo", model: "DeepSeek Coder 6.7B" },
    { label: "Ánh xạ cột dữ liệu", model: "DeepSeek Coder 6.7B" },
    { label: "Tính toán chỉ số", model: "Python/Pandas" },
    { label: "Diễn giải kết quả", model: "Qwen 2.5 7B" },
    { label: "Chuẩn hóa tiếng Việt", model: "DeepSeek Coder 6.7B" },
  ] as const;

  const overlayProgress = useMemo(() => {
    if (streamSuccess) return 100;
    if (streamRunning !== null) return Math.min(92, (streamMaxDone + 1) * 20 + 12);
    return Math.min(90, Math.max(0, (streamMaxDone + 1) * 20));
  }, [streamMaxDone, streamRunning, streamSuccess]);

  function applyStreamEvent(evt: DeepAnalysisStreamEvent) {
    if (evt.type !== "progress") return;
    const label = STREAM_STEP_LABEL_VI[evt.step_key] ?? evt.step_key;
    if (evt.status === "started") {
      setStreamRunning(evt.overlay_step);
      setStreamPhaseHint(`Máy chủ: ${label}…`);
    } else if (evt.status === "finished") {
      setStreamMaxDone(evt.overlay_step);
      setStreamRunning(null);
      setStreamPhaseHint(`Đã xong: ${label}`);
    }
  }

  useEffect(() => {
    void loadRuns();
  }, []);

  useEffect(() => {
    if (!deepAnalyzing) return;
    setAnalyzeElapsedSec(0);
    const clock = window.setInterval(() => setAnalyzeElapsedSec((n) => n + 1), 1000);
    return () => window.clearInterval(clock);
  }, [deepAnalyzing]);


  async function loadRuns() {
    try {
      const data = await api.get<AnalysisRun[]>("/insights/a2a/runs");
      setRuns(data);
    } catch {
      // Khong chan luong chinh neu tai lich su that bai.
    }
  }

  function splitCsvLine(line: string, delimiter: string): string[] {
    return line.split(delimiter).map((part) => part.trim().replace(/^"|"$/g, ""));
  }

  function parseCsvText(text: string): Array<Record<string, string | number>> {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) {
      throw new Error("File CSV không có dữ liệu hợp lệ.");
    }
    const delimiter = lines[0].includes(";") ? ";" : ",";
    const headers = splitCsvLine(lines[0], delimiter);
    const parsedRows: Array<Record<string, string | number>> = [];
    for (const line of lines.slice(1)) {
      const cols = splitCsvLine(line, delimiter);
      const row: Record<string, string | number> = {};
      headers.forEach((header, idx) => {
        row[header] = cols[idx] ?? "";
      });
      parsedRows.push(row);
    }
    return parsedRows;
  }

  function normalizeRowsFromHeaderAndBody(
    headers: Array<string | number | null | undefined>,
    bodyRows: Array<Array<string | number | null | undefined>>,
  ): Array<Record<string, string | number>> {
    const normalizedHeaders = headers.map((h) => String(h ?? "").trim());
    if (normalizedHeaders.filter(Boolean).length === 0) {
      throw new Error("Sheet không có dòng tiêu đề hợp lệ.");
    }
    const records: Array<Record<string, string | number>> = [];
    for (const row of bodyRows) {
      const record: Record<string, string | number> = {};
      let hasValue = false;
      normalizedHeaders.forEach((header, idx) => {
        if (!header) return;
        const cell = row[idx] ?? "";
        const cellString = String(cell).trim();
        if (cellString !== "") hasValue = true;
        record[header] = cellString;
      });
      if (hasValue) records.push(record);
    }
    return records;
  }

  async function parseSpreadsheetFile(file: File): Promise<Array<Record<string, string | number>>> {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
      const XLSX = await import("xlsx");
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error("File Excel không có sheet hợp lệ.");
      }
      const sheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<Array<string | number | null>>(sheet, {
        header: 1,
        defval: "",
        raw: false,
      });
      if (rows.length < 2) {
        throw new Error("Sheet Excel không đủ dữ liệu để phân tích.");
      }
      return normalizeRowsFromHeaderAndBody(rows[0] ?? [], rows.slice(1));
    }

    const text = await file.text();
    return parseCsvText(text);
  }

  async function handleCsvUpload(file: File) {
    setUploadingCsv(true);
    setError(null);
    try {
      const uploadedRows = await parseSpreadsheetFile(file);
      setDeepRows(uploadedRows);
      setPreviewPage(1);
      setSourceFilename(file.name);
      setDeepResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể nạp dữ liệu từ file.");
    } finally {
      setUploadingCsv(false);
    }
  }

  function resetStreamOverlay() {
    setStreamMaxDone(-1);
    setStreamRunning(null);
    setStreamSuccess(false);
    setStreamPhaseHint("");
  }

  async function handleDeepAnalyze() {
    if (deepRows.length === 0) {
      setError("Bạn cần nạp dữ liệu trước khi phân tích.");
      return;
    }
    setDeepAnalyzing(true);
    resetStreamOverlay();
    setError(null);
    let finishedOk = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), DEEP_ANALYSIS_FETCH_TIMEOUT_MS);
    try {
      const raw = await postNdjsonStream(
        "/insights/a2a/deep-analysis-stream",
        {
          business_name: businessName,
          industry,
          source_filename: sourceFilename,
          report_rows: deepRows,
        },
        { signal: controller.signal, onEvent: applyStreamEvent },
      );
      setDeepResult(normalizeDeepAnalysisResult(raw));
      await loadRuns();
      finishedOk = true;
    } catch (e) {
      setError(deepAnalysisErrorMessage(e, false));
    } finally {
      window.clearTimeout(timeoutId);
      if (finishedOk) {
        setStreamSuccess(true);
        window.setTimeout(() => {
          setDeepAnalyzing(false);
          resetStreamOverlay();
        }, 400);
      } else {
        setDeepAnalyzing(false);
        resetStreamOverlay();
      }
    }
  }

  async function handleUseSampleData() {
    setUploadingCsv(true);
    setError(null);
    try {
      const response = await fetch("/mau-du-lieu-tro-ly-phan-tich.csv");
      if (!response.ok) throw new Error("Không tải được dữ liệu mẫu.");
      const text = await response.text();
      const rows = parseCsvText(text);
      setDeepRows(rows);
      setPreviewPage(1);
      setSourceFilename("mau-du-lieu-tro-ly-phan-tich.csv");
      setDeepResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể dùng dữ liệu mẫu.");
    } finally {
      setUploadingCsv(false);
    }
  }

  const previewTotalPages = Math.max(1, Math.ceil(deepRows.length / previewLimit));
  const previewStartIndex = (previewPage - 1) * previewLimit;
  const previewEndIndex = previewStartIndex + previewLimit;
  const previewRows = deepRows.slice(previewStartIndex, previewEndIndex);

  const qualityScore = Math.round((deepResult?.data_quality_score ?? 0) * 100);
  const qualityColor =
    qualityScore < 40 ? "text-red-600" : qualityScore < 70 ? "text-amber-600" : "text-green-600";

  function metricScore(value: number, max: number) {
    return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  }

  function reportTypeLabel(value: string) {
    const mapping: Record<string, string> = {
      sales_report: "Báo cáo bán hàng",
      expense_report: "Báo cáo chi phí",
      payroll_report: "Báo cáo lương",
      generic_report: "Báo cáo tổng hợp",
    };
    return mapping[value] || "Báo cáo tổng hợp";
  }

  async function handleLoadRunResult(runId: string) {
    setError(null);
    try {
      const raw = await api.get<unknown>(`/insights/a2a/runs/${runId}/result`);
      setDeepResult(normalizeDeepAnalysisResult(raw));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được kết quả cũ.");
    }
  }

  async function handleReanalyzeRun(runId: string) {
    setDeepAnalyzing(true);
    resetStreamOverlay();
    setError(null);
    let finishedOk = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), DEEP_ANALYSIS_FETCH_TIMEOUT_MS);
    try {
      const raw = await postNdjsonStream(
        `/insights/a2a/runs/${runId}/reanalyze-stream`,
        {
          business_name: businessName,
          industry,
        },
        { signal: controller.signal, onEvent: applyStreamEvent },
      );
      setDeepResult(normalizeDeepAnalysisResult(raw));
      await loadRuns();
      finishedOk = true;
    } catch (e) {
      setError(deepAnalysisErrorMessage(e, true));
    } finally {
      window.clearTimeout(timeoutId);
      if (finishedOk) {
        setStreamSuccess(true);
        window.setTimeout(() => {
          setDeepAnalyzing(false);
          resetStreamOverlay();
        }, 400);
      } else {
        setDeepAnalyzing(false);
        resetStreamOverlay();
      }
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl [&_.card]:!rounded-none [&_.input]:!rounded-none [&_.select]:!rounded-none [&_.btn-primary]:!rounded-none [&_.btn-secondary]:!rounded-none">
      <div className="flex items-center justify-between">
        <div>
          <h1>Trợ lý phân tích</h1>
          <p className="mt-1 text-sm text-gray-500">Đọc báo cáo CSV/Excel và trả về kết quả phân tích dễ hiểu bằng tiếng Việt.</p>
        </div>
        <HelpDialogButton
          title="Hướng dẫn Trợ lý phân tích"
          summary="Trang này giúp bạn biết hôm nay cần làm gì để tăng doanh thu và giảm lãng phí ngân sách, thay vì phải tự đọc nhiều bảng số liệu."
          steps={[
            "Bước 1 - Tải lên 1 file CSV báo cáo kinh doanh của bạn.",
            "Bước 2 - Bấm Phân tích để hệ thống đọc dữ liệu và tính chỉ số.",
            "Bước 3 - Xem kết quả, điểm chất lượng dữ liệu và các gợi ý ưu tiên.",
          ]}
          tips={[
            "Xem điểm chất lượng dữ liệu (vòng tròn) để biết file đã đủ cột và dòng chưa.",
            "Nên giữ ít nhất 20 dòng dữ liệu để insight ổn định hơn.",
            "Sau khi có kết quả, ưu tiên xử lý mục có mức độ Cao trước.",
          ]}
        />
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex border border-blue-200 px-3 py-1 bg-blue-50 text-blue-700">
            Bước 1: Nạp dữ liệu
          </span>
          <span className="inline-flex border border-gray-200 px-3 py-1 bg-gray-100 text-gray-600">
            Bước 2: Phân tích
          </span>
          <span className="inline-flex border border-gray-200 px-3 py-1 bg-gray-100 text-gray-600">
            Bước 3: Hành động
          </span>
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn-secondary cursor-pointer">
              {uploadingCsv ? "Đang nạp CSV..." : "Nạp dữ liệu từ CSV"}
              <input
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                disabled={uploadingCsv}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleCsvUpload(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <button className="btn-secondary" onClick={handleUseSampleData} disabled={uploadingCsv}>
              Tải dữ liệu mẫu
            </button>
          </div>
          <div className="text-xs text-gray-500">
            {deepRows.length === 0 ? "Chưa có dữ liệu CSV." : `Đã nạp ${deepRows.length} dòng từ file ${sourceFilename}.`}
          </div>
          <button className="btn-primary" onClick={handleDeepAnalyze} disabled={deepAnalyzing || deepRows.length === 0}>
            {deepAnalyzing ? "Đang phân tích..." : "Phân tích"}
          </button>
        </div>
      </div>

      {error && <div className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {deepRows.length > 0 && (
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2>Xem lại dữ liệu CSV đã nạp</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">
                {sourceFilename ? `File: ${sourceFilename}` : "Dữ liệu đã nạp"}
              </span>
              <label className="text-gray-600">Hiển thị:</label>
              <select
                className="select w-[110px]"
                value={previewLimit}
                onChange={(e) => {
                  setPreviewLimit(Number(e.target.value));
                  setPreviewPage(1);
                }}
              >
                <option value={20}>20 dòng</option>
                <option value={50}>50 dòng</option>
                <option value={100}>100 dòng</option>
                <option value={200}>200 dòng</option>
              </select>
            </div>
          </div>
          <div className="max-h-[420px] overflow-auto border border-gray-200">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border-b border-gray-200 px-2 py-2 text-left font-medium text-gray-700">#</th>
                  {Object.keys(deepRows[0] ?? {}).map((header) => (
                    <th key={header} className="border-b border-gray-200 px-2 py-2 text-left font-medium text-gray-700">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className={rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                    <td className="border-b border-gray-100 px-2 py-2 text-gray-500">{previewStartIndex + rowIdx + 1}</td>
                    {Object.keys(deepRows[0] ?? {}).map((header) => (
                      <td key={`${rowIdx}-${header}`} className="border-b border-gray-100 px-2 py-2 text-gray-700">
                        {String(row[header] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
            <p>
              Đang hiển thị {Math.min(previewStartIndex + 1, deepRows.length)}-{Math.min(previewEndIndex, deepRows.length)} / {deepRows.length} dòng
            </p>
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary"
                disabled={previewPage <= 1}
                onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
              >
                Trang trước
              </button>
              <span>
                Trang {previewPage}/{previewTotalPages}
              </span>
              <button
                className="btn-secondary"
                disabled={previewPage >= previewTotalPages}
                onClick={() => setPreviewPage((p) => Math.min(previewTotalPages, p + 1))}
              >
                Trang sau
              </button>
            </div>
          </div>
        </div>
      )}

      {deepResult && (
        <div className="card space-y-3">
          <h2>Kết quả AI phân tích</h2>
          <p className="text-sm text-gray-600">
            Doanh nghiệp: <strong>{displayInsightBusiness(deepResult.business_name)}</strong> — Ngành:{" "}
            <strong>{displayInsightIndustry(deepResult.industry)}</strong> — Loại báo cáo:{" "}
            <strong>{deepResult.report_type_vi?.trim() || "Chưa rõ"}</strong>
          </p>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[260px_1fr]">
            <div className="border border-gray-200 p-3">
              <p className="text-xs text-gray-500">Điểm chất lượng dữ liệu</p>
              <div className="mt-3 flex items-center gap-3">
                <div
                  className="relative h-24 w-24 rounded-full border border-gray-200"
                  style={{
                    background: `conic-gradient(${qualityScore < 40 ? "#dc2626" : qualityScore < 70 ? "#eab308" : "#16a34a"} ${(deepResult.data_quality_score ?? 0) * 360}deg, #e5e7eb 0deg)`,
                  }}
                >
                  <div className="absolute inset-2 flex items-center justify-center rounded-full bg-white text-lg font-semibold">
                    {qualityScore}%
                  </div>
                </div>
                <div className="space-y-1 text-xs">
                  <p className={qualityColor}>Mức đánh giá: {qualityScore < 40 ? "Thấp" : qualityScore < 70 ? "Trung bình" : "Tốt"}</p>
                  {Object.entries(deepResult.data_quality_breakdown ?? {}).map(([key, value]) => (
                    <p key={key} className="text-gray-600">
                      {key === "do_day_du_cot" ? "Độ đầy đủ cột" : key === "do_day_du_so_dong" ? "Độ đầy đủ số dòng" : "Độ hợp lệ dữ liệu"}:{" "}
                      {Math.round(value * 100)}%
                    </p>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 text-xs">
              <div className="border border-gray-200 p-2">
                <p className="text-gray-500">Hiệu quả ROAS</p>
                <p className="text-base font-semibold text-gray-800">{deepResult.kpis.roas.toFixed(2)}</p>
                <p className={`${metricScore(deepResult.kpis.roas, 4) >= 60 ? "text-green-600" : "text-amber-600"}`}>{metricScore(deepResult.kpis.roas, 4)}%</p>
              </div>
              <div className="border border-gray-200 p-2">
                <p className="text-gray-500">Tỷ lệ chuyển đổi</p>
                <p className="text-base font-semibold text-gray-800">{(deepResult.kpis.conversion_rate * 100).toFixed(1)}%</p>
                <p className={`${metricScore(deepResult.kpis.conversion_rate, 0.2) >= 60 ? "text-green-600" : "text-amber-600"}`}>{metricScore(deepResult.kpis.conversion_rate, 0.2)}%</p>
              </div>
              <div className="border border-gray-200 p-2">
                <p className="text-gray-500">Tỷ lệ quay lại</p>
                <p className="text-base font-semibold text-gray-800">{(deepResult.kpis.repeat_rate * 100).toFixed(1)}%</p>
                <p className={`${metricScore(deepResult.kpis.repeat_rate, 0.4) >= 60 ? "text-green-600" : "text-amber-600"}`}>{metricScore(deepResult.kpis.repeat_rate, 0.4)}%</p>
              </div>
              <div className="border border-gray-200 p-2">
                <p className="text-gray-500">Giá trị đơn trung bình</p>
                <p className="text-base font-semibold text-gray-800">{Math.round(deepResult.kpis.aov).toLocaleString("vi-VN")} VND</p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {deepResult.insights.length === 0 ? (
              <p className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                Không có nhận định chi tiết trong phản hồi (danh sách rỗng hoặc không đúng định dạng).
              </p>
            ) : (
              deepResult.insights.map((insight, idx) => (
                <div key={idx} className="border border-gray-200 p-3 text-sm">
                  <p className="font-medium text-gray-800">
                    {insight.title} - {insight.severity}
                  </p>
                  <p className="mt-1 text-gray-600">{insight.recommendation}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2>Kết quả đã lưu</h2>
          <p className="text-xs text-gray-500">Có thể mở lại hoặc phân tích lại run cũ.</p>
        </div>
        {runs.length === 0 ? (
          <p className="text-sm text-gray-500">Chưa có kết quả cũ.</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border-b border-gray-200 px-2 py-2 text-left font-medium text-gray-700">Thời gian</th>
                  <th className="border-b border-gray-200 px-2 py-2 text-left font-medium text-gray-700">Doanh nghiệp</th>
                  <th className="border-b border-gray-200 px-2 py-2 text-left font-medium text-gray-700">Loại báo cáo</th>
                  <th className="border-b border-gray-200 px-2 py-2 text-left font-medium text-gray-700">File nguồn</th>
                  <th className="border-b border-gray-200 px-2 py-2 text-left font-medium text-gray-700">Fallback</th>
                  <th className="border-b border-gray-200 px-2 py-2 text-left font-medium text-gray-700">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run, idx) => (
                  <tr key={run.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                    <td className="border-b border-gray-100 px-2 py-2 text-xs text-gray-600">
                      {new Date(run.created_at).toLocaleString("vi-VN")}
                    </td>
                    <td className="border-b border-gray-100 px-2 py-2 text-gray-800">{run.business_name}</td>
                    <td className="border-b border-gray-100 px-2 py-2 text-gray-700">{reportTypeLabel(run.report_type)}</td>
                    <td className="border-b border-gray-100 px-2 py-2 text-xs text-gray-600">{run.source_filename || "-"}</td>
                    <td className="border-b border-gray-100 px-2 py-2 text-xs">
                      {run.fallback_provider ? (
                        <span className="text-amber-700">{run.fallback_provider}: {run.fallback_reason || "Không rõ lý do"}</span>
                      ) : (
                        <span className="text-green-700">Không</span>
                      )}
                    </td>
                    <td className="border-b border-gray-100 px-2 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button className="btn-secondary" onClick={() => void handleLoadRunResult(run.id)}>
                          Xem
                        </button>
                        <button className="btn-primary" onClick={() => void handleReanalyzeRun(run.id)}>
                          Phân tích lại
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deepAnalyzing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-3 py-6">
          <div className="w-full max-w-[920px] border border-indigo-200 bg-white p-6 shadow-xl">
            <p className="text-center text-base font-semibold text-indigo-800">Đang phân tích dữ liệu</p>
            <p className="mt-1 text-center text-sm text-gray-600">Tiến trình (theo máy chủ): {overlayProgress}%</p>
            {streamPhaseHint ? (
              <p className="mt-1 text-center text-[11px] text-gray-600">{streamPhaseHint}</p>
            ) : null}
            <p className="mt-1 text-center text-xs text-gray-500 tabular-nums">
              Đã chờ: {formatWaitSeconds(analyzeElapsedSec)}
            </p>
            <div className="mt-5 flex flex-wrap items-stretch justify-center gap-y-4 text-xs">
              {pipelineSteps.map((step, idx) => {
                const allComplete = streamSuccess;
                const isDone = allComplete || idx <= streamMaxDone;
                const isActive = !allComplete && streamRunning === idx;
                const statusLabel = isDone ? "100%" : isActive ? "Đang chạy…" : "Chờ";
                return (
                  <Fragment key={step.label}>
                    <div
                      className={`flex w-[min(42vw,168px)] flex-col border p-3 text-left sm:w-[168px] ${
                        isActive ? "border-indigo-400 bg-indigo-50" : isDone ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"
                      }`}
                    >
                      <p className="min-h-[2.5rem] font-medium leading-snug text-gray-800">{step.label}</p>
                      <p className="mt-1 min-h-[2.5rem] text-[11px] leading-snug text-gray-500 line-clamp-2">{step.model}</p>
                      <p
                        className={`mt-auto pt-2 ${isDone ? "text-green-700" : isActive ? "animate-pulse text-indigo-700" : "text-gray-500"}`}
                      >
                        {statusLabel}
                      </p>
                    </div>
                    {idx < pipelineSteps.length - 1 ? (
                      <span className="flex shrink-0 items-center self-center px-1 text-sm text-gray-400 sm:px-2" aria-hidden>
                        →
                      </span>
                    ) : null}
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
