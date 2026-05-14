"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Clock, Users, Check, ChevronDown, Link2, Plus, Trash2, Copy, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api-client";
import type { SuggestionItem, BriefForm, UserPrefs, TrackingLinkInput } from "../CampaignAssistantModal";

interface Props {
  suggestion: SuggestionItem | null;
  userPrefs: UserPrefs;
  brief: BriefForm;
  onBriefChange: (b: BriefForm) => void;
  brandId: string;
  trackingLinks: TrackingLinkInput[];
  onTrackingLinksChange: (links: TrackingLinkInput[]) => void;
  onClose: () => void;
}

const CHANNEL_OPTIONS = [
  { value: "email", label: "Email", icon: "📧" },
  { value: "facebook_post", label: "Facebook", icon: "📝" },
  { value: "video_script", label: "Kịch bản cho video", icon: "🎬" },
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
  trackingLinks,
  onTrackingLinksChange,
  onClose,
}: Props) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [genDone, setGenDone] = useState(false);
  const [showObjectivePicker, setShowObjectivePicker] = useState(false);
  const [showTrackingForm, setShowTrackingForm] = useState(false);
  const [linkForm, setLinkForm] = useState({ name: "", destination_url: "" });
  const [linkError, setLinkError] = useState("");
  const [createdLinks, setCreatedLinks] = useState<{ short_code: string; name: string }[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [createdCampaignId, setCreatedCampaignId] = useState<string>("");

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
    if (!brief.title.trim() || brief.channels.length === 0) {
      setError("Vui lòng điền tên chiến dịch và chọn ít nhất một kênh nội dung.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      console.log("[StepPreview] Creating CampaignIdea + Campaign + Building content...", { userPrefs });

      // Build deadline: use end_date if set, else default +30 days from today
      let deadline: string;
      if (userPrefs.end_date) {
        deadline = userPrefs.end_date;
      } else {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        deadline = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }

      // 1. Create CampaignIdea record WITH brand_id for proper context
      const ideaRes = await api.post<{ id: string }>("/campaign-ideas", {
        suggestion_id: suggestion.id,
        title: brief.title,
        objective: brief.objective,
        channels: brief.channels,
        hook: brief.hook,
        timing: brief.timing,
        customer_segment: brief.customer_segment,
        brand_id: brandId,
      });
      console.log("[StepPreview] CampaignIdea created:", ideaRes.id);

      // 2. Create Campaign in DB with actual dates
      const campaignPayload: Record<string, unknown> = {
        brand_id: brandId,
        campaign_name: brief.title,
        objective: brief.objective,
        channels: brief.channels,
        product_or_service: brief.hook,
        deadline,
      };
      if (userPrefs.start_date) campaignPayload.start_date = userPrefs.start_date;
      const campaignRes = await api.post<{ id: string }>("/campaigns", campaignPayload);
      const campaignId = campaignRes.id;
      console.log("[StepPreview] Campaign created:", campaignId);
      setCreatedCampaignId(campaignId);

      // 3. Tạo tracking links nếu user có bổ sung
      if (trackingLinks.length > 0) {
        const created: { short_code: string; name: string }[] = [];
        for (const link of trackingLinks) {
          const createdLink = await api.post<{ short_code: string }>(`/campaigns/${campaignId}/tracking-links`, {
            name: link.name,
            destination_url: link.destination_url,
          });
          created.push({ short_code: createdLink.short_code, name: link.name });
        }
        setCreatedLinks(created);
        console.log("[StepPreview] Tracking links created:", created);
      }

      // 4. Run the agent dispatcher to generate content (same as manual flow)
      // This ensures content_items are created properly with brand context
      await api.post(`/campaigns/${campaignId}/run`);
      console.log("[StepPreview] Campaign agent started");

      // 5. Close modal + redirect to campaign page
      if (trackingLinks.length === 0) {
        onClose();
        setTimeout(() => {
          router.push(`/campaigns/${campaignId}`);
        }, 300);
      }
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

  function addTrackingLink() {
    if (!linkForm.name.trim() || !linkForm.destination_url.trim()) {
      setLinkError("Nhập đầy đủ tên và URL đích");
      return;
    }
    if (!linkForm.destination_url.startsWith("http")) {
      setLinkError("URL phải bắt đầu bằng http:// hoặc https://");
      return;
    }
    setLinkError("");
    onTrackingLinksChange([...trackingLinks, { name: linkForm.name.trim(), destination_url: linkForm.destination_url.trim() }]);
    setLinkForm({ name: "", destination_url: "" });
  }

  function removeTrackingLink(index: number) {
    onTrackingLinksChange(trackingLinks.filter((_, i) => i !== index));
  }

  function copyRedirectUrl(shortCode: string) {
    const url = `${window.location.origin}/r/${shortCode}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(shortCode);
    setTimeout(() => setCopiedCode(null), 1500);
  }

  if (!suggestion) return null;

  const objectives = OBJECTIVE_OPTIONS[suggestion.category] || OBJECTIVE_OPTIONS["default"];

  // Đã tạo xong - hiển thị tracking links
  if (createdLinks.length > 0) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 size={24} className="text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Chiến dịch đã được tạo!</h3>
          <p className="text-sm text-gray-600 mt-1">Tracking links của bạn:</p>
        </div>

        <div className="space-y-2">
          {createdLinks.map((link) => (
            <div key={link.short_code} className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
              <Link2 size={14} className="text-green-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{link.name}</p>
                <p className="text-[10px] text-gray-500 font-mono">
                  {typeof window !== "undefined" ? window.location.origin : ""}/r/{link.short_code}
                </p>
              </div>
              <button
                onClick={() => copyRedirectUrl(link.short_code)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-white bg-green-600 rounded-md hover:bg-green-700 shrink-0"
              >
                {copiedCode === link.short_code ? <Check size={10} /> : <Copy size={10} />}
                {copiedCode === link.short_code ? "Đã copy!" : "Copy link"}
              </button>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-500 text-center">
          Dùng các link trên thay cho link gốc trong nội dung email/post. Mỗi click sẽ được theo dõi tự động.
        </p>

        <button
          onClick={() => {
            onClose();
            setTimeout(() => {
              router.push(`/campaigns/${createdCampaignId}`);
            }, 300);
          }}
          className="w-full btn-primary py-3"
        >
          Đi đến chiến dịch
        </button>
      </div>
    );
  }

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

      {/* Tracking links opt-in */}
      <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 size={14} className="text-gray-500" />
            <p className="text-sm font-medium text-gray-700">Theo dõi clicks</p>
          </div>
          <button
            type="button"
            onClick={() => setShowTrackingForm(!showTrackingForm)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showTrackingForm || trackingLinks.length > 0
                ? "bg-blue-100 text-blue-700 border border-blue-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {showTrackingForm || trackingLinks.length > 0 ? (
              <>
                <CheckCircle2 size={12} />
                Đã bổ sung {trackingLinks.length > 0 && `(${trackingLinks.length})`}
              </>
            ) : (
              <>
                <Plus size={12} />
                Thêm link
              </>
            )}
          </button>
        </div>

        {showTrackingForm && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              Tạo link trung gian để theo dõi clicks. Nếu không cần, bỏ qua phần này.
            </p>

            {/* Existing links */}
            {trackingLinks.map((link, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200">
                <Link2 size={12} className="text-[#377D73] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-gray-800 truncate">{link.name}</p>
                  <p className="text-[9px] text-gray-400 truncate">{link.destination_url}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeTrackingLink(i)}
                  className="p-1 text-gray-300 hover:text-red-500 shrink-0"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}

            {/* Add new link form */}
            <div className="flex gap-2">
              <input
                type="text"
                value={linkForm.name}
                onChange={(e) => setLinkForm({ ...linkForm, name: e.target.value })}
                placeholder="Tên link (VD: Đặt phòng)"
                className="input text-[11px] flex-1"
              />
              <input
                type="url"
                value={linkForm.destination_url}
                onChange={(e) => setLinkForm({ ...linkForm, destination_url: e.target.value })}
                placeholder="https://captone2.site"
                className="input text-[11px] flex-[2]"
              />
              <button
                type="button"
                onClick={addTrackingLink}
                className="px-3 py-1.5 text-[11px] font-medium text-white bg-[#377D73] rounded-md hover:bg-[#2d635c] shrink-0"
              >
                Thêm
              </button>
            </div>
            {linkError && <p className="text-[10px] text-red-500">{linkError}</p>}
          </div>
        )}
      </div>

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
