"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { BarChart3, Loader2 } from "lucide-react";

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

interface PerformanceSectionProps {
  campaignId: string;
  onAddRevenue?: () => void;
}

export default function PerformanceSection({ campaignId, onAddRevenue }: PerformanceSectionProps) {
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        const data = await api.get<{ metrics: PerformanceMetrics; revenues: unknown[] }>(
          `/campaigns/${campaignId}/performance`
        );
        setHasData(data.metrics.total_sent > 0 || data.metrics.total_revenue > 0);
      } catch {
        setHasData(false);
      } finally {
        setLoading(false);
      }
    };

    fetchPerformance();
  }, [campaignId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="text-center py-6">
      <BarChart3 size={32} className="mx-auto text-gray-200 mb-3" />
      <p className="text-sm text-gray-500 mb-3">
        {hasData
          ? "Đã có dữ liệu hiệu quả chiến dịch"
          : "Chưa có dữ liệu hiệu quả. Chạy chiến dịch để theo dõi."}
      </p>
      <Link
        href="/campaigns/analytics"
        className="inline-flex items-center gap-2 px-4 py-2 bg-[#377D73] text-white rounded-lg text-sm font-medium hover:bg-[#2A9D8F] transition-colors"
      >
        Xem chi tiết
      </Link>
    </div>
  );
}
