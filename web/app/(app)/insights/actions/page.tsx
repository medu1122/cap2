"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import HelpDialogButton from "@/components/common/HelpDialogButton";

interface InsightRun {
  id: string;
  business_name: string;
  industry: string | null;
  report_type: string;
  status: string;
  fallback_provider: string | null;
  fallback_reason: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  completed: "Hoàn tất",
  failed: "Thất bại",
};

export default function InsightActionsPage() {
  const [runs, setRuns] = useState<InsightRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<InsightRun[]>("/insights/a2a/runs");
      setRuns(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được lịch sử phân tích");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6 max-w-5xl space-y-5">
      <div className="rounded border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-700">
        Danh sách phiên chạy A2A gần nhất để theo dõi trạng thái, fallback và thời gian thực thi.
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1>Hàng đợi hành động</h1>
          <p className="text-sm text-gray-500 mt-1">Lịch sử chạy phân tích sâu A2A.</p>
        </div>
        <div className="flex items-center gap-2">
          <HelpDialogButton
            title="Hướng dẫn Hàng đợi hành động"
            summary="Trang này giúp bạn biến kết quả phân tích thành công việc cụ thể để đội vận hành triển khai ngay."
            steps={[
              "Bước 1 - Chạy phân tích sâu từ trang Trợ lý phân tích.",
              "Bước 2 - Quay lại trang này để theo dõi các run gần nhất.",
              "Bước 3 - Nếu có fallback, kiểm tra lại chất lượng dữ liệu CSV.",
            ]}
            tips={[
              "Run thất bại thường do thiếu cột quan trọng hoặc dữ liệu trống.",
              "Nên lưu ý các run có fallback để chuẩn hóa file cho lần sau.",
            ]}
          />
          <Link href="/insights" className="btn-secondary">Quay lại Trợ lý phân tích</Link>
        </div>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-20" />)}
        </div>
      ) : runs.length === 0 ? (
        <div className="card text-sm text-gray-500">Chưa có phiên chạy nào.</div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <div key={run.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{run.business_name} - {run.report_type}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Ngành: {run.industry || "Chưa khai báo"} {run.fallback_provider ? `- Fallback: ${run.fallback_provider}` : ""}
                  </p>
                  {run.fallback_reason && <p className="text-xs text-amber-700 mt-1">Lý do fallback: {run.fallback_reason}</p>}
                </div>
                <span className="inline-flex rounded border border-gray-200 px-2 py-1 text-xs text-gray-600">
                  {STATUS_LABELS[run.status] || run.status}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2">{new Date(run.created_at).toLocaleString("vi-VN")}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
