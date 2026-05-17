"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Clock, Users, Check, Link2, Plus, Trash2, Copy, CheckCircle2 } from "lucide-react";
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

const VALID_CHANNELS = ["facebook_post", "email", "video_script"];

const CHANNEL_OPTIONS = [
  { value: "email", label: "Email", icon: "📧" },
  { value: "facebook_post", label: "Facebook", icon: "📝" },
  { value: "video_script", label: "Kịch bản cho video", icon: "🎬" },
];

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
  const [showTrackingForm, setShowTrackingForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const [createdLinks, setCreatedLinks] = useState<{ short_code: string; name: string; link_type: string }[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [createdCampaignId, setCreatedCampaignId] = useState<string>("");

  const validChannels = useMemo(
    () => (brief.channels || []).filter((c: string) => VALID_CHANNELS.includes(c)),
    [brief.channels]
  );

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
      onBriefChange({
        ...res,
        timing: suggestion.timing || "",
        customer_segment: suggestion.customer_segment || "",
      });
      setGenDone(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Không thể tạo. Vui lòng thử lại.";
      setError(msg);
      setGenDone(true);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreateAndBuild() {
    if (!suggestion || !genDone) return;

    if (!brief.title.trim() || validChannels.length === 0) {
      setError("Vui lòng điền tên chiến dịch và chọn ít nhất một kênh nội dung.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      let deadline: string;
      if (userPrefs.end_date) {
        deadline = userPrefs.end_date;
      } else {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        deadline = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }

      // 1. Tạo CampaignIdea
      await api.post<{ id: string }>("/campaign-ideas", {
        suggestion_id: suggestion.id,
        title: brief.title,
        objective: brief.objective,
        channels: brief.channels,
        hook: brief.hook,
        timing: brief.timing,
        customer_segment: brief.customer_segment,
        brand_id: brandId,
      });

      // 2. Tạo Campaign
      const notes: string[] = [];
      if (brief.image_required) {
        notes.push("[IMAGE_REQUIRED] Người dùng yêu cầu hỗ trợ AI tạo ảnh đăng kèm cho chiến dịch.");
      }
      if (userPrefs.target_customer) {
        notes.push(`[TARGET_CUSTOMER: ${userPrefs.target_customer}]`);
      }
      const campaignPayload: Record<string, unknown> = {
        brand_id: brandId,
        campaign_name: brief.title,
        objective: brief.objective,
        channels: validChannels,
        product_or_service: brief.hook,
        deadline,
        additional_notes: notes.join("\n"),
      };
      if (userPrefs.start_date) campaignPayload.start_date = userPrefs.start_date;
      const campaignRes = await api.post<{ id: string }>("/campaigns", campaignPayload);
      const campaignId = campaignRes.id;
      setCreatedCampaignId(campaignId);

      // 3. Tạo tracking links (bulk — mỗi URL tạo email_click + facebook_post)
      if (trackingLinks.length > 0) {
        const destUrls = trackingLinks.map((l) => l.destination_url);
        const bulkLinks = await api.post<
          { short_code: string; name: string; link_type: string }[]
        >(`/campaigns/${campaignId}/tracking-links/bulk`, { destination_urls: destUrls });
        setCreatedLinks(bulkLinks.map((l) => ({ short_code: l.short_code, name: l.name, link_type: l.link_type })));
      }

      // 4. Chạy agent generate content
      await api.post(`/campaigns/${campaignId}/run`);

      // 5. Redirect
      onClose();
      setTimeout(() => { router.push(`/campaigns/${campaignId}`); }, 300);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Không thể tạo. Vui lòng thử lại.";
      setError(msg);
    } finally {
      setCreating(false);
    }
  }

  function updateBrief(key: keyof BriefForm, value: string | string[] | boolean) {
    onBriefChange({ ...brief, [key]: value });
  }

  function toggleChannel(ch: string) {
    const channels = brief.channels.includes(ch)
      ? brief.channels.filter((c) => c !== ch)
      : [...brief.channels, ch];
    updateBrief("channels", channels);
  }

  function addTrackingLink() {
    if (!linkUrl.trim()) { setLinkError("Nhập URL đích"); return; }
    if (!linkUrl.trim().startsWith("http")) { setLinkError("URL phải bắt đầu bằng http:// hoặc https://"); return; }
    setLinkError("");
    onTrackingLinksChange([...trackingLinks, { name: `Link ${trackingLinks.length + 1}`, destination_url: linkUrl.trim() }]);
    setLinkUrl("");
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

  function linkTypeLabel(lt: string) {
    if (lt === "email_click") return "Email";
    if (lt === "facebook_post") return "Facebook";
    return lt;
  }

  if (!suggestion) return null;

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
                <p className="text-sm font-medium text-gray-900">
                  {link.name}
                  <span className="ml-2 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                    {linkTypeLabel(link.link_type)}
                  </span>
                </p>
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
            setTimeout(() => { router.push(`/campaigns/${createdCampaignId}`); }, 300);
          }}
          className="w-full btn-primary py-3"
        >
          Đi đến chiến dịch
        </button>
      </div>
    );
  }

  // Loading state
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

        {/* Tên chiến dịch */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Tên chiến dịch</label>
          <input
            className="input"
            value={brief.title}
            onChange={(e) => updateBrief("title", e.target.value)}
            placeholder="VD: Giảm 30% Khóa Học Mùa Hè"
          />
        </div>

        {/* Mục tiêu — text input */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Mục tiêu</label>
          <input
            className="input"
            value={brief.objective}
            onChange={(e) => updateBrief("objective", e.target.value)}
            placeholder="VD: Giữ chân khách cũ, tăng doanh số..."
          />
        </div>

        {/* Ưu đãi chính */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Ưu đãi chính</label>
          <input
            className="input"
            value={brief.hook}
            onChange={(e) => updateBrief("hook", e.target.value)}
            placeholder="VD: Giảm 30% cho khách cũ"
          />
        </div>

        {/* Kênh nội dung */}
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

        {/* Hỗ trợ AI tạo ảnh */}
        <div className="border border-gray-200 rounded-xl p-4">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={brief.image_required}
              onChange={(e) => onBriefChange({ ...brief, image_required: e.target.checked })}
              className="accent-[#377D73] mt-0.5"
            />
            <div>
              <p className="text-sm text-gray-800">Hỗ trợ tạo ảnh bằng AI</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Bật tùy chọn này, ảnh sẽ được tạo và gắn kèm tự động vào email và bài đăng</p>
            </div>
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Tracking links */}
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
              <><CheckCircle2 size={12} /> Đã bổ sung {trackingLinks.length > 0 && `(${trackingLinks.length})`}</>
            ) : (
              <><Plus size={12} /> Thêm link</>
            )}
          </button>
        </div>

        {showTrackingForm && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              Hệ thống sẽ tự tạo link riêng cho Email và Facebook từ URL bạn nhập.
            </p>

            {trackingLinks.map((link, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200">
                <Link2 size={12} className="text-[#377D73] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-gray-800 truncate">{link.destination_url}</p>
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

            <div className="flex gap-2">
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://yoursite.com"
                className="input text-[11px] flex-1"
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
        disabled={creating || !genDone || validChannels.length === 0}
        className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {creating ? (
          <><Loader2 size={16} className="animate-spin" /> Đang khởi tạo...</>
        ) : (
          <><Check size={16} /> Bắt đầu tạo chiến dịch</>
        )}
      </button>
    </div>
  );
}
