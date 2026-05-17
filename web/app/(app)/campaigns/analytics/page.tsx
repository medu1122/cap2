"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  BarChart3,
  Loader2,
  Send,
  MousePointerClick,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Facebook,
  Mail,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { STATUS_LABELS, CHANNEL_LABELS, formatDate } from "@/lib/utils";
import ClickLineChart from "@/components/campaign/ClickLineChart";

/* ── Types ──────────────────────────────────────────────────────────────── */

interface CampaignListItem {
  id: string;
  campaign_name: string;
  channels: string[];
  status: string;
  deadline: string;
  content_count: number;
  pending_count: number;
}

interface ChannelMetrics {
  sent: number;
  opened: number;
  clicked: number;
  open_rate: number;
  click_rate: number;
  link_clicks: number;
}

interface CampaignPerformance {
  campaign_id: string;
  campaign_name: string;
  status: string;
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_clicked: number;
  total_bounced: number;
  open_rate: number;
  click_rate: number;
  email: ChannelMetrics;
  facebook: ChannelMetrics;
}

interface PerformanceResponse {
  metrics: CampaignPerformance;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function StatusIcon({ status }: { status: string }) {
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

/* ── Main Page ─────────────────────────────────────────────────────────── */

export default function CampaignAnalyticsPage() {
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [selectedPerformance, setSelectedPerformance] = useState<CampaignPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clicksTimeSeries, setClicksTimeSeries] = useState<Array<{ date: string; email_clicks: number; facebook_clicks: number }>>([]);
  const [loadingTimeSeries, setLoadingTimeSeries] = useState(false);

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

  const fetchPerformance = useCallback(async () => {
    if (!selectedCampaignId) return;
    setLoadingPerformance(true);
    setLoadingTimeSeries(true);
    setError(null);
    try {
      const [perfData, tsData] = await Promise.all([
        api.get<PerformanceResponse>(`/campaigns/${selectedCampaignId}/performance`),
        api.get<Array<{ date: string; email_clicks: number; facebook_clicks: number }>>(
          `/campaigns/${selectedCampaignId}/performance/clicks-timeseries`
        ).catch(() => [] as Array<{ date: string; email_clicks: number; facebook_clicks: number }>),
      ]);
      setSelectedPerformance(perfData.metrics);
      setClicksTimeSeries(tsData);
    } catch (err) {
      console.error("Failed to fetch performance:", err);
      setError("Không thể tải dữ liệu hiệu quả");
      setSelectedPerformance(null);
      setClicksTimeSeries([]);
    } finally {
      setLoadingPerformance(false);
      setLoadingTimeSeries(false);
    }
  }, [selectedCampaignId]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  const email = selectedPerformance?.email;
  const fb = selectedPerformance?.facebook;

  return (
    <div className="min-h-screen bg-transparent">
      {/* Header */}
      <div className="bg-white border-b border-[#377D73]/20 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/campaigns" className="text-gray-400 hover:text-gray-700 transition-colors">
              <ChevronLeft size={20} />
            </Link>
            <BarChart3 size={24} className="text-[#377D73]" />
            <h1 className="flex-1 text-xl font-semibold text-gray-900">
              Phân tích chiến dịch
            </h1>
          </div>
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
          <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
            <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
            <p className="text-gray-500 mb-4">{error}</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
            <BarChart3 size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="text-gray-500 mb-4">Chưa có chiến dịch nào.</p>
            <Link href="/campaigns/new" className="btn-primary">
              Tạo chiến dịch đầu tiên
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
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
                      {c.campaign_name} ({STATUS_LABELS[c.status] || c.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Performance Section */}
            {selectedCampaignId && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {campaigns.find((c) => c.id === selectedCampaignId)?.campaign_name}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Thống kê hiệu quả chiến dịch</p>
                  </div>
                  <button
                    onClick={fetchPerformance}
                    disabled={loadingPerformance}
                    className="btn-secondary text-sm flex items-center gap-2"
                  >
                    <RefreshCw size={14} className={loadingPerformance ? "animate-spin" : ""} />
                    Làm mới
                  </button>
                </div>

                {loadingPerformance && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-[#377D73]" />
                    <span className="ml-2 text-gray-500">Đang tải dữ liệu...</span>
                  </div>
                )}

                {error && !loadingPerformance && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-4">
                    {error}
                  </div>
                )}

                {!loadingPerformance && !error && selectedPerformance && (
                  <>
                    {/* Open Rate Cards */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      {/* Email Open Rate */}
                      <div className="border border-[#377D73]/20 rounded-xl p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-lg bg-[#377D73]/10 flex items-center justify-center">
                            <Mail size={18} className="text-[#377D73]" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">Tỉ lệ mở Email</p>
                            <p className="text-xs text-gray-400">{email?.sent || 0} email gửi</p>
                          </div>
                        </div>
                        <p className="text-4xl font-bold text-[#377D73]">
                          {(email?.open_rate || 0).toFixed(1)}%
                        </p>
                        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#377D73] rounded-full"
                            style={{ width: `${Math.min(email?.open_rate || 0, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1.5 text-xs text-gray-400">
                          <span>{email?.opened || 0} lần mở</span>
                          <span>{(email?.sent || 0) - (email?.opened || 0)} không mở</span>
                        </div>
                      </div>

                      {/* Facebook Open Rate */}
                      <div className="border border-blue-200/50 rounded-xl p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Facebook size={18} className="text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">Tỉ lệ mở Facebook</p>
                            <p className="text-xs text-gray-400">{fb?.sent || 0} post</p>
                          </div>
                        </div>
                        <p className="text-4xl font-bold text-blue-600">
                          {(fb?.open_rate || 0).toFixed(1)}%
                        </p>
                        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${Math.min(fb?.open_rate || 0, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1.5 text-xs text-gray-400">
                          <span>{fb?.opened || 0} lượt xem</span>
                          <span>{(fb?.sent || 0) - (fb?.opened || 0)} không xem</span>
                        </div>
                      </div>
                    </div>

                    {/* Click Rate Row */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="border border-gray-200 rounded-xl p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-[#377D73]/10 flex items-center justify-center">
                            <MousePointerClick size={18} className="text-[#377D73]" />
                          </div>
                          <p className="text-sm font-medium text-gray-500">Tỉ lệ click Email</p>
                        </div>
                        <p className="text-3xl font-bold text-gray-800">
                          {(email?.click_rate || 0).toFixed(1)}%
                        </p>
                        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#377D73]/60 rounded-full"
                            style={{ width: `${Math.min(email?.click_rate || 0, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1.5 text-xs text-gray-400">
                          <span>{email?.clicked || 0} click</span>
                          <span>{email?.link_clicks || 0} link click</span>
                        </div>
                      </div>

                      <div className="border border-gray-200 rounded-xl p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <MousePointerClick size={18} className="text-blue-600" />
                          </div>
                          <p className="text-sm font-medium text-gray-500">Tỉ lệ click Facebook</p>
                        </div>
                        <p className="text-3xl font-bold text-gray-800">
                          {(fb?.click_rate || 0).toFixed(1)}%
                        </p>
                        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-400/60 rounded-full"
                            style={{ width: `${Math.min(fb?.click_rate || 0, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1.5 text-xs text-gray-400">
                          <span>{fb?.clicked || 0} click</span>
                          <span>{fb?.link_clicks || 0} link click</span>
                        </div>
                      </div>
                    </div>

                    {/* Bar Chart */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-800">Lượt click theo thời gian</h3>
                          <p className="text-[11px] text-gray-400 mt-0.5">So sánh click Email vs Facebook</p>
                        </div>
                        <div className="flex items-center gap-4 text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm bg-[#7EB5A6] inline-block" />
                            <span className="text-gray-500">Email</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm bg-[#93C5FD] inline-block" />
                            <span className="text-gray-500">Facebook</span>
                          </div>
                        </div>
                      </div>
                      <ClickLineChart data={clicksTimeSeries} loading={loadingTimeSeries} />
                    </div>

                    {/* Footer */}
                    <div className="flex gap-3 pt-4 border-t border-gray-100">
                      <Link
                        href={`/campaigns/${selectedCampaignId}/sending`}
                        className="btn-primary flex items-center gap-2"
                      >
                        <Send size={14} />
                        Xem trang gửi email
                      </Link>
                      <Link href={`/campaigns/${selectedCampaignId}`} className="btn-secondary">
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
