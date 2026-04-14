"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { api } from "@/lib/api-client";

const CHANNELS = [
  { value: "facebook_post", label: "Facebook Post" },
  { value: "email", label: "Email" },
  { value: "video_script", label: "Video Script" },
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
    additional_notes: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleChannel(ch: string) {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(ch) ? f.channels.filter((c) => c !== ch) : [...f.channels, ch],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.channels.length === 0) { setError("Vui lòng chọn ít nhất 1 kênh."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ id: string }>("/campaigns", form);
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
      <div className="flex items-center gap-2 mb-6">
        <Link href="/campaigns" className="text-gray-400 hover:text-gray-700">
          <ChevronLeft size={18} />
        </Link>
        <h1>New Campaign</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="label">Tên chiến dịch *</label>
          <input className="input" value={form.campaign_name} onChange={(e) => update("campaign_name", e.target.value)} placeholder="Ra mắt cà phê mới" required />
        </div>

        <div>
          <label className="label">Mục tiêu *</label>
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
          <label className="label">Deadline *</label>
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

        <div>
          <label className="label">Ghi chú thêm</label>
          <textarea className="input min-h-[72px] resize-none" value={form.additional_notes} onChange={(e) => update("additional_notes", e.target.value)} placeholder="Nhấn mạnh nguyên liệu sạch, không dùng đường công nghiệp..." />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <p className="text-xs text-gray-400">Sau khi tạo, AI sẽ tự động bắt đầu soạn nội dung cho chiến dịch của bạn.</p>

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
