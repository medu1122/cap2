"use client";
import { useState } from "react";
import { Rocket, Loader2, Calendar } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface Props {
  campaignId: string;
  channels: string[];
  contentItems: Array<{ status: string }>;
  onNavigate: (path: string) => void;
}

export default function CampaignDeploymentSection({
  campaignId,
  channels,
  contentItems,
  onNavigate,
}: Props) {
  const [autoSchedule, setAutoSchedule] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState("");

  const hasEmailChannel = channels.includes("email");
  const allContentApproved = contentItems.every((c) => c.status === "approved");

  const canRun = hasEmailChannel && (contentItems.length === 0 || allContentApproved);

  async function handleScheduleToggle() {
    setScheduling(true);
    setScheduleMsg("");
    try {
      await api.post(`/campaigns/${campaignId}/schedule-auto`, { enabled: !autoSchedule });
      setAutoSchedule(!autoSchedule);
      setScheduleMsg(!autoSchedule ? "Đã bật gửi tự động" : "Đã tắt gửi tự động");
    } catch {
      setScheduleMsg("Lỗi khi cập nhật");
    } finally {
      setScheduling(false);
    }
  }

  function handleRun() {
    if (!canRun) return;
    onNavigate(`/campaigns/${campaignId}/sending`);
  }

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-md">
          <Rocket size={18} className="text-white" />
        </div>
        <h2 className="text-base font-bold text-gray-900">Triển khai</h2>
      </div>

      {/* Cảnh báo */}
      {!hasEmailChannel && (
        <p className="text-[11px] text-amber-600 font-medium">
          Chiến dịch chưa gồm kênh Email.
        </p>
      )}
      {!allContentApproved && contentItems.length > 0 && (
        <p className="text-[11px] text-red-500 font-medium">
          Cần duyệt tất cả nội dung trước khi chạy chiến dịch.
        </p>
      )}

      {/* Nút chạy chiến dịch */}
      <button
        type="button"
        onClick={handleRun}
        disabled={!canRun}
        className={cn(
          "w-full btn-primary py-2.5 flex items-center justify-center gap-2 text-[12px] font-bold shadow-sm transition-all",
          !canRun && "opacity-50 cursor-not-allowed"
        )}
      >
        <Rocket size={14} />
        Chạy chiến dịch
      </button>

      {/* Gửi tự động */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-gray-400" />
          <span className="text-[12px] text-gray-700 font-semibold">Gửi tự động</span>
        </div>
        <button
          onClick={handleScheduleToggle}
          disabled={scheduling || !hasEmailChannel}
          className={cn(
            "relative w-11 h-6 rounded-full transition-all duration-300 shadow-inner",
            autoSchedule ? "bg-[#377D73]" : "bg-gray-300",
            (!hasEmailChannel || scheduling) && "opacity-50 cursor-not-allowed"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-lg transition-all duration-300",
              autoSchedule && "translate-x-5"
            )}
          />
        </button>
      </div>
      {scheduleMsg && (
        <p className="text-[10px] text-[#377D73] font-semibold text-right">{scheduleMsg}</p>
      )}
    </div>
  );
}
