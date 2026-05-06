"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Clock, Users, Check, ChevronDown } from "lucide-react";
import { api } from "@/lib/api-client";
import type { SuggestionItem, BriefForm, UserPrefs } from "../CampaignAssistantModal";

interface Props {
  suggestion: SuggestionItem | null;
  userPrefs: UserPrefs;
  brief: BriefForm;
  onBriefChange: (b: BriefForm) => void;
  brandId: string;
  onClose: () => void;
}

const CHANNEL_OPTIONS = [
  { value: "email", label: "Email", icon: "📧" },
  { value: "facebook_post", label: "Facebook", icon: "📝" },
  { value: "video_script", label: "Content for Video TikTok", icon: "🎬" },
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

export default function StepPreview({
  suggestion,
  userPrefs,
  brief,
  onBriefChange,
  brandId,
  onClose,
}: Props) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [genDone, setGenDone] = useState(false);
  const [showObjectivePicker, setShowObjectivePicker] = useState(false);

  // Auto-generate brief when entering this step
  useEffect(() => {
    if (!suggestion || genDone || brief.title) return;
    generateBrief();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateBrief() {
    if (!suggestion) return;
    setGenerating(true);
    setError("");
    try {
      console.log("[StepPreview] Generating brief with:", { suggestion, userPrefs });
      const res = await api.post<BriefForm>("/campaign-ideas/generate-brief", {
        suggestion_id: suggestion.id,
        suggestion_title: suggestion.title,
        suggestion_description: suggestion.description,
        suggestion_category: suggestion.category,
        suggestion_timing: suggestion.timing,
        suggestion_segment: suggestion.customer_segment,
        suggestion_hook: suggestion.hook,
        target_customer: userPrefs.target_customer,
        budget: "unknown",
        start_date: userPrefs.start_date,
        end_date: userPrefs.end_date,
      });
      console.log("[StepPreview] Brief generated:", res);
      onBriefChange({
        ...res,
        timing: suggestion.timing || "",
        customer_segment: suggestion.customer_segment || "",
      });
      setGenDone(true);
    } catch (err) {
      console.error("[StepPreview] generateBrief error:", err);
      const msg = err instanceof Error ? err.message : "Không thể tạo. Vui lòng thử lại.";
      setError(msg);
      setGenDone(true);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreateAndBuild() {
    if (!suggestion || !genDone) return;
    setCreating(true);
    setError("");
    try {
      console.log("[StepPreview] Creating CampaignIdea + Campaign + Building content...", { userPrefs });

      // Use start_date and end_date from userPrefs
      const startDate = userPrefs.start_date || null;
      const endDate = userPrefs.end_date || null;

      // 1. Create CampaignIdea record
      const ideaRes = await api.post<{ id: string }>("/campaign-ideas", {
        suggestion_id: suggestion.id,
        title: brief.title,
        objective: brief.objective,
        channels: brief.channels,
        hook: brief.hook,
        timing: brief.timing,
        customer_segment: brief.customer_segment,
      });
      console.log("[StepPreview] CampaignIdea created:", ideaRes.id);

      // 2. Create Campaign in DB with actual dates
      const campaignRes = await api.post<{ id: string }>("/campaigns", {
        brand_id: brandId,
        campaign_name: brief.title,
        objective: brief.objective,
        channels: brief.channels,
        product_or_service: brief.hook,
        start_date: startDate,
        deadline: endDate,
      });
      const campaignId = campaignRes.id;
      console.log("[StepPreview] Campaign created:", campaignId);

      // 3. Build content for each selected channel
      for (const channel of brief.channels) {
        const apiPath = channel === "email" ? "/build/email"
          : channel === "facebook_post" ? "/build/post"
          : channel === "video_script" ? "/build/video"
          : null;

        if (!apiPath) continue;

        try {
          const contentRes = await api.post<Record<string, unknown>>(
            `/campaign-ideas/${ideaRes.id}${apiPath}`
          );

          // Get content based on channel
          const contentData = channel === "email" ? contentRes.email_content
            : channel === "facebook_post" ? contentRes.post_content
            : contentRes.video_script;

          // Save to campaign with pending_approval status so user can edit/regenerate
          await api.post(`/campaigns/${campaignId}/content-items`, {
            channel,
            content_json: contentData,
            status: "pending_approval",
          });
          console.log(`[StepPreview] ${channel} saved to campaign`);
        } catch (buildErr) {
          console.error(`[StepPreview] Failed to build ${channel}:`, buildErr);
        }
      }

      // 4. Close modal + redirect to campaign page
      onClose();
      // Wait for modal to close, then redirect and force reload
      setTimeout(() => {
        router.push(`/campaigns/${campaignId}`);
      }, 300);
    } catch (err) {
      console.error("[StepPreview] create error:", err);
      const msg = err instanceof Error ? err.message : "Không thể tạo. Vui lòng thử lại.";
      setError(msg);
    } finally {
      setCreating(false);
    }
  }

  function updateBrief(key: keyof BriefForm, value: string | string[]) {
    onBriefChange({ ...brief, [key]: value });
  }

  function toggleChannel(ch: string) {
    const channels = brief.channels.includes(ch)
      ? brief.channels.filter((c) => c !== ch)
      : [...brief.channels, ch];
    updateBrief("channels", channels);
  }

  if (!suggestion) return null;

  const objectives = OBJECTIVE_OPTIONS[suggestion.category] || OBJECTIVE_OPTIONS["default"];

  // Loading state - AI generating brief
  if (generating) {
    return (
      <div className="space-y-4 text-center py-12">
        <Loader2 size={40} className="animate-spin text-blue-500 mx-auto" />
        <p className="text-gray-600 font-medium">AI đang chuẩn bị chiến dịch...</p>
        <p className="text-xs text-gray-400">Đợi 5-15 giây</p>
      </div>
    );
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
          {userPrefs.start_date && userPrefs.end_date
            ? `${new Date(userPrefs.start_date).toLocaleDateString("vi-VN")} - ${new Date(userPrefs.end_date).toLocaleDateString("vi-VN")}`
            : "—"}
        </span>
      </div>

      {/* Editable form */}
      <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-4">
        <p className="text-sm font-medium text-gray-700">Tóm tắt chiến dịch</p>

        {/* Tên chiến dịch - có thể sửa */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Tên chiến dịch</label>
          <input
            className="input"
            value={brief.title}
            onChange={(e) => updateBrief("title", e.target.value)}
            placeholder="VD: Giảm 30% Khóa Học Mùa Hè"
          />
        </div>

        {/* Mục tiêu - dropdown có thể sửa */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Mục tiêu</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowObjectivePicker(!showObjectivePicker)}
              className="w-full input text-left flex items-center justify-between"
            >
              <span className={brief.objective ? "text-gray-900" : "text-gray-400"}>
                {brief.objective || "Chọn mục tiêu..."}
              </span>
              <ChevronDown size={14} className="text-gray-400 shrink-0" />
            </button>
            {showObjectivePicker && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {objectives.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => {
                      updateBrief("objective", opt.label);
                      setShowObjectivePicker(false);
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${
                      brief.objective === opt.label ? "bg-blue-50" : ""
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

        {/* Ưu đãi chính - có thể sửa */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Ưu đãi chính</label>
          <input
            className="input"
            value={brief.hook}
            onChange={(e) => updateBrief("hook", e.target.value)}
            placeholder="VD: Giảm 30% cho khách cũ"
          />
        </div>

        {/* Kênh nội dung - tick chọn */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Kênh nội dung</label>
          <div className="flex flex-wrap gap-3 mt-1">
            {CHANNEL_OPTIONS.map((ch) => (
              <label
                key={ch.value}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                  brief.channels.includes(ch.value)
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={brief.channels.includes(ch.value)}
                  onChange={() => toggleChannel(ch.value)}
                  className="sr-only"
                />
                <span>{ch.icon}</span>
                <span className="text-sm">{ch.label}</span>
                {brief.channels.includes(ch.value) && (
                  <Check size={14} className="text-blue-600" />
                )}
              </label>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Action button */}
      <button
        onClick={handleCreateAndBuild}
        disabled={creating || !genDone || brief.channels.length === 0}
        className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {creating ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Đang khởi tạo...
          </>
        ) : (
          <>
            Bắt đầu tạo chiến dịch
            <Check size={16} />
          </>
        )}
      </button>
    </div>
  );
}
