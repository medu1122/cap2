"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

const TONES = [
  { value: "playful", label: "Vui vẻ" },
  { value: "professional", label: "Chuyên nghiệp" },
  { value: "warm", label: "Ấm áp" },
  { value: "bold", label: "Mạnh mẽ" },
  { value: "informative", label: "Thông tin" },
];

interface Brand {
  brand_name: string;
  tagline: string;
  brand_description: string;
  tone_of_voice: string;
  logo_url: string;
  primary_color: string;
  target_audience: string;
  key_products: string[];
  forbidden_words: string[];
  preferred_cta: string;
  preferred_salutation: string;
  sample_post: string;
}

const EMPTY: Brand = {
  brand_name: "", tagline: "", brand_description: "", tone_of_voice: "warm",
  logo_url: "", primary_color: "#2563EB", target_audience: "", key_products: [],
  forbidden_words: [], preferred_cta: "", preferred_salutation: "bạn", sample_post: "",
};

export default function BrandVaultPage() {
  const [form, setForm] = useState<Brand>(EMPTY);
  const [productsRaw, setProductsRaw] = useState("");
  const [forbiddenRaw, setForbiddenRaw] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Brand>("/brands/me")
      .then((brand) => {
        setForm(brand);
        setProductsRaw((brand.key_products || []).join(", "));
        setForbiddenRaw((brand.forbidden_words || []).join(", "));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function update(key: keyof Brand, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api.put("/brands/me", {
        ...form,
        key_products: productsRaw.split(",").map((s) => s.trim()).filter(Boolean),
        forbidden_words: forbiddenRaw.split(",").map((s) => s.trim()).filter(Boolean),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Lỗi lưu Brand Vault");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 skeleton h-40 max-w-3xl" />;

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>Brand Vault</h1>
          <p className="text-sm text-gray-500 mt-1">Cấu hình thương hiệu — AI agent sẽ dùng thông tin này cho mọi chiến dịch.</p>
        </div>
        <button form="brand-form" type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Đang lưu..." : saved ? "Đã lưu ✓" : "Lưu thay đổi"}
        </button>
      </div>

      <form id="brand-form" onSubmit={handleSubmit} className="space-y-6">
        <div className="card space-y-4">
          <h2 className="border-b border-gray-100 pb-2">Thông tin cơ bản</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tên thương hiệu *</label>
              <input className="input" value={form.brand_name} onChange={(e) => update("brand_name", e.target.value)} placeholder="Cafe Bờ Hồ" required />
            </div>
            <div>
              <label className="label">Tagline</label>
              <input className="input" value={form.tagline} onChange={(e) => update("tagline", e.target.value)} placeholder="Ngụm cà phê, ngàn ký ức" />
            </div>
          </div>
          <div>
            <label className="label">Mô tả thương hiệu *</label>
            <textarea className="input min-h-[80px] resize-none" value={form.brand_description} onChange={(e) => update("brand_description", e.target.value)} placeholder="Quán cà phê nhỏ ở trung tâm TP.HCM, phục vụ cà phê truyền thống..." required />
          </div>
          <div>
            <label className="label">Khách hàng mục tiêu *</label>
            <input className="input" value={form.target_audience} onChange={(e) => update("target_audience", e.target.value)} placeholder="Học sinh, sinh viên 18-25 tuổi" required />
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="border-b border-gray-100 pb-2">Giọng nói & Phong cách</h2>
          <div>
            <label className="label">Giọng văn *</label>
            <div className="flex gap-3 flex-wrap mt-1">
              {TONES.map((t) => (
                <label key={t.value} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="tone"
                    value={t.value}
                    checked={form.tone_of_voice === t.value}
                    onChange={() => update("tone_of_voice", t.value)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700">{t.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Cách xưng hô</label>
              <input className="input" value={form.preferred_salutation} onChange={(e) => update("preferred_salutation", e.target.value)} placeholder="bạn, quý khách..." />
            </div>
            <div>
              <label className="label">CTA ưa dùng</label>
              <input className="input" value={form.preferred_cta} onChange={(e) => update("preferred_cta", e.target.value)} placeholder="Ghé thăm ngay, Đặt ngay..." />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="border-b border-gray-100 pb-2">Nội dung & Giới hạn</h2>
          <div>
            <label className="label">Sản phẩm/chủ đề chính</label>
            <input className="input" value={productsRaw} onChange={(e) => setProductsRaw(e.target.value)} placeholder="Cà phê sữa đá, Bạc xỉu, Trà đào (phân cách bằng dấu phẩy)" />
            <p className="text-xs text-gray-400 mt-1">Phân cách bằng dấu phẩy</p>
          </div>
          <div>
            <label className="label">Từ cấm</label>
            <input className="input" value={forbiddenRaw} onChange={(e) => setForbiddenRaw(e.target.value)} placeholder="rẻ, bình dân, giảm sốc (phân cách bằng dấu phẩy)" />
            <p className="text-xs text-gray-400 mt-1">AI sẽ không dùng những từ này trong nội dung</p>
          </div>
          <div>
            <label className="label">Bài đăng mẫu (tham khảo phong cách)</label>
            <textarea className="input min-h-[80px] resize-none" value={form.sample_post} onChange={(e) => update("sample_post", e.target.value)} placeholder="Dán một bài đăng bạn thích để AI học theo phong cách..." />
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="border-b border-gray-100 pb-2">Nhận diện</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Logo URL</label>
              <input className="input" type="url" value={form.logo_url} onChange={(e) => update("logo_url", e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <label className="label">Màu thương hiệu</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.primary_color || "#2563EB"} onChange={(e) => update("primary_color", e.target.value)} className="h-9 w-14 cursor-pointer rounded border border-gray-200" />
                <input className="input flex-1" value={form.primary_color} onChange={(e) => update("primary_color", e.target.value)} placeholder="#2563EB" />
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
