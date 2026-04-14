"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, RefreshCw } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatDate, cn } from "@/lib/utils";

interface WorkflowJob {
  id: string;
  trigger_type: string;
  campaign_id: string | null;
  status: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  queued: "Đang chờ",
  running: "Đang chạy",
  done: "Hoàn thành",
  failed: "Thất bại",
};

const STATUS_COLORS: Record<string, string> = {
  queued: "bg-yellow-50 text-yellow-700 border-yellow-200",
  running: "bg-blue-50 text-blue-700 border-blue-200",
  done: "bg-green-50 text-green-700 border-green-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

const TRIGGER_LABELS: Record<string, string> = {
  manual: "Thủ công",
  cron_daily: "Hẹn giờ hàng ngày",
  cron_weekly: "Hẹn giờ hàng tuần",
  campaign_created: "Chiến dịch mới",
};

export default function WorkflowPage() {
  const [jobs, setJobs] = useState<WorkflowJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [message, setMessage] = useState("");

  function loadJobs() {
    setLoading(true);
    api
      .get<WorkflowJob[]>("/workflow/jobs")
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadJobs();
  }, []);

  async function handleTrigger() {
    setTriggering(true);
    setMessage("");
    try {
      await api.post("/workflow/trigger", { trigger_type: "manual" });
      setMessage("Đã kích hoạt thành công. Tải lại để xem trạng thái.");
      loadJobs();
    } catch {
      setMessage("Kích hoạt thất bại. Vui lòng thử lại.");
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Tự động hoá</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý các tác vụ chạy theo lịch và kích hoạt thủ công
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadJobs}
            className="btn-secondary flex items-center gap-1.5"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Tải lại
          </button>
          <button
            onClick={handleTrigger}
            className="btn-primary flex items-center gap-1.5"
            disabled={triggering}
          >
            <Play size={14} />
            {triggering ? "Đang kích hoạt..." : "Kích hoạt thủ công"}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={cn(
            "text-sm px-4 py-2 rounded border",
            message.includes("thất bại")
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-green-50 text-green-700 border-green-200"
          )}
        >
          {message}
        </div>
      )}

      {/* Ghi chú tính năng */}
      <div className="card border-blue-100 bg-blue-50/50 text-sm text-blue-800 space-y-1">
        <p className="font-medium">Lên lịch tự động (Cron) — đang phát triển</p>
        <p className="text-blue-600">
          Tính năng tự động kích hoạt chiến dịch theo lịch hẹn giờ (hàng ngày / hàng tuần) sẽ
          được bổ sung trong giai đoạn tiếp theo. Hiện tại bạn có thể kích hoạt thủ công để kiểm thử.
        </p>
      </div>

      {/* Bảng lịch sử */}
      <div>
        <h2 className="mb-3">Lịch sử chạy</h2>
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-12" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 text-sm text-gray-400">
            Chưa có tác vụ nào được chạy.
          </div>
        ) : (
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Loại kích hoạt</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Trạng thái</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Chiến dịch</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700">
                      {TRIGGER_LABELS[job.trigger_type] ?? job.trigger_type}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-xs border",
                          STATUS_COLORS[job.status] ?? "bg-gray-100 text-gray-600 border-gray-200"
                        )}
                      >
                        {STATUS_LABELS[job.status] ?? job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {job.campaign_id ? (
                        <Link
                          href={`/campaigns/${job.campaign_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          Xem chiến dịch →
                        </Link>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {formatDate(job.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
