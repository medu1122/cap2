"use client";

import { useEffect, useState } from "react";
import HelpDialogButton from "@/components/common/HelpDialogButton";
import { api } from "@/lib/api-client";

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
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [overlayProgress, setOverlayProgress] = useState(0);
  const [previewLimit, setPreviewLimit] = useState(50);
  const [previewPage, setPreviewPage] = useState(1);

  const pipelineSteps = [
    { label: "Phân loại báo cáo", model: "DeepSeek Coder 6.7B" },
    { label: "Ánh xạ cột dữ liệu", model: "DeepSeek Coder 6.7B" },
    { label: "Tính toán chỉ số", model: "Python/Pandas" },
    { label: "Diễn giải kết quả", model: "Qwen 2.5 7B" },
    { label: "Chuẩn hóa tiếng Việt", model: "DeepSeek Coder 6.7B" },
  ] as const;

  useEffect(() => {
    void loadRuns();
  }, []);

  useEffect(() => {
    if (!deepAnalyzing) return;
    const timer = setInterval(() => {
      setOverlayProgress((prev) => {
        const next = Math.min(98, prev + 4);
        setActiveStepIndex(Math.min(pipelineSteps.length - 1, Math.floor((next / 100) * pipelineSteps.length)));
        return next;
      });
    }, 1200);
    return () => clearInterval(timer);
  }, [deepAnalyzing, pipelineSteps.length]);

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

  async function handleDeepAnalyze() {
    if (deepRows.length === 0) {
      setError("Bạn cần nạp dữ liệu trước khi phân tích.");
      return;
    }
    setDeepAnalyzing(true);
    setOverlayProgress(6);
    setError(null);
    try {
      const result = await api.post<DeepAnalysisResult>("/insights/a2a/deep-analysis", {
        business_name: businessName,
        industry,
        source_filename: sourceFilename,
        report_rows: deepRows,
      });
      setDeepResult(result);
      await loadRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể chạy phân tích.");
    } finally {
      setOverlayProgress(100);
      setDeepAnalyzing(false);
      setActiveStepIndex(0);
      setOverlayProgress(0);
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
      const result = await api.get<DeepAnalysisResult>(`/insights/a2a/runs/${runId}/result`);
      setDeepResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được kết quả cũ.");
    }
  }

  async function handleReanalyzeRun(runId: string) {
    setDeepAnalyzing(true);
    setOverlayProgress(6);
    setError(null);
    try {
      const result = await api.post<DeepAnalysisResult>(`/insights/a2a/runs/${runId}/reanalyze`, {
        business_name: businessName,
        industry,
      });
      setDeepResult(result);
      await loadRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể phân tích lại run cũ.");
    } finally {
      setOverlayProgress(100);
      setDeepAnalyzing(false);
      setActiveStepIndex(0);
      setOverlayProgress(0);
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
            "Nếu file chưa đúng chuẩn, hệ thống sẽ cảnh báo chất lượng dữ liệu để bạn chỉnh lại.",
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
            Doanh nghiệp: <strong>{deepResult.business_name}</strong> - Ngành: <strong>{deepResult.industry || "Chưa khai báo"}</strong> - Loại báo cáo: <strong>{deepResult.report_type_vi || "Báo cáo tổng hợp"}</strong>
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
                <p className="text-blue-600">100%</p>
              </div>
            </div>
          </div>
          {deepResult.data_warnings && deepResult.data_warnings.length > 0 && (
            <div className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-medium">Cảnh báo chất lượng dữ liệu</p>
              <ul className="mt-1 list-disc pl-5">
                {deepResult.data_warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          {deepResult.limitations && deepResult.limitations.length > 0 && (
            <div className="border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-800">Phân tích chưa thể thực hiện đầy đủ</p>
              <ul className="mt-1 list-disc pl-5 text-gray-700">
                {deepResult.limitations.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-2">
            {(deepResult.friendly_model_trace ||
              deepResult.model_trace.map((step) => ({
                step: step.step,
                model: step.model,
                provider: step.provider,
                status: step.status === "success" ? "Thành công" : "Thất bại",
              }))).map((step, idx) => (
              <div key={idx} className="border border-gray-200 p-3 text-sm">
                <p className="font-medium text-gray-800">{step.step}</p>
                <p className="mt-1 text-gray-600">Mô hình: {step.model} ({step.provider}) - Trạng thái: {step.status}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {deepResult.insights.map((insight, idx) => (
              <div key={idx} className="border border-gray-200 p-3 text-sm">
                <p className="font-medium text-gray-800">{insight.title} - {insight.severity}</p>
                <p className="text-gray-600 mt-1">{insight.recommendation}</p>
              </div>
            ))}
          </div>
          {deepResult.fallback?.provider && (
            <div className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Hệ thống dự phòng: {deepResult.fallback.provider} - {deepResult.fallback.user_message || "Đã dùng mô hình dự phòng để đảm bảo kết quả."}
            </div>
          )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35">
          <div className="w-[min(94vw,980px)] border border-indigo-200 bg-white p-5 shadow-xl">
            <p className="text-base font-semibold text-indigo-800">Đang phân tích dữ liệu</p>
            <p className="mt-1 text-sm text-gray-600">Tiến trình tổng: {overlayProgress}%</p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              {pipelineSteps.map((step, idx) => {
                const stepProgress = Math.max(0, Math.min(100, Math.round((overlayProgress - idx * 20) * 5)));
                const isDone = idx < activeStepIndex;
                const isActive = idx === activeStepIndex;
                return (
                  <div key={step.label} className="flex items-center gap-2">
                    <div className={`w-[155px] border p-2 ${isActive ? "border-indigo-400 bg-indigo-50" : isDone ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"}`}>
                      <p className="font-medium text-gray-800">{step.label}</p>
                      <p className="text-[11px] text-gray-500">{step.model}</p>
                      <p className={`mt-1 ${isDone ? "text-green-700" : isActive ? "text-indigo-700" : "text-gray-500"}`}>
                        {isDone ? "100%" : `${stepProgress}%`}
                      </p>
                    </div>
                    {idx < pipelineSteps.length - 1 && <span className="text-gray-400">→</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
