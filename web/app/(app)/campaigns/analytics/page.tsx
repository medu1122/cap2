"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  BarChart3,
  Loader2,
  Send,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Users,
  MousePointerClick,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { STATUS_LABELS } from "@/lib/utils";
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
  opened: number;     // unique IP users (người dùng thật)
  clicked: number;    // total web visits (lượt truy cập)
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const emailUsers = email?.opened ?? 0;
  const emailVisits = email?.clicked ?? 0;
  const emailNotVisited = Math.max(0, (email?.sent ?? 0) - emailUsers);
  const fbUsers = fb?.opened ?? 0;
  const fbVisits = fb?.clicked ?? 0;
  const fbNotVisited = Math.max(0, (fb?.sent ?? 0) - fbUsers);

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
                    {/* Section: Người dùng thật */}
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Users size={14} className="text-gray-400" />
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                          Người dùng thật
                        </p>
                        <span className="ml-2 text-[10px] text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                          Đếm theo IP duy nhất
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {/* Email - Người dùng thật */}
                        <div className="rounded-2xl border border-[#377D73]/20 p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-[#377D73]/10 flex items-center justify-center">
                              <Users size={18} className="text-[#377D73]" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-600">Email</p>
                              <p className="text-[11px] text-gray-400">{email?.sent ?? 0} email gửi</p>
                            </div>
                          </div>
                          <p className="text-4xl font-bold text-[#377D73]">{emailUsers.toLocaleString()}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            người dùng thật · {(email?.open_rate ?? 0).toFixed(1)}% tỉ lệ
                          </p>
                          <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                            <div
                              className="h-full bg-[#377D73] rounded-full"
                              style={{ width: `${Math.min(email?.open_rate ?? 0, 100)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-gray-300 mt-1 text-right">
                            {emailNotVisited > 0 ? `${emailNotVisited.toLocaleString()} không truy cập` : "Tất cả đã truy cập"}
                          </p>
                        </div>

                        {/* Facebook - Người dùng thật */}
                        <div className="rounded-2xl border border-blue-200/50 p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                              <Users size={18} className="text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-600">Facebook</p>
                              <p className="text-[11px] text-gray-400">{fb?.sent ?? 0} post</p>
                            </div>
                          </div>
                          <p className="text-4xl font-bold text-blue-600">{fbUsers.toLocaleString()}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            người dùng thật · {(fb?.open_rate ?? 0).toFixed(1)}% tỉ lệ
                          </p>
                          <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${Math.min(fb?.open_rate ?? 0, 100)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-gray-300 mt-1 text-right">
                            {fbNotVisited > 0 ? `${fbNotVisited.toLocaleString()} không truy cập` : "Tất cả đã truy cập"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Section: Lượt truy cập */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <MousePointerClick size={14} className="text-gray-400" />
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                          Lượt truy cập
                        </p>
                        <span className="ml-2 text-[10px] text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                          Tổng click truy cập website
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {/* Email - Lượt truy cập */}
                        <div className="rounded-2xl border border-[#377D73]/20 p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-[#377D73]/10 flex items-center justify-center">
                              <MousePointerClick size={18} className="text-[#377D73]" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-600">Email</p>
                              <p className="text-[11px] text-gray-400">{emailUsers.toLocaleString()} người dùng thật</p>
                            </div>
                          </div>
                          <p className="text-4xl font-bold text-[#377D73]">{emailVisits.toLocaleString()}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            lượt truy cập · {(email?.click_rate ?? 0).toFixed(1)}% tỉ lệ
                          </p>
                          <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                            <div
                              className="h-full bg-[#377D73]/60 rounded-full"
                              style={{ width: `${Math.min(email?.click_rate ?? 0, 100)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-gray-300 mt-1 text-right">
                            {(email?.link_clicks ?? 0).toLocaleString()} link click
                          </p>
                        </div>

                        {/* Facebook - Lượt truy cập */}
                        <div className="rounded-2xl border border-blue-200/50 p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                              <MousePointerClick size={18} className="text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-600">Facebook</p>
                              <p className="text-[11px] text-gray-400">{fbUsers.toLocaleString()} người dùng thật</p>
                            </div>
                          </div>
                          <p className="text-4xl font-bold text-blue-600">{fbVisits.toLocaleString()}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            lượt truy cập · {(fb?.click_rate ?? 0).toFixed(1)}% tỉ lệ
                          </p>
                          <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                            <div
                              className="h-full bg-blue-400/60 rounded-full"
                              style={{ width: `${Math.min(fb?.click_rate ?? 0, 100)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-gray-300 mt-1 text-right">
                            {(fb?.link_clicks ?? 0).toLocaleString()} link click
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Bar Chart */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5 mt-6">
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
