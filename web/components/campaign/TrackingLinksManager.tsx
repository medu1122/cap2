"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { Plus, Link, Trash2, Edit2, X, ExternalLink, MousePointerClick } from "lucide-react";

interface TrackingLink {
  id: string;
  campaign_id: string;
  name: string;
  destination_url: string;
  short_code: string;
  click_count: number;
  created_at: string;
}

interface Props {
  campaignId: string;
  onLinkSelect?: (link: TrackingLink) => void;
}

export default function TrackingLinksManager({ campaignId, onLinkSelect }: Props) {
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLink, setEditingLink] = useState<TrackingLink | null>(null);
  const [form, setForm] = useState({ name: "", destination_url: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchLinks();
  }, [campaignId]);

  async function fetchLinks() {
    try {
      const res = await api.get<TrackingLink[]>(`/campaigns/${campaignId}/tracking-links`);
      setLinks(res);
    } catch (err) {
      console.error("Failed to fetch links:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.destination_url.trim()) {
      setError("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (editingLink) {
        await api.put(`/campaigns/${campaignId}/tracking-links/${editingLink.id}`, {
          name: form.name.trim(),
          destination_url: form.destination_url.trim(),
        });
      } else {
        await api.post(`/campaigns/${campaignId}/tracking-links`, {
          name: form.name.trim(),
          destination_url: form.destination_url.trim(),
        });
      }
      await fetchLinks();
      closeModal();
    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(linkId: string) {
    if (!confirm("Xóa link này?")) return;
    try {
      await api.delete(`/campaigns/${campaignId}/tracking-links/${linkId}`);
      await fetchLinks();
    } catch (err) {
      console.error("Failed to delete link:", err);
    }
  }

  function openEditModal(link: TrackingLink) {
    setEditingLink(link);
    setForm({ name: link.name, destination_url: link.destination_url });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingLink(null);
    setForm({ name: "", destination_url: "" });
    setError("");
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    alert("Đã copy!");
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-700">Links theo dõi</h3>
          <span className="text-xs text-gray-400">({links.length})</span>
        </div>
        <button
          onClick={() => {
            setForm({ name: "", destination_url: "" });
            setEditingLink(null);
            setShowModal(true);
          }}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-[#377D73] rounded-lg hover:bg-[#2d635c] transition-colors"
        >
          <Plus className="w-3 h-3" />
          Thêm link
        </button>
      </div>

      {/* Links List */}
      {loading ? (
        <div className="text-center py-4 text-sm text-gray-400">Đang tải...</div>
      ) : links.length === 0 ? (
        <div className="text-center py-6 text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">
          Chưa có link nào. Nhấn "Thêm link" để tạo.
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          {links.map((link) => (
            <div key={link.id} className="p-3 hover:bg-gray-50 transition-colors group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 truncate">{link.name}</span>
                    {onLinkSelect && (
                      <button
                        onClick={() => onLinkSelect(link)}
                        className="text-xs text-[#377D73] hover:underline flex-shrink-0"
                      >
                        Dùng cho CTA
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400 truncate max-w-[200px]" title={link.destination_url}>
                      {link.destination_url}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <code className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      /r/{link.short_code}
                    </code>
                    <button
                      onClick={() => copyToClipboard(`${baseUrl}/r/${link.short_code}`)}
                      className="text-[10px] text-gray-400 hover:text-gray-600"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Click count */}
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <MousePointerClick className="w-3 h-3" />
                    <span className="font-medium">{link.click_count || 0}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditModal(link)}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                      title="Sửa"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(link.id)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded"
                      title="Xóa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">
                {editingLink ? "Sửa link" : "Thêm link mới"}
              </h3>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <div className="p-2 text-xs text-red-600 bg-red-50 rounded-lg">{error}</div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Tên link <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="VD: Đặt phòng ngay"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#377D73]/20 focus:border-[#377D73]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  URL đích <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={form.destination_url}
                  onChange={(e) => setForm({ ...form, destination_url: e.target.value })}
                  placeholder="https://khachsandan.vn/booking"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#377D73]/20 focus:border-[#377D73]"
                />
                <p className="mt-1 text-[10px] text-gray-400">
                  URL sẽ được chuyển thành link rút gọn để theo dõi clicks
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#377D73] rounded-lg hover:bg-[#2d635c] disabled:opacity-50"
                >
                  {saving ? "Đang lưu..." : editingLink ? "Cập nhật" : "Tạo link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
