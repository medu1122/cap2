"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, ImagePlus, Upload, Wand2, Mail, CalendarDays, Trash2, Calendar } from "lucide-react";
import { API_BASE, api } from "@/lib/api-client";
import { STATUS_LABELS, STATUS_COLORS, CHANNEL_LABELS, formatDate, cn } from "@/lib/utils";
import PerformanceSection from "@/components/campaign/PerformanceSection";
import RevenueUploadModal from "@/components/campaign/RevenueUploadModal";

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

interface ExecutionLogRow {
  id: string;
  batch_id: string;
  recipient_name: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  channel: string;
  status: string;
  opened_at: string | null;
  clicked_at: string | null;
  sent_at: string | null;
  ab_variant: string | null;
  error_message: string | null;
}

interface DeliverySummary {
  delivery: Record<string, unknown> | null;
  metrics: {
    total: number;
    sent: number;
    failed: number;
    skipped: number;
    opened: number;
    clicked: number;
    open_rate: number;
    click_rate: number;
    ab_summary: Record<string, Record<string, number>> | null;
  };
  logs: ExecutionLogRow[];
  latest_batch_id: string | null;
}

const RECIPIENT_STATUS_LABELS: Record<string, string> = {
  pending: "Đang chờ",
  sent: "Đã gửi",
  failed: "Thất bại",
  skipped_no_email: "Bỏ qua",
  skipped_no_phone: "Bỏ qua",
};

// ── AI Processing Overlay ───────────────────────────────────────────────────────

function AIProcessingOverlay({ campaign }: { campaign: Campaign }) {
  const logs = campaign.agent_logs;
  const runningLog = logs.find((l) => l.status === "running");
  let statusLabel = "Đang khởi động AI...";
  if (runningLog) {
    const ch = runningLog.channel ? ` ${CHANNEL_LABELS[runningLog.channel]}` : "";
    if (runningLog.agent_name === "strategist") statusLabel = "Strategist đang phân tích...";
    else if (runningLog.agent_name === "writer") statusLabel = `Writer đang soạn${ch}...`;
    else if (runningLog.agent_name === "critic") statusLabel = `Critic đang kiểm tra${ch}...`;
  }
  const doneCount = logs.filter((l) => l.status === "success").length;
  const phases = [
    { key: "strategist", label: "Strategist" },
    { key: "writer", label: "Writer" },
    { key: "critic", label: "Critic" },
  ];

  const getPhaseStatus = (key: string) => {
    if (logs.some((l) => l.agent_name === key && l.status === "running")) return "running";
    if (logs.some((l) => l.agent_name === key && l.status === "success")) return "done";
    return "pending";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white border border-gray-200 w-full max-w-sm mx-4 p-5 space-y-4 rounded-xl">
        <h2 className="text-center text-sm font-medium text-gray-800">{campaign.campaign_name}</h2>
        <div className="flex items-center justify-center gap-1.5">
          {phases.map((phase, idx) => {
            const status = getPhaseStatus(phase.key);
            const block = (
              <div key={phase.key} className={cn(
                "flex items-center justify-center w-20 py-2 px-2 rounded-lg border text-center",
                status === "done" && "bg-[#377D73]/10 border-[#377D73]",
                status === "running" && "bg-[#377D73]/5 border-[#377D73]/50 animate-pulse",
                status === "pending" && "bg-gray-50 border-gray-200",
              )}>
                <span className={cn(
                  "text-xs font-semibold",
                  status === "done" && "text-[#377D73]",
                  status === "running" && "text-[#377D73]",
                  status === "pending" && "text-gray-400",
                )}>{phase.label}</span>
              </div>
            );
            const sep = idx < phases.length - 1 ? (
              <div key={`s${idx}`} className={cn(
                "text-xs",
                getPhaseStatus(phases[idx].key) === "done" ? "text-[#377D73]/50" : "text-gray-200"
              )}>→</div>
            ) : null;
            return sep ? [block, sep] : [block];
          })}
        </div>
        <p className="text-center text-xs text-gray-500">{statusLabel}</p>
        <div className="flex items-center justify-center gap-1">
          {Array.from({ length: Math.max(5, doneCount) }).map((_, i) => (
            <span key={i} className={cn("w-1.5 h-1.5 rounded-full", i < doneCount ? "bg-[#377D73]" : "bg-gray-200")} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Image overlays ───────────────────────────────────────────────────────────────

function ImageGenerationOverlay({ campaignName, phase }: { campaignName: string; phase: number }) {
  const labels = ["Đang chuẩn bị...", "DALL-E đang tạo...", "Đang lưu...", "Hoàn tất!"];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-lg p-5 w-full max-w-xs mx-4 space-y-3">
        <p className="text-center text-[10px] text-gray-400 uppercase tracking-wider">Tạo ảnh AI</p>
        <h2 className="text-center text-sm font-medium text-gray-800">{campaignName}</h2>
        <div className="flex justify-center gap-1">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn(
              "w-2 h-2 rounded-full",
              phase > i ? "bg-[#377D73]" : phase === i ? "bg-[#377D73]/40 animate-pulse" : "bg-gray-200"
            )} />
          ))}
        </div>
        <p className="text-center text-xs text-gray-500">{labels[Math.min(phase, 3)]}</p>
      </div>
    </div>
  );
}

function ImageUploadOverlay({ campaignName, phase }: { campaignName: string; phase: number }) {
  const msgs = ["Đang tải lên...", "Đang lưu...", "Hoàn tất!"];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-lg p-5 w-full max-w-xs mx-4 space-y-3">
        <p className="text-center text-[10px] text-gray-400 uppercase tracking-wider">Upload ảnh</p>
        <h2 className="text-center text-sm font-medium text-gray-800">{campaignName}</h2>
        <div className="flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className={cn(
              "w-2 h-2 rounded-full",
              phase > i ? "bg-[#377D73]" : phase === i ? "bg-[#377D73]/40 animate-pulse" : "bg-gray-200"
            )} />
          ))}
        </div>
        <p className="text-center text-xs text-gray-500">{msgs[Math.min(phase, 2)]}</p>
      </div>
    </div>
  );
}

// ── CampaignImageCard ─────────────────────────────────────────────────────────

function CampaignImageCard({ campaign, onUpdated }: { campaign: Campaign; onUpdated: () => void }) {
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageGenPhase, setImageGenPhase] = useState(0);
  const [uploadPhase, setUploadPhase] = useState(0);
  const [error, setError] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const plan = campaign.campaign_plan_json || {};
  const imageUrl = plan.image_url as string | undefined;
  const savedPrompt = plan.image_prompt_final as string | undefined;

  async function handleGenerate() {
    setGenerating(true);
    setImageGenPhase(0);
    setError("");
    const t1 = setTimeout(() => setImageGenPhase(1), 400);
    try {
      const res = await api.post<{ Image_url: string; prompt_used: string }>(`/campaigns/${campaign.id}/image/generate`, {
        ...(customPrompt ? { prompt: customPrompt } : {}),
      });
      setLastPrompt(res.prompt_used);
      setImageGenPhase(2);
      await new Promise((r) => setTimeout(r, 450));
      setImageGenPhase(3);
      await new Promise((r) => setTimeout(r, 400));
      onUpdated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Tạo ảnh thất bại");
    } finally {
      clearTimeout(t1);
      setGenerating(false);
      setImageGenPhase(0);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadPhase(0);
    setError("");
    const form = new FormData();
    form.append("file", file);
    try {
      const uploadUrl = API_BASE ? `${API_BASE}/campaigns/${campaign.id}/image/upload` : `/campaigns/${campaign.id}/image/upload`;
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("aimap_token") || ""}` },
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Upload thất bại");
      }
      setUploadPhase(1);
      await new Promise((r) => setTimeout(r, 250));
      setUploadPhase(2);
      await new Promise((r) => setTimeout(r, 350));
      onUpdated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload thất bại");
    } finally {
      setUploading(false);
      setUploadPhase(0);
    }
  }

  return (
    <>
      {generating && <ImageGenerationOverlay campaignName={campaign.campaign_name} phase={imageGenPhase} />}
      {uploading && <ImageUploadOverlay campaignName={campaign.campaign_name} phase={uploadPhase} />}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ImagePlus size={14} className="text-[#377D73]" />
          <h3 className="text-sm font-medium text-gray-800">Ảnh</h3>
          {(savedPrompt || lastPrompt) && (
            <button onClick={() => setShowPrompt(!showPrompt)} className="ml-auto text-[9px] text-[#377D73] hover:underline">
              {showPrompt ? "Ẩn prompt" : "Xem prompt"}
            </button>
          )}
        </div>

        {/* Prompt display */}
        {showPrompt && (savedPrompt || lastPrompt) && (
          <div className="bg-gray-50 rounded-lg p-2 text-[10px] text-gray-500 leading-relaxed max-h-32 overflow-y-auto border border-gray-100">
            <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">Prompt đã dùng:</p>
            <p className="whitespace-pre-wrap">{lastPrompt || savedPrompt}</p>
          </div>
        )}

        {imageUrl ? (
          <img src={imageUrl} alt="Campaign" className="w-full rounded-lg border border-gray-100 bg-gray-50 object-cover" style={{ maxHeight: 200 }} />
        ) : (
          <div className="border-2 border-dashed border-gray-200 rounded-lg py-6 flex flex-col items-center gap-1.5 text-center bg-gray-50">
            <ImagePlus size={20} className="text-gray-300" />
            <p className="text-xs text-gray-400">Chưa có ảnh</p>
          </div>
        )}

        {/* Custom prompt input */}
        {showPromptInput && (
          <div className="space-y-1">
            <textarea
              className="input text-[10px] resize-none w-full"
              rows={3}
              placeholder="Nhập prompt tùy chỉnh cho ảnh..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
            />
            <p className="text-[9px] text-gray-400">Để trống = dùng prompt tự động từ nội dung campaign</p>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={handleGenerate} disabled={generating || uploading} className="btn-primary text-[11px] py-1.5 px-3 flex items-center gap-1 flex-1 justify-center">
            {generating ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
            {imageUrl ? "Tạo lại" : "Tạo ảnh"}
          </button>
          <button onClick={() => setShowPromptInput(!showPromptInput)} className={cn("btn-secondary text-[11px] py-1.5 px-2", showPromptInput && "bg-[#377D73]/10 border-[#377D73]/30")}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={generating || uploading} className="btn-secondary text-[11px] py-1.5 px-3 flex items-center gap-1 flex-1 justify-center">
            {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
            Upload
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
        {error && <p className="text-[10px] text-red-500">{error}</p>}
      </div>
    </>
  );
}

// ── ContentCard ───────────────────────────────────────────────────────────────

function ContentCard({ item, onAction }: { item: ContentItem; onAction: () => void }) {
  const [rejectNote, setRejectNote] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="bg-white rounded-lg p-3.5 space-y-2 border-l-4 border-l-[#377D73] shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-800">{CHANNEL_LABELS[item.channel]}</span>
          <span className={cn("badge text-[10px]", STATUS_COLORS[item.status])}>{STATUS_LABELS[item.status]}</span>
        </div>
        {item.status === "pending_approval" && (
          <div className="flex gap-1">
            <button onClick={approve} disabled={loading} className="btn-primary text-[10px] py-0.5 px-2">Duyệt</button>
            <button onClick={() => setShowReject(!showReject)} className="btn-secondary text-[10px] py-0.5 px-2">Từ chối</button>
            <button onClick={regenerate} disabled={loading} className="btn-secondary text-[10px] py-0.5 px-2">Tạo lại</button>
          </div>
        )}
      </div>

      {item.channel === "facebook_post" && (
        <div>
          <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">{c.copy as string}</p>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5">
            {(c.hashtags as string[] || []).map((h: string) => (
              <span key={h} className="text-[10px] text-[#377D73]">#{h.replace("#", "")}</span>
            ))}
          </div>
        </div>
      )}

      {item.channel === "email" && (
        <div className="space-y-1">
          <div>
            <p className="text-[9px] text-gray-400 uppercase tracking-wide font-medium">Tiêu đề</p>
            <p className="text-xs font-medium text-gray-800 leading-snug">{c.subject as string}</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-400 uppercase tracking-wide font-medium">Nội dung</p>
            <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">{c.body as string}</p>
          </div>
        </div>
      )}

      {item.channel === "video_script" && (
        <div className="space-y-1">
          {["hook", "body", "cta"].map((k) => (
            <div key={k}>
              <p className="text-[9px] text-gray-400 uppercase tracking-wide font-medium">{k === "hook" ? "Mở đầu" : k === "body" ? "Nội dung" : "CTA"}</p>
              <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">{c[k] as string}</p>
            </div>
          ))}
        </div>
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
    return hook ? hook.slice(0, 60) : "Kịch bản video";
  }
  return "";
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [customerLists, setCustomerLists] = useState<WorkflowCustomerList[]>([]);
  const [deliverySummary, setDeliverySummary] = useState<DeliverySummary | null>(null);
  const [listId, setListId] = useState("");
  const [execBusy, setExecBusy] = useState(false);
  const [execError, setExecError] = useState("");
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [autoSchedule, setAutoSchedule] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState("");
  const router = useRouter();

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

  async function handleScheduleToggle() {
    if (!id) return;
    setScheduling(true);
    setScheduleMsg("");
    try {
      await api.post(`/campaigns/${id}/schedule-auto`, { enabled: !autoSchedule });
      setAutoSchedule(!autoSchedule);
      setScheduleMsg(!autoSchedule ? "Đã bật gửi tự động" : "Đã tắt gửi tự động");
    } catch {
      setScheduleMsg("Lỗi khi cập nhật");
    } finally {
      setScheduling(false);
    }
  }

  const load = useCallback(() => {
    api.get<Campaign>(`/campaigns/${id}`).then(setCampaign).finally(() => setLoading(false));
  }, [id]);

  const loadDelivery = useCallback(() => {
    if (!id) return;
    api.get<DeliverySummary>(`/campaigns/${id}/delivery-summary`).then(setDeliverySummary).catch(() => setDeliverySummary(null));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const isProc = campaign?.status === "running" || campaign?.status === "pending_agent";
    if (isProc) return;
    api.get<WorkflowCustomerList[]>("/workflow/customer-lists").then(setCustomerLists).catch(() => setCustomerLists([]));
  }, [campaign?.status]);

  useEffect(() => {
    const isProc = campaign?.status === "running" || campaign?.status === "pending_agent";
    if (isProc) return;
    loadDelivery();
  }, [campaign?.status, loadDelivery]);

  const deliveryState = deliverySummary?.delivery as { status?: string; mode?: string; sms_preview?: string; last_error?: string } | undefined;
  const sendingDelivery = deliveryState?.status === "sending";

  useEffect(() => {
    if (!sendingDelivery) return;
    const t = setInterval(loadDelivery, 2000);
    return () => clearInterval(t);
  }, [sendingDelivery, loadDelivery]);

  useEffect(() => {
    if (!listId && customerLists.length > 0) setListId(customerLists[0].id);
  }, [customerLists, listId]);

  useEffect(() => {
    const isProcessing = campaign?.status === "running" || campaign?.status === "pending_agent";
    if (!isProcessing) return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [campaign?.status, load]);

  if (loading && !campaign) return <div className="p-6 skeleton h-40 max-w-6xl mx-auto" />;
  if (!campaign) return <div className="p-6 text-sm text-gray-400">Không tìm thấy chiến dịch.</div>;

  const isProcessing = campaign.status === "running" || campaign.status === "pending_agent";
  const sourceContext = (campaign.campaign_plan_json?.source_context || null) as SourceContext | null;
  const hasEmailChannel = campaign.channels.includes("email");

  async function runCampaignExecution() {
    if (!id || !listId) { setExecError("Chọn danh sách."); return; }
    setExecError("");
    setExecBusy(true);
    try {
      await api.post(`/campaigns/${id}/execute`, { mode: "email", customer_list_id: listId, ab_test: false });
      window.open(`/campaigns/${id}/sending`, "_blank");
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Không thể chạy.";
      setExecError(msg);
    } finally {
      setExecBusy(false);
    }
  }

  return (
    <>
      {isProcessing && <AIProcessingOverlay campaign={campaign} />}

      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-teal-50/30">
        <div className="p-6 max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Link href="/campaigns" className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100">
              <ChevronLeft size={18} />
            </Link>
            <h1 className="flex-1 text-xl font-bold text-gray-900 truncate">{campaign.campaign_name}</h1>
            <span className={cn("badge shrink-0 text-[11px]", STATUS_COLORS[campaign.status])}>{STATUS_LABELS[campaign.status]}</span>
            {isProcessing && <Loader2 size={14} className="text-[#377D73] animate-spin shrink-0" />}
            {!isProcessing && !showDeleteConfirm && (
              <button onClick={() => setShowDeleteConfirm(true)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded hover:bg-red-50" title="Xóa">
                <Trash2 size={14} />
              </button>
            )}
            {showDeleteConfirm && (
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1">
                <span className="text-[11px] text-red-700">Xóa?</span>
                <button onClick={handleDelete} disabled={deleting} className="btn-danger text-[11px] py-0.5 px-1.5">{deleting ? "..." : "Xóa"}</button>
                <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary text-[11px] py-0.5 px-1.5">Hủy</button>
              </div>
            )}
          </div>

          {/* Brief strip */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-6 pb-5 border-b-2 border-[#377D73]/20">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#377D73] font-medium">Mục tiêu</span>
              <span className="text-sm font-semibold text-gray-900">{campaign.objective}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500">Sản phẩm</span>
              <span className="text-sm text-gray-700">{campaign.product_or_service}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500">Hạn</span>
              <span className="text-sm text-gray-700">{formatDate(campaign.deadline)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500">Kênh</span>
              <div className="flex gap-1">
                {campaign.channels.map((ch) => (
                  <span key={ch} className="badge bg-[#377D73] text-white text-[11px]">{CHANNEL_LABELS[ch]}</span>
                ))}
              </div>
            </div>
            {sourceContext?.source_insight_run_id && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500">Insight</span>
                <Link href="/insights" className="text-[#377D73] hover:underline text-[11px] font-medium">{sourceContext.source_insight_run_id.slice(0, 8)}...</Link>
              </div>
            )}
          </div>

          {/* Main 2-column grid */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* LEFT COLUMN - Content focused */}
            <div className="lg:col-span-3 space-y-5">
              {/* Lịch đăng */}
              {campaign.content_items.length > 0 && (
                <div className="bg-gradient-to-br from-[#377D73]/5 via-white to-[#377D73]/5 rounded-xl p-4 border border-[#377D73]/20 shadow-md shadow-[#377D73]/10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-[#377D73]/10 rounded-lg">
                      <CalendarDays size={16} className="text-[#377D73]" />
                    </div>
                    <h2 className="text-base font-bold text-gray-900">Lịch đăng</h2>
                    <span className="ml-auto text-[10px] text-[#377D73]">→ <a href="/calendar" className="hover:underline font-medium">Lịch marketing</a></span>
                  </div>
                  <div className="space-y-2">
                    {campaign.content_items.slice().sort((a, b) => {
                      if (!a.scheduled_date) return 1;
                      if (!b.scheduled_date) return -1;
                      return a.scheduled_date.localeCompare(b.scheduled_date);
                    }).map((item) => (
                      <div key={item.id} className="flex items-center gap-3 text-xs bg-white/80 backdrop-blur-sm rounded-lg px-4 py-3 border border-gray-100 shadow-sm">
                        <div className="w-14 shrink-0 text-center bg-[#377D73]/10 rounded-lg py-1.5 px-2">
                          <p className="text-[11px] font-bold text-[#377D73]">{item.scheduled_date ? _formatDateShort(item.scheduled_date) : "—"}</p>
                        </div>
                        <span className="badge bg-blue-500 text-white text-[10px] shrink-0">{CHANNEL_LABELS[item.channel]}</span>
                        <span className={cn("badge text-[10px] shrink-0", STATUS_COLORS[item.status])}>{STATUS_LABELS[item.status]}</span>
                        <p className="text-gray-600 truncate flex-1 min-w-0 text-[11px] font-medium">{_getContentPreview(item)}</p>
                        {!item.scheduled_date && <span className="text-[9px] text-amber-600 shrink-0 font-medium bg-amber-50 px-2 py-0.5 rounded">chưa lịch</span>}
                      </div>
                    ))}
                  </div>
                  {campaign.content_items.some((c) => !c.scheduled_date) && (
                    <p className="text-[10px] text-[#377D73] mt-2 font-medium">Duyệt nội dung để tự đề xuất lịch.</p>
                  )}
                </div>
              )}

              {/* Nội dung */}
              {campaign.content_items.length > 0 && (
                <div className="bg-gradient-to-br from-purple-50/50 via-white to-purple-50/30 rounded-xl p-4 border border-purple-200/50 shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-purple-100 rounded-lg">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h2 className="text-base font-bold text-gray-900">Nội dung</h2>
                    <span className="badge bg-purple-500 text-white text-[11px]">{campaign.content_items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {campaign.content_items.map((item) => (
                      <ContentCard key={item.id} item={item} onAction={load} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN - Actions & Stats */}
            <div className="lg:col-span-2 space-y-5">
              {/* Triển khai */}
              {!isProcessing && (
                <div className="bg-gradient-to-br from-blue-50/50 via-white to-blue-50/30 rounded-xl p-4 border border-blue-200/50 shadow-md">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-blue-100 rounded-lg">
                      <Mail size={16} className="text-blue-600" />
                    </div>
                    <h2 className="text-base font-bold text-gray-900">Triển khai</h2>
                  </div>

                  {/* Metrics */}
                  {deliverySummary && deliverySummary.metrics.total > 0 ? (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-white rounded-xl p-4 text-center border-2 border-gray-100 shadow-sm">
                        <p className="text-2xl font-bold text-gray-900">{deliverySummary.metrics.total}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Tổng</p>
                      </div>
                      <div className="bg-gradient-to-br from-[#377D73] to-[#2d6a61] rounded-xl p-4 text-center shadow-lg shadow-[#377D73]/30">
                        <p className="text-2xl font-bold text-white">{deliverySummary.metrics.sent}</p>
                        <p className="text-[10px] text-white/80 uppercase tracking-wider font-semibold">Đã gửi</p>
                      </div>
                      <div className="bg-white rounded-xl p-4 text-center border-2 border-gray-100 shadow-sm">
                        <p className="text-xl font-bold text-blue-600">{deliverySummary.metrics.opened}</p>
                        <p className="text-[10px] text-gray-500">{deliverySummary.metrics.open_rate}% mở</p>
                      </div>
                      <div className="bg-white rounded-xl p-4 text-center border-2 border-gray-100 shadow-sm">
                        <p className="text-xl font-bold text-indigo-600">{deliverySummary.metrics.clicked}</p>
                        <p className="text-[10px] text-gray-500">{deliverySummary.metrics.click_rate}% click</p>
                      </div>
                    </div>
                  ) : null}

                  {/* Logs table */}
                  {deliverySummary && deliverySummary.logs.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-blue-100/50 mb-4 bg-white shadow-sm">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="bg-blue-50/50 text-left text-gray-600">
                            <th className="p-3 font-bold">Tên</th>
                            <th className="p-3 font-bold">Liên hệ</th>
                            <th className="p-3 font-bold">Trạng thái</th>
                            <th className="p-3 font-bold text-center">Mở</th>
                            <th className="p-3 font-bold text-center">Click</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deliverySummary.logs.map((row) => (
                            <tr key={row.id} className="border-t border-gray-100 hover:bg-blue-50/30 transition-colors">
                              <td className="p-3 font-medium text-gray-900">{row.recipient_name ?? "—"}</td>
                              <td className="p-3 text-gray-600 truncate max-w-[80px]">{row.channel === "sms_simulated" ? row.recipient_phone ?? "—" : row.recipient_email ?? "—"}</td>
                              <td className="p-3">
                                <span className={cn(
                                  "badge text-[9px] font-semibold",
                                  row.status === "sent" && "bg-[#377D73] text-white",
                                  row.status === "failed" && "bg-red-100 text-red-700",
                                  row.status === "pending" && "bg-amber-100 text-amber-700",
                                  (row.status === "skipped_no_email" || row.status === "skipped_no_phone") && "bg-gray-100 text-gray-600",
                                )}>
                                  {RECIPIENT_STATUS_LABELS[row.status] ?? row.status}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                {row.opened_at ? <span className="text-[#377D73] font-bold">✓</span> : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="p-3 text-center">
                                {row.clicked_at ? <span className="text-[#377D73] font-bold">✓</span> : <span className="text-gray-300">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  {/* Execute form */}
                  <div className="space-y-3 bg-white/60 rounded-xl p-4 border border-blue-100/50">
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-gray-600 font-semibold w-20 shrink-0">Danh sách</label>
                      <select className="input text-[11px] flex-1 bg-white" value={listId} onChange={(e) => setListId(e.target.value)}>
                        {customerLists.length === 0 ? (
                          <option value="">Chưa có danh sách</option>
                        ) : customerLists.map((l) => (
                          <option key={l.id} value={l.id}>{l.list_name}</option>
                        ))}
                      </select>
                    </div>

                    {!hasEmailChannel && <p className="text-[10px] text-amber-600 font-medium">Chiến dịch chưa gồm kênh Email.</p>}

                    <div className="flex items-center gap-2">
                      <div className="w-20 shrink-0" />
                      <button type="button" onClick={runCampaignExecution} disabled={execBusy || sendingDelivery || !listId || !hasEmailChannel}
                        className="btn-primary text-[12px] py-2 px-5 font-semibold shadow-lg shadow-[#377D73]/30">
                        {execBusy || sendingDelivery ? <Loader2 size={12} className="animate-spin" /> : null}
                        Chạy chiến dịch
                      </button>
                      {execError && <span className="text-[10px] text-red-500 font-medium">{execError}</span>}
                    </div>

                    {/* Auto schedule */}
                    <div className="flex items-center justify-between pt-3 border-t border-blue-100/50">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-amber-100 rounded-lg">
                          <Calendar size={14} className="text-amber-600" />
                        </div>
                        <span className="text-[12px] text-gray-700 font-semibold">Gửi tự động</span>
                      </div>
                      <button onClick={handleScheduleToggle} disabled={scheduling || !hasEmailChannel}
                        className={cn("relative w-11 h-6 rounded-full transition-all duration-300 shadow-inner",
                          autoSchedule ? "bg-[#377D73]" : "bg-gray-300",
                          (!hasEmailChannel || scheduling) && "opacity-50"
                        )}
                      >
                        <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-lg transition-all duration-300", autoSchedule && "translate-x-5")} />
                      </button>
                    </div>
                    {scheduleMsg && <p className="text-[10px] text-[#377D73] font-semibold text-right">{scheduleMsg}</p>}
                  </div>
                </div>
              )}

              {/* Ảnh */}
              {!isProcessing && (
                <div className="bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30 rounded-xl p-4 border border-orange-200/50 shadow-md">
                  <CampaignImageCard campaign={campaign} onUpdated={load} />
                </div>
              )}

              {/* Hiệu quả */}
              {!isProcessing && (
                <div className="bg-gradient-to-br from-green-50/50 via-white to-green-50/30 rounded-xl p-4 border border-green-200/50 shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-green-100 rounded-lg">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <h2 className="text-base font-bold text-gray-900">Hiệu quả</h2>
                  </div>
                  <PerformanceSection campaignId={id as string} onAddRevenue={() => setShowRevenueModal(true)} />
                </div>
              )}
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
