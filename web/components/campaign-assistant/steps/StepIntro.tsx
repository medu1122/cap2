"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

interface BrandOption {
  id: string;
  brand_name: string;
}

interface Props {
  brandId: string;
  onBrandChange: (id: string) => void;
  onNext: () => void;
}

export default function StepIntro({ brandId, onBrandChange, onNext }: Props) {
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<BrandOption[]>("/brands")
      .then((list) => {
        setBrands(list);
        if (list.length > 0 && !brandId) {
          onBrandChange(list[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
          <span className="text-3xl">⚡</span>
        </div>
        <h3 className="text-xl font-semibold text-gray-900">Chào bạn!</h3>
        <p className="text-gray-600 text-sm">
          Tôi sẽ giúp bạn tìm ý tưởng chiến dịch marketing phù hợp với thương hiệu.
          <br />
          Hãy chọn thương hiệu bạn muốn chạy chiến dịch.
        </p>
      </div>

      <div className="space-y-2">
        <label className="label">Thương hiệu</label>
        {loading ? (
          <div className="h-12 bg-gray-100 rounded animate-pulse" />
        ) : brands.length === 0 ? (
          <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg text-sm text-amber-800">
            Bạn chưa có hồ sơ thương hiệu nào.{" "}
            <a href="/brand-vault" className="underline font-medium">Tạo ngay →</a>
          </div>
        ) : (
          <select
            className="input"
            value={brandId}
            onChange={(e) => onBrandChange(e.target.value)}
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.brand_name}
              </option>
            ))}
          </select>
        )}
      </div>

      <button
        onClick={onNext}
        disabled={!brandId || brands.length === 0}
        className="w-full btn-primary py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Bắt đầu gợi ý
      </button>
    </div>
  );
}
