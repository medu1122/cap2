"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Loader2, X } from "lucide-react";
import { api, API_BASE, getToken } from "@/lib/api-client";
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
  contact_email?: string;
  phone?: string;
  address?: string;
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
  contact_email: "",
  phone: "",
  address: "",
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
  const [isFormOpen, setIsFormOpen] = useState(false);

  function hydrateForm(brand: Brand) {
    setForm(brand);
    setProductsRaw((brand.key_products || []).join(", "));
    setForbiddenRaw((brand.forbidden_words || []).join(", "));
  }

  function startNewBrand() {
    setForm(EMPTY);
    setProductsRaw("");
    setForbiddenRaw("");
    setError("");
    setSaved(false);
    setIsFormOpen(true);
    router.replace("/brand-vault");
  }

  function openBrandForm(brand: Brand) {
    hydrateForm(brand);
    setError("");
    setSaved(false);
    setIsFormOpen(true);
    if (brand.id) {
      router.replace(`/brand-vault?brandId=${brand.id}`);
    }
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
            setIsFormOpen(true);
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

  function formatDebug(value: unknown): string {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  async function saveBrandWithDebug(payload: Record<string, unknown>) {
    const token = getToken();
    const isUpdate = Boolean(form.id);
    const path = isUpdate ? `/brands/id/${form.id}` : "/brands";
    const url = API_BASE ? `${API_BASE}${path}` : path;

    const debugBase = {
      timestamp: new Date().toISOString(),
      method: isUpdate ? "PUT" : "POST",
      url,
      hasToken: Boolean(token),
      payload,
    };
    console.debug("[brand-vault:save:start]", debugBase);

    try {
      const res = await fetch(url, {
        method: isUpdate ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const rawText = await res.text();
      let parsed: unknown = rawText;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch {
        // keep raw text for debugging
      }

      if (!res.ok) {
        const debugErr = { ...debugBase, status: res.status, response: parsed };
        console.error("[brand-vault:save:error]", debugErr);
        const detail =
          typeof parsed === "object" && parsed && "detail" in parsed
            ? String((parsed as { detail?: string }).detail || "")
            : "";
        throw new Error(detail || `Save failed (HTTP ${res.status})`);
      }

      const debugOk = { ...debugBase, status: res.status, response: parsed };
      console.debug("[brand-vault:save:success]", debugOk);
      return parsed as Brand;
    } catch (err) {
      console.error("[brand-vault:save:fetch_error]", { ...debugBase, fetch_error: String(err) });
      throw err;
    }
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
      const savedBrand = await saveBrandWithDebug(payload);

      await loadBrands();
      hydrateForm(savedBrand);
      router.replace(`/brand-vault?brandId=${savedBrand.id}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi lưu hồ sơ thương hiệu";
      setError(`${msg}. Mở DevTools để xem log [brand-vault:save:*].`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteBrand() {
    if (!form.id) return;

    // Gọi API đếm campaign liên quan
    let campaignCount = 0;
    let campaignNames: string[] = [];
    try {
      const data = await api.get<{ count: number; campaigns: { id: string; name: string }[] }>(
        `/brands/id/${form.id}/campaigns/count`
      );
      campaignCount = data.count;
      campaignNames = data.campaigns.map((c) => c.name);
    } catch {
      // Nếu lỗi, vẫn cho xóa
    }

    // Tạo message xác nhận
    let confirmMsg = `Bạn có chắc muốn xóa thương hiệu "${form.brand_name}"?`;
    if (campaignCount > 0) {
      confirmMsg = `Thương hiệu "${form.brand_name}" có ${campaignCount} chiến dịch liên quan:\n\n${campaignNames.slice(0, 3).map((n) => `• ${n}`).join("\n")}${campaignCount > 3 ? `\n• ... và ${campaignCount - 3} chiến dịch khác` : ""}\n\nTất cả sẽ bị xóa vĩnh viễn. Tiếp tục?`;
    } else {
      confirmMsg += " Hành động này không thể hoàn tác.";
    }

    if (!window.confirm(confirmMsg)) return;

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
      setError(err instanceof Error ? err.message : "Không thể xóa thương hiệu");
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
              "Tuỳ chọn: email, SĐT, địa chỉ — backend cần migration mới nhất (xem docs/final database-overview).",
              "Khai báo sản phẩm chính và từ cấm để AI tránh dùng.",
              "Bấm Lưu để áp dụng cho các chiến dịch tạo sau đó.",
            ]}
          />
          <button type="button" className="btn-secondary" onClick={startNewBrand}>
            + Tạo hồ sơ mới
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
                        onClick={() => openBrandForm(b)}
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

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsFormOpen(false)}
            aria-label="Đóng form thương hiệu"
          />
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2>{form.id ? "Cập nhật hồ sơ thương hiệu" : "Tạo hồ sơ thương hiệu"}</h2>
              <button
                type="button"
                className="btn-secondary p-1.5"
                onClick={() => setIsFormOpen(false)}
                aria-label="Đóng"
              >
                <X size={16} />
              </button>
            </div>

            <form id="brand-form" onSubmit={handleSubmit} className="space-y-5">

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

          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs font-medium text-gray-600">
              Liên hệ và địa điểm <span className="font-normal text-gray-400">(tuỳ chọn)</span>
            </p>
            <div>
              <label className="label">Email liên hệ</label>
              <input
                type="email"
                className="input"
                value={form.contact_email ?? ""}
                onChange={(e) => update("contact_email", e.target.value)}
                placeholder="hello@thuonghieu.vn"
              />
            </div>
            <div>
              <label className="label">Số điện thoại</label>
              <input
                className="input"
                value={form.phone ?? ""}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="0901 234 567"
              />
            </div>
            <div>
              <label className="label">Địa chỉ</label>
              <textarea
                className="input min-h-[72px] resize-y text-sm"
                value={form.address ?? ""}
                onChange={(e) => update("address", e.target.value)}
                placeholder="123 Đường ABC, Quận 1, TP.HCM"
              />
            </div>
          </div>
        </div>

        {/* Phong cách viết */}
        <div className="card space-y-4">
          <div>
            <label className="label">Phong cách viết cho chiến dịch</label>
            <p className="text-xs text-gray-400 mb-2">
              Chọn giọng văn cho nội dung bài đăng, email, video của chiến dịch
            </p>
            <select
              className="input"
              value={TONES.some((t) => t.value === form.tone_of_voice) ? form.tone_of_voice : "warm"}
              onChange={(e) => update("tone_of_voice", e.target.value)}
            >
              {TONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label} — {t.hint}
                </option>
              ))}
            </select>
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
              <div className="sticky bottom-0 bg-white pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsFormOpen(false)}
                  disabled={saving}
                >
                  Đóng
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Đang lưu..." : saved ? "Đã lưu ✓" : "Lưu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
