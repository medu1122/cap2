"use client";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { X, Upload, DollarSign, ShoppingCart, AlertCircle } from "lucide-react";

interface RevenueUploadModalProps {
  campaignId: string;
  campaignName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

interface RevenueForm {
  revenue: string;
  orderCount: string;
  cost: string;
  notes: string;
}

export default function RevenueUploadModal({ campaignId, campaignName, onClose, onSuccess }: RevenueUploadModalProps) {
  const [form, setForm] = useState<RevenueForm>({
    revenue: "",
    orderCount: "",
    cost: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const revenue = parseFloat(form.revenue);
    const orderCount = parseInt(form.orderCount) || 0;
    const cost = parseFloat(form.cost) || 0;

    if (isNaN(revenue) || revenue < 0) {
      setError("Doanh thu phải là số không âm");
      return;
    }

    setLoading(true);
    try {
      await api.post(`/campaigns/${campaignId}/revenue`, {
        revenue,
        order_count: orderCount,
        cost,
        notes: form.notes || undefined,
        source: "manual",
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi lưu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Nhập Doanh thu</h2>
            <p className="text-sm text-gray-500 mt-0.5">{campaignName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Revenue */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Tổng doanh thu (VNĐ)
            </label>
            <div className="relative">
              <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                step="1000"
                min="0"
                placeholder="VD: 9500000"
                value={form.revenue}
                onChange={(e) => setForm({ ...form, revenue: e.target.value })}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal focus:border-teal outline-none"
                required
              />
            </div>
          </div>

          {/* Order Count */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Số đơn hàng
            </label>
            <div className="relative">
              <ShoppingCart size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                min="0"
                placeholder="VD: 8"
                value={form.orderCount}
                onChange={(e) => setForm({ ...form, orderCount: e.target.value })}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal focus:border-teal outline-none"
              />
            </div>
          </div>

          {/* Cost */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Chi phí chiến dịch (VNĐ)
              <span className="text-gray-400 font-normal ml-1">(tuỳ chọn)</span>
            </label>
            <div className="relative">
              <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                step="1000"
                min="0"
                placeholder="VD: 2500000"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal focus:border-teal outline-none"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Dùng để tính ROI</p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Ghi chú <span className="text-gray-400 font-normal">(tuỳ chọn)</span>
            </label>
            <textarea
              placeholder="VD: Khách hàng từ chiến dịch Summer Sale"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal focus:border-teal outline-none resize-none"
            />
          </div>

          {/* Upload CSV hint */}
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
            <Upload size={20} className="mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">
              Sắp có tính năng import CSV từ Shopee/Lazada/Tiki
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-[#377D73] text-white rounded-lg font-medium hover:bg-[#2d6a61] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Đang lưu..." : "Cập nhật"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
