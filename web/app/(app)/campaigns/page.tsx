"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { api } from "@/lib/api-client";
import { STATUS_LABELS, STATUS_COLORS, CHANNEL_LABELS, formatDate, cn } from "@/lib/utils";
import HelpDialogButton from "@/components/common/HelpDialogButton";
import CampaignAssistantButton from "@/components/campaign-assistant/CampaignAssistantButton";

interface Campaign {
  id: string;
  campaign_name: string;
  objective: string;
  status: string;
  channels: string[];
  deadline: string;
  created_at: string;
  content_count: number;
  pending_count: number;
  source_insight_run_id?: string | null;
  source_customer_segment?: string | null;
}

const TABS = ["all", "running", "pending_approval", "approved", "failed"];
const TAB_LABELS: Record<string, string> = {
  all: "Tất cả", running: "Đang chạy", pending_approval: "Chờ duyệt", approved: "Đã duyệt", failed: "Thất bại",
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = tab !== "all" ? `?status=${tab}` : "";
    api.get<Campaign[]>(`/campaigns${qs}`)
      .then(setCampaigns)
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="p-6 max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <h1>Chiến dịch</h1>
        <div className="flex items-center gap-2">
          <HelpDialogButton
            title="Hướng dẫn trang Chiến dịch"
            summary="Đây là nơi theo dõi toàn bộ đợt quảng bá và trạng thái xử lý AI."
            steps={[
              "Dùng tab để lọc trạng thái (đang chạy, chờ duyệt, đã duyệt...).",
              "Bấm 'Xem' để mở chi tiết từng chiến dịch.",
              "Bấm 'Tạo chiến dịch' để tạo mới và chạy AI.",
            ]}
          />
          <Link href="/campaigns/new" className="btn-primary">
            <Plus size={15} /> Tạo chiến dịch
          </Link>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-2 text-sm border-b-2 transition-colors",
              tab === t ? "border-blue-600 text-blue-700 font-medium" : "border-transparent text-gray-500 hover:text-gray-800"
            )}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-14" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-400">
          Chưa có chiến dịch nào.{" "}
          <Link href="/campaigns/new" className="text-blue-600 hover:underline">Tạo chiến dịch đầu tiên →</Link>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface border-b border-gray-200 text-xs text-gray-500 uppercase font-medium">
                <th className="text-left px-4 py-3">Tên chiến dịch</th>
                <th className="text-left px-4 py-3">Kênh</th>
                <th className="text-left px-4 py-3">Trạng thái</th>
                <th className="text-left px-4 py-3">Deadline</th>
                <th className="text-left px-4 py-3">Nội dung</th>
                <th className="text-left px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-surface last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{c.campaign_name}</p>
                    <p className="text-xs text-gray-400 truncate max-w-xs">{c.objective}</p>
                    {c.source_insight_run_id ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="badge bg-blue-50 text-blue-700">Insight Action</span>
                        {c.source_customer_segment ? (
                          <span className="badge bg-gray-100 text-gray-600">
                            Segment: {c.source_customer_segment}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {c.channels.map((ch) => (
                        <span key={ch} className="badge bg-gray-100 text-gray-600">{CHANNEL_LABELS[ch] || ch}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("badge", STATUS_COLORS[c.status])}>{STATUS_LABELS[c.status]}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(c.deadline)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.content_count} item{c.pending_count > 0 && <span className="text-amber-600 ml-1">({c.pending_count} chờ duyệt)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/campaigns/${c.id}`} className="text-blue-600 hover:underline text-xs">Xem →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <CampaignAssistantButton />
    </div>
  );
}
