"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { TrendingUp, TrendingDown, Mail, MousePointerClick, ShoppingCart, DollarSign, Percent, Loader2 } from "lucide-react";

interface PerformanceMetrics {
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

interface PerformanceSectionProps {
  campaignId: string;
  onAddRevenue?: () => void;
}

export default function PerformanceSection({ campaignId, onAddRevenue }: PerformanceSectionProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPerformance = async () => {
    try {
      setLoading(true);
      const data = await api.get<{ metrics: PerformanceMetrics; revenues: RevenueRecord[] }>(
        `/campaigns/${campaignId}/performance`
      );
      setMetrics(data.metrics);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, [campaignId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("vi-VN").format(value) + "đ";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-teal" />
        <span className="ml-2 text-gray-500">Đang tải dữ liệu...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
        {error}
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sent */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Mail size={16} className="text-blue-600" />
            </div>
            <span className="text-xs text-gray-500">Email gửi</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{metrics.total_sent}</p>
          <p className="text-xs text-gray-400 mt-1">{metrics.delivered} thành công</p>
        </div>

        {/* Open Rate */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <Percent size={16} className="text-purple-600" />
            </div>
            <span className="text-xs text-gray-500">Tỷ lệ mở</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">{metrics.open_rate.toFixed(1)}%</p>
          <p className="text-xs text-gray-400 mt-1">{metrics.opened} lần mở</p>
        </div>

        {/* Click Rate */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
              <MousePointerClick size={16} className="text-teal-600" />
            </div>
            <span className="text-xs text-gray-500">Tỷ lệ click</span>
          </div>
          <p className="text-2xl font-bold text-teal-600">{metrics.click_rate.toFixed(1)}%</p>
          <p className="text-xs text-gray-400 mt-1">{metrics.clicked} lần click</p>
        </div>

        {/* Revenue */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <DollarSign size={16} className="text-green-600" />
            </div>
            <span className="text-xs text-gray-500">Doanh thu</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(metrics.total_revenue)}</p>
          <p className="text-xs text-gray-400 mt-1">{metrics.total_orders} đơn hàng</p>
        </div>
      </div>

      {/* ROI Card */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-green-700">ROI</span>
              {metrics.roi_percent !== null && metrics.roi_percent > 0 ? (
                <TrendingUp size={16} className="text-green-600" />
              ) : metrics.roi_percent !== null && metrics.roi_percent < 0 ? (
                <TrendingDown size={16} className="text-red-500" />
              ) : null}
            </div>
            {metrics.roi_percent !== null ? (
              <p className="text-3xl font-bold text-green-700">
                {metrics.roi_percent >= 0 ? "+" : ""}{metrics.roi_percent.toFixed(1)}%
              </p>
            ) : (
              <p className="text-xl text-gray-400">Chưa có dữ liệu</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-1">Doanh thu / Chi phí</p>
            <p className="text-sm font-medium text-gray-700">
              {formatCurrency(metrics.total_revenue)} / {formatCurrency(metrics.cost)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {metrics.cost > 0
                ? `${formatCurrency(metrics.total_revenue / metrics.cost)} / 1đ chi phí`
                : "Nhập chi phí để tính ROI"}
            </p>
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm text-center">
          <p className="text-xs text-gray-500 mb-1">Chuyển đổi</p>
          <p className="text-xl font-bold text-gray-900">{metrics.conversion_rate.toFixed(2)}%</p>
          <p className="text-xs text-gray-400">{metrics.total_orders} đơn</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm text-center">
          <p className="text-xs text-gray-500 mb-1">Mỗi email mang lại</p>
          <p className="text-xl font-bold text-teal-600">{formatCurrency(metrics.revenue_per_email)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm text-center">
          <p className="text-xs text-gray-500 mb-1">Gửi thất bại</p>
          <p className="text-xl font-bold text-red-500">{metrics.bounced}</p>
          <p className="text-xs text-gray-400">{metrics.total_sent > 0 ? ((metrics.bounced / metrics.total_sent) * 100).toFixed(1) : 0}%</p>
        </div>
      </div>

      {/* Add Revenue Button */}
      {onAddRevenue && (
        <button
          onClick={onAddRevenue}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-teal hover:text-teal transition-colors flex items-center justify-center gap-2"
        >
          <ShoppingCart size={18} />
          Nhập doanh thu
        </button>
      )}
    </div>
  );
}
