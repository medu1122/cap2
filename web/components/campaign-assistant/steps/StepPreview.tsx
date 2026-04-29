"use client";
import { useState } from "react";
import { Check, Clock, Users, ChevronDown } from "lucide-react";
import { api } from "@/lib/api-client";
import type { SuggestionItem, BriefForm, UserPrefs } from "../CampaignAssistantModal";

const CHANNEL_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "facebook_post", label: "Bài đăng Facebook" },
  { value: "video_script", label: "Kịch bản video" },
];

const OBJECTIVE_OPTIONS: Record<string, { label: string; desc: string }[]> = {
  retention: [
    { label: "Giữ chân khách cũ", desc: "Tăng loyalty, giảm churn" },
    { label: "Tăng tần suất mua lại", desc: "Khách mua nhiều hơn trong tháng" },
    { label: "Khôi phục khách đã mất", desc: "Win-back khách 3-6 tháng không quay lại" },
  ],
  acquisition: [
    { label: "Thu hút khách hàng mới", desc: "Mở rộng tệp khách" },
    { label: "Tăng nhận diện thương hiệu", desc: "Nhiều người biết đến hơn" },
  ],
  awareness: [
    { label: "Xây dựng uy tín", desc: "Trở thành thương hiệu đáng tin cậy" },
    { label: "Tiếp cận thị trường mới", desc: "Mở rộng phạm vi khách hàng" },
  ],
  upsell: [
    { label: "Tăng giá trị đơn hàng", desc: "Khách mua nhiều hơn mỗi lần" },
    { label: "Upsell sản phẩm cao cấp", desc: "Chuyển khách lên gói/dịch vụ cao hơn" },
  ],
  seasonal: [
    { label: "Khuyến mãi dịp lễ", desc: "Tận dụng dịp lễ sắp tới" },
    { label: "Chiến dịch theo mùa", desc: "Phù hợp với thời điểm trong năm" },
  ],
  default: [
    { label: "Tăng doanh số", desc: "Thúc đẩy mua hàng" },
    { label: "Xây dựng thương hiệu", desc: "Nâng cao hình ảnh thương hiệu" },
    { label: "Kết nối khách hàng", desc: "Tạo mối quan hệ với khách" },
  ],
};

const DURATION_LABELS: Record<string, string> = {
  "1_week": "1 tuần",
  "2_4_weeks": "2-4 tuần",
  "1_month": "Cả tháng",
};

const BUDGET_LABELS: Record<string, string> = {
  low: "Thấp (<5M)",
  medium: "Trung bình",
  high: "Cao (>20M)",
  unknown: "Chưa xác định",
};

interface Props {
  suggestion: SuggestionItem | null;
  userPrefs: UserPrefs;
  brief: BriefForm;
  onBriefChange: (b: BriefForm) => void;
  onIdeaIdChange: (id: string) => void;
  onNext: () => void;
}

export default function StepPreview({
  suggestion,
  userPrefs,
  brief,
  onBriefChange,
  onIdeaIdChange,
  onNext,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [showObjectivePicker, setShowObjectivePicker] = useState(false);

  if (!suggestion) return null;

  const objectives = OBJECTIVE_OPTIONS[suggestion.category] || OBJECTIVE_OPTIONS["default"];

  // Pre-fill khi lần đầu render
  const initialBrief: BriefForm = {
    title: suggestion.title,
    objective: brief.objective || suggestion.description,
    channels: suggestion.channels?.length ? suggestion.channels : ["email", "facebook_post"],
    hook: suggestion.hook || "",
    timing: suggestion.timing || "",
    customer_segment: suggestion.customer_segment || "",
  };

  const currentBrief = brief.title ? brief : initialBrief;

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
        timing: currentBrief.timing,
        customer_segment: currentBrief.customer_segment,
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
      {/* Campaign header */}
      <div className="text-center">
        <h3 className="text-lg font-bold text-gray-900">{suggestion.title}</h3>
        <p className="text-sm text-gray-600 mt-1">{suggestion.description}</p>
      </div>

      {/* Info chips */}
      <div className="flex flex-wrap gap-2 justify-center">
        {suggestion.timing && (
          <span className="badge bg-orange-50 text-orange-700 border border-orange-200 text-xs">
            <Clock size={10} className="inline mr-1" />
            {suggestion.timing}
          </span>
        )}
        {suggestion.customer_segment && (
          <span className="badge bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs">
            <Users size={10} className="inline mr-1" />
            {suggestion.customer_segment}
          </span>
        )}
        <span className="badge bg-gray-100 text-gray-600 text-xs">
          Ngân sách: {BUDGET_LABELS[userPrefs.budget] || "—"}
        </span>
        <span className="badge bg-gray-100 text-gray-600 text-xs">
          Thời gian: {DURATION_LABELS[userPrefs.duration] || "—"}
        </span>
      </div>

      {/* Form */}
      <div className="border border-gray-200 rounded-xl p-4 space-y-4 bg-gray-50">
        <p className="text-sm font-medium text-gray-700">Chi tiết chiến dịch</p>

        {/* Tên chiến dịch */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Tên chiến dịch</label>
          <input
            className="input"
            value={currentBrief.title}
            onChange={(e) => updateBrief("title", e.target.value)}
          />
        </div>

        {/* Mục tiêu - picker */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Mục tiêu</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowObjectivePicker(!showObjectivePicker)}
              className="w-full input text-left flex items-center justify-between"
            >
              <span className={currentBrief.objective ? "text-gray-900" : "text-gray-400"}>
                {currentBrief.objective || "Chọn mục tiêu..."}
              </span>
              <ChevronDown size={14} className="text-gray-400 shrink-0" />
            </button>
            {showObjectivePicker && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {objectives.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => {
                      updateBrief("objective", opt.label);
                      setShowObjectivePicker(false);
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${
                      currentBrief.objective === opt.label ? "bg-blue-50" : ""
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-500">{opt.desc}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ưu đãi / Hook */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Ưu đãi chính</label>
          <input
            className="input"
            value={currentBrief.hook}
            onChange={(e) => updateBrief("hook", e.target.value)}
            placeholder="VD: Giảm 30% cho khách cũ"
          />
        </div>

        {/* Kênh nội dung */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Kênh nội dung</label>
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleCreate}
        disabled={creating || currentBrief.channels.length === 0}
        className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {creating ? "Đang tạo..." : "Bắt đầu viết nội dung"}
        {!creating && <Check size={16} />}
      </button>
    </div>
  );
}
