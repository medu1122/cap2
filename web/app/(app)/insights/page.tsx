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

const PRIORITY_STYLES: Record<string, string> = {
  P1: "bg-red-50 text-red-700 border-red-200",
  P2: "bg-amber-50 text-amber-700 border-amber-200",
  P3: "bg-green-50 text-green-700 border-green-200",
};

export default function InsightsPage() {
  const [cards, setCards] = useState<InsightCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [metricDate, setMetricDate] = useState("");
  const [priority, setPriority] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recomputing, setRecomputing] = useState(false);

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

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1>Trợ lý phân tích</h1>
          <p className="text-sm text-gray-500 mt-1">AI tổng hợp chỉ số và gợi ý hành động ưu tiên cho doanh nghiệp.</p>
        </div>
        <HelpDialogButton
          title="Hướng dẫn Trợ lý phân tích"
          summary="Trợ lý phân tích giúp bạn ưu tiên đúng việc cần làm mỗi ngày: phát hiện vấn đề từ dữ liệu, giải thích nguyên nhân chính, rồi đề xuất hành động cụ thể cho đội vận hành."
          steps={[
            "Bước 1 - Chọn Ngày dữ liệu để xem đúng ngày bạn muốn đánh giá hiệu quả kinh doanh.",
            "Bước 2 - Chọn Mức ưu tiên: P1 là việc cần xử lý ngay, P2 xử lý trong ngày, P3 theo dõi thêm.",
            "Bước 3 - Bấm Lọc để xem danh sách phân tích theo điều kiện bạn đã chọn.",
            "Bước 4 - Bấm Phân tích lại khi bạn vừa nạp dữ liệu mới hoặc muốn làm mới kết quả phân tích cho ngày đang xem.",
            "Bước 5 - Mở Hàng đợi hành động để chuyển insight thành đầu việc cụ thể cho từng người phụ trách.",
          ]}
          tips={[
            "Nên ưu tiên xử lý các mục P1 trước để tránh thất thoát ngân sách hoặc doanh thu.",
            "Hãy đối chiếu phần 'Mốc tham chiếu' để hiểu vì sao hệ thống cảnh báo.",
            "Nếu dữ liệu đầu vào chưa đủ, kết quả phân tích có thể chưa phản ánh đúng toàn cảnh.",
          ]}
        />
      </div>

      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Ngày dữ liệu</label>
          <input className="input w-[170px]" type="date" value={metricDate} onChange={(e) => setMetricDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Mức ưu tiên</label>
          <select className="select w-[140px]" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="P1">P1</option>
            <option value="P2">P2</option>
            <option value="P3">P3</option>
          </select>
        </div>
        <button className="btn-secondary" onClick={loadCards}>Lọc</button>
        <button className="btn-primary" onClick={handleRecompute} disabled={recomputing}>
          {recomputing ? "Đang phân tích lại..." : "Phân tích lại"}
        </button>
        <Link href="/insights/actions" className="btn-secondary">Hàng đợi hành động</Link>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24" />)}
        </div>
      ) : cards.length === 0 ? (
        <div className="card text-sm text-gray-500">Chưa có phân tích. Bạn cần nạp dữ liệu trước, sau đó bấm Phân tích lại.</div>
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
                      {card.priority} - {Math.round(card.confidence * 100)}%
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
