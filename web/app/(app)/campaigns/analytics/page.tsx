"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  BarChart3,
  Loader2,
  Send,
  Percent,
  MousePointerClick,
  Users,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Eye,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api-client";
import {
  STATUS_LABELS,
  CHANNEL_LABELS,
  formatDate,
  formatDateShort,
} from "@/lib/utils";
import HelpDialogButton from "@/components/common/HelpDialogButton";

interface CampaignListItem {
  id: string;
  campaign_name: string;
  objective: string;
  channels: string[];
  status: string;
  deadline: string;
  content_count: number;
  pending_count: number;
  created_at: string;
}

interface CampaignPerformance {
  campaign_id: string;
  campaign_name: string;
  status: string;
  total_sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  open_rate: number;
  click_rate: number;
  conversion_rate: number;
  cost: number;
  revenue_per_email: number;
}

interface PerformanceResponse {
  metrics: CampaignPerformance;
}

export default function CampaignAnalyticsPage() {
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [selectedPerformance, setSelectedPerformance] = useState<CampaignPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch campaigns list
  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const data = await api.get<CampaignListItem[]>("/campaigns");
        setCampaigns(data);
        if (data.length > 0 && !selectedCampaignId) {
          setSelectedCampaignId(data[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch campaigns:", err);
        setError("Không thể tải danh sách chiến dịch");
      } finally {
        setLoading(false);
      }
    };
    fetchCampaigns();
  }, []);

  // Fetch performance
  const fetchPerformance = useCallback(async () => {
    if (!selectedCampaignId) return;
    setLoadingPerformance(true);
    setError(null);
    try {
      const data = await api.get<PerformanceResponse>(
        `/campaigns/${selectedCampaignId}/performance`
      );
      setSelectedPerformance(data.metrics);
    } catch (err) {
      console.error("Failed to fetch performance:", err);
      setError("Không thể tải dữ liệu hiệu quả");
      setSelectedPerformance(null);
    } finally {
      setLoadingPerformance(false);
    }
  }, [selectedCampaignId]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);

  // Summary from selected campaign
  const totalSent = selectedPerformance?.total_sent || 0;
  const totalOpened = selectedPerformance?.opened || 0;
  const avgOpenRate = selectedPerformance?.open_rate || 0;
  const avgClickRate = selectedPerformance?.click_rate || 0;

  function getStatusIcon(status: string) {
    switch (status) {
      case "completed":
        return <CheckCircle2 size={14} className="text-green-500" />;
      case "running":
        return <Clock size={14} className="text-blue-500" />;
      case "pending_agent":
        return <RefreshCw size={14} className="text-amber-500" />;
      case "failed":
        return <XCircle size={14} className="text-red-500" />;
      default:
        return <AlertCircle size={14} className="text-gray-400" />;
    }
  }

  function getStatusLabel(status: string) {
    return STATUS_LABELS[status] || status;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/campaigns"
              className="text-gray-400 hover:text-gray-700 transition-colors"
            >
              <ChevronLeft size={20} />
            </Link>
            <BarChart3 size={24} className="text-[#377D73]" />
            <h1 className="flex-1 text-xl font-semibold text-gray-900">
              Phân tích chiến dịch
            </h1>
            <HelpDialogButton
              title="Hướng dẫn Phân tích chiến dịch"
              summary="Xem hiệu quả email của các chiến dịch đã gửi."
              steps={[
                "Chọn chiến dịch để xem chi tiết.",
                "Theo dõi: email gửi, tỷ lệ mở, tỷ lệ click, tỷ lệ thất bại.",
                "Kết quả từ Customer Outreach cũng được gộp vào nếu có gắn campaign.",
              ]}
              buttonClassName="btn-secondary text-xs"
            />
          </div>

          {/* Summary Stats */}
          {selectedPerformance && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-blue-600 text-xs mb-1">
                  <Send size={12} />
                  Email gửi
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {totalSent.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedPerformance.delivered} thành công
                </p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-purple-600 text-xs mb-1">
                  <Eye size={12} />
                  Tỷ lệ mở
                </div>
                <p className="text-lg font-bold text-purple-600">
                  {avgOpenRate.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {totalOpened} lần mở
                </p>
              </div>
              <div className="bg-teal-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-teal-600 text-xs mb-1">
                  <MousePointerClick size={12} />
                  Tỷ lệ click
                </div>
                <p className="text-lg font-bold text-teal-600">
                  {avgClickRate.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedPerformance.clicked} lần click
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-[#377D73]" />
            <span className="ml-3 text-gray-500">Đang tải danh sách chiến dịch...</span>
          </div>
        ) : error && campaigns.length === 0 ? (
          <div className="text-center py-20">
            <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
            <p className="text-gray-500 mb-4">{error}</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
            <BarChart3 size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">Chưa có chiến dịch nào.</p>
            <Link href="/campaigns/new" className="btn-primary">
              Tạo chiến dịch đầu tiên
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Campaign Selector */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-4 flex-wrap">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  Chọn chiến dịch:
                </label>
                <select
                  className="input flex-1 min-w-[200px] max-w-md"
                  value={selectedCampaignId || ""}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                >
                  <option value="" disabled>-- Chọn chiến dịch --</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.campaign_name} ({getStatusLabel(c.status)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Campaign Info */}
              {selectedCampaign && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Trạng thái</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusIcon(selectedCampaign.status)}
                        <span className="font-medium">
                          {getStatusLabel(selectedCampaign.status)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Kênh</p>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {selectedCampaign.channels.map((ch) => (
                          <span
                            key={ch}
                            className="badge bg-gray-100 text-gray-600 text-xs"
                          >
                            {CHANNEL_LABELS[ch] || ch}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Deadline</p>
                      <p className="font-medium mt-1">
                        {formatDate(selectedCampaign.deadline)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Nội dung</p>
                      <p className="font-medium mt-1">
                        {selectedCampaign.content_count} mục
                        {selectedCampaign.pending_count > 0 && (
                          <span className="text-amber-600 ml-1">
                            ({selectedCampaign.pending_count} chờ duyệt)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Performance Section */}
            {selectedCampaignId && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {selectedCampaign?.campaign_name}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Thống kê hiệu quả chiến dịch
                    </p>
                  </div>
                  <button
                    onClick={fetchPerformance}
                    disabled={loadingPerformance}
                    className="btn-secondary text-sm flex items-center gap-2"
                  >
                    <RefreshCw
                      size={14}
                      className={loadingPerformance ? "animate-spin" : ""}
                    />
                    Làm mới
                  </button>
                </div>

                {/* Loading */}
                {loadingPerformance && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-[#377D73]" />
                    <span className="ml-2 text-gray-500">Đang tải dữ liệu...</span>
                  </div>
                )}

                {/* Error */}
                {error && !loadingPerformance && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-4">
                    {error}
                  </div>
                )}

                {/* Metrics */}
                {!loadingPerformance && !error && selectedPerformance && (
                  <>
                    {/* Empty State */}
                    {selectedPerformance.total_sent === 0 && (
                      <div className="text-center py-8 bg-gray-50 rounded-xl">
                        <BarChart3 size={48} className="mx-auto text-gray-200 mb-4" />
                        <p className="text-gray-500">
                          Chưa có dữ liệu gửi cho chiến dịch này.
                        </p>
                        <p className="text-sm text-gray-400 mt-2">
                          Gửi email từ trang Gửi Email của chiến dịch để xem thống kê.
                        </p>
                      </div>
                    )}

                    {/* Metrics Grid */}
                    {selectedPerformance.total_sent > 0 && (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                          {/* Gửi */}
                          <div className="bg-blue-50 rounded-xl p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5 text-blue-600 text-xs mb-2">
                              <Send size={11} />
                              Gửi
                            </div>
                            <p className="text-2xl font-bold text-gray-900">
                              {selectedPerformance.total_sent.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {selectedPerformance.delivered} thành công
                            </p>
                          </div>

                          {/* Mở */}
                          <div className="bg-purple-50 rounded-xl p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5 text-purple-600 text-xs mb-2">
                              <Eye size={11} />
                              Mở
                            </div>
                            <p className="text-2xl font-bold text-purple-600">
                              {selectedPerformance.opened.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {selectedPerformance.open_rate.toFixed(1)}%
                            </p>
                          </div>

                          {/* Click */}
                          <div className="bg-teal-50 rounded-xl p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5 text-teal-600 text-xs mb-2">
                              <MousePointerClick size={11} />
                              Click
                            </div>
                            <p className="text-2xl font-bold text-teal-600">
                              {selectedPerformance.clicked.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {selectedPerformance.click_rate.toFixed(1)}%
                            </p>
                          </div>

                          {/* Tỷ lệ mở */}
                          <div className="bg-indigo-50 rounded-xl p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5 text-indigo-600 text-xs mb-2">
                              <Percent size={11} />
                              Tỷ lệ mở
                            </div>
                            <p className="text-2xl font-bold text-indigo-600">
                              {selectedPerformance.open_rate.toFixed(0)}%
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              trên tổng gửi
                            </p>
                          </div>

                          {/* Tỷ lệ click */}
                          <div className="bg-emerald-50 rounded-xl p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5 text-emerald-600 text-xs mb-2">
                              <TrendingUp size={11} />
                              Tỷ lệ click
                            </div>
                            <p className="text-2xl font-bold text-emerald-600">
                              {selectedPerformance.click_rate.toFixed(0)}%
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              CTR
                            </p>
                          </div>

                          {/* Thất bại */}
                          <div className="bg-red-50 rounded-xl p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5 text-red-500 text-xs mb-2">
                              <XCircle size={11} />
                              Thất bại
                            </div>
                            <p className="text-2xl font-bold text-red-500">
                              {selectedPerformance.bounced}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {selectedPerformance.total_sent > 0
                                ? `${((selectedPerformance.bounced / selectedPerformance.total_sent) * 100).toFixed(1)}%`
                                : "0%"}
                            </p>
                          </div>
                        </div>

                        {/* Email Funnel */}
                        <div className="bg-gray-50 rounded-xl p-4">
                          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
                            Phổ biến email
                          </p>
                          <div className="space-y-2.5">
                            <FunnelBar
                              label="Đã gửi"
                              value={selectedPerformance.total_sent}
                              total={selectedPerformance.total_sent}
                              color="bg-blue-400"
                            />
                            <FunnelBar
                              label="Đã mở"
                              value={selectedPerformance.opened}
                              total={selectedPerformance.total_sent}
                              color="bg-purple-400"
                            />
                            <FunnelBar
                              label="Đã click"
                              value={selectedPerformance.clicked}
                              total={selectedPerformance.total_sent}
                              color="bg-teal-400"
                            />
                            <FunnelBar
                              label="Thất bại"
                              value={selectedPerformance.bounced}
                              total={selectedPerformance.total_sent}
                              color="bg-red-400"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Footer actions */}
                    <div className="flex gap-3 pt-4 border-t border-gray-100 mt-4">
                      <Link
                        href={`/campaigns/${selectedCampaignId}/sending`}
                        className="btn-primary flex items-center gap-2"
                      >
                        <Send size={14} />
                        Xem trang gửi email
                      </Link>
                      <Link
                        href={`/campaigns/${selectedCampaignId}`}
                        className="btn-secondary"
                      >
                        Quay lại chiến dịch
                      </Link>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FunnelBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 shrink-0">
        <p className="text-[11px] text-gray-600 font-medium">{label}</p>
      </div>
      <div className="flex-1 bg-gray-200 rounded-full h-5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-20 shrink-0 text-right">
        <p className="text-[11px] font-semibold text-gray-700">{value.toLocaleString()}</p>
        <p className="text-[10px] text-gray-400">{pct.toFixed(1)}%</p>
      </div>
    </div>
  );
}
