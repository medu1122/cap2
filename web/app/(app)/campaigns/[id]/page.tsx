"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Check, Loader2, Clock, AlertCircle, ImagePlus, Upload, Wand2 } from "lucide-react";
import { API_BASE, api } from "@/lib/api-client";
import { STATUS_LABELS, STATUS_COLORS, CHANNEL_LABELS, formatDate, cn } from "@/lib/utils";
import HelpDialogButton from "@/components/common/HelpDialogButton";

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

// ── Progress model ────────────────────────────────────────────────────────────

type StepStatus = "pending" | "running" | "done" | "failed";

interface PipelineStep {
  key: string;
  label: string;
  agentName: string;
  channel: string | null;
  status: StepStatus;
  model?: string;
  durationMs?: number | null;
}

const AGENT_LABELS: Record<string, string> = {
  strategist: "Strategist",
  writer: "Writer",
  critic: "Critic",
};

function buildPipelineSteps(campaign: Campaign): PipelineStep[] {
  const channels = campaign.channels;

  const expected: { key: string; label: string; agentName: string; channel: string | null }[] = [
    {
      key: "strategist",
      label: "Strategist — Phân tích input & lên kế hoạch",
      agentName: "strategist",
      channel: null,
    },
    ...channels.flatMap((ch) => [
      {
        key: `writer_${ch}`,
        label: `Writer — ${CHANNEL_LABELS[ch] ?? ch}`,
        agentName: "writer",
        channel: ch,
      },
      {
        key: `critic_${ch}`,
        label: `Critic — ${CHANNEL_LABELS[ch] ?? ch}`,
        agentName: "critic",
        channel: ch,
      },
    ]),
  ];

  return expected.map((exp) => {
    const successLog = campaign.agent_logs.find(
      (l) => l.agent_name === exp.agentName && l.channel === exp.channel && l.status === "success"
    );
    const runningLog = campaign.agent_logs.find(
      (l) => l.agent_name === exp.agentName && l.channel === exp.channel && l.status === "running"
    );
    const failedLog = campaign.agent_logs.find(
      (l) => l.agent_name === exp.agentName && l.channel === exp.channel && l.status === "failed"
    );

    let status: StepStatus = "pending";
    if (failedLog) status = "failed";
    else if (successLog) status = "done";
    else if (runningLog) status = "running";

    return {
      ...exp,
      status,
      model: successLog?.model_used,
      durationMs: successLog?.duration_ms,
    };
  });
}

// ── AIPipelineProgress component ──────────────────────────────────────────────

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done")
    return <Check size={13} className="text-green-600" />;
  if (status === "running")
    return <Loader2 size={13} className="text-blue-500 animate-spin" />;
  if (status === "failed")
    return <AlertCircle size={13} className="text-red-500" />;
  return <span className="w-3 h-3 rounded-full border border-gray-300 inline-block" />;
}

function AIPipelineProgress({ campaign }: { campaign: Campaign }) {
  const steps = buildPipelineSteps(campaign);
  const doneCount = steps.filter((s) => s.status === "done").length;
  const totalCount = steps.length;
  const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const currentStep = steps.find((s) => s.status === "running");
  const isActive = campaign.status === "running" || campaign.status === "pending_agent";

  return (
    <div className="card border-blue-100 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Chi tiết các bước</h2>
        <span className="text-xs text-gray-400 tabular-nums">
          {doneCount}/{totalCount} bước
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn(
            "absolute left-0 top-0 h-full rounded-full transition-all duration-500",
            isActive ? "bg-blue-500" : percent === 100 ? "bg-green-500" : "bg-gray-400"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Current step label */}
      {currentStep && (
        <p className="text-xs text-blue-600 flex items-center gap-1.5">
          <Loader2 size={11} className="animate-spin shrink-0" />
          <span>
            <strong>{AGENT_LABELS[currentStep.agentName] ?? currentStep.agentName}</strong>
            {currentStep.channel ? ` đang xử lý ${CHANNEL_LABELS[currentStep.channel] ?? currentStep.channel}` : " đang phân tích input"}
            <span className="animate-pulse">...</span>
          </span>
        </p>
      )}

      {campaign.status === "pending_agent" && !currentStep && (
        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <Loader2 size={11} className="animate-spin shrink-0" />
          Đang khởi động AI Pipeline...
        </p>
      )}

      {/* Step list */}
      <div className="space-y-0">
        {steps.map((step, idx) => (
          <div key={step.key} className="flex items-start gap-3 py-2">
            {/* Icon + connector */}
            <div className="flex flex-col items-center shrink-0 mt-0.5">
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center",
                step.status === "done" ? "bg-green-50" :
                step.status === "running" ? "bg-blue-50" :
                step.status === "failed" ? "bg-red-50" : "bg-gray-50"
              )}>
                <StepIcon status={step.status} />
              </div>
              {idx < steps.length - 1 && (
                <div className={cn(
                  "w-px flex-1 mt-1",
                  step.status === "done" ? "bg-green-200" : "bg-gray-100"
                )} style={{ minHeight: 12 }} />
              )}
            </div>

            {/* Label + meta */}
            <div className="flex-1 min-w-0 pb-1">
              <p className={cn(
                "text-xs font-medium leading-5",
                step.status === "done" ? "text-gray-700" :
                step.status === "running" ? "text-blue-700" :
                step.status === "failed" ? "text-red-600" : "text-gray-400"
              )}>
                {step.label}
              </p>
              {step.status === "done" && (step.model || step.durationMs) && (
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {step.model && step.model !== "pending" && (
                    <span className={cn(
                      "text-xs",
                      step.model.includes("qwen") ? "text-emerald-600" : "text-gray-400"
                    )}>{step.model}</span>
                  )}
                  {step.durationMs && (
                    <span className="text-xs text-gray-300 flex items-center gap-0.5">
                      <Clock size={9} />
                      {step.durationMs < 1000
                        ? `${step.durationMs}ms`
                        : `${(step.durationMs / 1000).toFixed(1)}s`}
                    </span>
                  )}
                </div>
              )}
              {step.status === "running" && (
                <p className="text-xs text-blue-400 mt-0.5">Đang gọi LLM...</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {campaign.status === "failed" && campaign.error_message && (
        <div className="rounded-md bg-red-50 border border-red-100 p-2.5">
          <p className="text-xs text-red-600 font-medium mb-0.5">Pipeline thất bại</p>
          <p className="text-xs text-red-500 break-words">{campaign.error_message}</p>
        </div>
      )}
    </div>
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
    <div className="border border-gray-200 rounded-md p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{CHANNEL_LABELS[item.channel]}</span>
          <span className={cn("badge", STATUS_COLORS[item.status])}>{STATUS_LABELS[item.status]}</span>
          {item.source === "user_edit" && <span className="badge bg-gray-100 text-gray-500">Đã chỉnh sửa</span>}
        </div>
        {item.status === "pending_approval" && (
          <div className="flex flex-wrap gap-2">
            <button onClick={approve} disabled={loading} className="btn-primary text-xs py-1 px-3">Duyệt</button>
            <button onClick={() => setShowReject(!showReject)} className="btn-danger text-xs py-1 px-3">Từ chối</button>
            <button
              type="button"
              onClick={regenerate}
              disabled={loading}
              className="btn-secondary text-xs py-1 px-3"
            >
              Tạo lại
            </button>
          </div>
        )}
      </div>

      {item.channel === "facebook_post" && (
        <div>
          <p className="text-sm text-gray-700 whitespace-pre-line">{c.copy as string}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {(c.hashtags as string[] || []).map((h: string) => (
              <span key={h} className="text-xs text-blue-600">#{h.replace("#", "")}</span>
            ))}
          </div>
        </div>
      )}

      {item.channel === "email" && (
        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium mb-1">Tiêu đề</p>
            <p className="text-sm font-medium text-gray-900">{c.subject as string}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium mb-1">Nội dung</p>
            <p className="text-sm text-gray-700 whitespace-pre-line">{c.body as string}</p>
          </div>
        </div>
      )}

      {item.channel === "video_script" && (
        <div className="space-y-2">
          {["hook", "body", "cta"].map((k) => (
            <div key={k}>
              <p className="text-xs text-gray-500 uppercase font-medium mb-1">{k === "hook" ? "Mở đầu" : k === "body" ? "Nội dung" : "CTA"}</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{c[k] as string}</p>
            </div>
          ))}
          {typeof c.duration_estimate === "string" && (
            <p className="text-xs text-gray-400">Thời lượng ước tính: {c.duration_estimate}</p>
          )}
        </div>
      )}

      {showReject && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <textarea
            className="input text-sm resize-none"
            rows={2}
            placeholder="Lý do từ chối..."
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
          />
          <button onClick={reject} disabled={loading || !rejectNote} className="btn-danger text-xs py-1 px-3">Xác nhận từ chối</button>
        </div>
      )}
    </div>
  );
}

// ── PipelineOverlay (floating modal while AI runs) ────────────────────────────

const PHASE_CONFIG = [
  {
    key: "strategist",
    label: "Strategist",
    sublabel: "Phân tích input",
    activeClasses: "bg-indigo-50 border-indigo-500",
    textClass: "text-indigo-800",
  },
  {
    key: "writer",
    label: "Writer",
    sublabel: "Soạn nội dung",
    activeClasses: "bg-emerald-50 border-emerald-500",
    textClass: "text-emerald-800",
  },
  {
    key: "critic",
    label: "Critic",
    sublabel: "Kiểm tra chất lượng",
    activeClasses: "bg-amber-50 border-amber-500",
    textClass: "text-amber-800",
  },
] as const;

function PipelineOverlay({ campaign }: { campaign: Campaign }) {
  const logs = campaign.agent_logs;

  const phaseStatus = (name: string) => {
    if (logs.some((l) => l.agent_name === name && l.status === "running")) return "running";
    if (logs.some((l) => l.agent_name === name && l.status === "success")) return "done";
    return "pending";
  };

  const runningLog = logs.find((l) => l.status === "running");
  let statusLabel = "Đang khởi động AI Pipeline...";
  if (runningLog) {
    const ch = runningLog.channel ? ` ${CHANNEL_LABELS[runningLog.channel] || runningLog.channel}` : "";
    if (runningLog.agent_name === "strategist") statusLabel = "Strategist đang phân tích input & lập kế hoạch...";
    else if (runningLog.agent_name === "writer") statusLabel = `Writer đang soạn nội dung${ch}...`;
    else if (runningLog.agent_name === "critic") statusLabel = `Critic đang kiểm tra chất lượng${ch}...`;
    else if (runningLog.agent_name === "image_prompt_qwen") statusLabel = "Qwen đang tạo prompt hình ảnh...";
    else if (runningLog.agent_name === "image_prompt_refiner") statusLabel = "GPT đang tinh chỉnh prompt hình ảnh...";
    else statusLabel = `${runningLog.agent_name} đang chạy...`;
  }

  const doneCount = logs.filter((l) => l.status === "success").length;
  const allSteps = campaign.channels.length * 2 + 1; // strategist + writer*n + critic*n

  const phases = PHASE_CONFIG.map((p) => ({
    ...p,
    status: phaseStatus(p.key) as "pending" | "running" | "done",
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white border border-gray-200 w-full max-w-lg mx-4 p-6 space-y-6 rounded-none">
        <div className="text-center">
          <h2 className="text-base font-semibold text-gray-800">{campaign.campaign_name}</h2>
        </div>

        <div className="flex items-center justify-center gap-2 flex-wrap">
          {phases.flatMap((phase, idx) => {
            const block = (
              <div
                key={phase.key}
                className={cn(
                  "flex flex-col items-center justify-center w-28 min-h-[5.5rem] border-2 px-2 py-2 text-center transition-colors rounded-none",
                  phase.status === "done" && "bg-green-50 border-green-600",
                  phase.status === "running" && cn("animate-pulse", phase.activeClasses),
                  phase.status === "pending" && "bg-gray-50 border-gray-200",
                )}
              >
                <p
                  className={cn(
                    "text-xs font-semibold",
                    phase.status === "done" && "text-green-800",
                    phase.status === "running" && phase.textClass,
                    phase.status === "pending" && "text-gray-400",
                  )}
                >
                  {phase.label}
                </p>
                <p className="text-xs text-gray-500 mt-1 leading-tight">{phase.sublabel}</p>
              </div>
            );
            const arrow = idx < phases.length - 1
              ? (
                <div key={`a${idx}`} className={cn(
                  "text-sm text-gray-400",
                  phases[idx].status === "done" ? "text-green-600" : "text-gray-300"
                )}>
                  →
                </div>
              )
              : null;
            return arrow ? [block, arrow] : [block];
          })}
        </div>

        <div className="text-center text-sm text-gray-600">
          {statusLabel}
        </div>

        <div className="flex items-center justify-center gap-1">
          {Array.from({ length: Math.max(allSteps, doneCount) }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "w-2 h-2 rounded-none transition-colors",
                i < doneCount ? "bg-green-600" : "bg-gray-200"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ImageGenerationOverlay (floating modal while DALL-E / upload runs) ────────

const IMAGE_GEN_PHASES = [
  {
    key: "prompt",
    label: "Prompt",
    sublabel: "Chuẩn bị",
    emoji: "📝",
    activeClasses: "bg-violet-50 border-violet-400 shadow-violet-100",
    textClass: "text-violet-700",
    shadowClass: "shadow-lg shadow-violet-100",
  },
  {
    key: "dalle",
    label: "DALL-E 3",
    sublabel: "Tạo ảnh",
    emoji: "🎨",
    activeClasses: "bg-sky-50 border-sky-400 shadow-sky-100",
    textClass: "text-sky-700",
    shadowClass: "shadow-lg shadow-sky-100",
  },
  {
    key: "save",
    label: "Lưu ảnh",
    sublabel: "Tải & lưu",
    emoji: "💾",
    activeClasses: "bg-teal-50 border-teal-400 shadow-teal-100",
    textClass: "text-teal-700",
    shadowClass: "shadow-lg shadow-teal-100",
  },
] as const;

const IMAGE_GEN_STATUS: Record<number, string> = {
  0: "Đang chuẩn bị prompt hình ảnh...",
  1: "DALL-E 3 đang tạo ảnh (thường 15–60 giây)...",
  2: "Đang tải và lưu ảnh về máy chủ...",
  3: "Hoàn tất!",
};

function phaseBlockStatus(phase: number, index: number): "pending" | "running" | "done" {
  if (phase > index) return "done";
  if (phase === index) return "running";
  return "pending";
}

function ImageGenerationOverlay({
  campaignName,
  phase,
}: {
  campaignName: string;
  phase: number;
}) {
  const phases = IMAGE_GEN_PHASES.map((p, idx) => ({
    ...p,
    status: phaseBlockStatus(phase, idx),
  }));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg mx-4 space-y-7">
        <div className="text-center space-y-1">
          <p className="text-xs uppercase tracking-widest text-gray-400 font-medium">Đang tạo ảnh AI</p>
          <h2 className="text-base font-semibold text-gray-800">{campaignName}</h2>
        </div>

        <div className="flex items-center justify-center gap-3">
          {phases.flatMap((stepCfg, idx) => {
            const block = (
              <div
                key={stepCfg.key}
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl w-28 h-24 border-2 transition-all duration-500",
                  stepCfg.status === "done" && "bg-green-50 border-green-300 shadow-md shadow-green-100",
                  stepCfg.status === "running" && cn("border-2 animate-pulse", stepCfg.activeClasses, stepCfg.shadowClass),
                  stepCfg.status === "pending" && "bg-gray-50 border-gray-200",
                )}
              >
                <span className="text-2xl leading-none">
                  {stepCfg.status === "done" ? "✅" : stepCfg.emoji}
                </span>
                <p
                  className={cn(
                    "text-xs font-semibold mt-2",
                    stepCfg.status === "done" && "text-green-700",
                    stepCfg.status === "running" && stepCfg.textClass,
                    stepCfg.status === "pending" && "text-gray-400",
                  )}
                >
                  {stepCfg.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 text-center leading-tight px-1">
                  {stepCfg.sublabel}
                </p>
              </div>
            );
            const arrow = idx < phases.length - 1
              ? (
                <div
                  key={`img-a${idx}`}
                  className={cn(
                    "text-xl font-light transition-colors duration-500",
                    phase > idx ? "text-green-400" : "text-gray-200",
                  )}
                >
                  →
                </div>
              )
              : null;
            return arrow ? [block, arrow] : [block];
          })}
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-600 flex items-center justify-center gap-2">
            {phase < 3 && <Loader2 size={14} className="animate-spin text-violet-500 shrink-0" />}
            <span>{IMAGE_GEN_STATUS[Math.min(phase, 3)] ?? IMAGE_GEN_STATUS[1]}</span>
          </p>
        </div>

        <div className="flex items-center justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all duration-300",
                phase > i ? "bg-green-400 scale-110" : phase === i ? "bg-violet-400 animate-pulse" : "bg-gray-200",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ImageUploadOverlay (2-step: upload → save) ────────────────────────────────

const UPLOAD_PHASES = [
  { key: "up", label: "Tải lên", sublabel: "Gửi file", emoji: "⬆️", activeClasses: "bg-indigo-50 border-indigo-400", textClass: "text-indigo-700", shadowClass: "shadow-lg shadow-indigo-100" },
  { key: "sv", label: "Lưu ảnh", sublabel: "Máy chủ", emoji: "💾", activeClasses: "bg-teal-50 border-teal-400", textClass: "text-teal-700", shadowClass: "shadow-lg shadow-teal-100" },
] as const;

function ImageUploadOverlay({ campaignName, phase }: { campaignName: string; phase: number }) {
  const steps = UPLOAD_PHASES.map((p, idx) => ({
    ...p,
    status: phaseBlockStatus(phase, idx),
  }));
  const msg =
    phase >= 2 ? "Hoàn tất!" : phase === 1 ? "Đang lưu vào chiến dịch..." : "Đang tải ảnh lên máy chủ...";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4 space-y-7">
        <div className="text-center space-y-1">
          <p className="text-xs uppercase tracking-widest text-gray-400 font-medium">Đang upload ảnh</p>
          <h2 className="text-base font-semibold text-gray-800">{campaignName}</h2>
        </div>
        <div className="flex items-center justify-center gap-4">
          {steps.flatMap((s, idx) => {
            const block = (
              <div
                key={s.key}
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl w-28 h-24 border-2 transition-all duration-500",
                  s.status === "done" && "bg-green-50 border-green-300",
                  s.status === "running" && cn("border-2 animate-pulse", s.activeClasses, s.shadowClass),
                  s.status === "pending" && "bg-gray-50 border-gray-200",
                )}
              >
                <span className="text-2xl">{s.status === "done" ? "✅" : s.emoji}</span>
                <p className={cn("text-xs font-semibold mt-2", s.status === "done" && "text-green-700", s.status === "running" && s.textClass, s.status === "pending" && "text-gray-400")}>{s.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.sublabel}</p>
              </div>
            );
            const arrow = idx === 0 ? <div key="u-a" className={cn("text-xl", phase > 0 ? "text-green-400" : "text-gray-200")}>→</div> : null;
            return idx === 0 ? [block, arrow] : [block];
          })}
        </div>
        <p className="text-sm text-gray-600 text-center flex items-center justify-center gap-2">
          {phase < 2 && <Loader2 size={14} className="animate-spin text-indigo-500 shrink-0" />}
          {msg}
        </p>
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
  const fileRef = useRef<HTMLInputElement>(null);

  const plan = campaign.campaign_plan_json || {};
  const imageUrl = plan.image_url as string | undefined;
  const suggestedPrompt = (plan.image_prompt_final || plan.image_prompt_qwen) as string | undefined;

  async function handleGenerate() {
    setGenerating(true);
    setImageGenPhase(0);
    setError("");
    const t1 = setTimeout(() => setImageGenPhase(1), 400);
    try {
      await api.post(`/campaigns/${campaign.id}/image/generate`, {
        prompt: customPrompt || undefined,
      });
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
      const uploadUrl = API_BASE
        ? `${API_BASE}/campaigns/${campaign.id}/image/upload`
        : `/campaigns/${campaign.id}/image/upload`;
      const res = await fetch(
        uploadUrl,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${localStorage.getItem("aimap_token") || ""}` },
          body: form,
        }
      );
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
      {generating && (
        <ImageGenerationOverlay campaignName={campaign.campaign_name} phase={imageGenPhase} />
      )}
      {uploading && (
        <ImageUploadOverlay campaignName={campaign.campaign_name} phase={uploadPhase} />
      )}
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <ImagePlus size={16} className="text-gray-500" />
        <h2>Ảnh chiến dịch</h2>
      </div>

      {imageUrl ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Campaign image"
            className="w-full rounded-md border border-gray-200 object-cover"
            style={{ maxHeight: 280 }}
          />
          <p className="text-xs text-gray-400">Click "Tạo lại" để thay ảnh mới.</p>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-200 rounded-md py-8 flex flex-col items-center text-center gap-2">
          <ImagePlus size={24} className="text-gray-300" />
          <p className="text-sm text-gray-400">Chưa có ảnh. Tạo bằng AI hoặc upload từ thiết bị.</p>
        </div>
      )}

      {showPromptInput && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500">Nhập prompt tuỳ chỉnh (để trống = dùng gợi ý hệ thống)</p>
          <textarea
            className="input text-xs resize-none w-full"
            rows={3}
            placeholder={suggestedPrompt || "Mô tả hình ảnh bạn muốn..."}
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
          />
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handleGenerate}
          disabled={generating || uploading}
          className="btn-primary text-xs py-1.5 flex items-center gap-1.5 flex-1 justify-center"
        >
          {generating ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
          {imageUrl ? "Tạo lại bằng AI" : "Tạo bằng AI"}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={generating || uploading}
          className="btn-secondary text-xs py-1.5 flex items-center gap-1.5 flex-1 justify-center"
        >
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          Upload ảnh
        </button>
        <button
          onClick={() => setShowPromptInput((v) => !v)}
          className="btn-secondary text-xs py-1.5 px-2"
          title="Tuỳ chỉnh prompt"
        >
          ✏️
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api.get<Campaign>(`/campaigns/${id}`)
      .then(setCampaign)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll every 3s while AI is processing
  useEffect(() => {
    const isProcessing = campaign?.status === "running" || campaign?.status === "pending_agent";
    if (!isProcessing) return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [campaign?.status, load]);

  if (loading && !campaign) {
    return <div className="p-6 skeleton h-40 max-w-6xl" />;
  }

  if (!campaign) return <div className="p-6 text-sm text-gray-400">Không tìm thấy chiến dịch.</div>;

  const isProcessing = campaign.status === "running" || campaign.status === "pending_agent";
  const sourceContext = (campaign.campaign_plan_json?.source_context || null) as SourceContext | null;

  return (
    <>
      {/* Floating pipeline modal — appears while AI is running */}
      {isProcessing && <PipelineOverlay campaign={campaign} />}

      <div className="p-6 max-w-6xl">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/campaigns" className="text-gray-400 hover:text-gray-700"><ChevronLeft size={18} /></Link>
          <h1 className="flex-1">{campaign.campaign_name}</h1>
          <HelpDialogButton
            title="Hướng dẫn chi tiết chiến dịch"
            summary="Trang này là nơi bạn theo dõi toàn bộ đầu ra AI, duyệt nội dung và kiểm tra tiến trình."
            steps={[
              "Xem phần Brief để kiểm tra mục tiêu và kênh đã chọn.",
              "Khi AI đang chạy, màn hình sẽ hiện tiến trình Strategist → Writer → Critic.",
              "Duyệt, từ chối hoặc bấm Tạo lại để sinh bản nội dung mới (khi đang chờ duyệt).",
              "Sau khi duyệt, nội dung sẽ xuất hiện trong Lịch marketing.",
            ]}
            buttonClassName="btn-secondary text-xs"
          />
          <span className={cn("badge", STATUS_COLORS[campaign.status])}>{STATUS_LABELS[campaign.status]}</span>
          {isProcessing && <Loader2 size={14} className="text-blue-400 animate-spin" />}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-5">
            {/* Brief info */}
            <div className="card">
              <h2 className="mb-3">Brief</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex gap-4">
                  <dt className="text-gray-500 w-32 shrink-0">Mục tiêu</dt>
                  <dd className="text-gray-800">{campaign.objective}</dd>
                </div>
                <div className="flex gap-4">
                  <dt className="text-gray-500 w-32 shrink-0">Sản phẩm</dt>
                  <dd className="text-gray-800">{campaign.product_or_service}</dd>
                </div>
                <div className="flex gap-4">
                  <dt className="text-gray-500 w-32 shrink-0">Deadline</dt>
                  <dd className="text-gray-800">{formatDate(campaign.deadline)}</dd>
                </div>
                <div className="flex gap-4">
                  <dt className="text-gray-500 w-32 shrink-0">Kênh</dt>
                  <dd className="flex gap-1">
                    {campaign.channels.map((ch) => (
                      <span key={ch} className="badge bg-gray-100 text-gray-600">{CHANNEL_LABELS[ch]}</span>
                    ))}
                  </dd>
                </div>
                {sourceContext?.source_insight_run_id ? (
                  <div className="flex gap-4">
                    <dt className="text-gray-500 w-32 shrink-0">Nguồn tạo</dt>
                    <dd className="text-gray-800">
                      Insight run:{" "}
                      <Link
                        href="/insights/actions"
                        className="text-blue-600 hover:underline"
                      >
                        {sourceContext.source_insight_run_id}
                      </Link>
                      {sourceContext.source_customer_segment ? (
                        <span className="ml-2 text-xs border px-2 py-0.5 bg-gray-50 text-gray-700 border-gray-200">
                          Segment: {sourceContext.source_customer_segment}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>

            {/* Content items */}
            {campaign.content_items.length > 0 && (
              <div>
                <h2 className="mb-3">Nội dung ({campaign.content_items.length})</h2>
                <div className="space-y-3">
                  {campaign.content_items.map((item) => (
                    <ContentCard key={item.id} item={item} onAction={load} />
                  ))}
                </div>
              </div>
            )}

            {/* Image card — below content, always shown after brief */}
            {!isProcessing && <CampaignImageCard campaign={campaign} onUpdated={load} />}
          </div>

          <div className="lg:col-span-2">
            {!isProcessing && campaign.agent_logs.length > 0 && (
              <div className="card lg:sticky lg:top-6 space-y-3">
                <h2 className="text-base font-semibold text-gray-800">Tiến trình AI</h2>
                <AIPipelineProgress campaign={campaign} />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
