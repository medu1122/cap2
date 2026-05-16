"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import HelpDialogButton from "@/components/common/HelpDialogButton";
import TrackingLinksModal from "@/components/campaign/TrackingLinksModal";

const CHANNELS = [
  { value: "facebook_post", label: "Bài đăng Facebook" },
  { value: "email", label: "Email" },
  { value: "video_script", label: "Kịch bản cho video" },
];

const today = new Date().toISOString().split("T")[0];

interface BrandOption {
  id: string;
  brand_name: string;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [form, setForm] = useState({
    brand_id: "",
    campaign_name: "",
    objective: "",
    product_or_service: "",
    target_audience: "",
    offer_or_hook: "",
    deadline: "",
    channels: [] as string[],
    image_required: false,
    additional_notes: "",
    source_insight_run_id: "",
    source_customer_segment: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false); // yes/no dialog
  const [showLinkModal, setShowLinkModal] = useState(false);   // form nhập link

  useEffect(() => {
    api.get<BrandOption[]>("/brands")
      .then((list) => {
        setBrands(list);
        if (list.length > 0) {
          setForm((f) => ({ ...f, brand_id: f.brand_id || list[0].id }));
        }
      })
      .catch(() => setError("Không tải được danh sách thương hiệu"))
      .finally(() => setLoadingBrands(false));
  }, []);

  useEffect(() => {
    const sourceInsightRunId = (searchParams.get("source_insight_run_id") || "").trim();
    const sourceCustomerSegment = (searchParams.get("source_customer_segment") || "").trim().toLowerCase();
    const campaignName = (searchParams.get("campaign_name") || "").trim();
    const objective = (searchParams.get("objective") || "").trim();
    const offerOrHook = (searchParams.get("offer_or_hook") || "").trim();
    const additionalNotes = (searchParams.get("additional_notes") || "").trim();
    const channelsRaw = (searchParams.get("channels") || "").trim();
    const channelsFromQuery = channelsRaw
      ? channelsRaw
          .split(",")
          .map((x) => x.trim())
          .filter((x) => ["facebook_post", "email", "video_script"].includes(x))
      : [];

    setForm((f) => ({
      ...f,
      source_insight_run_id: sourceInsightRunId || f.source_insight_run_id,
      source_customer_segment: sourceCustomerSegment || f.source_customer_segment,
      campaign_name: campaignName || f.campaign_name,
      objective: objective || f.objective,
      offer_or_hook: offerOrHook || f.offer_or_hook,
      additional_notes: additionalNotes || f.additional_notes,
      channels: channelsFromQuery.length > 0 ? channelsFromQuery : f.channels,
    }));
  }, [searchParams]);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleAISuggest() {
    if (!form.campaign_name.trim()) {
      setError("Nhập tên chiến dịch trước để AI gợi ý nội dung.");
      return;
    }
    setSuggesting(true);
    setError("");
    try {
      const res = await api.post<{
        objective: string;
        product_or_service: string;
        target_audience: string;
        offer_or_hook: string;
        additional_notes: string;
      }>("/campaigns/ai-suggest", { campaign_name: form.campaign_name });
      setForm((f) => ({
        ...f,
        objective:        res.objective        || f.objective,
        product_or_service: res.product_or_service || f.product_or_service,
        target_audience:  res.target_audience  || f.target_audience,
        offer_or_hook:    res.offer_or_hook    || f.offer_or_hook,
        additional_notes: res.additional_notes || f.additional_notes,
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể gợi ý. Vui lòng thử lại.");
    } finally {
      setSuggesting(false);
    }
  }

  function toggleChannel(ch: string) {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(ch) ? f.channels.filter((c) => c !== ch) : [...f.channels, ch],
    }));
  }

  async function executeCreateCampaign(urls: string[]) {
    setLoading(true);
    try {
      const normalizedSegment = form.source_customer_segment.trim().toLowerCase();
      const segmentAllowed = ["vip", "potential", "inactive", "unknown"].includes(normalizedSegment);
      const payload = {
        ...form,
        source_insight_run_id: form.source_insight_run_id.trim() || undefined,
        source_customer_segment: segmentAllowed ? normalizedSegment : undefined,
        additional_notes: [
          form.additional_notes?.trim() || "",
          form.image_required ? "[IMAGE_REQUIRED] Người dùng yêu cầu hỗ trợ AI tạo ảnh đăng kèm cho chiến dịch." : "",
        ]
          .filter(Boolean)
          .join("\n"),
      };
      const res = await api.post<{ id: string }>("/campaigns", payload);

      if (urls.length > 0) {
        await api.post(`/campaigns/${res.id}/tracking-links/bulk`, {
          destination_urls: urls,
        });
      }

      await api.post(`/campaigns/${res.id}/run`);
      router.push(`/campaigns/${res.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.brand_id) { setError("Vui lòng chọn thương hiệu."); return; }
    if (!form.campaign_name.trim()) { setError("Vui lòng nhập tên chiến dịch."); return; }
    if (!form.objective.trim()) { setError("Vui lòng nhập mục tiêu chiến dịch."); return; }
    if (!form.product_or_service.trim()) { setError("Vui lòng nhập sản phẩm / dịch vụ."); return; }
    if (!form.deadline) { setError("Vui lòng chọn ngày kết thúc (deadline)."); return; }
    if (form.channels.length === 0) { setError("Vui lòng chọn ít nhất 1 kênh."); return; }
    setError("");
    // Hỏi có nhập link không trước
    setShowLinkDialog(true);
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Link href="/campaigns" className="text-sm text-gray-500 hover:text-gray-800">
            ← Quay lại
          </Link>
          <h1>Tạo chiến dịch mới</h1>
        </div>
        <HelpDialogButton
          title="Hướng dẫn tạo chiến dịch"
          summary="Điền brief cơ bản, AI sẽ tạo nội dung theo kênh đã chọn."
          steps={[
            "Nhập tên chiến dịch và mục tiêu.",
            "Chọn sản phẩm, đối tượng, deadline và kênh.",
            "Bấm 'AI điền giúp tất cả' để gợi ý nhanh.",
            "Bấm 'Tạo chiến dịch' để bắt đầu.",
          ]}
          tips={[
            "Lịch đăng được AI đề xuất tự động.",
          ]}
        />
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 [&_.input]:!rounded-none [&_.btn-primary]:!rounded-none [&_.btn-secondary]:!rounded-none"
      >
        <div>
          <label className="label">Thương hiệu *</label>
          <select
            className="input"
            value={form.brand_id}
            onChange={(e) => update("brand_id", e.target.value)}
            required
            disabled={loadingBrands || brands.length === 0}
          >
            {brands.length === 0 ? (
              <option value="">Chưa có thương hiệu</option>
            ) : (
              brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.brand_name}
                </option>
              ))
            )}
          </select>
          {brands.length === 0 && !loadingBrands && (
            <p className="text-xs text-red-600 mt-1">
              Bạn cần tạo thương hiệu trước ở Brand Vault.
              {" "}
              <Link href="/brand-vault" className="underline">Mở Brand Vault</Link>
            </p>
          )}
        </div>

        <div>
          <label className="label">Tên chiến dịch *</label>
          <input className="input" value={form.campaign_name} onChange={(e) => update("campaign_name", e.target.value)} required />
        </div>

        {form.source_insight_run_id ? (
          <div className="border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
            Chiến dịch này được tạo từ Insight run: <span className="font-medium">{form.source_insight_run_id}</span>
            {form.source_customer_segment ? (
              <span> | Segment: <span className="font-medium">{form.source_customer_segment}</span></span>
            ) : null}
          </div>
        ) : null}

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0">Mục tiêu *</label>
            <button
              type="button"
              onClick={handleAISuggest}
              disabled={suggesting}
              className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              {suggesting ? "AI đang gợi ý..." : "AI điền giúp tất cả"}
            </button>
          </div>
          <textarea className="input min-h-[72px] resize-none" value={form.objective} onChange={(e) => update("objective", e.target.value)} required />
        </div>

        <div>
          <label className="label">Sản phẩm / Dịch vụ *</label>
          <input className="input" value={form.product_or_service} onChange={(e) => update("product_or_service", e.target.value)} required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Khách hàng mục tiêu</label>
            <input className="input" value={form.target_audience} onChange={(e) => update("target_audience", e.target.value)} />
          </div>
          <div>
            <label className="label">Ưu đãi / Hook</label>
            <input className="input" value={form.offer_or_hook} onChange={(e) => update("offer_or_hook", e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Ngày kết thúc *</label>
          <input type="date" className="input" value={form.deadline} onChange={(e) => update("deadline", e.target.value)} min={today} required />
        </div>

        <div>
          <label className="label">Kênh nội dung *</label>
          <div className="flex gap-3 mt-1">
            {CHANNELS.map((ch) => (
              <label key={ch.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.channels.includes(ch.value)}
                  onChange={() => toggleChannel(ch.value)}
                  className="accent-blue-600"
                />
                <span className="text-sm text-gray-700">{ch.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="border border-gray-200 bg-gray-50/60 p-3 rounded-none">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.image_required}
              onChange={() => setForm((f) => ({ ...f, image_required: !f.image_required }))}
              className="accent-[#377D73] mt-0.5"
            />
            <span className="text-sm text-gray-800">Hệ thống hỗ trợ AI tạo ảnh giúp đăng kèm</span>
          </label>
        </div>

        <div>
          <label className="label">Ghi chú thêm</label>
          <textarea className="input min-h-[72px] resize-none" value={form.additional_notes} onChange={(e) => update("additional_notes", e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <Link href="/campaigns" className="btn-secondary">Hủy</Link>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Đang tạo..." : "Tạo chiến dịch"}
          </button>
        </div>
      </form>

      {/* Dialog hỏi trước khi nhập link */}
      {showLinkDialog && (
        <YesNoLinkDialog
          onClose={() => setShowLinkDialog(false)}
          onGoToLinks={() => setShowLinkModal(true)}
          onSkip={() => executeCreateCampaign([])}
        />
      )}

      {/* Form nhập link */}
      <TrackingLinksModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onConfirm={(urls: string[]) => executeCreateCampaign(urls)}
        onSkip={() => executeCreateCampaign([])}
      />
    </div>
  );
}

// ── Dialog hỏi có nhập link không ────────────────────────────────────────────

// ── Dialog hỏi có nhập link không ────────────────────────────────────────────

interface YesNoLinkDialogProps {
  onClose: () => void;
  onGoToLinks: () => void;
  onSkip: () => void;
}

function YesNoLinkDialog({ onClose, onGoToLinks, onSkip }: YesNoLinkDialogProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#377D73]/10 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-[#377D73]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900">Bạn có link hay địa chỉ trang web nào muốn bổ sung cho nội dung không?</h3>
          <p className="text-xs text-gray-500">Hệ thống sẽ tạo link trung gian để theo dõi lượt click vào email hoặc bài đăng Facebook.</p>
        </div>
        <div className="flex gap-3 p-4 border-t border-gray-100">
          <button
            onClick={() => { onSkip(); onClose(); }}
            className="flex-1 py-2.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg transition-colors"
          >
            Không, bỏ qua
          </button>
          <button
            onClick={() => { onGoToLinks(); onClose(); }}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-[#377D73] hover:bg-[#2d635c] rounded-lg transition-colors"
          >
            Có, nhập link
          </button>
        </div>
      </div>
    </div>
  );
}

