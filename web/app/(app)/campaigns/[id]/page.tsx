"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, Loader2, ImagePlus, Upload, Wand2, Mail, CalendarDays, Trash2, Calendar,
  Target, TrendingUp, Users, Megaphone, Clock, CheckCircle2, XCircle, AlertCircle,
  Play, Pause, Send, BarChart3, Sparkles, FileText, Zap, Star, Award, Gift, Facebook, Video,
  ExternalLink, X
} from "lucide-react";
import { API_BASE, api } from "@/lib/api-client";
import { STATUS_LABELS, STATUS_COLORS, CHANNEL_LABELS, formatDate, cn } from "@/lib/utils";
import PerformanceSection from "@/components/campaign/PerformanceSection";
import RevenueUploadModal from "@/components/campaign/RevenueUploadModal";
import TrackingLinksManager from "@/components/campaign/TrackingLinksManager";
import VideoScriptContent from "@/components/campaign/VideoScriptContent";
import FacebookPostContent from "@/components/campaign/FacebookPostContent";
import { CampaignBuildingProgress } from "@/components/campaign/CampaignBuildingProgress";

import CampaignDeploymentSection from "@/components/campaign/CampaignDeploymentSection";
interface AgentLog {
  id: string;
  agent_name: string;
  step_order: number;
  channel: string | null;
  model_used: string;
  model_provider: string;
  duration_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  status: string;
  created_at: string;
  prompt_preview: string | null;
  output_preview: string | null;
}

interface ContentItem {
  id: string;
  channel: string;
  version: number;
  status: string;
  content_json: Record<string, unknown>;
  scheduled_date: string | null;
  source: string;
  created_at: string;
}

interface Campaign {
  id: string;
  campaign_name: string;
  objective: string;
  product_or_service: string;
  status: string;
  channels: string[];
  deadline: string;
  error_message: string | null;
  campaign_plan_json: Record<string, unknown> | null;
  content_items: ContentItem[];
  agent_logs: AgentLog[];
  created_at: string;
}

interface SourceContext {
  source_insight_run_id?: string;
  source_customer_segment?: string;
}

interface WorkflowCustomerList {
  id: string;
  list_name: string;
  status: string;
  total_records: number;
  valid_records: number;
}

// ── Delete Confirmation Modal ─────────────────────────────────────────────────

function DeleteConfirmModal({ campaignName, onConfirm, onCancel, deleting }: {
  campaignName: string; onConfirm: () => void; onCancel: () => void; deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 size={28} className="text-red-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Xóa chiến dịch?</h3>
          <p className="text-sm text-gray-500 mb-1">
            Bạn đang xóa chiến dịch:
          </p>
          <p className="text-sm font-semibold text-gray-800 mb-4">"{campaignName}"</p>
          <p className="text-xs text-red-500 mb-4">Hành động này không thể hoàn tác.</p>
        </div>
        <div className="flex gap-3 p-4 bg-gray-50 border-t border-gray-100">
          <button onClick={onCancel} className="flex-1 btn-secondary py-2.5 font-medium" disabled={deleting}>
            Hủy
          </button>
          <button onClick={onConfirm} className="flex-1 btn-danger py-2.5 font-medium" disabled={deleting}>
            {deleting ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Xóa"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AI Processing Banner ────────────────────────────────────────────────────────

// ── Channel Icon ────────────────────────────────────────────────────────────────

function ChannelIcon({ channel, size = 14 }: { channel: string; size?: number }) {
  switch (channel) {
    case "email":
      return <Mail size={size} className="text-blue-500" />;
    case "facebook_post":
      return <Facebook size={size} className="text-blue-600" />;
    case "video_script":
      return <Video size={size} className="text-pink-500" />;
    default:
      return <Megaphone size={size} className="text-gray-500" />;
  }
}

// ── CampaignImageCard ─────────────────────────────────────────────────────────

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <button className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors" onClick={onClose}>
        <X size={20} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

function CampaignImageCard({ campaign, onUpdated }: { campaign: Campaign; onUpdated: () => void }) {
  const [generating, setGenerating] = useState(false);
  const [genPhase, setGenPhase] = useState(0);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const [error, setError] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingIdx, setDeletingIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const plan = campaign.campaign_plan_json || {};

  // Sync images from plan
  useEffect(() => {
    const imgs = (plan.images as string[] | undefined) || [];
    const legacy = plan.image_url as string | undefined;
    setImages(imgs.length ? imgs : (legacy ? [legacy] : []));
  }, [plan]);

  const savedPrompt = plan.image_prompt_final as string | undefined;
  const lastPrompt = useRef<string | null>(null);

  const hasPendingImage = !!savedPrompt && images.length === 0 && !generating;
  const [readyAuto, setReadyAuto] = useState(false);

  useEffect(() => {
    if (hasPendingImage && !autoTriggered) {
      const t = setTimeout(() => { setAutoTriggered(true); setReadyAuto(true); }, 1500);
      return () => clearTimeout(t);
    }
  }, [hasPendingImage, autoTriggered]);

  useEffect(() => {
    if (!readyAuto) return;
    const doGenerate = async () => {
      setGenerating(true); setGenPhase(0); setError("");
      try {
        await new Promise((r) => setTimeout(r, 500)); setGenPhase(1);
        const res = await api.post<{ image_url: string; prompt_used: string }>(`/campaigns/${campaign.id}/image/generate`, {});
        lastPrompt.current = res.prompt_used;
        setGenPhase(2);
        await new Promise((r) => setTimeout(r, 500)); setGenPhase(3);
        onUpdated();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Tạo ảnh thất bại");
        setGenPhase(-1);
      } finally {
        setTimeout(() => { setGenerating(false); setGenPhase(0); setReadyAuto(false); }, 800);
      }
    };
    doGenerate();
  }, [readyAuto]);

  const handleGenerate = async () => {
    setGenerating(true); setGenPhase(0); setError("");
    try {
      await new Promise((r) => setTimeout(r, 500)); setGenPhase(1);
      const res = await api.post<{ image_url: string; prompt_used: string }>(
        `/campaigns/${campaign.id}/image/generate`,
        { ...(customPrompt ? { prompt: customPrompt } : {}) }
      );
      lastPrompt.current = res.prompt_used;
      setGenPhase(2);
      await new Promise((r) => setTimeout(r, 500)); setGenPhase(3);
      onUpdated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Tạo ảnh thất bại");
      setGenPhase(-1);
    } finally {
      setTimeout(() => { setGenerating(false); setGenPhase(0); }, 800);
    }
  };

  async function handleBulkUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true); setError("");
    try {
      const form = new FormData();
      Array.from(files).forEach((f) => form.append("files", f));
      const token = localStorage.getItem("aimap_token") || "";
      const res = await fetch(`${API_BASE || ""}/campaigns/${campaign.id}/images/bulk-upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) throw new Error("Upload thất bại");
      onUpdated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload thất bại");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete(idx: number) {
    setDeletingIdx(idx); setError("");
    try {
      const token = localStorage.getItem("aimap_token") || "";
      const res = await fetch(`${API_BASE || ""}/campaigns/${campaign.id}/images/${idx}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Xóa ảnh thất bại");
      setImages((prev) => prev.filter((_, i) => i !== idx));
      onUpdated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Xóa ảnh thất bại");
    } finally {
      setDeletingIdx(null);
    }
  }

  function handleDownload(url: string, filename: string) {
    fetch(url).then((r) => r.blob()).then((blob) => {
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
    });
  }

  const phaseLabels = autoTriggered
    ? ["Đang chuẩn bị...", "AI đang tạo ảnh bằng AI...", "Đang lưu...", "Hoàn tất!"]
    : ["Đang chuẩn bị...", "AI đang tạo ảnh...", "Đang lưu...", "Hoàn tất!"];
  const effectivePrompt = customPrompt || lastPrompt.current || savedPrompt || "";

  return (
    <>
      {lightboxSrc && <ImageLightbox src={lightboxSrc} alt="Campaign" onClose={() => setLightboxSrc(null)} />}

      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <ImagePlus size={14} className="text-[#377D73]" />
          <h3 className="text-sm font-medium text-gray-800">Ảnh</h3>
          {images.length > 0 && (
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{images.length} ảnh</span>
          )}
          <button onClick={() => setShowPrompt(!showPrompt)} className="ml-auto text-[9px] text-[#377D73] hover:underline flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            {showPrompt ? "Ẩn prompt" : "Sửa prompt"}
          </button>
        </div>

        {/* Prompt editor */}
        {showPrompt && (
          <div className="space-y-2 bg-gradient-to-r from-[#377D73]/5 to-transparent rounded-lg p-3 border border-[#377D73]/20">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-[#377D73]">Prompt tùy chỉnh</span>
              <span className="text-[9px] text-gray-400">(để trống = dùng prompt tự động)</span>
            </div>
            <textarea
              className="input text-[10px] resize-none w-full bg-white"
              rows={3}
              placeholder="Nhập mô tả cho ảnh muốn tạo..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
            />
            {effectivePrompt && effectivePrompt !== customPrompt && (
              <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-100">
                <p className="text-[9px] text-gray-500 mb-1">Prompt đang dùng:</p>
                <p className="text-[10px] text-gray-600 whitespace-pre-wrap leading-relaxed">{effectivePrompt}</p>
              </div>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {generating ? (
          <div className="relative rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-50 border border-gray-100" style={{ minHeight: 180 }}>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
              <Loader2 size={24} className="text-[#377D73] animate-spin mb-2" />
              <p className="text-xs font-medium text-gray-700">{phaseLabels[genPhase] || "Đang xử lý..."}</p>
              <div className="flex gap-1 mt-2">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={cn("w-1.5 h-1.5 rounded-full transition-all", genPhase > i ? "bg-[#377D73]" : genPhase === i ? "bg-[#377D73]/50 animate-pulse" : "bg-gray-300")} />
                ))}
              </div>
            </div>
          </div>
        ) : images.length > 0 ? (
          /* Grid nhiều ảnh */
          <div className="grid grid-cols-2 gap-2">
            {images.map((url, idx) => (
              <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Ảnh ${idx + 1}`}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setLightboxSrc(url)}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                {/* Overlay actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => setLightboxSrc(url)}
                    className="p-1.5 bg-white/90 rounded-full text-gray-700 hover:bg-white transition-colors"
                    title="Xem lớn"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDownload(url, `campaign-${idx + 1}.jpg`)}
                    className="p-1.5 bg-white/90 rounded-full text-gray-700 hover:bg-white transition-colors"
                    title="Tải về"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(idx)}
                    disabled={deletingIdx === idx}
                    className="p-1.5 bg-white/90 rounded-full text-red-500 hover:bg-white transition-colors disabled:opacity-50"
                    title="Xóa ảnh"
                  >
                    {deletingIdx === idx ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-200 rounded-lg py-6 flex flex-col items-center gap-1.5 text-center bg-gray-50">
            <ImagePlus size={20} className="text-gray-300" />
            <p className="text-xs text-gray-400">Chưa có ảnh</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button onClick={handleGenerate} disabled={generating} className={cn("btn-primary text-[11px] py-1.5 px-3 flex items-center gap-1 flex-1 justify-center", generating && "opacity-70")}>
            {generating ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
            {images.length > 0 ? "Tạo thêm ảnh" : "Tạo ảnh"}
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={generating || uploading} className={cn("btn-secondary text-[11px] py-1.5 px-3 flex items-center gap-1 flex-1 justify-center", (generating || uploading) && "opacity-50")}>
            {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
            {uploading ? "Đang upload..." : "Upload"}
          </button>
        </div>

        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleBulkUpload(e.target.files)} />

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <span className="text-[10px] text-red-600 flex-1">{error}</span>
            <button onClick={() => setError("")} className="text-red-400 hover:text-red-600">×</button>
          </div>
        )}
      </div>
    </>
  );
}

// ── ContentCard ───────────────────────────────────────────────────────────────

function ContentCard({ item, campaignId, onAction, campaignImages }: { item: ContentItem; campaignId: string; onAction: () => void; campaignImages?: string[] }) {
  const [rejectNote, setRejectNote] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [loading, setLoading] = useState(false);

  // Inline edit state
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  // Compare current content_json vs original to detect changes
  function hasChanges(): boolean {
    return JSON.stringify(draft) !== JSON.stringify(item.content_json);
  }

  function startEdit() {
    setDraft({ ...item.content_json });
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft({});
  }

  async function saveEdit() {
    if (!hasChanges()) return;
    setSaving(true);
    try {
      await api.post(`/content/${item.id}/save-edit`, draft);
      setEditing(false);
      onAction();
    } catch {
      // silent fail
    } finally {
      setSaving(false);
    }
  }

  async function approve() {
    setLoading(true);
    await api.patch(`/content/${item.id}/approve`).catch(() => {});
    onAction();
    setLoading(false);
  }

  async function reject() {
    setLoading(true);
    await api.patch(`/content/${item.id}/reject`, { rejection_note: rejectNote }).catch(() => {});
    onAction();
    setShowReject(false);
    setLoading(false);
  }

  async function regenerate() {
    setLoading(true);
    await api.post(`/content/${item.id}/regenerate`).catch(() => {});
    onAction();
    setLoading(false);
  }

  const c = item.content_json;
  const isPending = item.status === "pending_approval";

  // Draft version (when editing)
  const d = editing ? draft : c;

  return (
    <div className="bg-white rounded-lg p-3.5 space-y-2 border-l-4 border-l-[#377D73] shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChannelIcon channel={item.channel} size={12} />
          <span className="text-xs font-medium text-gray-800">{CHANNEL_LABELS[item.channel]}</span>
          <span className={cn("badge text-[10px]", STATUS_COLORS[item.status])}>{STATUS_LABELS[item.status]}</span>
        </div>
        {editing ? (
          <div className="flex gap-1">
            <button
              onClick={saveEdit}
              disabled={saving || !hasChanges()}
              className="flex items-center gap-1 text-[10px] py-0.5 px-2.5 rounded-md bg-[#377D73] text-white hover:bg-[#2d6860] disabled:opacity-40 font-medium transition-colors"
            >
              {saving ? <Loader2 size={10} className="animate-spin" /> : null}
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="btn-secondary text-[10px] py-0.5 px-2"
            >
              Hủy
            </button>
          </div>
        ) : isPending ? (
          <div className="flex gap-1">
            <button onClick={startEdit} className="btn-secondary text-[10px] py-0.5 px-2">Sửa</button>
            <button onClick={approve} disabled={loading} className="btn-primary text-[10px] py-0.5 px-2">Duyệt</button>
            <button onClick={() => setShowReject(!showReject)} className="btn-secondary text-[10px] py-0.5 px-2">Từ chối</button>
            <button onClick={regenerate} disabled={loading} className="btn-secondary text-[10px] py-0.5 px-2">Tạo lại</button>
          </div>
        ) : (
          <div className="flex gap-1">
            <button onClick={startEdit} className="btn-secondary text-[10px] py-0.5 px-2">Sửa</button>
          </div>
        )}
      </div>

      {item.channel === "facebook_post" && (
        <FacebookPostContent
          contentId={item.id}
          campaignId={campaignId}
          content={c}
          editing={editing}
          draft={draft}
          setDraft={setDraft}
          isPending={isPending}
          startEdit={startEdit}
          campaignImages={campaignImages || []}
        />
      )}

      {item.channel === "email" && (
        <div className="space-y-1">
          <div>
            <p className="text-[9px] text-gray-400 uppercase tracking-wide font-medium">
              {editing ? "Tiêu đề" : "Tiêu đề"}
            </p>
            {editing ? (
              <input
                type="text"
                className="w-full text-xs font-medium text-gray-800 border border-blue-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#377D73]/30 bg-blue-50/30 leading-snug"
                value={(d.subject as string) || ""}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                placeholder="Nhập tiêu đề email..."
              />
            ) : (
              <p
                className="text-xs font-medium text-gray-800 leading-snug cursor-text hover:bg-gray-50 rounded px-1 -mx-1 py-0.5 transition-colors"
                onClick={isPending ? undefined : startEdit}
                title={!isPending ? "Nhấn để chỉnh sửa" : undefined}
              >{c.subject as string}</p>
            )}
          </div>
          <div>
            <p className="text-[9px] text-gray-400 uppercase tracking-wide font-medium">Nội dung</p>
            {editing ? (
              <textarea
                className="w-full text-xs text-gray-600 border border-blue-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#377D73]/30 bg-blue-50/30 resize-none leading-relaxed"
                rows={6}
                value={(d.body as string) || ""}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                placeholder="Nhập nội dung email..."
              />
            ) : (
              <p
                className="text-xs text-gray-600 whitespace-pre-line leading-relaxed cursor-text hover:bg-gray-50 rounded px-1 -mx-1 py-0.5 transition-colors"
                onClick={isPending ? undefined : startEdit}
                title={!isPending ? "Nhấn để chỉnh sửa" : undefined}
              >{c.body as string}</p>
            )}
          </div>
          {(d.cta_text as string) || (d.cta_url as string) ? (
            <div className="mt-2 pt-2 border-t border-gray-100">
              {editing ? (
                <div className="space-y-1">
                  <p className="text-[9px] text-gray-400 uppercase tracking-wide font-medium mb-1">Call-to-action</p>
                  <input
                    type="text"
                    className="w-full text-xs border border-blue-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#377D73]/30 bg-blue-50/30"
                    value={(d.cta_text as string) || ""}
                    onChange={(e) => setDraft({ ...draft, cta_text: e.target.value })}
                    placeholder="Text nút bấm (VD: Nhấn vào đây)"
                  />
                  <input
                    type="url"
                    className="w-full text-xs border border-blue-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#377D73]/30 bg-blue-50/30"
                    value={(d.cta_url as string) || ""}
                    onChange={(e) => setDraft({ ...draft, cta_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center px-3 py-1.5 bg-[#377D73] text-white rounded-lg text-[11px] font-semibold shadow-sm">
                    {(c.cta_text as string) || "Nhấn vào đây"}
                  </span>
                </div>
              )}
            </div>
          ) : null}

          {/* Ảnh đính kèm */}
          {Array.isArray(c.images) && (c.images as string[]).length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-[9px] text-gray-400 uppercase tracking-wide font-medium mb-1.5">Ảnh đính kèm</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(c.images as string[]).map((url, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Ảnh ${idx + 1}`}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => window.open(url, "_blank")}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <span className="text-white opacity-0 group-hover:opacity-100 text-[9px] font-medium transition-opacity">Xem</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {item.channel === "video_script" && (
        <VideoScriptContent content={d} isPending={isPending} />
      )}

      {showReject && (
        <div className="space-y-1 pt-1.5 border-t border-gray-100">
          <textarea className="input text-[11px] resize-none w-full" rows={2} placeholder="Lý do..." value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
          <button onClick={reject} disabled={loading || !rejectNote} className="btn-danger text-[10px] py-0.5 px-2">Xác nhận</button>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function _getContentPreview(item: ContentItem): string {
  const c = item.content_json;
  if (item.channel === "facebook_post") return (c.copy as string) || "";
  if (item.channel === "email") return (c.subject as string) || "";
  if (item.channel === "video_script") {
    const hook = (c.hook as string) || "";
    return hook ? hook.slice(0, 60) : "Kịch bản cho video";
  }
  return "";
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [realtimeMessages, setRealtimeMessages] = useState<string[]>([]);
  const router = useRouter();
  const esRef = useRef<EventSource | null>(null);

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/campaigns/${id}`);
      router.push("/campaigns");
    } catch {
      alert("Xóa thất bại");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const load = useCallback(() => {
    api.get<Campaign>(`/campaigns/${id}`).then(setCampaign).catch(() => setCampaign(null));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // SSE subscription cho realtime messages
  useEffect(() => {
    if (!id || !campaign) return;
    const isProcessing = campaign.status === "running" || campaign.status === "pending_agent";
    if (!isProcessing) return;

    const es = new EventSource(`/api/internal/campaigns/${id}/stream`);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.message) {
          setRealtimeMessages((prev) => {
            const updated = [...prev, data.message];
            return updated.slice(-3); // Giữ 3 message gần nhất
          });
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // Silently reconnect
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [id, campaign?.status, campaign]);

  // Fallback polling khi SSE không khả dụng
  useEffect(() => {
    const isProcessing = campaign?.status === "running" || campaign?.status === "pending_agent";
    if (!isProcessing) return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [campaign?.status, load]);

  if (!campaign) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-teal-50/30 p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="h-14 w-64 bg-gray-200 rounded-xl animate-pulse" />
        <div className="h-24 bg-white rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3 space-y-5">
            <div className="h-48 bg-white rounded-xl animate-pulse" />
            <div className="h-64 bg-white rounded-xl animate-pulse" />
          </div>
          <div className="lg:col-span-2 space-y-5">
            <div className="h-80 bg-white rounded-xl animate-pulse" />
            <div className="h-48 bg-white rounded-xl animate-pulse" />
            <div className="h-64 bg-white rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );

  const isProcessing = campaign.status === "running" || campaign.status === "pending_agent";
  const sourceContext = (campaign.campaign_plan_json?.source_context || null) as SourceContext | null;

  return (
    <>
      {showDeleteConfirm && campaign && (
        <DeleteConfirmModal campaignName={campaign.campaign_name} onConfirm={handleDelete} onCancel={() => setShowDeleteConfirm(false)} deleting={deleting} />
      )}

      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-teal-50/30">
        <div className="p-6 max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Link href="/campaigns" className="group flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 hover:bg-[#377D73]/10 transition-all">
              <ChevronLeft size={18} className="text-gray-500 group-hover:text-[#377D73] transition-colors" />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 truncate">{campaign.campaign_name}</h1>
            </div>
            <span className={cn("badge shrink-0 text-[11px]", STATUS_COLORS[campaign.status])}>{STATUS_LABELS[campaign.status]}</span>
            {!isProcessing && !showDeleteConfirm && (
              <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all" title="Xóa chiến dịch">
                <Trash2 size={16} />
              </button>
            )}
          </div>

          {/* Brief strip - stacked layout */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 mb-6 border border-gray-100 shadow-sm">
            {/* Row 1: Mục tiêu + Hạn + Kênh */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-[#377D73]/10 rounded">
                  <Target size={12} className="text-[#377D73]" />
                </div>
                <span className="text-[11px] text-[#377D73] font-semibold">Mục tiêu</span>
                <span className="text-sm font-semibold text-gray-900">{campaign.objective}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="p-1 bg-amber-100 rounded">
                  <Clock size={12} className="text-amber-600" />
                </div>
                <span className="text-[11px] text-gray-500">Hạn</span>
                <span className="text-sm text-gray-700">{formatDate(campaign.deadline)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="p-1 bg-blue-100 rounded">
                  <Megaphone size={12} className="text-blue-600" />
                </div>
                <span className="text-[11px] text-gray-500">Kênh</span>
                <div className="flex gap-1">
                  {campaign.channels.map((ch) => (
                    <span key={ch} className="badge bg-[#377D73] text-white text-[10px]">{CHANNEL_LABELS[ch]}</span>
                  ))}
                </div>
              </div>
              {sourceContext?.source_insight_run_id && (
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-indigo-100 rounded">
                    <Sparkles size={12} className="text-indigo-600" />
                  </div>
                  <span className="text-[11px] text-gray-500">Insight</span>
                  <Link href="/insights" className="text-[#377D73] hover:underline text-[11px] font-medium">{sourceContext.source_insight_run_id.slice(0, 8)}...</Link>
                </div>
              )}
            </div>
            {/* Row 2: Sản phẩm */}
            <div className="flex items-center gap-2 pt-3">
              <div className="p-1 bg-purple-100 rounded">
                <Gift size={12} className="text-purple-600" />
              </div>
              <span className="text-[11px] text-gray-500">Sản phẩm</span>
              <span className="text-sm text-gray-700">{campaign.product_or_service}</span>
            </div>
          </div>

          {/* Inline progress bar — thời gian chạy hiển thị ngay trong form */}
          {isProcessing && (
            <div className="mb-4 space-y-2">
              <CampaignBuildingProgress
                channels={campaign.channels}
                agent_logs={campaign.agent_logs}
                campaign_plan_json={campaign.campaign_plan_json ?? undefined}
              />
              {realtimeMessages.length > 0 && (
                <div className="bg-[#377D73]/5 border border-[#377D73]/20 rounded-lg px-4 py-2">
                  <p className="text-[11px] text-[#377D73] font-medium">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#377D73] animate-pulse mr-1.5" />
                    {realtimeMessages[realtimeMessages.length - 1]}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Main 2-column grid */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* LEFT COLUMN - Content focused */}
            <div className="lg:col-span-3 space-y-5">
              {/* Lịch cụ thể */}
              <div className="bg-gradient-to-br from-[#377D73]/5 via-white to-[#377D73]/5 rounded-xl p-4 border border-[#377D73]/20 shadow-md shadow-[#377D73]/10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-[#377D73] rounded-xl shadow-lg shadow-[#377D73]/30">
                    <CalendarDays size={20} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-base font-bold text-gray-900">Lịch cụ thể</h2>
                  </div>
                  <span className="text-[10px] text-[#377D73]">→ <a href="/calendar" className="hover:underline font-medium">Lịch marketing</a></span>
                </div>
                
                {/* Loading state - khi chưa có content_items */}
                {campaign.content_items.length === 0 && isProcessing && (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="flex items-center gap-3 h-16 bg-white/60 rounded-lg border border-gray-100 animate-pulse">
                        <div className="w-14 shrink-0 bg-gray-200 rounded-lg m-3" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-gray-200 rounded w-1/3" />
                          <div className="h-2 bg-gray-100 rounded w-2/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state - khi không có content_items và không đang xử lý */}
                {campaign.content_items.length === 0 && !isProcessing && (
                  <div className="text-center py-6 text-gray-400">
                    <Calendar size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Chưa có lịch cụ thể</p>
                  </div>
                )}

                {/* Content - khi đã có content_items */}
                {campaign.content_items.length > 0 && (
                  <div className="space-y-2">
                    {campaign.content_items.slice().sort((a, b) => {
                      if (!a.scheduled_date) return 1;
                      if (!b.scheduled_date) return -1;
                      return a.scheduled_date.localeCompare(b.scheduled_date);
                    }).map((item) => (
                      <div key={item.id} className="flex items-center gap-3 text-xs bg-white/80 backdrop-blur-sm rounded-lg px-4 py-3 border border-gray-100 shadow-sm">
                        <div className="w-14 shrink-0 text-center bg-[#377D73] rounded-lg py-2 px-2 shadow-sm">
                          <p className="text-[11px] font-bold text-white">{item.scheduled_date ? _formatDateShort(item.scheduled_date) : "—"}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <ChannelIcon channel={item.channel} size={12} />
                            <span className="text-[11px] font-medium text-gray-800">{CHANNEL_LABELS[item.channel]}</span>
                            <span className={cn("badge text-[9px] shrink-0", STATUS_COLORS[item.status])}>{STATUS_LABELS[item.status]}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 truncate max-w-[200px]">{_getContentPreview(item)}</p>
                        </div>
                        {!item.scheduled_date && <span className="text-[9px] text-amber-600 shrink-0 font-semibold bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">chưa lịch</span>}
                      </div>
                    ))}
                    {campaign.content_items.some((c) => !c.scheduled_date) && (
                      <p className="text-[10px] text-[#377D73] mt-2 font-medium">Duyệt nội dung để tự đề xuất lịch.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Nội dung */}
              <div className="bg-gradient-to-br from-violet-50/50 via-white to-purple-50/30 rounded-xl p-4 border border-violet-200/50 shadow-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-200">
                    <FileText size={20} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-base font-bold text-gray-900">Nội dung</h2>
                  </div>
                  <span className="badge bg-gradient-to-r from-violet-500 to-purple-500 text-white text-[11px] shadow-sm">
                    {campaign.content_items.length > 0 ? campaign.content_items.length : (isProcessing ? "..." : "0")}
                  </span>
                </div>
                
                {/* Loading state - khi chưa có content_items */}
                {campaign.content_items.length === 0 && isProcessing && (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-20 bg-white/60 rounded-lg border border-gray-100 animate-pulse">
                        <div className="p-4 space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-1/2" />
                          <div className="h-3 bg-gray-100 rounded w-3/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state - khi không có content_items và không đang xử lý */}
                {campaign.content_items.length === 0 && !isProcessing && (
                  <div className="text-center py-6 text-gray-400">
                    <FileText size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Chưa có nội dung nào</p>
                  </div>
                )}

                {/* Content - khi đã có content_items */}
                {campaign.content_items.length > 0 && (
                  <div className="space-y-2">
                    {campaign.content_items.map((item) => (
                      <ContentCard key={item.id} item={item} campaignId={id as string} onAction={load}
                        campaignImages={(campaign.campaign_plan_json?.images as string[]) || []} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN - Actions & Stats */}
            <div className="lg:col-span-2 space-y-5">
              <CampaignDeploymentSection
                campaignId={id as string}
                channels={campaign.channels}
                contentItems={campaign.content_items}
                onNavigate={(path) => router.push(path)}
              />

              {/* Ảnh */}
              <div className="bg-gradient-to-br from-orange-50/50 via-white to-amber-50/30 rounded-xl p-4 border border-orange-200/50 shadow-md">
                <CampaignImageCard campaign={campaign} onUpdated={load} />
              </div>

              {/* Hiệu quả */}
              <div className="bg-gradient-to-br from-green-50/50 via-white to-emerald-50/30 rounded-xl p-4 border border-green-200/50 shadow-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg shadow-green-200">
                    <TrendingUp size={20} className="text-white" />
                  </div>
                  <h2 className="text-base font-bold text-gray-900">Hiệu quả</h2>
                </div>
                <PerformanceSection campaignId={id as string} onAddRevenue={() => setShowRevenueModal(true)} />
              </div>

              {/* Tracking Links */}
              <TrackingLinksManager campaignId={id as string} />
            </div>
          </div>
        </div>
      </div>

      {showRevenueModal && campaign && (
        <RevenueUploadModal campaignId={campaign.id} campaignName={campaign.campaign_name} onClose={() => setShowRevenueModal(false)} />
      )}
    </>
  );
}
