"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import HelpDialogButton from "@/components/common/HelpDialogButton";

const TONES = [
  { value: "playful",      label: "Vui tươi",      hint: "Như trò chuyện với bạn bè" },
  { value: "professional", label: "Nghiêm túc",    hint: "Lịch sự, đáng tin cậy" },
  { value: "warm",         label: "Thân thiện",    hint: "Gần gũi, chân thành" },
  { value: "bold",         label: "Bứt phá",       hint: "Mạnh mẽ, tạo cảm giác gấp" },
  { value: "informative",  label: "Rõ ràng",       hint: "Đi thẳng vào thông tin" },
];

interface Brand {
  id?: string;
  brand_name: string;
  tagline?: string;
  brand_description: string;
  tone_of_voice: string;
  logo_url?: string;
  primary_color?: string;
  target_audience: string;
  key_products: string[];
  forbidden_words: string[];
  preferred_cta: string;
  preferred_salutation: string;
  sample_post?: string;
  updated_at?: string;
}

const EMPTY: Brand = {
  brand_name: "",
  brand_description: "",
  tone_of_voice: "warm",
  target_audience: "",
  key_products: [],
  forbidden_words: [],
  preferred_cta: "",
  preferred_salutation: "bạn",
};

export default function BrandVaultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const brandId = searchParams.get("brandId");

  const [brands, setBrands] = useState<Brand[]>([]);
  const [form, setForm] = useState<Brand>(EMPTY);
  const [productsRaw, setProductsRaw]   = useState("");
  const [forbiddenRaw, setForbiddenRaw] = useState("");
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState("");
  const [generating, setGenerating] = useState(false);

  function hydrateForm(brand: Brand) {
    setForm(brand);
    setProductsRaw((brand.key_products || []).join(", "));
    setForbiddenRaw((brand.forbidden_words || []).join(", "));
  }

  function startNewBrand() {
    setForm(EMPTY);
    setProductsRaw("");
    setForbiddenRaw("");
    router.replace("/brand-vault");
  }

  async function loadBrands() {
    const list = await api.get<Brand[]>("/brands");
    setBrands(list);
    return list;
  }

  useEffect(() => {
    loadBrands()
      .then((list) => {
        if (brandId) {
          const selected = list.find((b) => b.id === brandId);
          if (selected) {
            hydrateForm(selected);
            return;
          }
        }
        if (list.length > 0) {
          hydrateForm(list[0]);
          router.replace(`/brand-vault?brandId=${list[0].id}`);
        } else {
          startNewBrand();
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [brandId]);

  function update(key: keyof Brand, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function generateDescription() {
    if (!form.brand_name.trim()) {
      setError("Nhập tên thương hiệu trước để AI tạo mô tả.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const res = await api.post<{ description: string }>("/brands/ai-describe", {
        brand_name: form.brand_name,
      });
      update("brand_description", res.description);
    } catch {
      setError("Không thể tạo mô tả tự động. Vui lòng thử lại.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const payload = {
        ...form,
        key_products:   productsRaw.split(",").map((s) => s.trim()).filter(Boolean),
        forbidden_words: forbiddenRaw.split(",").map((s) => s.trim()).filter(Boolean),
      };

      const savedBrand = form.id
        ? await api.put<Brand>(`/brands/id/${form.id}`, payload)
        : await api.post<Brand>("/brands", payload);

      await loadBrands();
      hydrateForm(savedBrand);
      router.replace(`/brand-vault?brandId=${savedBrand.id}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Lỗi lưu hồ sơ thương hiệu");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteBrand() {
    if (!form.id) return;
    const ok = window.confirm(`Xoá thương hiệu "${form.brand_name}"? Hành động này không thể hoàn tác.`);
    if (!ok) return;

    setSaving(true);
    setError("");
    try {
      await api.delete(`/brands/id/${form.id}`);
      const list = await loadBrands();
      if (list.length > 0) {
        hydrateForm(list[0]);
        router.replace(`/brand-vault?brandId=${list[0].id}`);
      } else {
        startNewBrand();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể xoá thương hiệu");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 skeleton h-40 max-w-2xl" />;

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1>Hồ sơ thương hiệu</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý nhiều hồ sơ thương hiệu. Chọn một hồ sơ để chỉnh sửa chi tiết.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HelpDialogButton
            title="Hướng dẫn hồ sơ thương hiệu"
            summary="Hồ sơ thương hiệu giúp AI viết đúng giọng văn, thông điệp và nhóm khách hàng của bạn."
            steps={[
              "Tạo hồ sơ mới hoặc chọn hồ sơ hiện có trong danh sách.",
              "Điền đầy đủ mô tả thương hiệu, tone, khách hàng mục tiêu.",
              "Khai báo sản phẩm chính và từ cấm để AI tránh dùng.",
              "Bấm Lưu để áp dụng cho các chiến dịch tạo sau đó.",
            ]}
          />
          <button type="button" className="btn-secondary" onClick={startNewBrand}>
            + Tạo hồ sơ mới
          </button>
          <button form="brand-form" type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Đang lưu..." : saved ? "Đã lưu ✓" : "Lưu"}
          </button>
        </div>
      </div>

      <div className="card mb-5">
        <h2 className="mb-3">Danh sách thương hiệu</h2>
        {brands.length === 0 ? (
          <p className="text-sm text-gray-400">Chưa có hồ sơ thương hiệu nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-3 font-medium">Tên</th>
                  <th className="py-2 pr-3 font-medium">Tone</th>
                  <th className="py-2 pr-3 font-medium">Khách hàng mục tiêu</th>
                  <th className="py-2 pr-3 font-medium">Cập nhật</th>
                  <th className="py-2 font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b) => (
                  <tr key={b.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-3 text-gray-800 font-medium">{b.brand_name}</td>
                    <td className="py-2 pr-3 text-gray-600">{b.tone_of_voice}</td>
                    <td className="py-2 pr-3 text-gray-600 truncate max-w-[260px]">{b.target_audience || "-"}</td>
                    <td className="py-2 pr-3 text-gray-500">{b.updated_at ? new Date(b.updated_at).toLocaleDateString("vi-VN") : "-"}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => router.replace(`/brand-vault?brandId=${b.id}`)}
                        className="text-blue-600 hover:underline"
                      >
                        Xem
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <form id="brand-form" onSubmit={handleSubmit} className="space-y-5 max-w-2xl">

        {/* Thông tin cơ bản */}
        <div className="card space-y-4">
          <div>
            <label className="label">Tên thương hiệu *</label>
            <input
              className="input"
              value={form.brand_name}
              onChange={(e) => update("brand_name", e.target.value)}
              placeholder="Cafe Bờ Hồ"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Mô tả thương hiệu *</label>
              <button
                type="button"
                onClick={generateDescription}
                disabled={generating}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors"
              >
                {generating
                  ? <><Loader2 size={12} className="animate-spin" /> Đang tạo...</>
                  : <><Sparkles size={12} /> AI tạo giúp</>
                }
              </button>
            </div>
            <textarea
              className="input min-h-[80px] resize-none"
              value={form.brand_description}
              onChange={(e) => update("brand_description", e.target.value)}
              placeholder="Quán cà phê nhỏ ở trung tâm TP.HCM, phục vụ cà phê truyền thống..."
              required
            />
          </div>

          <div>
            <label className="label">Khách hàng mục tiêu</label>
            <input
              className="input"
              value={form.target_audience}
              onChange={(e) => update("target_audience", e.target.value)}
              placeholder="Học sinh, sinh viên 18-25 tuổi"
            />
          </div>
        </div>

        {/* Phong cách viết */}
        <div className="card space-y-4">
          <div>
            <label className="label">AI sẽ viết theo phong cách nào?</label>
            <p className="text-xs text-gray-400 mb-2">Ảnh hưởng trực tiếp đến cách AI "nói chuyện" trong mọi bài đăng của bạn</p>
            <div className="grid grid-cols-1 gap-2 mt-1">
              {TONES.map((t) => (
                <label
                  key={t.value}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded border cursor-pointer transition-colors ${
                    form.tone_of_voice === t.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="tone"
                    value={t.value}
                    checked={form.tone_of_voice === t.value}
                    onChange={() => update("tone_of_voice", t.value)}
                    className="accent-blue-600 shrink-0"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-800">{t.label}</span>
                    <span className="text-xs text-gray-400 ml-2">{t.hint}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Gọi khách hàng là...</label>
              <input
                className="input"
                value={form.preferred_salutation}
                onChange={(e) => update("preferred_salutation", e.target.value)}
                placeholder="bạn, quý khách, anh/chị..."
              />
            </div>
            <div>
              <label className="label">Câu kêu gọi hành động</label>
              <input
                className="input"
                value={form.preferred_cta}
                onChange={(e) => update("preferred_cta", e.target.value)}
                placeholder="Đặt ngay, Ghé thăm hôm nay..."
              />
              <p className="text-xs text-gray-400 mt-1">AI sẽ dùng câu này ở cuối bài</p>
            </div>
          </div>
        </div>

        {/* Giới hạn nội dung */}
        <div className="card space-y-4">
          <div>
            <label className="label">Sản phẩm / chủ đề chính</label>
            <input
              className="input"
              value={productsRaw}
              onChange={(e) => setProductsRaw(e.target.value)}
              placeholder="Cà phê sữa đá, Bạc xỉu, Trà đào"
            />
          </div>
          <div>
            <label className="label">Từ cấm</label>
            <input
              className="input"
              value={forbiddenRaw}
              onChange={(e) => setForbiddenRaw(e.target.value)}
              placeholder="rẻ, bình dân, giảm sốc"
            />
            <p className="text-xs text-gray-400 mt-1">AI sẽ tránh dùng những từ này</p>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {form.id && (
          <div className="pt-2">
            <button
              type="button"
              onClick={handleDeleteBrand}
              className="btn-secondary border-red-300 text-red-600 hover:bg-red-50"
              disabled={saving}
            >
              Xoá thương hiệu này
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
