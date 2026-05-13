"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { Plus, Link2, Trash2, Copy, ExternalLink, ChevronDown, ChevronUp, MousePointerClick } from "lucide-react";

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
}

export default function TrackingLinksManager({ campaignId }: Props) {
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({ name: "", destination_url: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchLinks();
  }, [campaignId]);

  async function fetchLinks() {
    try {
      const res = await api.get<TrackingLink[]>(`/campaigns/${campaignId}/tracking-links`);
      setLinks(res);
    } catch {
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.destination_url.trim()) {
      setError("Nhập đầy đủ tên và URL đích");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post(`/campaigns/${campaignId}/tracking-links`, {
        name: form.name.trim(),
        destination_url: form.destination_url.trim(),
      });
      setForm({ name: "", destination_url: "" });
      setExpanded(false);
      await fetchLinks();
    } catch (err: any) {
      setError(err?.message || "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(linkId: string) {
    if (!confirm("Xóa link này?")) return;
    try {
      await api.delete(`/campaigns/${campaignId}/tracking-links/${linkId}`);
      await fetchLinks();
    } catch {
      // ignore
    }
  }

  function copyLink(shortCode: string) {
    const url = `${window.location.origin}/r/${shortCode}`;
    navigator.clipboard.writeText(url);
    setCopied(shortCode);
    setTimeout(() => setCopied(null), 1500);
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Link2 size={12} className="text-[#377D73]" />
          <span className="text-xs font-semibold text-gray-700">Links theo dõi</span>
          {!loading && links.length > 0 && (
            <span className="text-[10px] text-gray-400">({links.length})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {links.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-[10px] text-[#377D73] hover:underline font-medium"
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? "Ẩn" : "Thêm"}
            </button>
          )}
          {!expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-white bg-[#377D73] rounded-md hover:bg-[#2d635c] transition-colors"
            >
              <Plus size={10} />
              Thêm
            </button>
          )}
        </div>
      </div>

      {/* Inline add form */}
      {expanded && (
        <form onSubmit={handleSubmit} className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
          {error && (
            <div className="text-[10px] text-red-600 bg-red-50 px-2 py-1 rounded">{error}</div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Tên link (VD: Đặt phòng)"
              className="flex-1 px-2.5 py-1.5 text-[11px] border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#377D73]/30 focus:border-[#377D73] bg-white"
            />
            <input
              type="url"
              value={form.destination_url}
              onChange={(e) => setForm({ ...form, destination_url: e.target.value })}
              placeholder="https://..."
              className="flex-[2] px-2.5 py-1.5 text-[11px] border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#377D73]/30 focus:border-[#377D73] bg-white"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setExpanded(false); setError(""); setForm({ name: "", destination_url: "" }); }}
              className="px-3 py-1 text-[11px] text-gray-500 hover:text-gray-700"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1 text-[11px] font-medium text-white bg-[#377D73] rounded-md hover:bg-[#2d635c] disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : "Tạo"}
            </button>
          </div>
        </form>
      )}

      {/* Links list */}
      {loading ? (
        <div className="text-center py-3 text-[11px] text-gray-400">Đang tải...</div>
      ) : links.length === 0 && !expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="w-full text-center py-3 text-[11px] text-gray-400 border border-dashed border-gray-200 rounded-lg hover:border-[#377D73]/40 hover:text-[#377D73]/70 transition-colors"
        >
          + Thêm link để theo dõi clicks
        </button>
      ) : (
        <div className="space-y-1.5">
          {links.map((link) => (
            <div key={link.id} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-100 group hover:border-gray-200 transition-colors">
              {/* Icon + name */}
              <div className="w-6 h-6 rounded-md bg-[#377D73]/10 flex items-center justify-center shrink-0">
                <Link2 size={11} className="text-[#377D73]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-gray-800 truncate">{link.name}</p>
                <p className="text-[9px] text-gray-400 truncate">{link.destination_url}</p>
              </div>

              {/* Short URL */}
              <div className="shrink-0 hidden sm:flex items-center gap-1">
                <code className="text-[9px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono">
                  /r/{link.short_code}
                </code>
                <button
                  onClick={() => copyLink(link.short_code)}
                  title="Copy link"
                  className="p-1 text-gray-300 hover:text-[#377D73] transition-colors"
                >
                  {copied === link.short_code ? (
                    <span className="text-[9px] text-[#377D73] font-medium">Đã copy!</span>
                  ) : (
                    <Copy size={10} />
                  )}
                </button>
              </div>

              {/* Click count */}
              <div className="shrink-0 flex items-center gap-0.5 text-[10px] text-gray-500">
                <MousePointerClick size={10} className="text-gray-400" />
                <span className="font-semibold">{link.click_count || 0}</span>
              </div>

              {/* Delete */}
              <button
                onClick={() => handleDelete(link.id)}
                className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                title="Xóa"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
