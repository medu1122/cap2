"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Check, Loader2, Clock, AlertCircle } from "lucide-react";
import { api } from "@/lib/api-client";
import { STATUS_LABELS, STATUS_COLORS, CHANNEL_LABELS, formatDate, cn } from "@/lib/utils";

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
      label: "Strategist — Phân tích brief & lên kế hoạch",
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
        <h2 className="text-sm font-semibold text-gray-700">Tiến trình AI Pipeline</h2>
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
            {currentStep.channel ? ` đang xử lý ${CHANNEL_LABELS[currentStep.channel] ?? currentStep.channel}` : " đang phân tích brief"}
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
                <div className="flex items-center gap-2 mt-0.5">
                  {step.model && step.model !== "pending" && (
                    <span className="text-xs text-gray-400">{step.model}</span>
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
          <div className="flex gap-2">
            <button onClick={approve} disabled={loading} className="btn-primary text-xs py-1 px-3">Duyệt</button>
            <button onClick={() => setShowReject(!showReject)} className="btn-danger text-xs py-1 px-3">Từ chối</button>
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
          {c.duration_estimate && <p className="text-xs text-gray-400">Thời lượng ước tính: {c.duration_estimate as string}</p>}
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

// ── AgentLogTimeline (completed steps only) ───────────────────────────────────

function AgentLogTimeline({ logs }: { logs: AgentLog[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const completedLogs = logs.filter((l) => l.status === "success" || l.status === "failed");

  if (completedLogs.length === 0)
    return <p className="text-sm text-gray-400">Chưa có hoạt động.</p>;

  return (
    <div className="space-y-3">
      {completedLogs.map((log) => (
        <div key={log.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className={cn(
              "w-2.5 h-2.5 rounded-full mt-1",
              log.status === "success" ? "bg-green-500" : "bg-red-500"
            )} />
            <div className="flex-1 w-px bg-gray-200 mt-1" />
          </div>
          <div className="flex-1 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium capitalize text-gray-800">{log.agent_name}</span>
                {log.channel && <span className="badge bg-gray-100 text-gray-500 text-xs">{CHANNEL_LABELS[log.channel] || log.channel}</span>}
                {log.model_used && log.model_used !== "pending" && (
                  <span className="badge bg-blue-50 text-blue-600 text-xs">{log.model_used}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                {log.duration_ms && <span>{log.duration_ms}ms</span>}
                {log.input_tokens && <span>{log.input_tokens + (log.output_tokens || 0)} tokens</span>}
              </div>
            </div>
            <button
              className="text-xs text-gray-400 hover:text-gray-600 mt-1"
              onClick={() => setExpanded(expanded === log.id ? null : log.id)}
            >
              {expanded === log.id ? "Thu gọn" : "Xem chi tiết"}
            </button>
            {expanded === log.id && (
              <div className="mt-2 space-y-2">
                {log.prompt_preview && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Prompt preview</p>
                    <pre className="text-xs bg-surface p-2 rounded border border-gray-100 whitespace-pre-wrap font-mono">{log.prompt_preview}</pre>
                  </div>
                )}
                {log.output_preview && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Output preview</p>
                    <pre className="text-xs bg-surface p-2 rounded border border-gray-100 whitespace-pre-wrap font-mono">{log.output_preview}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
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
    return <div className="p-6 skeleton h-40 max-w-4xl" />;
  }

  if (!campaign) return <div className="p-6 text-sm text-gray-400">Không tìm thấy chiến dịch.</div>;

  const isProcessing = campaign.status === "running" || campaign.status === "pending_agent";

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/campaigns" className="text-gray-400 hover:text-gray-700"><ChevronLeft size={18} /></Link>
        <h1 className="flex-1">{campaign.campaign_name}</h1>
        <span className={cn("badge", STATUS_COLORS[campaign.status])}>{STATUS_LABELS[campaign.status]}</span>
        {isProcessing && <Loader2 size={14} className="text-blue-400 animate-spin" />}
      </div>

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3 space-y-5">

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
            </dl>
          </div>

          {/* AI Pipeline Progress panel — shown while processing */}
          {isProcessing && <AIPipelineProgress campaign={campaign} />}

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
        </div>

        {/* Right sidebar */}
        <div className="col-span-2 space-y-4">
          {/* Show progress panel in sidebar when completed (compact view) */}
          {!isProcessing && campaign.agent_logs.length > 0 && (
            <div className="card">
              <h2 className="mb-3">Pipeline Summary</h2>
              <AIPipelineProgress campaign={campaign} />
            </div>
          )}

          <div className="card sticky top-6">
            <h2 className="mb-4">Agent Activity Log</h2>
            <AgentLogTimeline logs={campaign.agent_logs} />
          </div>
        </div>
      </div>
    </div>
  );
}
