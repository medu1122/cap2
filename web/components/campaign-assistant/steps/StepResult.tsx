"use client";
import { useState } from "react";
import { RefreshCw, ExternalLink, Copy, Check } from "lucide-react";
import { api } from "@/lib/api-client";
import type { BriefForm, BuildingStatus, ContentBlocks } from "../CampaignAssistantModal";
import VideoScriptContent from "@/components/campaign/VideoScriptContent";

interface Props {
  ideaId: string;
  brief: BriefForm;
  blocks: ContentBlocks;
  buildingStatus: BuildingStatus;
  onClose: () => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 hover:bg-gray-100 rounded transition-colors"
      title="Sao chép"
    >
      {copied ? (
        <Check size={14} className="text-green-600" />
      ) : (
        <Copy size={14} className="text-gray-400" />
      )}
    </button>
  );
}

function BlockCard({
  title,
  icon,
  children,
  onRegenerate,
  regenerating,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <h4 className="font-medium text-gray-900">{title}</h4>
        </div>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            <RefreshCw size={12} className={regenerating ? "animate-spin" : ""} />
            Tạo lại
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function StepResult({
  ideaId,
  brief,
  blocks,
  buildingStatus,
  onClose,
}: Props) {
  const [regenerating, setRegenerating] = useState<string | null>(null);

  async function handleRegenerate(block: string) {
    setRegenerating(block);
    try {
      switch (block) {
        case "email":
          await api.post(`/campaign-ideas/${ideaId}/build/email`);
          break;
        case "post":
          await api.post(`/campaign-ideas/${ideaId}/build/post`);
          break;
        case "video":
          await api.post(`/campaign-ideas/${ideaId}/build/video`);
          break;
        case "image":
          await api.post(`/campaign-ideas/${ideaId}/build/image-prompt`);
          break;
      }
    } catch {
      // Silent fail
    } finally {
      setRegenerating(null);
    }
  }

  const email = blocks.email as { subject?: string; preheader?: string; body?: string; cta_text?: string } | null;
  const post = blocks.post as { hook?: string; body?: string; hashtags?: string[]; image_style?: string } | null;
  const video = blocks.video as Record<string, unknown> | null;

  return (
    <div className="space-y-5">
      <div className="text-center pb-4 border-b border-gray-200">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">🎉</span>
        </div>
        <h3 className="text-xl font-bold text-gray-900">{brief.title}</h3>
        <p className="text-sm text-gray-600 mt-1">Plan chiến dịch hoàn chỉnh</p>
      </div>

      {/* Email */}
      {buildingStatus.email === "done" && email && (
        <BlockCard
          title="Email Marketing"
          icon="📧"
          onRegenerate={() => handleRegenerate("email")}
          regenerating={regenerating === "email"}
        >
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Tiêu đề</p>
              <div className="flex items-start gap-2">
                <p className="font-medium text-gray-900 flex-1">{email.subject}</p>
                <CopyButton text={email.subject || ""} />
              </div>
            </div>
            {email.preheader && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Preheader</p>
                <p className="text-gray-700">{email.preheader}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Nội dung</p>
              <div className="bg-white border border-gray-200 rounded-lg p-3 text-gray-700 whitespace-pre-wrap">
                {email.body}
              </div>
            </div>
            {email.cta_text && (
              <div className="flex items-center gap-2">
                <span className="badge bg-blue-100 text-blue-700">{email.cta_text}</span>
              </div>
            )}
          </div>
        </BlockCard>
      )}

      {/* Post */}
      {buildingStatus.post === "done" && post && (
        <BlockCard
          title="Bài đăng Facebook"
          icon="📝"
          onRegenerate={() => handleRegenerate("post")}
          regenerating={regenerating === "post"}
        >
          <div className="space-y-3 text-sm">
            {post.hook && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-600 mb-0.5">Hook (dòng đầu)</p>
                <p className="font-medium text-gray-900">{post.hook}</p>
              </div>
            )}
            {post.body && (
              <div className="whitespace-pre-wrap text-gray-700">
                {post.body}
              </div>
            )}
            {post.hashtags && post.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {post.hashtags.map((tag) => (
                  <span key={tag} className="badge bg-blue-50 text-blue-600 text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {post.image_style && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Phong cách ảnh</p>
                <p className="text-gray-600 italic">{post.image_style}</p>
              </div>
            )}
          </div>
        </BlockCard>
      )}

      {/* Video */}
      {buildingStatus.video === "done" && video && (
        <BlockCard
          title="Kịch bản cho Video"
          icon="🎬"
          onRegenerate={() => handleRegenerate("video")}
          regenerating={regenerating === "video"}
        >
          <VideoScriptContent content={video} />
        </BlockCard>
      )}

      {/* Image Prompt */}
      {buildingStatus.image === "done" && blocks.imagePrompt && (
        <BlockCard
          title="Prompt tạo ảnh"
          icon="🖼️"
          onRegenerate={() => handleRegenerate("image")}
          regenerating={regenerating === "image"}
        >
          <div className="flex items-start gap-2">
            <p className="text-sm text-gray-700 flex-1">{blocks.imagePrompt}</p>
            <CopyButton text={blocks.imagePrompt as string} />
          </div>
        </BlockCard>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button onClick={onClose} className="btn-secondary flex-1">
          Đóng
        </button>
        <a
          href={`/campaigns/new?campaign_name=${encodeURIComponent(brief.title)}&objective=${encodeURIComponent(brief.objective)}&channels=${encodeURIComponent(brief.channels.join(","))}`}
          className="btn-primary flex-1 text-center"
        >
          <ExternalLink size={16} className="inline mr-2" />
          Tạo chiến dịch
        </a>
      </div>
    </div>
  );
}
