"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { CHANNEL_LABELS, CHANNEL_COLORS } from "@/lib/utils";
import HelpDialogButton from "@/components/common/HelpDialogButton";
import AIToolsMenu from "@/components/campaign-assistant/AIToolsMenu";

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
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className="text-3xl font-bold text-[#377D73] mt-2">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
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

  const totalContent = Object.values(stats?.content_by_channel ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header với nút hướng dẫn và AI Tools */}
      <div className="flex items-center justify-end gap-2">
        <AIToolsMenu />
        <HelpDialogButton
          title="AIMAP - Hướng dẫn sử dụng"
          summary="AIMAP là nền tảng marketing tự động hóa bằng AI, giúp doanh nghiệp nhỏ quản lý chiến dịch, tạo nội dung và chăm sóc khách hàng dễ dàng."
          steps={[
            "Bước 1 - Brand Vault: Thiết lập hồ sơ thương hiệu (tên, giọng điệu, khách hàng mục tiêu) để AI viết nội dung đúng phong cách.",
            "Bước 2 - Campaign Brief: Tạo chiến dịch mới với thông tin sản phẩm, khách hàng mục tiêu, deadline. Chọn kênh (Email, Facebook, Video).",
            "Bước 3 - AI tạo nội dung: Hệ thống AI (Strategist + Writer + Critic) sẽ tự động tạo nội dung cho bạn.",
            "Bước 4 - Duyệt nội dung: Xem, chỉnh sửa và phê duyệt nội dung trước khi đăng.",
            "Bước 5 - Marketing Calendar: Lên lịch đăng nội dung theo ngày cụ thể.",
            "Bước 6 - Customer Lists: Import danh sách khách hàng, phân tích segment (VIP, tiềm năng, sắp rời bỏ).",
            "Bước 7 - Email Outreach: Gửi email cá nhân hóa hàng loạt cho từng nhóm khách hàng.",
            "Bước 8 - AI Analyst: Tải lên file dữ liệu (CSV/Excel), AI sẽ phân tích và đưa ra insights.",
            "Bước 9 - Workflow Automation: Lên lịch tự động chạy chiến dịch định kỳ.",
            "Bước 10 - Campaign Ideas: Nhận gợi ý ý tưởng chiến dịch từ AI kèm plan chi tiết.",
          ]}
          tips={[
            "Bắt đầu bằng Brand Vault để AI hiểu thương hiệu của bạn.",
            "Dùng Campaign Templates để tiết kiệm thời gian cho các chiến dịch tương tự.",
            "Kết hợp Email + Facebook để tiếp cận khách hàng đa kênh.",
            "Phân tích khách hàng định kỳ để hiểu rõ hơn về hành vi mua hàng.",
            "Workflow giúp bạn tự động hóa các chiến dịch lặp lại (tuần, tháng).",
          ]}
          buttonLabel="Hướng dẫn"
          buttonClassName="bg-[#377D73] text-white px-4 py-2 rounded-lg hover:bg-[#2d6a61] text-sm font-medium transition-colors"
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Tổng chiến dịch" value={stats?.total_campaigns ?? 0} />
        <StatCard label="Nội dung đã tạo" value={stats?.total_content_items ?? 0} />
        <StatCard label="Chờ duyệt" value={stats?.pending_approvals ?? 0} sub="cần xem lại" />
        <StatCard label="Đã duyệt" value={stats?.approved_items ?? 0} />
      </div>

      {/* Nội dung theo kênh */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Nội dung theo kênh</h2>
          <Link
            href="/dashboard/channel-insights"
            className="inline-flex h-8 items-center justify-center rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Xem thêm
          </Link>
        </div>
        {Object.keys(stats?.content_by_channel ?? {}).length === 0 ? (
          <p className="text-sm text-gray-400">Chưa có dữ liệu.</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(stats?.content_by_channel ?? {}).map(([channel, count]) => (
              <div key={channel} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{CHANNEL_LABELS[channel] || channel}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${CHANNEL_COLORS[channel] || "bg-gray-400"}`}
                      style={{ width: `${totalContent > 0 ? (count / totalContent) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-800 w-16 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hồ sơ thương hiệu */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-5 pb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Hồ sơ thương hiệu</h2>
          <Link href="/brand-vault" className="text-sm text-[#377D73] hover:text-[#2d6a61] font-medium transition-colors">+ Tạo hồ sơ mới</Link>
        </div>
        {brands.length === 0 ? (
          <div className="px-5 pb-5">
            <p className="text-sm text-gray-400">Chưa có hồ sơ. Tạo mới để AI viết nội dung sát thương hiệu hơn.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-t border-gray-50">
                  <th className="py-3 px-5 font-medium">Tên thương hiệu</th>
                  <th className="py-3 px-3 font-medium">Tone</th>
                  <th className="py-3 px-3 font-medium">Khách hàng mục tiêu</th>
                  <th className="py-3 px-3 font-medium">Sản phẩm chính</th>
                  <th className="py-3 px-3 font-medium">Cập nhật</th>
                  <th className="py-3 px-5 font-medium">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b) => (
                  <tr key={b.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-5 text-gray-900 font-medium">{b.brand_name}</td>
                    <td className="py-3 px-3 text-gray-600">{b.tone_of_voice || "-"}</td>
                    <td className="py-3 px-3 text-gray-600 max-w-[200px] truncate">{b.target_audience || "-"}</td>
                    <td className="py-3 px-3 text-gray-600">{(b.key_products || []).slice(0, 2).join(", ") || "-"}</td>
                    <td className="py-3 px-3 text-gray-500">{new Date(b.updated_at).toLocaleDateString("vi-VN")}</td>
                    <td className="py-3 px-5">
                      <Link href={`/brand-vault?brandId=${b.id}`} className="text-[#377D73] hover:text-[#2d6a61] font-medium transition-colors">
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
