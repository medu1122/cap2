"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import HelpDialogButton from "@/components/common/HelpDialogButton";
import { api } from "@/lib/api-client";

interface InsightCard {
  id: string;
  metric_date: string;
  title: string;
  priority: "P1" | "P2" | "P3";
  confidence: number;
  reasoning: string;
  evidence: Array<{ metric_key: string; metric_value: number; baseline_value: number; window: string }>;
  status: string;
}

interface DeepAnalysisResult {
  business_name: string;
  industry?: string;
  model: { provider: string; name: string; base_url: string };
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
  a2a_pipeline: Array<{ agent: string; summary?: string; issues?: string[]; actions?: Array<{ priority: string; text: string }> }>;
}

const PRIORITY_STYLES: Record<string, string> = {
  P1: "bg-red-50 text-red-700 border-red-200",
  P2: "bg-amber-50 text-amber-700 border-amber-200",
  P3: "bg-green-50 text-green-700 border-green-200",
};

const PRIORITY_LABELS: Record<string, string> = {
  P1: "Cao",
  P2: "Vừa",
  P3: "Thấp",
};

export default function InsightsPage() {
  const [cards, setCards] = useState<InsightCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [metricDate, setMetricDate] = useState("");
  const [priority, setPriority] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recomputing, setRecomputing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<string | null>(null);
  const [deepAnalyzing, setDeepAnalyzing] = useState(false);
  const [deepResult, setDeepResult] = useState<DeepAnalysisResult | null>(null);
  const [deepRows, setDeepRows] = useState<Array<{ revenue: number; ad_spend: number; orders: number; leads: number; repeat_orders: number }>>([]);
  const [businessName, setBusinessName] = useState("Cửa hàng Mộc An");
  const [industry, setIndustry] = useState("Bán lẻ tiêu dùng");

  async function loadCards() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (metricDate) params.set("metric_date", metricDate);
      if (priority) params.set("priority", priority);
      const result = await api.get<InsightCard[]>(`/insights/cards${params.toString() ? `?${params.toString()}` : ""}`);
      setCards(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được insight");
    } finally {
      setLoading(false);
    }
  }

  async function handleRecompute() {
    const targetDate = metricDate || new Date().toISOString().slice(0, 10);
    setRecomputing(true);
    setError(null);
    try {
      await api.post("/insights/recompute", { metric_date: targetDate });
      await loadCards();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tính lại insight");
    } finally {
      setRecomputing(false);
    }
  }

  async function handleSeedSampleData() {
    const today = new Date().toISOString().slice(0, 10);
    setSeeding(true);
    setError(null);
    try {
      await api.post("/insights/ingest", {
        source_type: "manual_sample",
        source_name: "Du lieu mau he thong",
        snapshot_date: today,
        payload: {
          revenue: 12500000,
          orders: 180,
          ad_spend: 7200000,
          leads: 1900,
          repeat_orders: 34,
          channel: "facebook",
        },
      });
      await api.post("/insights/recompute", { metric_date: today });
      setMetricDate(today);
      await loadCards();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể nạp dữ liệu mẫu");
    } finally {
      setSeeding(false);
    }
  }

  function _splitCsvLine(line: string, delimiter: string): string[] {
    return line.split(delimiter).map((part) => part.trim().replace(/^"|"$/g, ""));
  }

  function _parseNumber(raw: string | undefined): number {
    if (!raw) return 0;
    const normalized = raw.replace(/\s/g, "").replace(/\./g, "").replace(/,/g, ".");
    const value = Number(normalized);
    return Number.isFinite(value) ? value : 0;
  }

  async function handleCsvUpload(file: File) {
    setUploadingCsv(true);
    setError(null);
    setUploadSummary(null);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length < 2) {
        throw new Error("File CSV không có dữ liệu hợp lệ.");
      }

      const delimiter = lines[0].includes(";") ? ";" : ",";
      const headers = _splitCsvLine(lines[0], delimiter);
      const pickIndex = (...names: string[]) => {
        for (const name of names) {
          const idx = headers.indexOf(name);
          if (idx >= 0) return idx;
        }
        return -1;
      };
      const idx = {
        ngay: pickIndex("ngay_du_lieu", "ngay_bao_cao"),
        kenh: pickIndex("kenh", "kenh_ban_hang"),
        doanhThu: pickIndex("doanh_thu_vnd", "doanh_thu_thuan_vnd"),
        donHang: pickIndex("so_don_hang", "so_don_hang_thanh_cong"),
        chiPhiAds: pickIndex("chi_phi_quang_cao_vnd", "chi_phi_marketing_vnd"),
        khachTiemNang: pickIndex("so_khach_tiem_nang", "so_lead"),
        donLapLai: pickIndex("so_don_hang_lap_lai"),
      };

      const requiredIndexes = Object.values(idx);
      if (requiredIndexes.some((position) => position < 0)) {
        throw new Error("Thiếu cột bắt buộc trong CSV. Vui lòng dùng file mẫu để nhập đúng cấu trúc.");
      }

      let successRows = 0;
      const uniqueDates = new Set<string>();
      const uploadedRows: Array<{ revenue: number; ad_spend: number; orders: number; leads: number; repeat_orders: number }> = [];
      for (const line of lines.slice(1)) {
        const cols = _splitCsvLine(line, delimiter);
        const snapshotDate = cols[idx.ngay];
        if (!snapshotDate) continue;
        const payload = {
          revenue: _parseNumber(cols[idx.doanhThu]),
          orders: _parseNumber(cols[idx.donHang]),
          ad_spend: _parseNumber(cols[idx.chiPhiAds]),
          leads: _parseNumber(cols[idx.khachTiemNang]),
          repeat_orders: _parseNumber(cols[idx.donLapLai]),
          channel: cols[idx.kenh] || "tong_hop",
        };
        await api.post("/insights/ingest", {
          source_type: "csv_upload",
          source_name: file.name,
          snapshot_date: snapshotDate,
          payload,
        });
        uniqueDates.add(snapshotDate);
        successRows += 1;
        uploadedRows.push({
          revenue: payload.revenue,
          ad_spend: payload.ad_spend,
          orders: payload.orders,
          leads: payload.leads,
          repeat_orders: payload.repeat_orders,
        });
      }

      for (const day of uniqueDates) {
        await api.post("/insights/recompute", { metric_date: day });
      }

      if (uniqueDates.size > 0) {
        const latestDate = Array.from(uniqueDates).sort().at(-1);
        if (latestDate) setMetricDate(latestDate);
      }
      await loadCards();
      setUploadSummary(`Đã nạp ${successRows} dòng dữ liệu và phân tích ${uniqueDates.size} ngày.`);
      setDeepRows(uploadedRows);
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
        report_rows: deepRows,
      });
      setDeepResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể chạy phân tích sâu A2A.");
    } finally {
      setDeepAnalyzing(false);
    }
  }

  useEffect(() => {
    loadCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    return cards.reduce<Record<string, InsightCard[]>>((acc, item) => {
      const key = item.metric_date;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [cards]);
  const hasData = cards.length > 0;

  return (
    <div className="p-6 space-y-6 max-w-6xl [&_.card]:!rounded-none [&_.input]:!rounded-none [&_.select]:!rounded-none [&_.btn-primary]:!rounded-none [&_.btn-secondary]:!rounded-none">
      <div className="flex items-center justify-between">
        <div>
          <h1>Trợ lý phân tích</h1>
          <p className="text-sm text-gray-500 mt-1">AI tổng hợp chỉ số và gợi ý hành động ưu tiên cho doanh nghiệp.</p>
        </div>
        <HelpDialogButton
          title="Hướng dẫn Trợ lý phân tích"
          summary="Trang này giúp bạn biết hôm nay cần làm gì để tăng doanh thu và giảm lãng phí ngân sách, thay vì phải tự đọc nhiều bảng số liệu."
          steps={[
            "Bước 1 - Nạp dữ liệu: nếu chưa có dữ liệu, bấm Nạp dữ liệu mẫu để hệ thống tạo ví dụ giúp bạn bắt đầu ngay.",
            "Bước 2 - Phân tích: bấm Phân tích ngay hoặc Phân tích lại khi bạn vừa cập nhật dữ liệu mới.",
            "Bước 3 - Hành động: mở Hàng đợi hành động để giao việc cụ thể theo mức ưu tiên.",
          ]}
          tips={[
            "Mức ưu tiên hiển thị theo ngôn ngữ dễ hiểu: Cao/Vừa/Thấp, kèm mã kỹ thuật P1/P2/P3.",
            "Nên bấm Phân tích lại sau mỗi lần nạp dữ liệu hoặc cuối ngày bán hàng để có khuyến nghị mới nhất.",
            "Hãy đối chiếu Mốc tham chiếu để hiểu vì sao hệ thống cảnh báo hoặc đề xuất hành động.",
          ]}
        />
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`inline-flex rounded-full px-3 py-1 ${hasData ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}>
            Bước 1: Nạp dữ liệu
          </span>
          <span className={`inline-flex rounded-full px-3 py-1 ${hasData ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
            Bước 2: Phân tích
          </span>
          <span className={`inline-flex rounded-full px-3 py-1 ${hasData ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
            Bước 3: Hành động
          </span>
        </div>

        {!hasData ? (
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
              <a href="/mau-du-lieu-tro-ly-phan-tich.csv" className="btn-secondary">
                Tải file CSV mẫu
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-2">
            <button className="btn-primary" onClick={handleSeedSampleData} disabled={seeding}>
              {seeding ? "Đang nạp dữ liệu mẫu..." : "Nạp dữ liệu mẫu"}
            </button>
            <button className="btn-secondary" onClick={handleRecompute} disabled={recomputing}>
              {recomputing ? "Đang phân tích..." : "Phân tích ngay"}
            </button>
            </div>
            <p className="text-sm text-gray-500">
              Chưa có dữ liệu đầu vào. Bạn có thể nạp file CSV thật của doanh nghiệp hoặc dùng dữ liệu mẫu để xem luồng.
            </p>
            {uploadSummary && (
              <p className="text-sm text-green-700">{uploadSummary}</p>
            )}
            <div className="rounded border border-indigo-200 bg-indigo-50 p-3 space-y-2">
              <p className="text-sm font-medium text-indigo-800">Phân tích sâu A2A (Agent-to-Agent)</p>
              <p className="text-xs text-indigo-700">
                Luồng A2A sẽ chạy 3 tác tử: Strategist -> Diagnostic -> ActionAdvisor để phân tích sâu báo cáo của bạn.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Tên doanh nghiệp" />
                <input className="input" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Ngành hàng" />
              </div>
              <button className="btn-primary" onClick={handleDeepAnalyze} disabled={deepAnalyzing || deepRows.length === 0}>
                {deepAnalyzing ? "Đang chạy A2A..." : "Phân tích sâu báo cáo (A2A)"}
              </button>
              {deepRows.length === 0 && <p className="text-xs text-indigo-700">Cần nạp CSV trước để bật tính năng này.</p>}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ngày dữ liệu</label>
              <input className="input w-[170px]" type="date" value={metricDate} onChange={(e) => setMetricDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Mức ưu tiên</label>
              <select className="select w-[220px]" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="">Tất cả mức ưu tiên</option>
                <option value="P1">Cao (P1) - Cần xử lý ngay</option>
                <option value="P2">Vừa (P2) - Xử lý trong ngày</option>
                <option value="P3">Thấp (P3) - Theo dõi</option>
              </select>
            </div>
            <button className="btn-secondary" onClick={loadCards}>Lọc</button>
            <button className="btn-primary" onClick={handleRecompute} disabled={recomputing}>
              {recomputing ? "Đang phân tích lại..." : "Phân tích lại"}
            </button>
            <Link href="/insights/actions" className="btn-secondary">Hàng đợi hành động</Link>
          </div>
        )}
      </div>

      {hasData && (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            <p className="font-medium">Cao (P1)</p>
            <p>Cần xử lý ngay để tránh ảnh hưởng doanh thu/ngân sách.</p>
          </div>
          <div className="rounded border border-amber-100 bg-amber-50 p-3 text-sm text-amber-700">
            <p className="font-medium">Vừa (P2)</p>
            <p>Nên xử lý trong ngày để cải thiện hiệu suất vận hành.</p>
          </div>
          <div className="rounded border border-green-100 bg-green-50 p-3 text-sm text-green-700">
            <p className="font-medium">Thấp (P3)</p>
            <p>Theo dõi định kỳ, chưa cần ưu tiên xử lý tức thời.</p>
          </div>
        </div>
      )}

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {deepResult && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2>Kết quả phân tích sâu A2A</h2>
            <span className="inline-flex rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">
              Model đang chạy: {deepResult.model.name} ({deepResult.model.provider})
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Doanh nghiệp: <strong>{deepResult.business_name}</strong> - Ngành: <strong>{deepResult.industry || "Chưa khai báo"}</strong>
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="rounded border border-gray-200 p-2">ROAS: {deepResult.kpis.roas.toFixed(2)}</div>
            <div className="rounded border border-gray-200 p-2">Conversion: {(deepResult.kpis.conversion_rate * 100).toFixed(1)}%</div>
            <div className="rounded border border-gray-200 p-2">Repeat rate: {(deepResult.kpis.repeat_rate * 100).toFixed(1)}%</div>
            <div className="rounded border border-gray-200 p-2">AOV: {Math.round(deepResult.kpis.aov).toLocaleString("vi-VN")} VND</div>
          </div>
          <div className="space-y-2">
            {deepResult.a2a_pipeline.map((step, idx) => (
              <div key={idx} className="rounded border border-gray-200 p-3">
                <p className="font-medium text-sm text-gray-800">{step.agent}</p>
                {step.summary && <p className="text-sm text-gray-600 mt-1">{step.summary}</p>}
                {step.issues && <ul className="list-disc pl-5 text-sm text-gray-600 mt-1">{step.issues.map((i, n) => <li key={n}>{i}</li>)}</ul>}
                {step.actions && <ul className="list-disc pl-5 text-sm text-gray-600 mt-1">{step.actions.map((a, n) => <li key={n}>[{a.priority}] {a.text}</li>)}</ul>}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24" />)}
        </div>
      ) : cards.length === 0 ? (
        <div className="card text-sm text-gray-500">Chưa có bản phân tích cho bộ lọc hiện tại. Bạn có thể đổi ngày hoặc bấm Phân tích lại.</div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([day, dayCards]) => (
            <div key={day} className="space-y-3">
              <h2 className="text-base font-semibold text-gray-800">{new Date(day).toLocaleDateString("vi-VN")}</h2>
              {dayCards.map((card) => (
                <div key={card.id} className="card space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{card.title}</p>
                      <p className="text-sm text-gray-600 mt-1">{card.reasoning}</p>
                    </div>
                    <span className={`inline-flex items-center rounded border px-2 py-1 text-xs font-medium ${PRIORITY_STYLES[card.priority] || PRIORITY_STYLES.P2}`}>
                      {PRIORITY_LABELS[card.priority] || "Vừa"} ({card.priority}) - {Math.round(card.confidence * 100)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {card.evidence.map((ev, idx) => (
                      <div key={`${card.id}-${idx}`} className="rounded border border-gray-200 bg-gray-50 p-2 text-xs">
                        <p className="font-medium text-gray-700">{ev.metric_key}</p>
                        <p className="text-gray-600">Hiện tại: {ev.metric_value}</p>
                        <p className="text-gray-500">Mốc tham chiếu: {ev.baseline_value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
