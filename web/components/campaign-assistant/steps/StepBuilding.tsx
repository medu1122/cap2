"use client";
import { useEffect, useRef } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api-client";
import type { BlockStatus, BuildingStatus, ContentBlocks } from "../CampaignAssistantModal";

interface Props {
  ideaId: string;
  blocks: ContentBlocks;
  onBlocksChange: (b: ContentBlocks) => void;
  buildingStatus: BuildingStatus;
  onBuildingStatusChange: (s: BuildingStatus) => void;
  onComplete: () => void;
}

const BLOCK_CONFIGS = [
  { key: "email" as const, label: "Nội dung Email", icon: "📧" },
  { key: "post" as const, label: "Bài đăng Facebook", icon: "📝" },
  { key: "video" as const, label: "Kịch bản cho Video", icon: "🎬" },
  { key: "image" as const, label: "Prompt tạo ảnh", icon: "🖼️" },
];

export default function StepBuilding({
  ideaId,
  blocks,
  onBlocksChange,
  buildingStatus,
  onBuildingStatusChange,
  onComplete,
}: Props) {
  const builtRef = useRef(false);

  useEffect(() => {
    if (!ideaId || builtRef.current) return;
    builtRef.current = true;

    async function buildAll() {
      for (const config of BLOCK_CONFIGS) {
        const currentStatus = buildingStatus[config.key];
        if (currentStatus !== "idle") continue;

        const newStatus = { ...buildingStatus, [config.key]: "loading" as BlockStatus };
        onBuildingStatusChange(newStatus);

        try {
          switch (config.key) {
            case "email": {
              const res = await api.post<{ email_content: Record<string, unknown> }>(
                `/campaign-ideas/${ideaId}/build/email`
              );
              onBlocksChange({ ...blocks, email: res.email_content });
              onBuildingStatusChange({ ...newStatus, email: "done" as BlockStatus });
              break;
            }
            case "post": {
              const res = await api.post<{ post_content: Record<string, unknown> }>(
                `/campaign-ideas/${ideaId}/build/post`
              );
              onBlocksChange({ ...blocks, post: res.post_content });
              onBuildingStatusChange({ ...newStatus, post: "done" as BlockStatus });
              break;
            }
            case "video": {
              const res = await api.post<{ video_script: Record<string, unknown> }>(
                `/campaign-ideas/${ideaId}/build/video`
              );
              onBlocksChange({ ...blocks, video: res.video_script });
              onBuildingStatusChange({ ...newStatus, video: "done" as BlockStatus });
              break;
            }
            case "image": {
              const res = await api.post<{ image_prompt: string }>(
                `/campaign-ideas/${ideaId}/build/image-prompt`
              );
              onBlocksChange({ ...blocks, imagePrompt: res.image_prompt });
              onBuildingStatusChange({ ...newStatus, image: "done" as BlockStatus });
              break;
            }
          }
        } catch {
          onBuildingStatusChange({ ...newStatus, [config.key]: "error" as BlockStatus });
        }
      }

      // Check all done after short delay
      setTimeout(() => {
        const allDone = BLOCK_CONFIGS.every((c) => buildingStatus[c.key] === "done");
        if (allDone) onComplete();
      }, 800);
    }

    buildAll();
  }, [ideaId]);

  const allDone = BLOCK_CONFIGS.every((c) => buildingStatus[c.key] === "done");
  const anyError = BLOCK_CONFIGS.some((c) => buildingStatus[c.key] === "error");

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
          <Loader2 size={24} className="text-blue-600 animate-spin" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">AI đang tạo nội dung...</h3>
        <p className="text-sm text-gray-600">Từng phần một, đảm bảo chất lượng cao nhất</p>
      </div>

      <div className="space-y-3">
        {BLOCK_CONFIGS.map((config) => {
          const status = buildingStatus[config.key];
          return (
            <div
              key={config.key}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                status === "done"
                  ? "border-green-200 bg-green-50"
                  : status === "error"
                  ? "border-red-200 bg-red-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <span className="text-xl">{config.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{config.label}</p>
                <p className="text-xs text-gray-500">
                  {status === "idle" && "Đang chờ..."}
                  {status === "loading" && "AI đang viết..."}
                  {status === "done" && "Hoàn tất"}
                  {status === "error" && "Lỗi - bấm để thử lại"}
                </p>
              </div>
              <div>
                {status === "idle" && <div className="w-5 h-5 rounded-full border-2 border-gray-300" />}
                {status === "loading" && <Loader2 size={20} className="text-blue-500 animate-spin" />}
                {status === "done" && <CheckCircle2 size={20} className="text-green-600" />}
                {status === "error" && <AlertCircle size={20} className="text-red-500" />}
              </div>
            </div>
          );
        })}
      </div>

      {allDone && (
        <p className="text-center text-sm text-green-600 font-medium">
          ✓ Tất cả nội dung đã sẵn sàng!
        </p>
      )}
      {anyError && !allDone && (
        <p className="text-center text-sm text-amber-600">
          Một số phần gặp lỗi. Bạn có thể xem lại sau.
        </p>
      )}
    </div>
  );
}
