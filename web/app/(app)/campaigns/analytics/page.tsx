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
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api-client";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  CHANNEL_LABELS,
  formatDate,
  formatDateShort,
  cn,
} from "@/lib/utils";
import HelpDialogButton from "@/components/common/HelpDialogButton";
import RevenueUploadModal from "@/components/campaign/RevenueUploadModal";

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
  cost?: number;
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
  total_revenue: number;
  total_orders: number;
  open_rate: number;
  click_rate: number;
  conversion_rate: number;
  cost: number;
  roi_percent: number | null;
  revenue_per_email: number;
}

interface RevenueRecord {
  id: string;
  revenue: number;
  order_count: number;
  cost: number;
  source: string;
  notes: string | null;
  recorded_date: string | null;
  created_at: string;
}

interface PerformanceResponse {
  metrics: CampaignPerformance;
  revenues: RevenueRecord[];
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat("vi-VN").format(value) + "đ";
};

const formatFullCurrency = (value: number) => {
  return new Intl.NumberFormat("vi-VN").format(value) + " đ";
};

export default function CampaignAnalyticsPage() {
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [selectedPerformance, setSelectedPerformance] = useState<CampaignPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [showRevenueModal, setShowRevenueModal] = useState(false);
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

  // Fetch performance for selected campaign
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

  // Calculate summary stats from all campaigns
  const totalSent = selectedPerformance?.total_sent || 0;
  const totalRevenue = selectedPerformance?.total_revenue || 0;
  const avgOpenRate = selectedPerformance?.open_rate || 0;
  const avgRoi = selectedPerformance?.roi_percent ?? null;

  const getStatusIcon = (status: string) => {
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
  };

  const getStatusLabel = (status: string) => {
    return STATUS_LABELS[status] || status;
  };

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
              summary="Xem hiệu quả của các chiến dịch email."
              steps={[
                "Chọn chiến dịch để xem chi tiết.",
                "Theo dõi: email gửi, tỷ lệ mở, click, doanh thu, ROI.",
                "Nhấn 'Nhập doanh thu' để cập nhật số liệu.",
                "Kết quả từ Customer Outreach cũng được gộp vào nếu có gắn campaign.",
              ]}
              buttonClassName="btn-secondary text-xs"
            />
          </div>

          {/* Summary Stats - Only show when there's data */}
          {selectedPerformance && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                  <Send size={12} />
                  Email gửi
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {totalSent.toLocaleString()}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                  <Percent size={12} />
                  Tỷ lệ mở
                </div>
                <p className="text-lg font-bold text-purple-600">
                  {avgOpenRate.toFixed(1)}%
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                  <DollarSign size={12} />
                  Doanh thu
                </div>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(totalRevenue)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                  <TrendingUp size={12} />
                  ROI
                </div>
                <p
                  className={cn(
                    "text-lg font-bold",
                    avgRoi !== null && avgRoi >= 0
                      ? "text-green-600"
                      : avgRoi !== null
                      ? "text-red-500"
                      : "text-gray-400"
                  )}
                >
                  {avgRoi !== null
                    ? `${avgRoi >= 0 ? "+" : ""}${avgRoi.toFixed(1)}%`
                    : "N/A"}
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
                        {selectedCampaign.content_count} item
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
                      Chi tiết hiệu quả chiến dịch
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

                {/* Loading State */}
                {loadingPerformance && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-[#377D73]" />
                    <span className="ml-2 text-gray-500">Đang tải dữ liệu...</span>
                  </div>
                )}

                {/* Error State */}
                {error && !loadingPerformance && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-4">
                    {error}
                  </div>
                )}

                {/* Performance Metrics */}
                {!loadingPerformance && !error && selectedPerformance && (
                  <>
                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 text-blue-600 text-xs mb-1">
                          <Send size={12} />
                          Gửi
                        </div>
                        <p className="text-xl font-bold text-gray-900">
                          {selectedPerformance.total_sent.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {selectedPerformance.delivered} thành công
                        </p>
                      </div>

                      <div className="bg-purple-50 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 text-purple-600 text-xs mb-1">
                          <Percent size={12} />
                          Mở
                        </div>
                        <p className="text-xl font-bold text-purple-600">
                          {selectedPerformance.open_rate.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {selectedPerformance.opened} lần
                        </p>
                      </div>

                      <div className="bg-teal-50 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 text-teal-600 text-xs mb-1">
                          <MousePointerClick size={12} />
                          Click
                        </div>
                        <p className="text-xl font-bold text-teal-600">
                          {selectedPerformance.click_rate.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {selectedPerformance.clicked} lần
                        </p>
                      </div>

                      <div className="bg-green-50 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 text-green-600 text-xs mb-1">
                          <DollarSign size={12} />
                          Doanh thu
                        </div>
                        <p className="text-xl font-bold text-green-600">
                          {formatCurrency(selectedPerformance.total_revenue)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {selectedPerformance.total_orders} đơn
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 text-gray-600 text-xs mb-1">
                          <Users size={12} />
                          Mỗi email
                        </div>
                        <p className="text-xl font-bold text-gray-900">
                          {formatCurrency(selectedPerformance.revenue_per_email)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">mang lại
                        </p>
                      </div>

                      <div className="bg-amber-50 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 text-amber-600 text-xs mb-1">
                          <TrendingUp size={12} />
                          ROI
                        </div>
                        <p
                          className={cn(
                            "text-xl font-bold",
                            selectedPerformance.roi_percent !== null &&
                              selectedPerformance.roi_percent >= 0
                              ? "text-green-600"
                              : selectedPerformance.roi_percent !== null
                              ? "text-red-500"
                              : "text-gray-400"
                          )}
                        >
                          {selectedPerformance.roi_percent !== null
                            ? `${selectedPerformance.roi_percent >= 0 ? "+" : ""}${selectedPerformance.roi_percent.toFixed(1)}%`
                            : "N/A"}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatFullCurrency(selectedPerformance.cost)} chi phí
                        </p>
                      </div>

                      <div className="bg-red-50 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 text-red-600 text-xs mb-1">
                          <XCircle size={12} />
                          Thất bại
                        </div>
                        <p className="text-xl font-bold text-red-500">
                          {selectedPerformance.bounced}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {selectedPerformance.total_sent > 0
                            ? `${((selectedPerformance.bounced / selectedPerformance.total_sent) * 100).toFixed(1)}%`
                            : "0%"}
                        </p>
                      </div>
                    </div>

                    {/* Empty State - No Data */}
                    {selectedPerformance.total_sent === 0 && (
                      <div className="text-center py-8 bg-gray-50 rounded-xl">
                        <BarChart3 size={48} className="mx-auto text-gray-200 mb-4" />
                        <p className="text-gray-500">
                          Chưa có dữ liệu gửi cho chiến dịch này.
                        </p>
                        <p className="text-sm text-gray-400 mt-2">
                          Gửi email từ mục Chiến dịch hoặc Customer Outreach (có gắn campaign) để xem thống kê.
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-gray-100">
                      <button
                        onClick={() => setShowRevenueModal(true)}
                        className="btn-primary flex items-center gap-2"
                      >
                        <DollarSign size={16} />
                        Nhập doanh thu
                      </button>
                      <Link
                        href={`/campaigns/${selectedCampaignId}`}
                        className="btn-secondary"
                      >
                        Xem chi tiết
                      </Link>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Revenue Modal */}
      {selectedCampaignId && showRevenueModal && (
        <RevenueUploadModal
          campaignId={selectedCampaignId}
          campaignName={selectedCampaign?.campaign_name || ""}
          onClose={() => {
            setShowRevenueModal(false);
            fetchPerformance();
          }}
        />
      )}
    </div>
  );
}
