"use client";
import { Loader2, Check, Sparkles, Mail, Facebook, Video, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentLog {
  id: string;
  agent_name: string;
  step_order: number;
  channel: string | null;
  status: string;
  created_at: string;
}

interface CampaignBuildingProgressProps {
  channels: string[];
  agent_logs: AgentLog[];
  campaign_plan_json?: Record<string, unknown>;
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail size={12} />,
  facebook_post: <Facebook size={12} />,
  video_script: <Video size={12} />,
};

export function CampaignBuildingProgress({ channels, agent_logs, campaign_plan_json }: CampaignBuildingProgressProps) {
  const plan = campaign_plan_json || {};
  const planDone = agent_logs.some(l => l.agent_name === "strategist" && l.status === "success");
  const imageDone = !!(plan.image_prompt_final && plan.image_prompt_qwen);

  type StepKey = "plan" | "email" | "facebook_post" | "video_script" | "image";

  const steps: { key: StepKey; label: string; icon: React.ReactNode }[] = [
    { key: "plan", label: "Phân tích chiến lược", icon: <Sparkles size={12} /> },
    ...channels.filter(ch => ch === "email").map(ch => ({
      key: ch as StepKey,
      label: "Soạn nội dung Email",
      icon: CHANNEL_ICONS[ch],
    })),
    ...channels.filter(ch => ch === "facebook_post").map(ch => ({
      key: ch as StepKey,
      label: "Soạn nội dung Facebook",
      icon: CHANNEL_ICONS[ch],
    })),
    ...channels.filter(ch => ch === "video_script").map(ch => ({
      key: ch as StepKey,
      label: "Soạn kịch bản video",
      icon: CHANNEL_ICONS[ch],
    })),
    { key: "image", label: "Tạo ảnh bằng AI", icon: <ImagePlus size={12} /> },
  ];

  function getStepStatus(stepKey: StepKey): "done" | "running" | "pending" {
    if (stepKey === "plan") {
      if (planDone) return "done";
      if (agent_logs.some(l => l.agent_name === "strategist" && l.status === "running")) return "running";
      return "pending";
    }
    if (stepKey === "image") {
      if (imageDone) return "done";
      if (!planDone) return "pending";
      if (agent_logs.some(l => (l.agent_name === "image_prompt_qwen" || l.agent_name === "image_prompt_refiner") && l.status === "running")) return "running";
      return "pending";
    }
    const ch = stepKey;
    if (!planDone) return "pending";
    const writerDone = agent_logs.some(l => l.agent_name === "writer" && l.channel === ch && l.status === "success");
    const writerRunning = agent_logs.some(l => l.agent_name === "writer" && l.channel === ch && l.status === "running");
    const criticDone = agent_logs.some(l => l.agent_name === "critic" && l.channel === ch && l.status === "success");
    if (writerDone || criticDone) return "done";
    if (writerRunning) return "running";
    return "pending";
  }

  const allDone = steps.every(s => getStepStatus(s.key) === "done");

  return (
    <div className="mb-4 bg-white border border-[#377D73]/20 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-[#377D73]/5 border-b border-[#377D73]/10">
        <Loader2 size={14} className="text-[#377D73] animate-spin shrink-0" />
        <span className="text-sm font-medium text-[#377D73]">
          {allDone ? "Hoàn tất!" : "AI đang xây dựng chiến dịch..."}
        </span>
      </div>
      <div className="px-4 py-3 space-y-1.5">
        {steps.map((step, idx) => {
          const status = getStepStatus(step.key);
          const isLast = idx === steps.length - 1;
          return (
            <div key={step.key} className="flex items-center gap-2.5">
              <div className="flex flex-col items-center shrink-0">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px]",
                  status === "done" && "bg-[#377D73] text-white",
                  status === "running" && "bg-[#377D73]/20 text-[#377D73] animate-pulse",
                  status === "pending" && "bg-gray-100 text-gray-400",
                )}>
                  {status === "done" ? <Check size={10} /> : step.icon}
                </div>
                {!isLast && (
                  <div className={cn("w-px flex-1 min-h-[12px]", status === "done" ? "bg-[#377D73]/40" : "bg-gray-100")} />
                )}
              </div>
              <div className={cn(
                "flex-1 text-xs py-1",
                status === "done" && "text-gray-500",
                status === "running" && "text-[#377D73] font-medium",
                status === "pending" && "text-gray-400",
              )}>
                {status === "running" && <Loader2 size={9} className="inline animate-spin mr-1" />}
                {step.label}
                {status === "running" && "..."}
                {status === "pending" && " (chờ)..."}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
