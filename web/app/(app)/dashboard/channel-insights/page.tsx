"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { CHANNEL_LABELS } from "@/lib/utils";
import HelpDialogButton from "@/components/common/HelpDialogButton";

interface Stats {
  content_by_channel: Record<string, number>;
}

export default function ChannelInsightsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Stats>("/dashboard/stats")
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h1>Nội dung theo kênh</h1>
        <div className="flex items-center gap-2">
          <HelpDialogButton
            title="Hướng dẫn thống kê theo kênh"
            summary="Bảng này cho biết số lượng nội dung theo từng kênh để bạn cân đối phân phối."
            steps={[
              "So sánh số lượng giữa Facebook, Email, Video.",
              "Kênh nào thấp có thể ưu tiên ở chiến dịch tiếp theo.",
              "Quay lại Tổng quan để xem thêm KPI khác.",
            ]}
          />
          <Link href="/dashboard" className="btn-secondary">Quay lại</Link>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="space-y-2">
            <div className="skeleton h-5 w-full" />
            <div className="skeleton h-5 w-full" />
            <div className="skeleton h-5 w-full" />
          </div>
        ) : Object.keys(stats?.content_by_channel ?? {}).length === 0 ? (
          <p className="text-sm text-gray-400">Chưa có dữ liệu nội dung theo kênh.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-3 font-medium">Kênh</th>
                <th className="py-2 font-medium">Số nội dung</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats?.content_by_channel ?? {}).map(([channel, count]) => (
                <tr key={channel} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-3 text-gray-700">{CHANNEL_LABELS[channel] || channel}</td>
                  <td className="py-2 font-medium text-gray-900">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
