"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Sparkles, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import HelpDialogButton from "@/components/common/HelpDialogButton";

const CHANNELS = [
  { value: "facebook_post", label: "Bài đăng Facebook" },
  { value: "email", label: "Email" },
  { value: "video_script", label: "Kịch bản video" },
];

const today = new Date().toISOString().split("T")[0];

export default function NewCampaignPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    campaign_name: "",
    objective: "",
    product_or_service: "",
    target_audience: "",
    offer_or_hook: "",
    deadline: "",
    channels: [] as string[],
    image_required: false,
    additional_notes: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

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

  function toggleImageRequired() {
    setForm((f) => ({ ...f, image_required: !f.image_required }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.channels.length === 0) { setError("Vui lòng chọn ít nhất 1 kênh."); return; }
    setError("");
    setLoading(true);
    try {
      const payload = {
        ...form,
        additional_notes: [
          form.additional_notes?.trim() || "",
          form.image_required ? "[IMAGE_REQUIRED] Người dùng yêu cầu gợi ý prompt tạo ảnh cho chiến dịch." : "",
        ]
          .filter(Boolean)
          .join("\n"),
      };
      const res = await api.post<{ id: string }>("/campaigns", payload);
      await api.post(`/campaigns/${res.id}/run`);
      router.push(`/campaigns/${res.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Link href="/campaigns" className="text-gray-400 hover:text-gray-700">
            <ChevronLeft size={18} />
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

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="label">Tên chiến dịch *</label>
          <input className="input" value={form.campaign_name} onChange={(e) => update("campaign_name", e.target.value)} placeholder="Ra mắt cà phê mới" required />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0">Mục tiêu *</label>
            <button
              type="button"
              onClick={handleAISuggest}
              disabled={suggesting}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors"
            >
              {suggesting
                ? <><Loader2 size={12} className="animate-spin" /> AI đang gợi ý...</>
                : <><Sparkles size={12} /> AI điền giúp tất cả</>
              }
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

        <div className="card border-gray-200 bg-gray-50/60">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.image_required}
              onChange={toggleImageRequired}
              className="accent-blue-600"
            />
            <span className="text-sm text-gray-800">Cần hệ thống gợi ý prompt tạo ảnh</span>
          </label>
          <p className="text-xs text-gray-500 mt-1">
            Nếu bật, AI sẽ chạy 2 bước A2A: Qwen tạo prompt ảnh ban đầu, sau đó GPT tối ưu prompt cuối.
          </p>
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
    </div>
  );
}
