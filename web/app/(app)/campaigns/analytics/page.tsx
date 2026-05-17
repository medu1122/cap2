"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  BarChart3,
  Loader2,
  Send,
  Eye,
  MousePointerClick,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Link2,
  Facebook,
  Mail,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { STATUS_LABELS, CHANNEL_LABELS, formatDate } from "@/lib/utils";
import ClickLineChart from "@/components/campaign/ClickLineChart";
import HelpDialogButton from "@/components/common/HelpDialogButton";

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
      <div className="w-20 shrink-0">
        <p className="text-[11px] text-gray-600 font-medium">{label}</p>
      </div>
      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
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

function ChannelSection({
  label,
  icon,
  sent,
  opened,
  clicked,
  linkClicks,
  openRate,
  clickRate,
  iconBg,
  unit = "email",
}: {
  label: string;
  icon: React.ReactNode;
  sent: number;
  opened: number;
  clicked: number;
  linkClicks: number;
  openRate: number;
  clickRate: number;
  iconBg: string;
  unit?: string;
}) {
  const empty = sent === 0;

  return (
    <div className="border border-[#377D73]/20 rounded-xl overflow-hidden">
      {/* Section Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#377D73]/15 bg-gradient-to-r from-[#377D73]/5 to-transparent">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800">{label}</p>
          <p className="text-[10px] text-gray-400">{sent} {unit}</p>
        </div>
      </div>

      {/* Metrics Grid */}
      {empty ? (
        <div className="px-5 py-8 text-center">
          <p className="text-xs text-gray-400">Chưa có dữ liệu gửi</p>
        </div>
      ) : (
        <div className="px-5 py-4 space-y-4">
          {/* KPI Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
              <p className="text-xl font-bold text-gray-700">{sent.toLocaleString()}</p>
              <p className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">Gửi</p>
            </div>
            <div className="bg-[#377D73]/5 rounded-lg p-3 text-center border border-[#377D73]/15">
              <p className="text-xl font-bold text-[#377D73]">{opened.toLocaleString()}</p>
              <p className="text-[9px] text-[#377D73]/60 uppercase tracking-wider font-semibold">Mở</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
              <p className="text-xl font-bold text-gray-700">{clicked.toLocaleString()}</p>
              <p className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">Click</p>
            </div>
          </div>

          {/* Open Rate Bar */}
          <div>
            <div className="flex justify-between text-[11px] text-gray-500 mb-1.5">
              <span>Tỷ lệ mở</span>
              <span className="font-semibold text-[#377D73]">{openRate.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#377D73] rounded-full transition-all"
                style={{ width: `${Math.min(openRate, 100)}%` }}
              />
            </div>
          </div>

          {/* Click Rate Bar */}
          <div>
            <div className="flex justify-between text-[11px] text-gray-500 mb-1.5">
              <span>Tỷ lệ click</span>
              <span className="font-semibold text-[#377D73]">{clickRate.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#377D73]/60 rounded-full transition-all"
                style={{ width: `${Math.min(clickRate, 100)}%` }}
              />
            </div>
          </div>

          {/* Funnel */}
          <div className="pt-2 space-y-2">
            <FunnelBar label="Đã gửi" value={sent} total={sent} color="bg-gray-300" />
            <FunnelBar label="Đã mở" value={opened} total={sent} color="bg-[#377D73]" />
            <FunnelBar label="Đã click" value={clicked} total={sent} color="bg-[#377D73]/60" />
          </div>

          {/* Link Clicks */}
          {linkClicks > 0 && (
            <div className="flex items-center justify-between px-3 py-2 bg-[#377D73]/5 rounded-lg border border-[#377D73]/15">
              <div className="flex items-center gap-2 text-[11px] text-gray-500">
                <Link2 size={11} className="text-[#377D73]" />
                <span>Link clicks</span>
              </div>
              <span className="text-sm font-bold text-[#377D73]">{linkClicks.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FacebookSection({
  sent,
  opened,
  clicked,
  linkClicks,
  openRate,
  clickRate,
}: {
  sent: number;
  opened: number;
  clicked: number;
  linkClicks: number;
  openRate: number;
  clickRate: number;
}) {
  const empty = sent === 0;

  return (
    <div className="border border-[#377D73]/20 rounded-xl overflow-hidden">
      {/* Section Header - Facebook style */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50/50 to-transparent">
        <div className="w-9 h-9 rounded-full flex items-center justify-center bg-blue-100">
          <Facebook size={16} className="text-blue-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-800">Facebook</p>
          <p className="text-[10px] text-gray-400">{sent} post</p>
        </div>
        {sent > 0 && (
          <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
            Đang chạy
          </span>
        )}
      </div>

      {empty ? (
        <div className="px-5 py-8 text-center">
          <p className="text-xs text-gray-400">Chưa có dữ liệu post</p>
        </div>
      ) : (
        <div className="px-5 py-4 space-y-4">
          {/* KPI Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
              <p className="text-xl font-bold text-gray-700">{sent.toLocaleString()}</p>
              <p className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">Post</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
              <p className="text-xl font-bold text-blue-600">{opened.toLocaleString()}</p>
              <p className="text-[9px] text-blue-400 uppercase tracking-wider font-semibold">Lượt xem</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
              <p className="text-xl font-bold text-gray-700">{clicked.toLocaleString()}</p>
              <p className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">Click</p>
            </div>
          </div>

          {/* Open Rate Bar */}
          <div>
            <div className="flex justify-between text-[11px] text-gray-500 mb-1.5">
              <span>Tỷ lệ xem</span>
              <span className="font-semibold text-blue-500">{openRate.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${Math.min(openRate, 100)}%` }} />
            </div>
          </div>

          {/* Click Rate Bar */}
          <div>
            <div className="flex justify-between text-[11px] text-gray-500 mb-1.5">
              <span>Tỷ lệ click</span>
              <span className="font-semibold text-blue-500">{clickRate.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-300 rounded-full transition-all" style={{ width: `${Math.min(clickRate, 100)}%` }} />
            </div>
          </div>

          {/* Funnel */}
          <div className="pt-2 space-y-2">
            <FunnelBar label="Đã post" value={sent} total={sent} color="bg-gray-300" />
            <FunnelBar label="Lượt xem" value={opened} total={sent} color="bg-blue-400" />
            <FunnelBar label="Click" value={clicked} total={sent} color="bg-blue-300" />
          </div>

          {/* Link Clicks */}
          {linkClicks > 0 && (
            <div className="flex items-center justify-between px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-2 text-[11px] text-gray-500">
                <Link2 size={11} className="text-blue-500" />
                <span>Link clicks</span>
              </div>
              <span className="text-sm font-bold text-blue-600">{linkClicks.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
        ).catch(() => [] as typeof tsData),
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

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);
  const email = selectedPerformance?.email;
  const fb = selectedPerformance?.facebook;
  const totalSent = selectedPerformance?.total_sent || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-[#377D73]/20 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/campaigns" className="text-gray-400 hover:text-gray-700 transition-colors">
              <ChevronLeft size={20} />
            </Link>
            <BarChart3 size={24} className="text-[#377D73]" />
            <h1 className="flex-1 text-xl font-semibold text-gray-900">
              Phân tích chiến dịch
            </h1>
            <HelpDialogButton
              title="Hướng dẫn Phân tích chiến dịch"
              summary="Xem hiệu quả gửi email và đăng Facebook của từng chiến dịch."
              steps={[
                "Chọn chiến dịch để xem chi tiết.",
                "Email: theo dõi lượt mở, lượt click từ email.",
                "Facebook: theo dõi lượt truy cập từ tracking link.",
                "Thêm tracking link để đo lường hiệu quả Facebook post.",
              ]}
              buttonClassName="btn-secondary text-xs"
            />
          </div>

          {/* Summary Row */}
          {selectedPerformance && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                  <Send size={12} />
                  Email gửi
                </div>
                <p className="text-lg font-bold text-gray-900">{email?.sent || 0}</p>
                <p className="text-xs text-gray-400">{(email?.sent ?? 0) - (email?.opened ?? 0)} không mở</p>
              </div>
              <div className="bg-[#377D73]/5 rounded-lg p-3 border border-[#377D73]/20">
                <div className="flex items-center gap-2 text-[#377D73] text-xs mb-1">
                  <Eye size={12} />
                  Tỷ lệ mở
                </div>
                <p className="text-lg font-bold text-[#377D73]">{email?.open_rate.toFixed(1) || 0}%</p>
                <p className="text-xs text-[#377D73]/60">{email?.opened || 0} lần mở</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                  <MousePointerClick size={12} />
                  Tổng click
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {(selectedPerformance?.total_clicked || 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-400">{selectedPerformance?.click_rate.toFixed(1) || 0}% CTR</p>
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

              {selectedCampaign && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Trạng thái</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusIcon status={selectedCampaign.status} />
                        <span className="font-medium">
                          {STATUS_LABELS[selectedCampaign.status] || selectedCampaign.status}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Kênh</p>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {selectedCampaign.channels.map((ch) => (
                          <span key={ch} className="badge bg-gray-100 text-gray-600 text-xs">
                            {CHANNEL_LABELS[ch] || ch}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Deadline</p>
                      <p className="font-medium mt-1">{formatDate(selectedCampaign.deadline)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Nội dung</p>
                      <p className="font-medium mt-1">
                        {selectedCampaign.content_count} mục
                        {selectedCampaign.pending_count > 0 && (
                          <span className="text-amber-600 ml-1">({selectedCampaign.pending_count} chờ duyệt)</span>
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
                    {/* Empty State */}
                    {totalSent === 0 && (
                      <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200">
                        <BarChart3 size={48} className="mx-auto text-gray-200 mb-4" />
                        <p className="text-gray-500">Chưa có dữ liệu gửi cho chiến dịch này.</p>
                        <p className="text-sm text-gray-400 mt-2">
                          Gửi email từ trang Gửi Email của chiến dịch để xem thống kê.
                        </p>
                      </div>
                    )}

                    {totalSent > 0 && (
                      <>
                        {/* Channel Sections */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                          {/* Email */}
                          <ChannelSection
                            label="Email"
                            icon={<Mail size={16} className="text-[#377D73]" />}
                            sent={email?.sent || 0}
                            opened={email?.opened || 0}
                            clicked={email?.clicked || 0}
                            linkClicks={email?.link_clicks || 0}
                            openRate={email?.open_rate || 0}
                            clickRate={email?.click_rate || 0}
                            iconBg="bg-[#377D73]/10"
                            unit="email"
                          />

                          {/* Facebook */}
                          <FacebookSection
                            sent={fb?.sent || 0}
                            opened={fb?.opened || 0}
                            clicked={fb?.clicked || 0}
                            linkClicks={fb?.link_clicks || 0}
                            openRate={fb?.open_rate || 0}
                            clickRate={fb?.click_rate || 0}
                          />
                        </div>

                        {/* Biểu đồ đường - Click theo thời gian */}
                        <div className="bg-white rounded-xl border border-gray-200 p-5">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className="text-sm font-semibold text-gray-800">Lượt click theo thời gian</h3>
                              <p className="text-[11px] text-gray-400 mt-0.5">So sánh click Email vs Facebook</p>
                            </div>
                            <div className="flex items-center gap-4 text-[11px]">
                              <div className="flex items-center gap-1.5">
                                <span className="w-3 h-0.5 rounded-full bg-[#7EB5A6] inline-block" />
                                <span className="text-gray-500">Email</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-3 h-0.5 rounded-full bg-[#93C5FD] inline-block" />
                                <span className="text-gray-500">Facebook</span>
                              </div>
                            </div>
                          </div>
                          <ClickLineChart data={clicksTimeSeries} loading={loadingTimeSeries} />
                        </div>

                        {/* Footer */}
                        <div className="flex gap-3 pt-4 border-t border-gray-100 mt-6">
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
