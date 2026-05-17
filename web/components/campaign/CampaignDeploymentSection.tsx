"use client";
import { useState } from "react";
import { Play, Loader2, Calendar } from "lucide-react";
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
  const [execBusy, setExecBusy] = useState(false);
  const [execError, setExecError] = useState("");
  const [autoSchedule, setAutoSchedule] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState("");

  const hasEmailChannel = channels.includes("email");
  const allContentApproved = contentItems.every((c) => c.status === "approved");

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

  async function runCampaignExecution() {
    setExecError("");
    setExecBusy(true);
    try {
      await api.post(`/campaigns/${campaignId}/execute`, {
        mode: "email",
        customer_list_ids: [],
        ab_test: false,
      });
      onNavigate(`/campaigns/${campaignId}/sending`);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e
        ? String((e as { message: string }).message)
        : "Không thể chạy.";
      setExecError(msg);
    } finally {
      setExecBusy(false);
    }
  }

  return (
    <div className="bg-gradient-to-br from-blue-50/50 via-white to-cyan-50/30 rounded-xl p-4 border border-blue-200/50 shadow-md">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg shadow-blue-200">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9-18 9 2 9 18 9-18-9z" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-gray-900">Triển khai</h2>
      </div>

      <div className="space-y-3">
        {!hasEmailChannel && (
          <p className="text-[11px] text-amber-600 font-medium">Chiến dịch chưa gồm kênh Email.</p>
        )}
        {!allContentApproved && contentItems.length > 0 && (
          <p className="text-[11px] text-red-500 font-medium">
            Cần duyệt tất cả nội dung trước khi chạy chiến dịch.
          </p>
        )}
        {execError && (
          <p className="text-[11px] text-red-500 font-medium">{execError}</p>
        )}

        <div className="flex items-center gap-3">
          <div className="flex-1" />
          <button
            type="button"
            onClick={runCampaignExecution}
            disabled={
              execBusy || !hasEmailChannel ||
              (!allContentApproved && contentItems.length > 0)
            }
            className={cn(
              "btn-primary text-[12px] py-2.5 px-6 font-bold shadow-lg shadow-[#377D73]/30 flex items-center gap-2 transition-all",
              execBusy && "opacity-80 cursor-not-allowed",
            )}
          >
            {execBusy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            {execBusy ? "Đang gửi..." : "Chạy chiến dịch"}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-blue-100/50">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-amber-100 rounded-lg">
            <Calendar size={14} className="text-amber-600" />
          </div>
          <span className="text-[12px] text-gray-700 font-semibold">Gửi tự động</span>
        </div>
        <button
          onClick={handleScheduleToggle}
          disabled={scheduling || !hasEmailChannel}
          className={cn(
            "relative w-11 h-6 rounded-full transition-all duration-300 shadow-inner",
            autoSchedule ? "bg-[#377D73]" : "bg-gray-300",
            (!hasEmailChannel || scheduling) && "opacity-50",
          )}
        >
          <span className={cn(
            "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-lg transition-all duration-300",
            autoSchedule && "translate-x-5",
          )} />
        </button>
      </div>
      {scheduleMsg && (
        <p className="text-[10px] text-[#377D73] font-semibold text-right mt-1">{scheduleMsg}</p>
      )}
    </div>
  );
}
