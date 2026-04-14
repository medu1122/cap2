"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { STATUS_LABELS, STATUS_COLORS, CHANNEL_LABELS, timeAgo, cn } from "@/lib/utils";

interface Stats {
  total_campaigns: number;
  total_content_items: number;
  pending_approvals: number;
  approved_items: number;
  content_by_channel: Record<string, number>;
  recent_campaigns: Array<{ id: string; campaign_name: string; status: string; created_at: string }>;
  recent_agent_logs: Array<{ id: string; agent_name: string; channel: string | null; model_used: string; duration_ms: number | null; status: string; created_at: string }>;
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="card">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Stats>("/dashboard/stats")
      .then(setStats)
      .finally(() => setLoading(false));

    api.get<{ summary: string }>("/dashboard/summary")
      .then((r) => setSummary(r.summary))
      .catch(() => setSummary(""));
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="skeleton h-7 w-40" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1>Tổng quan</h1>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Tổng chiến dịch" value={stats?.total_campaigns ?? 0} />
        <StatCard label="Nội dung đã tạo" value={stats?.total_content_items ?? 0} />
        <StatCard label="Chờ duyệt" value={stats?.pending_approvals ?? 0} sub="cần xem lại" />
        <StatCard label="Đã duyệt" value={stats?.approved_items ?? 0} />
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3 card">
          <h2 className="mb-4">Hoạt động gần đây</h2>
          {stats?.recent_agent_logs?.length === 0 ? (
            <p className="text-sm text-gray-400">Chưa có hoạt động nào.</p>
          ) : (
            <div className="space-y-2">
              {stats?.recent_agent_logs?.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full", log.status === "success" ? "bg-green-500" : "bg-red-500")} />
                    <span className="text-sm text-gray-700 font-medium capitalize">{log.agent_name}</span>
                    {log.channel && (
                      <span className="text-xs text-gray-400">{CHANNEL_LABELS[log.channel] || log.channel}</span>
                    )}
                    <span className="text-xs text-gray-400">{log.model_used}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {log.duration_ms && <span>{log.duration_ms}ms</span>}
                    <span>{timeAgo(log.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col-span-2 space-y-4">
          <div className="card">
            <h2 className="mb-3">Nội dung theo kênh</h2>
            {Object.keys(stats?.content_by_channel ?? {}).length === 0 ? (
              <p className="text-sm text-gray-400">Chưa có dữ liệu.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(stats?.content_by_channel ?? {}).map(([channel, count]) => (
                  <div key={channel} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{CHANNEL_LABELS[channel] || channel}</span>
                    <span className="text-sm font-medium text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {summary && (
        <div className="card border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h2>Nhận định từ AI</h2>
            <span className="text-xs text-gray-400">Tự động phân tích</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
        </div>
      )}
    </div>
  );
}
