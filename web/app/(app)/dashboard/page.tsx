"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { CHANNEL_LABELS } from "@/lib/utils";
import HelpDialogButton from "@/components/common/HelpDialogButton";

interface Stats {
  total_campaigns: number;
  total_content_items: number;
  pending_approvals: number;
  approved_items: number;
  content_by_channel: Record<string, number>;
}

interface BrandSummary {
  id: string;
  brand_name: string;
  tone_of_voice: string;
  target_audience: string;
  key_products: string[];
  updated_at: string;
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
  const [brands, setBrands] = useState<BrandSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Stats>("/dashboard/stats")
      .then(setStats)
      .finally(() => setLoading(false));

    api.get<BrandSummary[]>("/brands")
      .then(setBrands)
      .catch(() => setBrands([]));
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
        <HelpDialogButton
          title="Hướng dẫn trang Tổng quan"
          summary="Trang này giúp bạn nắm nhanh tình hình toàn bộ đợt quảng bá."
          steps={[
            "Xem 4 chỉ số chính: tổng chiến dịch, nội dung, chờ duyệt, đã duyệt.",
            "Xem phân bổ nội dung theo kênh để biết kênh nào dùng nhiều.",
            "Kiểm tra hồ sơ thương hiệu để đảm bảo AI viết đúng giọng thương hiệu.",
          ]}
        />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Tổng chiến dịch" value={stats?.total_campaigns ?? 0} />
        <StatCard label="Nội dung đã tạo" value={stats?.total_content_items ?? 0} />
        <StatCard label="Chờ duyệt" value={stats?.pending_approvals ?? 0} sub="cần xem lại" />
        <StatCard label="Đã duyệt" value={stats?.approved_items ?? 0} />
      </div>

      <div className="card max-w-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2>Nội dung theo kênh</h2>
          <Link
            href="/dashboard/channel-insights"
            className="inline-flex h-8 items-center justify-center rounded border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50"
            title="Xem thêm"
          >
            Xem thêm
          </Link>
        </div>
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

      <div className="card border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2>Hồ sơ thương hiệu</h2>
          <Link href="/brand-vault" className="text-sm text-blue-600 hover:underline">+ Tạo hồ sơ mới</Link>
        </div>
        {brands.length === 0 ? (
          <p className="text-sm text-gray-400">Chưa có hồ sơ. Tạo mới để AI viết nội dung sát thương hiệu hơn.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-3 font-medium">Tên thương hiệu</th>
                  <th className="py-2 pr-3 font-medium">Tone</th>
                  <th className="py-2 pr-3 font-medium">Khách hàng mục tiêu</th>
                  <th className="py-2 pr-3 font-medium">Sản phẩm chính</th>
                  <th className="py-2 pr-3 font-medium">Cập nhật</th>
                  <th className="py-2 font-medium">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b) => (
                  <tr key={b.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-3 text-gray-900 font-medium">{b.brand_name}</td>
                    <td className="py-2 pr-3 text-gray-600">{b.tone_of_voice}</td>
                    <td className="py-2 pr-3 text-gray-600 max-w-[280px] truncate">{b.target_audience || "-"}</td>
                    <td className="py-2 pr-3 text-gray-600">{(b.key_products || []).slice(0, 2).join(", ") || "-"}</td>
                    <td className="py-2 pr-3 text-gray-500">{new Date(b.updated_at).toLocaleDateString("vi-VN")}</td>
                    <td className="py-2">
                      <Link href={`/brand-vault?brandId=${b.id}`} className="text-blue-600 hover:underline">
                        Xem
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
