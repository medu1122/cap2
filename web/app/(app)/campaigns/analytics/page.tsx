"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, BarChart3, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { STATUS_LABELS, STATUS_COLORS, CHANNEL_LABELS, formatDate, cn } from "@/lib/utils";
import HelpDialogButton from "@/components/common/HelpDialogButton";
import PerformanceSection from "@/components/campaign/PerformanceSection";
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
}

interface SelectedCampaign {
  id: string;
  campaign_name: string;
  status: string;
}

export default function CampaignAnalyticsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<SelectedCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRevenueModal, setShowRevenueModal] = useState(false);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const data = await api.get<CampaignListItem[]>("/campaigns");
        setCampaigns(data);
        
        // Auto-select first campaign if available
        if (data.length > 0) {
          setSelectedCampaign({
            id: data[0].id,
            campaign_name: data[0].campaign_name,
            status: data[0].status,
          });
        }
      } catch (err) {
        console.error("Failed to fetch campaigns:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, []);

  const handleCampaignChange = (campaignId: string) => {
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (campaign) {
      setSelectedCampaign({
        id: campaign.id,
        campaign_name: campaign.campaign_name,
        status: campaign.status,
      });
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/campaigns" className="text-gray-400 hover:text-gray-700">
          <ChevronLeft size={20} />
        </Link>
        <BarChart3 size={24} className="text-[#377D73]" />
        <h1 className="flex-1 text-xl font-semibold">Phân tích chiến dịch</h1>
        <HelpDialogButton
          title="Hướng dẫn Phân tích chiến dịch"
          summary="Chọn chiến dịch để xem KPIs và doanh thu."
          steps={[
            "Chọn chiến dịch từ danh sách.",
            "Xem các chỉ số: email gửi, tỷ lệ mở, click, doanh thu, ROI.",
            "Nhấn 'Nhập doanh thu' để cập nhật số liệu.",
            "Dữ liệu được tính toán từ: logs gửi email + doanh thu nhập tay.",
          ]}
          buttonClassName="btn-secondary text-xs"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[#377D73]" />
          <span className="ml-3 text-gray-500">Đang tải danh sách chiến dịch...</span>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20">
          <BarChart3 size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">Chưa có chiến dịch nào.</p>
          <Link href="/campaigns/new" className="btn-primary">
            Tạo chiến dịch đầu tiên
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Campaign Selector */}
          <div className="card">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Chọn chiến dịch:
              </label>
              <select
                className="input flex-1 max-w-md"
                value={selectedCampaign?.id || ""}
                onChange={(e) => handleCampaignChange(e.target.value)}
              >
                <option value="" disabled>-- Chọn chiến dịch --</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.campaign_name} ({STATUS_LABELS[c.status] || c.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Campaign Info Preview */}
            {selectedCampaign && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                {(() => {
                  const campaign = campaigns.find((c) => c.id === selectedCampaign.id);
                  if (!campaign) return null;
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Trạng thái</p>
                        <span className={cn("badge", STATUS_COLORS[campaign.status])}>
                          {STATUS_LABELS[campaign.status] || campaign.status}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Kênh</p>
                        <div className="flex gap-1 flex-wrap mt-1">
                          {campaign.channels.map((ch) => (
                            <span key={ch} className="badge bg-gray-100 text-gray-600 text-xs">
                              {CHANNEL_LABELS[ch] || ch}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Deadline</p>
                        <p className="font-medium">{formatDate(campaign.deadline)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Nội dung</p>
                        <p className="font-medium">
                          {campaign.content_count} item
                          {campaign.pending_count > 0 && (
                            <span className="text-amber-600 ml-1">({campaign.pending_count} chờ duyệt)</span>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Performance Section - Only show when campaign is selected */}
          {selectedCampaign ? (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-800">
                  Hiệu quả chiến dịch
                </h2>
              </div>
              <PerformanceSection
                campaignId={selectedCampaign.id}
                onAddRevenue={() => setShowRevenueModal(true)}
              />
            </div>
          ) : (
            <div className="card text-center py-16">
              <BarChart3 size={48} className="mx-auto text-gray-200 mb-4" />
              <p className="text-gray-500">Chọn một chiến dịch để xem phân tích</p>
            </div>
          )}
        </div>
      )}

      {/* Revenue Modal */}
      {selectedCampaign && showRevenueModal && (
        <RevenueUploadModal
          campaignId={selectedCampaign.id}
          campaignName={selectedCampaign.campaign_name}
          onClose={() => setShowRevenueModal(false)}
        />
      )}
    </div>
  );
}
