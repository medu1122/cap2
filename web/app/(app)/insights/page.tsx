"use client";

import { useEffect, useState } from "react";
import HelpDialogButton from "@/components/common/HelpDialogButton";
import { api } from "@/lib/api-client";

interface DeepAnalysisResult {
  run_id: string;
  business_name: string;
  report_type: string;
  industry?: string;
  model_trace: Array<{ step: string; agent: string; provider: string; model: string; status: string }>;
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
  fallback: { provider?: string | null; reason?: string | null };
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
  const [businessName, setBusinessName] = useState("Doanh nghiệp mẫu");
  const [industry, setIndustry] = useState("Bán lẻ tiêu dùng");
  const [sourceFilename, setSourceFilename] = useState<string | undefined>(undefined);
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  useEffect(() => {
    void loadRuns();
  }, []);

  useEffect(() => {
    if (!deepAnalyzing) return;
    const timer = setInterval(() => {
      setActiveStepIndex((prev) => (prev + 1) % 5);
    }, 1200);
    return () => clearInterval(timer);
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

  async function handleCsvUpload(file: File) {
    setUploadingCsv(true);
    setError(null);
    try {
      const text = await file.text();
      const uploadedRows = parseCsvText(text);
      setDeepRows(uploadedRows);
      setSourceFilename(file.name);
      setDeepResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể nạp dữ liệu CSV.");
    } finally {
      setUploadingCsv(false);
    }
  }

  async function handleDeepAnalyze() {
    if (deepRows.length === 0) {
      setError("Bạn cần nạp dữ liệu CSV trước khi phân tích sâu A2A.");
      return;
    }
    setDeepAnalyzing(true);
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
      setError(e instanceof Error ? e.message : "Không thể chạy phân tích sâu A2A.");
    } finally {
      setDeepAnalyzing(false);
      setActiveStepIndex(0);
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
      setSourceFilename("mau-du-lieu-tro-ly-phan-tich.csv");
      setDeepResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể dùng dữ liệu mẫu.");
    } finally {
      setUploadingCsv(false);
    }
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
      setDeepAnalyzing(false);
      setActiveStepIndex(0);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl [&_.card]:!rounded-none [&_.input]:!rounded-none [&_.select]:!rounded-none [&_.btn-primary]:!rounded-none [&_.btn-secondary]:!rounded-none">
      <div className="flex items-center justify-between">
        <div>
          <h1>Trợ lý phân tích</h1>
          <p className="text-sm text-gray-500 mt-1">Phân tích sâu báo cáo CSV bằng luồng A2A: DeepSeek -> Qwen -> GPT fallback.</p>
        </div>
        <HelpDialogButton
          title="Hướng dẫn Trợ lý phân tích"
          summary="Trang này giúp bạn biết hôm nay cần làm gì để tăng doanh thu và giảm lãng phí ngân sách, thay vì phải tự đọc nhiều bảng số liệu."
          steps={[
            "Bước 1 - Tải lên 1 file CSV báo cáo kinh doanh của bạn.",
            "Bước 2 - Bấm Phân tích để chạy chuỗi tác tử.",
            "Bước 3 - Đọc insight và kế hoạch hành động 30/60/90 ngày.",
          ]}
          tips={[
            "Nếu CSV không đúng chuẩn, hệ thống vẫn cố gắng map cột và ghi rõ trạng thái fallback.",
            "Nên giữ ít nhất 20 dòng dữ liệu để insight ổn định hơn.",
            "Sau khi có kết quả, ưu tiên xử lý mục có mức độ Cao trước.",
          ]}
        />
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex rounded-full px-3 py-1 bg-blue-50 text-blue-700">
            Bước 1: Nạp dữ liệu
          </span>
          <span className="inline-flex rounded-full px-3 py-1 bg-gray-100 text-gray-600">
            Bước 2: Phân tích
          </span>
          <span className="inline-flex rounded-full px-3 py-1 bg-gray-100 text-gray-600">
            Bước 3: Hành động
          </span>
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn-secondary cursor-pointer">
              {uploadingCsv ? "Đang nạp CSV..." : "Nạp dữ liệu từ CSV"}
              <input
                type="file"
                accept=".csv,text/csv"
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
              Dùng dữ liệu mẫu ngay
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Cần file để chỉnh tay trước khi nạp?{" "}
            <a href="/mau-du-lieu-tro-ly-phan-tich.csv" className="underline">
              Tải file CSV mẫu
            </a>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Tên doanh nghiệp" />
            <input className="input" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Ngành hàng" />
          </div>
          <div className="text-xs text-gray-500">
            {deepRows.length === 0 ? "Chưa có dữ liệu CSV." : `Đã nạp ${deepRows.length} dòng từ file ${sourceFilename}.`}
          </div>
          <button className="btn-primary" onClick={handleDeepAnalyze} disabled={deepAnalyzing || deepRows.length === 0}>
            {deepAnalyzing ? "Đang phân tích..." : "Phân tích"}
          </button>
        </div>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {deepResult && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2>Kết quả phân tích sâu A2A</h2>
            <span className="inline-flex rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">Run ID: {deepResult.run_id}</span>
          </div>
          <p className="text-sm text-gray-600">
            Doanh nghiệp: <strong>{deepResult.business_name}</strong> - Ngành: <strong>{deepResult.industry || "Chưa khai báo"}</strong> - Loại báo cáo: <strong>{deepResult.report_type}</strong>
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="rounded border border-gray-200 p-2">ROAS: {deepResult.kpis.roas.toFixed(2)}</div>
            <div className="rounded border border-gray-200 p-2">Conversion: {(deepResult.kpis.conversion_rate * 100).toFixed(1)}%</div>
            <div className="rounded border border-gray-200 p-2">Repeat rate: {(deepResult.kpis.repeat_rate * 100).toFixed(1)}%</div>
            <div className="rounded border border-gray-200 p-2">AOV: {Math.round(deepResult.kpis.aov).toLocaleString("vi-VN")} VND</div>
          </div>
          {deepResult.schema_mapping && (
            <div className="rounded border border-gray-200 p-3 text-xs space-y-2">
              <p className="font-medium text-gray-800">Mapping cột CSV (độ tin cậy)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Object.entries(deepResult.schema_mapping).map(([key, value]) => {
                  const conf = deepResult.mapping_confidence?.[key] ?? 0;
                  return (
                    <div key={key} className="rounded border border-gray-200 bg-gray-50 p-2">
                      <p className="font-medium">{key}</p>
                      <p className="text-gray-600">Cột gốc: {value || "Không map được"}</p>
                      <p className="text-gray-500">Tin cậy: {(conf * 100).toFixed(0)}%</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {deepResult.data_warnings && deepResult.data_warnings.length > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-medium">Cảnh báo chất lượng dữ liệu</p>
              <ul className="mt-1 list-disc pl-5">
                {deepResult.data_warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-2">
            {deepResult.model_trace.map((step, idx) => (
              <div key={idx} className="rounded border border-gray-200 p-3 text-sm">
                <p className="font-medium text-gray-800">{step.step} - {step.agent}</p>
                <p className="text-gray-600 mt-1">Model: {step.model} ({step.provider}) - Trạng thái: {step.status}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {deepResult.insights.map((insight, idx) => (
              <div key={idx} className="rounded border border-gray-200 p-3 text-sm">
                <p className="font-medium text-gray-800">{insight.title} - {insight.severity}</p>
                <p className="text-gray-600 mt-1">{insight.recommendation}</p>
              </div>
            ))}
          </div>
          <div className="rounded border border-gray-200 p-3 text-sm">
            <p className="font-medium text-gray-800">Kế hoạch hành động 30/60/90</p>
            <p className="mt-1 text-gray-600">30 ngày: {deepResult.action_plan_30_60_90.day_30.join("; ")}</p>
            <p className="mt-1 text-gray-600">60 ngày: {deepResult.action_plan_30_60_90.day_60.join("; ")}</p>
            <p className="mt-1 text-gray-600">90 ngày: {deepResult.action_plan_30_60_90.day_90.join("; ")}</p>
          </div>
          {deepResult.fallback?.provider && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Fallback đã dùng: {deepResult.fallback.provider} - Lý do: {deepResult.fallback.reason}
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
          <div className="space-y-2">
            {runs.map((run) => (
              <div key={run.id} className="rounded border border-gray-200 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-gray-800">
                    {run.business_name} - {run.report_type} {run.source_filename ? `(${run.source_filename})` : ""}
                  </p>
                  <p className="text-xs text-gray-500">{new Date(run.created_at).toLocaleString("vi-VN")}</p>
                </div>
                {run.fallback_provider && (
                  <p className="mt-1 text-xs text-amber-700">
                    Fallback: {run.fallback_provider} - {run.fallback_reason}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="btn-secondary" onClick={() => void handleLoadRunResult(run.id)}>
                    Xem kết quả
                  </button>
                  <button className="btn-primary" onClick={() => void handleReanalyzeRun(run.id)}>
                    Phân tích lại
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deepAnalyzing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35">
          <div className="w-[min(92vw,560px)] rounded-none border border-indigo-200 bg-white p-5 shadow-xl">
            <p className="text-base font-semibold text-indigo-800">Hệ thống đang phân tích báo cáo</p>
            <p className="mt-1 text-sm text-gray-600">Bạn có thể theo dõi model đang hoạt động ngay tại đây.</p>
            <div className="mt-4 space-y-2 text-sm">
              {[
                "1. ClassifierAgent - DeepSeek Coder 6.7B",
                "2. MapperAgent - DeepSeek Coder 6.7B",
                "3. PlannerAgent - DeepSeek Coder 6.7B",
                "4. Metrics Executor - Python/Pandas",
                "5. NarratorAgent - Qwen 2.5 7B",
              ].map((line, idx) => (
                <div key={line} className={`rounded border px-3 py-2 ${idx === activeStepIndex ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-gray-200 text-gray-600"}`}>
                  {line} {idx === activeStepIndex ? "(đang chạy)" : ""}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
