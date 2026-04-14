"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import HelpDialogButton from "@/components/common/HelpDialogButton";

interface InsightAction {
  id: string;
  insight_card_id: string | null;
  action_text: string;
  owner: string;
  impact_estimate: string;
  status: string;
  created_at: string;
}

const OWNER_LABELS: Record<string, string> = {
  marketing: "Marketing",
  content: "Nội dung",
  sales: "Bán hàng",
  ops: "Vận hành",
};

const IMPACT_LABELS: Record<string, string> = {
  high: "Cao",
  medium: "Vừa",
  low: "Thấp",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Đang mở",
  done: "Đã hoàn tất",
  dismissed: "Bỏ qua",
};

export default function InsightActionsPage() {
  const [actions, setActions] = useState<InsightAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("open");
  const [error, setError] = useState<string | null>(null);

  async function loadData(nextStatus = status) {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<InsightAction[]>(`/insights/actions?status=${encodeURIComponent(nextStatus)}`);
      setActions(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được hàng đợi hành động");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData("open");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6 max-w-5xl space-y-5">
      <div className="rounded border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-700">
        Bước 3 - Hành động: Đây là danh sách việc cần triển khai sau khi hệ thống phân tích dữ liệu ở trang Trợ lý phân tích.
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1>Hàng đợi hành động</h1>
          <p className="text-sm text-gray-500 mt-1">Danh sách việc cần làm được đề xuất từ Trợ lý phân tích.</p>
        </div>
        <div className="flex items-center gap-2">
          <HelpDialogButton
            title="Hướng dẫn Hàng đợi hành động"
            summary="Trang này giúp bạn biến kết quả phân tích thành công việc cụ thể để đội vận hành triển khai ngay."
            steps={[
              "Bước 1 - Chọn Trạng thái để lọc các việc đang mở, đã hoàn tất hoặc bỏ qua.",
              "Bước 2 - Đọc nội dung hành động và xác định người phụ trách phù hợp.",
              "Bước 3 - Ưu tiên xử lý các việc có Mức tác động cao trước.",
              "Bước 4 - Cập nhật trạng thái định kỳ để theo dõi tiến độ thực thi.",
            ]}
            tips={[
              "Nếu danh sách quá nhiều, hãy xử lý theo nguyên tắc: tác động cao trước, effort thấp làm trước.",
              "Nên rà soát lại danh sách sau mỗi lần bạn bấm Phân tích lại ở trang Trợ lý phân tích.",
            ]}
          />
          <Link href="/insights" className="btn-secondary">Quay lại Trợ lý phân tích</Link>
        </div>
      </div>

      <div className="card flex items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Trạng thái</label>
          <select
            className="select w-[160px]"
            value={status}
            onChange={(e) => {
              const next = e.target.value;
              setStatus(next);
              loadData(next);
            }}
          >
            <option value="open">Đang mở</option>
            <option value="done">Đã hoàn tất</option>
            <option value="dismissed">Bỏ qua</option>
          </select>
        </div>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-20" />)}
        </div>
      ) : actions.length === 0 ? (
        <div className="card text-sm text-gray-500">Chưa có hành động nào cho bộ lọc hiện tại.</div>
      ) : (
        <div className="space-y-3">
          {actions.map((action) => (
            <div key={action.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{action.action_text}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Phụ trách: {OWNER_LABELS[action.owner] || action.owner} - Mức tác động: {IMPACT_LABELS[action.impact_estimate] || action.impact_estimate}
                  </p>
                </div>
                <span className="inline-flex rounded border border-gray-200 px-2 py-1 text-xs text-gray-600">
                  {STATUS_LABELS[action.status] || action.status}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2">{new Date(action.created_at).toLocaleString("vi-VN")}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
