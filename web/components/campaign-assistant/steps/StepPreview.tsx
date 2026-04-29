"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { api } from "@/lib/api-client";
import type { SuggestionItem, BriefForm } from "../CampaignAssistantModal";

const CHANNEL_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "facebook_post", label: "Bài đăng Facebook" },
  { value: "video_script", label: "Kịch bản video" },
];

interface Props {
  suggestion: SuggestionItem | null;
  brief: BriefForm;
  onBriefChange: (b: BriefForm) => void;
  onIdeaIdChange: (id: string) => void;
  onNext: () => void;
}

export default function StepPreview({
  suggestion,
  brief,
  onBriefChange,
  onIdeaIdChange,
  onNext,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);

  if (!suggestion) return null;

  const initialBrief: BriefForm = {
    title: suggestion.title,
    objective: suggestion.description,
    channels: suggestion.channels,
    hook: suggestion.hook || "",
  };

  const currentBrief = editMode ? brief : { ...initialBrief, ...brief };

  function updateBrief(key: keyof BriefForm, value: string | string[]) {
    onBriefChange({ ...currentBrief, [key]: value });
  }

  function toggleChannel(ch: string) {
    const channels = currentBrief.channels.includes(ch)
      ? currentBrief.channels.filter((c) => c !== ch)
      : [...currentBrief.channels, ch];
    updateBrief("channels", channels);
  }

  async function handleCreate() {
    if (!suggestion) return;
    setCreating(true);
    setError("");
    try {
      const res = await api.post<{ id: string }>("/campaign-ideas", {
        suggestion_id: suggestion.id,
        title: currentBrief.title,
        objective: currentBrief.objective,
        channels: currentBrief.channels,
        hook: currentBrief.hook,
      });
      onBriefChange(currentBrief);
      onIdeaIdChange(res.id);
      onNext();
    } catch {
      setError("Không thể tạo. Vui lòng thử lại.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-gray-900 mb-1">{suggestion.title}</h3>
        <p className="text-sm text-gray-600">{suggestion.description}</p>
      </div>

      <div className="border border-gray-200 rounded-xl p-4 space-y-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Tên chiến dịch</span>
          <button
            onClick={() => setEditMode(!editMode)}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            {editMode ? "Xong" : "Chỉnh sửa"}
          </button>
        </div>

        {editMode ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500">Tên chiến dịch</label>
              <input
                className="input"
                value={currentBrief.title}
                onChange={(e) => updateBrief("title", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Mục tiêu</label>
              <textarea
                className="input min-h-[80px] resize-none"
                value={currentBrief.objective}
                onChange={(e) => updateBrief("objective", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Ưu đãi / Hook</label>
              <input
                className="input"
                value={currentBrief.hook}
                onChange={(e) => updateBrief("hook", e.target.value)}
                placeholder="VD: Giảm 20% cho khách cũ"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Kênh nội dung</label>
              <div className="flex gap-3 mt-1">
                {CHANNEL_OPTIONS.map((ch) => (
                  <label key={ch.value} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentBrief.channels.includes(ch.value)}
                      onChange={() => toggleChannel(ch.value)}
                      className="accent-blue-600"
                    />
                    <span className="text-sm">{ch.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20">Tên:</span>
              <span className="font-medium text-gray-900">{currentBrief.title}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-500 w-20 shrink-0">Mục tiêu:</span>
              <span className="text-gray-700">{currentBrief.objective}</span>
            </div>
            {currentBrief.hook && (
              <div className="flex items-start gap-2">
                <span className="text-gray-500 w-20 shrink-0">Hook:</span>
                <span className="text-blue-600 font-medium">{currentBrief.hook}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20">Kênh:</span>
              <div className="flex gap-1 flex-wrap">
                {currentBrief.channels.map((ch) => {
                  const opt = CHANNEL_OPTIONS.find((c) => c.value === ch);
                  return (
                    <span key={ch} className="badge bg-gray-200 text-gray-700">
                      {opt?.label || ch}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleCreate}
        disabled={creating || currentBrief.channels.length === 0}
        className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {creating ? "Đang tạo..." : "Bắt đầu build nội dung"}
        {!creating && <Check size={16} className="inline ml-2" />}
      </button>
    </div>
  );
}
