"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { Plus, Link2, Trash2, Copy, ChevronUp, MousePointerClick, Mouse, Eye } from "lucide-react";

interface TrackingLink {
  id: string;
  campaign_id: string;
  name: string;
  destination_url: string;
  short_code: string;
  click_count: number;
  link_type: string;
  created_at: string;
}

interface Props {
  campaignId: string;
}

function LinkRow({ link, onDelete, baseUrl }: {
  link: TrackingLink;
  onDelete: (id: string) => void;
  baseUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const fullUrl = `${baseUrl}/r/${link.short_code}`;

  function copyLink() {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-2 text-[11px] bg-white border border-gray-100 rounded-lg px-3 py-2">
      <MousePointerClick size={10} className="text-[#377D73] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-700 truncate">{link.name}</p>
        <p className="text-[9px] text-gray-400 truncate">{link.destination_url}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[10px] text-gray-500 font-medium">
          {link.click_count} <span className="text-gray-400">click</span>
        </span>
        <button
          onClick={copyLink}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Sao chép link"
        >
          {copied ? (
            <span className="text-[9px] text-green-600 font-medium">Đã chép!</span>
          ) : (
            <Copy size={10} className="text-gray-400" />
          )}
        </button>
        <button
          onClick={() => onDelete(link.id)}
          className="p-1 hover:bg-red-50 rounded transition-colors"
          title="Xóa"
        >
          <Trash2 size={10} className="text-gray-300 hover:text-red-500" />
        </button>
      </div>
    </div>
  );
}

export default function TrackingLinksManager({ campaignId }: Props) {
  const [emailLinks, setEmailLinks] = useState<TrackingLink[]>([]);
  const [fbLinks, setFbLinks] = useState<TrackingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEmail, setExpandedEmail] = useState(false);
  const [expandedFb, setExpandedFb] = useState(false);
  const [emailForm, setEmailForm] = useState({ name: "", destination_url: "" });
  const [fbForm, setFbForm] = useState({ name: "", destination_url: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    fetchLinks();
  }, [campaignId]);

  async function fetchLinks() {
    try {
      const res = await api.get<TrackingLink[]>(`/campaigns/${campaignId}/tracking-links`);
      setEmailLinks(res.filter((l) => l.link_type === "email_click"));
      setFbLinks(res.filter((l) => l.link_type === "facebook_post"));
    } catch {
      setEmailLinks([]);
      setFbLinks([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!emailForm.name.trim() || !emailForm.destination_url.trim()) {
      setError("Nhập đầy đủ tên và URL đích");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post(`/campaigns/${campaignId}/tracking-links`, {
        name: emailForm.name.trim(),
        destination_url: emailForm.destination_url.trim(),
        link_type: "email_click",
      });
      setEmailForm({ name: "", destination_url: "" });
      setExpandedEmail(false);
      await fetchLinks();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddFb(e: React.FormEvent) {
    e.preventDefault();
    if (!fbForm.name.trim() || !fbForm.destination_url.trim()) {
      setError("Nhập đầy đủ tên và URL đích");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post(`/campaigns/${campaignId}/tracking-links`, {
        name: fbForm.name.trim(),
        destination_url: fbForm.destination_url.trim(),
        link_type: "facebook_post",
      });
      setFbForm({ name: "", destination_url: "" });
      setExpandedFb(false);
      await fetchLinks();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
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

  if (loading) {
    return <div className="text-center py-4 text-[11px] text-gray-400">Đang tải...</div>;
  }

  const totalEmailClicks = emailLinks.reduce((s, l) => s + l.click_count, 0);
  const totalFbClicks = fbLinks.reduce((s, l) => s + l.click_count, 0);

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-[10px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
      )}

      {/* ── Link Click (Email) ── */}
      <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Mouse size={11} className="text-blue-600" />
            <span className="text-[11px] font-semibold text-blue-900">Link Click (Email)</span>
            {totalEmailClicks > 0 && (
              <span className="text-[9px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full font-medium">
                {totalEmailClicks} click
              </span>
            )}
          </div>
          <button
            onClick={() => setExpandedEmail(!expandedEmail)}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-white bg-blue-500 rounded hover:bg-blue-600 transition-colors"
          >
            {expandedEmail ? <ChevronUp size={9} /> : <Plus size={9} />}
            {expandedEmail ? "Đóng" : "Thêm"}
          </button>
        </div>

        <p className="text-[9px] text-blue-700 mb-2">
          Gắn vào nút CTA trong email. User click → đếm click.
        </p>

        {expandedEmail && (
          <form onSubmit={handleAddEmail} className="space-y-1.5 mb-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={emailForm.name}
                onChange={(e) => setEmailForm({ ...emailForm, name: e.target.value })}
                placeholder="Tên link (VD: Đặt phòng ngay)"
                className="flex-1 px-2 py-1 text-[11px] border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
              />
              <input
                type="url"
                value={emailForm.destination_url}
                onChange={(e) => setEmailForm({ ...emailForm, destination_url: e.target.value })}
                placeholder="https://trang-cua-ban.com"
                className="flex-[2] px-2 py-1 text-[11px] border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setExpandedEmail(false); setError(""); setEmailForm({ name: "", destination_url: "" }); }}
                className="px-2 py-0.5 text-[11px] text-gray-500 hover:text-gray-700">Hủy</button>
              <button type="submit" disabled={saving}
                className="px-3 py-0.5 text-[11px] font-medium text-white bg-blue-500 rounded hover:bg-blue-600 disabled:opacity-50">
                {saving ? "Đang lưu..." : "Tạo link"}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-1">
          {emailLinks.length === 0 && !expandedEmail && (
            <button onClick={() => setExpandedEmail(true)}
              className="w-full text-center py-2 text-[10px] text-blue-500 border border-dashed border-blue-200 rounded hover:bg-blue-50 transition-colors">
              + Thêm link click cho email
            </button>
          )}
          {emailLinks.map((link) => (
            <LinkRow key={link.id} link={link} onDelete={handleDelete} baseUrl={baseUrl} />
          ))}
        </div>
      </div>

      {/* ── Link Mở (Facebook Post) ── */}
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Eye size={11} className="text-indigo-600" />
            <span className="text-[11px] font-semibold text-indigo-900">Link Mở (Facebook Post)</span>
            {totalFbClicks > 0 && (
              <span className="text-[9px] text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-full font-medium">
                {totalFbClicks} lượt mở
              </span>
            )}
          </div>
          <button
            onClick={() => setExpandedFb(!expandedFb)}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-white bg-indigo-500 rounded hover:bg-indigo-600 transition-colors"
          >
            {expandedFb ? <ChevronUp size={9} /> : <Plus size={9} />}
            {expandedFb ? "Đóng" : "Thêm"}
          </button>
        </div>

        <p className="text-[9px] text-indigo-700 mb-2">
          Dán link bài đăng Facebook. Mỗi lượt mở = 1 click (đếm thủ công hoặc qua UTM).
        </p>

        {expandedFb && (
          <form onSubmit={handleAddFb} className="space-y-1.5 mb-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={fbForm.name}
                onChange={(e) => setFbForm({ ...fbForm, name: e.target.value })}
                placeholder="Tên link (VD: Post khuyến mãi T7)"
                className="flex-1 px-2 py-1 text-[11px] border border-indigo-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
              />
              <input
                type="url"
                value={fbForm.destination_url}
                onChange={(e) => setFbForm({ ...fbForm, destination_url: e.target.value })}
                placeholder="https://facebook.com/.../..."
                className="flex-[2] px-2 py-1 text-[11px] border border-indigo-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setExpandedFb(false); setError(""); setFbForm({ name: "", destination_url: "" }); }}
                className="px-2 py-0.5 text-[11px] text-gray-500 hover:text-gray-700">Hủy</button>
              <button type="submit" disabled={saving}
                className="px-3 py-0.5 text-[11px] font-medium text-white bg-indigo-500 rounded hover:bg-indigo-600 disabled:opacity-50">
                {saving ? "Đang lưu..." : "Tạo link"}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-1">
          {fbLinks.length === 0 && !expandedFb && (
            <button onClick={() => setExpandedFb(true)}
              className="w-full text-center py-2 text-[10px] text-indigo-500 border border-dashed border-indigo-200 rounded hover:bg-indigo-50 transition-colors">
              + Thêm link Facebook Post để theo dõi lượt mở
            </button>
          )}
          {fbLinks.map((link) => (
            <LinkRow key={link.id} link={link} onDelete={handleDelete} baseUrl={baseUrl} />
          ))}
        </div>
      </div>
    </div>
  );
}
