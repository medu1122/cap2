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

interface ClassificationInfo {
  report_type?: string;
  reason?: string | null;
  columns_overview?: Array<{ name: string; role_guess: string }>;
  structure_summary?: string;
}

interface KpiAvailabilitySlot {
  computable: boolean;
  reason_if_not?: string | null;
}

interface ExploratoryMetrics {
  numeric_columns?: Array<{
    column: string;
    count: number;
    min: number;
    max: number;
    mean: number;
    sum: number;
  }>;
  categorical_columns?: Array<{
    column: string;
    unique_count: number;
    top_values: Array<{ value: string; count: number }>;
  }>;
  column_hints?: {
    likely_customer_identifier?: string | null;
    likely_price_or_amount?: string | null;
    likely_date?: string | null;
  };
  row_count?: number;
}

interface DeepAnalysisResult {
  run_id: string;
  business_name: string;
  report_type: string;
  report_type_vi?: string;
  industry?: string;
  classification?: ClassificationInfo;
  exploratory_metrics?: ExploratoryMetrics;
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
  situations?: Array<{
    id: string;
    title: string;
    severity: string;
    reason: string;
    evidence?: Record<string, number>;
  }>;
  suggested_actions?: Array<{
    id: string;
    title: string;
    priority: string;
    target_segment: string;
    reason: string;
    expected_impact: string;
  }>;
  action_plan_30_60_90: { day_30: string[]; day_60: string[]; day_90: string[] };
  schema_mapping?: Record<string, string | null>;
  mapping_confidence?: Record<string, number>;
  data_warnings?: string[];
  data_quality_score?: number;
  data_quality_breakdown?: Record<string, number>;
  limitations?: string[];
  /** Neu co: chi hien thi KPI khi computable (API moi). */
  kpi_availability?: Record<string, KpiAvailabilitySlot>;
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

  const situations: NonNullable<DeepAnalysisResult["situations"]> = [];
  if (Array.isArray(r.situations)) {
    for (const item of r.situations) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const evRaw =
        o.evidence && typeof o.evidence === "object" && !Array.isArray(o.evidence)
          ? (o.evidence as Record<string, unknown>)
          : {};
      const evidence: Record<string, number> = {};
      for (const [k, val] of Object.entries(evRaw)) {
        evidence[k] = coerceFiniteNumber(val);
      }
      situations.push({
        id: String(o.id ?? ""),
        title: String(o.title ?? "Tinh huong"),
        severity: String(o.severity ?? "thap"),
        reason: String(o.reason ?? ""),
        evidence,
      });
    }
  }

  const suggested_actions: NonNullable<DeepAnalysisResult["suggested_actions"]> = [];
  if (Array.isArray(r.suggested_actions)) {
    for (const item of r.suggested_actions) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      suggested_actions.push({
        id: String(o.id ?? ""),
        title: String(o.title ?? "Hanh dong"),
        priority: String(o.priority ?? "medium"),
        target_segment: String(o.target_segment ?? "unknown"),
        reason: String(o.reason ?? ""),
        expected_impact: String(o.expected_impact ?? ""),
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

  let kpi_availability: DeepAnalysisResult["kpi_availability"] = undefined;
  if (r.kpi_availability && typeof r.kpi_availability === "object" && !Array.isArray(r.kpi_availability)) {
    const built: NonNullable<DeepAnalysisResult["kpi_availability"]> = {};
    for (const [key, val] of Object.entries(r.kpi_availability as Record<string, unknown>)) {
      if (!val || typeof val !== "object" || Array.isArray(val)) continue;
      const o = val as Record<string, unknown>;
      built[key] = {
        computable: Boolean(o.computable),
        reason_if_not: o.reason_if_not == null ? undefined : String(o.reason_if_not),
      };
    }
    kpi_availability = Object.keys(built).length ? built : undefined;
  }

  let classification: ClassificationInfo | undefined;
  if (r.classification && typeof r.classification === "object" && !Array.isArray(r.classification)) {
    const c = r.classification as Record<string, unknown>;
    const overviewRaw = Array.isArray(c.columns_overview) ? c.columns_overview : [];
    const columns_overview: Array<{ name: string; role_guess: string }> = [];
    for (const row of overviewRaw) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      columns_overview.push({
        name: String(o.name ?? ""),
        role_guess: String(o.role_guess ?? "unknown"),
      });
    }
    classification = {
      report_type: c.report_type != null ? String(c.report_type) : undefined,
      reason: c.reason == null ? undefined : String(c.reason),
      structure_summary: c.structure_summary != null ? String(c.structure_summary) : undefined,
      columns_overview: columns_overview.length ? columns_overview : undefined,
    };
  }

  let exploratory_metrics: ExploratoryMetrics | undefined;
  if (r.exploratory_metrics && typeof r.exploratory_metrics === "object" && !Array.isArray(r.exploratory_metrics)) {
    const ex = r.exploratory_metrics as Record<string, unknown>;
    const numeric_columns: ExploratoryMetrics["numeric_columns"] = [];
    if (Array.isArray(ex.numeric_columns)) {
      for (const row of ex.numeric_columns) {
        if (!row || typeof row !== "object") continue;
        const o = row as Record<string, unknown>;
        numeric_columns.push({
          column: String(o.column ?? ""),
          count: coerceFiniteNumber(o.count),
          min: coerceFiniteNumber(o.min),
          max: coerceFiniteNumber(o.max),
          mean: coerceFiniteNumber(o.mean),
          sum: coerceFiniteNumber(o.sum),
        });
      }
    }
    const categorical_columns: ExploratoryMetrics["categorical_columns"] = [];
    if (Array.isArray(ex.categorical_columns)) {
      for (const row of ex.categorical_columns) {
        if (!row || typeof row !== "object") continue;
        const o = row as Record<string, unknown>;
        const tops: Array<{ value: string; count: number }> = [];
        if (Array.isArray(o.top_values)) {
          for (const t of o.top_values) {
            if (!t || typeof t !== "object") continue;
            const u = t as Record<string, unknown>;
            tops.push({ value: String(u.value ?? ""), count: coerceFiniteNumber(u.count) });
          }
        }
        categorical_columns.push({
          column: String(o.column ?? ""),
          unique_count: coerceFiniteNumber(o.unique_count),
          top_values: tops,
        });
      }
    }
    const hints = ex.column_hints && typeof ex.column_hints === "object" ? (ex.column_hints as Record<string, unknown>) : undefined;
    exploratory_metrics = {
      numeric_columns: numeric_columns.length ? numeric_columns : undefined,
      categorical_columns: categorical_columns.length ? categorical_columns : undefined,
      row_count: ex.row_count != null ? coerceFiniteNumber(ex.row_count) : undefined,
      column_hints: hints
        ? {
            likely_customer_identifier:
              hints.likely_customer_identifier == null ? undefined : String(hints.likely_customer_identifier),
            likely_price_or_amount: hints.likely_price_or_amount == null ? undefined : String(hints.likely_price_or_amount),
            likely_date: hints.likely_date == null ? undefined : String(hints.likely_date),
          }
        : undefined,
    };
  }

  return {
    run_id: String(r.run_id),
    business_name: String(r.business_name ?? ""),
    report_type: String(r.report_type ?? "generic_report"),
    report_type_vi: r.report_type_vi != null ? String(r.report_type_vi) : undefined,
    industry: r.industry != null ? String(r.industry) : undefined,
    classification,
    exploratory_metrics,
    model_trace,
    friendly_model_trace,
    kpis,
    insights,
    issues: normalizeStringArray(r.issues).filter(Boolean),
    situations: situations.length ? situations : undefined,
    suggested_actions: suggested_actions.length ? suggested_actions : undefined,
    action_plan_30_60_90,
    schema_mapping,
    mapping_confidence,
    data_warnings: data_warnings.length ? data_warnings : undefined,
    data_quality_score: coerceFiniteNumber(r.data_quality_score, 0),
    data_quality_breakdown,
    limitations: limitations.length ? limitations : undefined,
    kpi_availability,
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

/** Anh xa role_guess tu model sang tieng Viet ngan gon. */
/** API cu khong co kpi_availability -> coi la hien thi binh thuong. */
function kpiSlot(result: DeepAnalysisResult, key: string): { ok: boolean; reason?: string } {
  const s = result.kpi_availability?.[key];
  if (!s) return { ok: true };
  return { ok: s.computable, reason: s.reason_if_not ?? undefined };
}

function roleGuessLabelVi(role: string): string {
  const m: Record<string, string> = {
    revenue: "Doanh thu / giá trị",
    ad_spend: "Chi phí quảng cáo",
    orders: "Đơn / số lượng",
    leads: "Lead / khách tiềm năng",
    repeat_orders: "Đơn lặp lại",
    date: "Thời gian / ngày",
    category: "Nhóm / danh mục",
    customer: "Khách hàng",
    price: "Giá / đơn giá",
    metric_other: "Chỉ số (số)",
    unknown: "Chưa rõ",
  };
  const k = role.trim().toLowerCase();
  return m[k] ?? role;
}

function toCampaignFromActionHref(
  runId: string,
  action: { title: string; reason: string; target_segment: string; expected_impact?: string },
): string {
  const normalizedSegment = (action.target_segment || "unknown").toLowerCase();
  const channels = normalizedSegment === "inactive" || normalizedSegment === "vip" ? "email" : "facebook_post";
  const params = new URLSearchParams({
    source_insight_run_id: runId,
    source_customer_segment: normalizedSegment,
    channels,
    campaign_name: `Action: ${action.title}`.slice(0, 120),
    objective: action.reason || action.title,
    offer_or_hook: action.expected_impact || "",
    additional_notes: `[INSIGHT_ACTION] ${action.title}`,
  });
  return `/campaigns/new?${params.toString()}`;
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
  const [actionSegmentFilter, setActionSegmentFilter] = useState<"all" | "vip" | "potential" | "inactive" | "unknown">("all");

  const pipelineSteps = [
    { label: "Phân loại báo cáo", model: "Qwen 2.5 14B (local)" },
    { label: "Ánh xạ cột dữ liệu", model: "Qwen 2.5 14B (local)" },
    { label: "Tính toán chỉ số", model: "Python/Pandas" },
    { label: "Diễn giải kết quả", model: "Qwen 2.5 14B (local/GPT fallback)" },
    { label: "Chuẩn hóa tiếng Việt", model: "Qwen 2.5 14B (local)" },
  ] as const;

  const filteredSuggestedActions = useMemo(() => {
    const actions = deepResult?.suggested_actions ?? [];
    if (actionSegmentFilter === "all") return actions;
    return actions.filter((a) => (a.target_segment || "unknown").toLowerCase() === actionSegmentFilter);
  }, [deepResult?.suggested_actions, actionSegmentFilter]);

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
        <div className="card space-y-4">
          <h2>Kết quả AI phân tích</h2>

          <div className="max-w-sm border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Điểm chất lượng dữ liệu</p>
            <div className="mt-4 flex flex-col items-center justify-center gap-4 sm:flex-row sm:items-start">
              <div
                className="relative h-28 w-28 shrink-0 rounded-full border border-gray-200"
                style={{
                  background: `conic-gradient(${qualityScore < 40 ? "#dc2626" : qualityScore < 70 ? "#eab308" : "#16a34a"} ${(deepResult.data_quality_score ?? 0) * 360}deg, #e5e7eb 0deg)`,
                }}
              >
                <div className="absolute inset-2 flex items-center justify-center rounded-full bg-white text-xl font-semibold tabular-nums">
                  {qualityScore}%
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-2 text-sm">
                <p className={qualityColor}>
                  Mức đánh giá: <span className="font-medium">{qualityScore < 40 ? "Thấp" : qualityScore < 70 ? "Trung bình" : "Tốt"}</span>
                </p>
                {Object.entries(deepResult.data_quality_breakdown ?? {}).map(([key, value]) => (
                  <p key={key} className="text-gray-700">
                    {key === "do_day_du_cot"
                      ? "Độ đầy đủ cột"
                      : key === "do_day_du_so_dong"
                        ? "Độ đầy đủ số dòng"
                        : "Độ hợp lệ dữ liệu"}
                    : {Math.round(value * 100)}%
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div className="border border-indigo-200 bg-indigo-50/50 p-4 text-sm leading-relaxed text-gray-800">
            <p className="font-medium text-indigo-950">Chào bạn — đây là phần phân tích chi tiết từ dữ liệu bạn đã gửi</p>
            <p className="mt-3 text-gray-700">
              Mình đã đọc file và gắn nhãn doanh nghiệp là <strong>{displayInsightBusiness(deepResult.business_name)}</strong>, ngành{" "}
              <strong>{displayInsightIndustry(deepResult.industry)}</strong>, loại báo cáo{" "}
              <strong>{deepResult.report_type_vi?.trim() || reportTypeLabel(deepResult.report_type)}</strong>.
            </p>

            {deepResult.classification?.structure_summary || (deepResult.classification?.columns_overview?.length ?? 0) > 0 || deepResult.classification?.reason ? (
              <>
                <p className="mt-4 font-medium text-gray-900">Bước 1 — Phân loại nhanh (chỉ cần tên cột và tối đa 2 dòng mẫu)</p>
                {deepResult.classification?.structure_summary ? (
                  <p className="mt-2 text-gray-700">{deepResult.classification.structure_summary}</p>
                ) : null}
                {deepResult.classification?.reason ? (
                  <p className="mt-1 text-xs text-gray-600">Ghi chú từ mô hình: {deepResult.classification.reason}</p>
                ) : null}
                {deepResult.classification?.columns_overview && deepResult.classification.columns_overview.length > 0 ? (
                  <ul className="mt-2 space-y-1 border border-indigo-100 bg-white/70 p-3 text-gray-700">
                    {deepResult.classification.columns_overview.map((row, i) => (
                      <li key={`${row.name}-${i}`} className="flex flex-wrap gap-x-2 text-sm">
                        <span className="font-medium">{row.name}</span>
                        <span className="text-gray-500">— {roleGuessLabelVi(row.role_guess)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : null}

            {deepResult.schema_mapping && Object.keys(deepResult.schema_mapping).length > 0 ? (
              <>
                <p className="mt-4 font-medium text-gray-900">Bước 2 — Ánh xạ cột phục vụ tính toán (chọn cột cho KPI)</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-gray-700 marker:text-indigo-600">
                  {Object.entries(deepResult.schema_mapping).map(([role, col]) => (
                    <li key={role}>
                      {role}: <strong>{col ?? "—"}</strong>
                      {deepResult.mapping_confidence?.[role] != null ? (
                        <span className="text-gray-500"> (độ tin: {Math.round(deepResult.mapping_confidence[role] * 100)}%)</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {deepResult.exploratory_metrics &&
            ((deepResult.exploratory_metrics.numeric_columns?.length ?? 0) > 0 ||
              (deepResult.exploratory_metrics.categorical_columns?.length ?? 0) > 0 ||
              deepResult.exploratory_metrics.row_count != null) ? (
              <>
                <p className="mt-4 font-medium text-gray-900">Bước 3 — Thống kê khám phá (trên toàn bộ dòng bạn đã gửi)</p>
                {deepResult.exploratory_metrics.row_count != null ? (
                  <p className="mt-1 text-xs text-gray-600">Số dòng đưa vào thống kê: {Math.round(deepResult.exploratory_metrics.row_count)}</p>
                ) : null}
                {deepResult.exploratory_metrics.column_hints &&
                (deepResult.exploratory_metrics.column_hints.likely_customer_identifier ||
                  deepResult.exploratory_metrics.column_hints.likely_price_or_amount ||
                  deepResult.exploratory_metrics.column_hints.likely_date) ? (
                  <ul className="mt-2 list-inside list-disc space-y-1 text-gray-700 marker:text-indigo-600">
                    {deepResult.exploratory_metrics.column_hints.likely_customer_identifier ? (
                      <li>
                        Gợi ý cột liên quan khách hàng: <strong>{deepResult.exploratory_metrics.column_hints.likely_customer_identifier}</strong>
                      </li>
                    ) : null}
                    {deepResult.exploratory_metrics.column_hints.likely_price_or_amount ? (
                      <li>
                        Gợi ý cột giá / số tiền: <strong>{deepResult.exploratory_metrics.column_hints.likely_price_or_amount}</strong>
                      </li>
                    ) : null}
                    {deepResult.exploratory_metrics.column_hints.likely_date ? (
                      <li>
                        Gợi ý cột thời gian: <strong>{deepResult.exploratory_metrics.column_hints.likely_date}</strong>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
                {deepResult.exploratory_metrics.numeric_columns && deepResult.exploratory_metrics.numeric_columns.length > 0 ? (
                  <div className="mt-3 space-y-2 border border-gray-200 bg-white/80 p-3 text-xs text-gray-800">
                    <p className="font-medium text-gray-900">Cột số: thấp nhất — cao nhất — trung bình (theo từng cột)</p>
                    <ul className="mt-2 space-y-2">
                      {deepResult.exploratory_metrics.numeric_columns.map((nc) => (
                        <li key={nc.column}>
                          <span className="font-medium">{nc.column}</span>
                          <span className="text-gray-600">
                            {" "}
                            — min {nc.min.toLocaleString("vi-VN")}, max {nc.max.toLocaleString("vi-VN")}, trung bình {nc.mean.toLocaleString("vi-VN")}, tổng{" "}
                            {nc.sum.toLocaleString("vi-VN")} ({nc.count} giá trị số)
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {deepResult.exploratory_metrics.categorical_columns && deepResult.exploratory_metrics.categorical_columns.length > 0 ? (
                  <div className="mt-3 space-y-2 border border-gray-200 bg-white/80 p-3 text-xs text-gray-800">
                    <p className="font-medium text-gray-900">Cột phân loại: giá trị xuất hiện nhiều nhất</p>
                    <ul className="mt-2 space-y-2">
                      {deepResult.exploratory_metrics.categorical_columns.map((cc) => (
                        <li key={cc.column}>
                          <span className="font-medium">{cc.column}</span>
                          <span className="text-gray-600"> — {cc.unique_count} giá trị khác nhau</span>
                          <ul className="mt-1 ml-3 list-disc text-gray-700">
                            {cc.top_values.map((tv, j) => (
                              <li key={j}>
                                {tv.value} <span className="text-gray-500">({tv.count} dòng)</span>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : null}

            <p className="mt-4 font-medium text-gray-900">Tổng hợp KPI (từ các cột đã ánh xạ)</p>
            {deepResult.kpi_availability ? (
              <p className="mt-1 text-xs text-gray-600">
                Giá trị chỉ hiển thị khi đủ cột và mẫu số hợp lệ. Dòng <strong className="font-normal">—</strong> nghĩa là KPI{" "}
                <em>không áp dụng</em>, không phải “bằng 0 thật”.
              </p>
            ) : null}
            <ul className="mt-2 list-inside list-disc space-y-1 text-gray-700 marker:text-indigo-600">
              <li>
                Doanh thu (tổng từ cột đã nhận diện):{" "}
                {kpiSlot(deepResult, "revenue").ok ? (
                  <strong>{Math.round(deepResult.kpis.revenue).toLocaleString("vi-VN")} VND</strong>
                ) : (
                  <>
                    <strong className="text-gray-500">—</strong>{" "}
                    <span className="text-xs text-gray-600">({kpiSlot(deepResult, "revenue").reason})</span>
                  </>
                )}
              </li>
              <li>
                Chi phí quảng cáo:{" "}
                {kpiSlot(deepResult, "ad_spend").ok ? (
                  <strong>{Math.round(deepResult.kpis.ad_spend).toLocaleString("vi-VN")} VND</strong>
                ) : (
                  <>
                    <strong className="text-gray-500">—</strong>{" "}
                    <span className="text-xs text-gray-600">({kpiSlot(deepResult, "ad_spend").reason})</span>
                  </>
                )}
              </li>
              <li>
                Số đơn / giao dịch:{" "}
                {kpiSlot(deepResult, "orders").ok ? (
                  <strong>{Math.round(deepResult.kpis.orders).toLocaleString("vi-VN")}</strong>
                ) : (
                  <>
                    <strong className="text-gray-500">—</strong>{" "}
                    <span className="text-xs text-gray-600">({kpiSlot(deepResult, "orders").reason})</span>
                  </>
                )}
              </li>
              <li>
                Số lead (tổng từ cột đã nhận diện):{" "}
                {kpiSlot(deepResult, "leads").ok ? (
                  <strong>{Math.round(deepResult.kpis.leads).toLocaleString("vi-VN")}</strong>
                ) : (
                  <>
                    <strong className="text-gray-500">—</strong>{" "}
                    <span className="text-xs text-gray-600">({kpiSlot(deepResult, "leads").reason})</span>
                  </>
                )}
              </li>
              <li>
                ROAS (doanh thu / chi phí quảng cáo):{" "}
                {kpiSlot(deepResult, "roas").ok ? (
                  <strong>{deepResult.kpis.roas.toFixed(2)}</strong>
                ) : (
                  <>
                    <strong className="text-gray-500">—</strong>{" "}
                    <span className="text-xs text-gray-600">({kpiSlot(deepResult, "roas").reason})</span>
                  </>
                )}
              </li>
              <li>
                Tỷ lệ chuyển đổi:{" "}
                {kpiSlot(deepResult, "conversion_rate").ok ? (
                  <strong>{(deepResult.kpis.conversion_rate * 100).toFixed(2)}%</strong>
                ) : (
                  <>
                    <strong className="text-gray-500">—</strong>{" "}
                    <span className="text-xs text-gray-600">({kpiSlot(deepResult, "conversion_rate").reason})</span>
                  </>
                )}
              </li>
              <li>
                Tỷ lệ khách quay lại:{" "}
                {kpiSlot(deepResult, "repeat_rate").ok ? (
                  <strong>{(deepResult.kpis.repeat_rate * 100).toFixed(2)}%</strong>
                ) : (
                  <>
                    <strong className="text-gray-500">—</strong>{" "}
                    <span className="text-xs text-gray-600">({kpiSlot(deepResult, "repeat_rate").reason})</span>
                  </>
                )}
              </li>
              <li>
                Giá trị đơn trung bình (AOV):{" "}
                {kpiSlot(deepResult, "aov").ok ? (
                  <strong>{Math.round(deepResult.kpis.aov).toLocaleString("vi-VN")} VND</strong>
                ) : (
                  <>
                    <strong className="text-gray-500">—</strong>{" "}
                    <span className="text-xs text-gray-600">({kpiSlot(deepResult, "aov").reason})</span>
                  </>
                )}
              </li>
            </ul>
            <p className="mt-2 text-xs text-gray-600">
              Nếu đã ánh xạ cột nhưng số vẫn lạ (ví dụ doanh thu 0), kiểm tra định dạng số trong file hoặc đúng cột tiền tệ — có thể phân tích lại sau khi chỉnh.
            </p>

            {deepResult.data_warnings && deepResult.data_warnings.length > 0 ? (
              <>
                <p className="mt-4 font-medium text-amber-900">Lưu ý về dữ liệu</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-amber-950/90 marker:text-amber-700">
                  {deepResult.data_warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </>
            ) : null}

            {deepResult.issues.length > 0 ? (
              <>
                <p className="mt-4 font-medium text-gray-900">Vấn đề cần chú ý</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-gray-700 marker:text-indigo-600">
                  {deepResult.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </>
            ) : null}

            {deepResult.situations && deepResult.situations.length > 0 ? (
              <>
                <p className="mt-4 font-medium text-gray-900">Tình huống phát hiện</p>
                <ul className="mt-2 space-y-2">
                  {deepResult.situations.map((situation) => (
                    <li key={situation.id} className="border border-gray-200 bg-white p-3">
                      <p className="font-medium text-gray-900">
                        {situation.title} <span className="text-xs text-gray-500">({situation.severity})</span>
                      </p>
                      <p className="mt-1 text-sm text-gray-700">{situation.reason}</p>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {deepResult.suggested_actions && deepResult.suggested_actions.length > 0 ? (
              <>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-gray-900">Hành động đề xuất</p>
                  <select
                    className="select w-[180px] text-xs"
                    value={actionSegmentFilter}
                    onChange={(e) =>
                      setActionSegmentFilter(
                        e.target.value as "all" | "vip" | "potential" | "inactive" | "unknown",
                      )
                    }
                  >
                    <option value="all">Tất cả segment</option>
                    <option value="vip">VIP</option>
                    <option value="potential">Potential</option>
                    <option value="inactive">Inactive</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
                <ul className="mt-2 space-y-2">
                  {filteredSuggestedActions.map((action) => (
                    <li key={action.id} className="border border-green-200 bg-green-50/40 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-gray-900">{action.title}</p>
                          <p className="mt-1 text-xs text-gray-600">
                            Ưu tiên: {action.priority} | Segment: {action.target_segment}
                          </p>
                        </div>
                        <a
                          className="btn-primary text-xs"
                          href={toCampaignFromActionHref(deepResult.run_id, action)}
                        >
                          Tạo campaign từ action
                        </a>
                      </div>
                      <p className="mt-2 text-sm text-gray-700">{action.reason}</p>
                      {action.expected_impact ? (
                        <p className="mt-1 text-xs text-gray-600">Tác động kỳ vọng: {action.expected_impact}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {filteredSuggestedActions.length === 0 ? (
                  <p className="text-xs text-gray-500">Không có action cho segment đã chọn.</p>
                ) : null}
              </>
            ) : null}

            {deepResult.limitations && deepResult.limitations.length > 0 ? (
              <>
                <p className="mt-4 font-medium text-gray-900">Giới hạn phân tích</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-gray-700 marker:text-gray-500">
                  {deepResult.limitations.map((lim, i) => (
                    <li key={i}>{lim}</li>
                  ))}
                </ul>
              </>
            ) : null}

            <p className="mt-4 font-medium text-gray-900">Nhận định và gợi ý</p>
            {deepResult.insights.length === 0 ? (
              <p className="mt-2 text-gray-600">Hiện chưa có nhận định chi tiết từ mô hình — có thể do dữ liệu quá ít hoặc định dạng chưa khớp.</p>
            ) : (
              <ul className="mt-2 space-y-3">
                {deepResult.insights.map((insight, idx) => (
                  <li key={idx} className="border-l-2 border-indigo-300 pl-3">
                    <p className="font-medium text-gray-900">
                      {insight.title}{" "}
                      <span className="font-normal text-gray-500">({insight.severity})</span>
                    </p>
                    {Object.keys(insight.evidence).length > 0 ? (
                      <p className="mt-1 text-xs text-gray-600">
                        Số liệu liên quan:{" "}
                        {Object.entries(insight.evidence)
                          .map(([k, v]) => `${k} = ${Number.isInteger(v) ? v : v.toFixed(4)}`)
                          .join("; ")}
                      </p>
                    ) : null}
                    <p className="mt-1 text-gray-700">{insight.recommendation}</p>
                  </li>
                ))}
              </ul>
            )}

            {(deepResult.action_plan_30_60_90.day_30.length > 0 ||
              deepResult.action_plan_30_60_90.day_60.length > 0 ||
              deepResult.action_plan_30_60_90.day_90.length > 0) && (
              <>
                <p className="mt-4 font-medium text-gray-900">Gợi ý theo mốc thời gian</p>
                {deepResult.action_plan_30_60_90.day_30.length > 0 ? (
                  <div className="mt-2">
                    <p className="text-xs font-semibold uppercase text-gray-500">30 ngày tới</p>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-gray-700">
                      {deepResult.action_plan_30_60_90.day_30.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {deepResult.action_plan_30_60_90.day_60.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase text-gray-500">60 ngày tới</p>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-gray-700">
                      {deepResult.action_plan_30_60_90.day_60.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {deepResult.action_plan_30_60_90.day_90.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase text-gray-500">90 ngày tới</p>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-gray-700">
                      {deepResult.action_plan_30_60_90.day_90.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}

            {deepResult.fallback.user_message || deepResult.fallback.reason ? (
              <p className="mt-4 rounded border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-950">
                {deepResult.fallback.user_message || deepResult.fallback.reason}
              </p>
            ) : null}
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
          <div className="w-full max-w-[min(100%-1.5rem,1100px)] border border-indigo-200 bg-white p-4 shadow-xl sm:p-6">
            <p className="text-center text-base font-semibold text-indigo-800">Đang phân tích dữ liệu</p>
            <p className="mt-1 text-center text-sm text-gray-600">Tiến trình (theo máy chủ): {overlayProgress}%</p>
            {streamPhaseHint ? (
              <p className="mt-1 text-center text-[11px] text-gray-600">{streamPhaseHint}</p>
            ) : null}
            <p className="mt-1 text-center text-xs text-gray-500 tabular-nums">
              Đã chờ: {formatWaitSeconds(analyzeElapsedSec)}
            </p>
            <div className="mt-5 flex flex-nowrap items-stretch justify-center gap-1 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] sm:gap-2 text-xs">
              {pipelineSteps.map((step, idx) => {
                const allComplete = streamSuccess;
                const isDone = allComplete || idx <= streamMaxDone;
                const isActive = !allComplete && streamRunning === idx;
                const statusLabel = isDone ? "100%" : isActive ? "Đang chạy…" : "Chờ";
                return (
                  <Fragment key={step.label}>
                    <div
                      className={`flex w-[min(17vw,152px)] min-w-[104px] shrink-0 flex-col border p-2 text-left sm:w-[152px] sm:p-3 ${
                        isActive ? "border-indigo-400 bg-indigo-50" : isDone ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"
                      }`}
                    >
                      <p className="min-h-[2.25rem] font-medium leading-snug text-gray-800">{step.label}</p>
                      <p className="mt-1 min-h-[2.25rem] text-[10px] leading-snug text-gray-500 line-clamp-2 sm:text-[11px]">{step.model}</p>
                      <p
                        className={`mt-auto pt-2 ${isDone ? "text-green-700" : isActive ? "animate-pulse text-indigo-700" : "text-gray-500"}`}
                      >
                        {statusLabel}
                      </p>
                    </div>
                    {idx < pipelineSteps.length - 1 ? (
                      <span className="flex shrink-0 items-center self-center px-0.5 text-xs text-gray-400 sm:px-1" aria-hidden>
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
