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

interface TrackingLinkInput {
  name: string;
  destination_url: string;
}

interface CreatedLinkInfo {
  short_code: string;
  name: string;
  link_type: string;
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
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [destUrls, setDestUrls] = useState<string[]>([]);

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

  function confirmCreateLinks(urls: string[]) {
    executeCreateCampaign(urls);
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

      // Tạo tracking links bulk (email_click + facebook_post cho mỗi URL)
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

  function toggleImageRequired() {
    setForm((f) => ({ ...f, image_required: !f.image_required }));
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
    setShowLinkModal(true);
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
          summary="Bạn chỉ cần điền brief cơ bản, AI sẽ phân tích và sinh nội dung theo kênh đã chọn."
          steps={[
            "Nhập tên chiến dịch và mục tiêu.",
            "Chọn sản phẩm, đối tượng, deadline và kênh cần tạo nội dung.",
            "Có thể bấm 'AI điền giúp tất cả' để gợi ý nhanh.",
            "Bấm 'Tạo chiến dịch' để bắt đầu pipeline.",
          ]}
          tips={[
            "Lịch đăng được AI đề xuất từ đầu, và hiển thị ở Lịch marketing sau khi nội dung được duyệt.",
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
          <input className="input" value={form.campaign_name} onChange={(e) => update("campaign_name", e.target.value)} placeholder="Ra mắt cà phê mới" required />
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
          <textarea className="input min-h-[72px] resize-none" value={form.objective} onChange={(e) => update("objective", e.target.value)} placeholder="Giới thiệu sản phẩm mới, tăng nhận diện thương hiệu..." required />
        </div>

        <div>
          <label className="label">Sản phẩm / Dịch vụ *</label>
          <input className="input" value={form.product_or_service} onChange={(e) => update("product_or_service", e.target.value)} placeholder="Cà phê trứng truyền thống" required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Khách hàng mục tiêu</label>
            <input className="input" value={form.target_audience} onChange={(e) => update("target_audience", e.target.value)} placeholder="Dân văn phòng 25-35 tuổi" />
          </div>
          <div>
            <label className="label">Ưu đãi / Hook</label>
            <input className="input" value={form.offer_or_hook} onChange={(e) => update("offer_or_hook", e.target.value)} placeholder="Mua 1 tặng 1 trong tuần đầu" />
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
              onChange={toggleImageRequired}
              className="accent-[#377D73] mt-0.5"
            />
            <div>
              <span className="text-sm text-gray-800">Hệ thống hỗ trợ AI tạo ảnh giúp đăng kèm luôn</span>
              <p className="text-[10px] text-gray-500 mt-0.5">Bật tùy chọn này, ảnh sẽ được tạo và gắn kèm tự động vào email và bài đăng</p>
            </div>
          </label>
        </div>

        <div>
          <label className="label">Ghi chú thêm</label>
          <textarea className="input min-h-[72px] resize-none" value={form.additional_notes} onChange={(e) => update("additional_notes", e.target.value)} placeholder="Nhấn mạnh nguyên liệu sạch, không dùng đường công nghiệp..." />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <p className="text-xs text-gray-400">
          Sau khi tạo, AI sẽ tự động phân tích và đề xuất lịch đăng theo từng kênh; lịch này sẽ xuất hiện trong mục Lịch marketing sau khi nội dung được duyệt.
        </p>

        <div className="flex gap-3">
          <Link href="/campaigns" className="btn-secondary">Hủy</Link>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Đang tạo..." : "Tạo chiến dịch"}
          </button>
        </div>
      </form>

      <TrackingLinksModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onConfirm={confirmCreateLinks}
        onSkip={() => confirmCreateLinks([])}
      />
    </div>
  );
}
