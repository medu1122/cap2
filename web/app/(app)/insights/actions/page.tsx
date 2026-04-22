"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import HelpDialogButton from "@/components/common/HelpDialogButton";

interface InsightRun {
  id: string;
  business_name: string;
  industry: string | null;
  report_type: string;
  status: string;
  fallback_provider: string | null;
  fallback_reason: string | null;
  created_at: string;
}

interface SuggestedAction {
  id: string;
  title: string;
  priority: string;
  target_segment: string;
  reason?: string;
  goal?: string;
  expected_impact?: string;
  recommended_channels?: string[];
}

interface InsightRunResult {
  run_id: string;
  suggested_actions?: SuggestedAction[];
}

const STATUS_LABELS: Record<string, string> = {
  completed: "Hoàn tất",
  failed: "Thất bại",
  success: "Thành công",
};

function toCampaignFromActionHref(runId: string, action: SuggestedAction): string {
  const normalizedSegment = (action.target_segment || "unknown").toLowerCase();
  const channels =
    action.recommended_channels && action.recommended_channels.length > 0
      ? action.recommended_channels.join(",")
      : normalizedSegment === "inactive" || normalizedSegment === "churn_risk" || normalizedSegment === "vip"
        ? "email"
        : "facebook_post";
  const params = new URLSearchParams({
    source_insight_run_id: runId,
    source_customer_segment: normalizedSegment,
    channels,
    campaign_name: `Action: ${action.title}`.slice(0, 120),
    objective: action.goal || action.reason || action.title,
    offer_or_hook: action.expected_impact || "",
    additional_notes: `[INSIGHT_ACTION] ${action.title}`,
  });
  return `/campaigns/new?${params.toString()}`;
}

export default function InsightActionsPage() {
  const [runs, setRuns] = useState<InsightRun[]>([]);
  const [actionsByRun, setActionsByRun] = useState<Record<string, SuggestedAction[]>>({});
  const [loadingRunIds, setLoadingRunIds] = useState<Record<string, boolean>>({});
  const [runErrors, setRunErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<InsightRun[]>("/insights/a2a/runs");
      setRuns(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được lịch sử phân tích");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLoadActions(runId: string) {
    if (actionsByRun[runId]) return;
    setLoadingRunIds((prev) => ({ ...prev, [runId]: true }));
    setRunErrors((prev) => ({ ...prev, [runId]: "" }));
    try {
      const result = await api.get<InsightRunResult>(`/insights/a2a/runs/${runId}/result`);
      setActionsByRun((prev) => ({
        ...prev,
        [runId]: result.suggested_actions ?? [],
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Không tải được action cho run này";
      setRunErrors((prev) => ({ ...prev, [runId]: msg }));
    } finally {
      setLoadingRunIds((prev) => ({ ...prev, [runId]: false }));
    }
  }

  return (
    <div className="p-6 max-w-5xl space-y-5">
      <div className="rounded border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-700">
        Danh sách phiên chạy A2A gần nhất để theo dõi trạng thái, fallback và thời gian thực thi.
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1>Hàng đợi hành động</h1>
          <p className="text-sm text-gray-500 mt-1">Lịch sử chạy phân tích sâu A2A.</p>
        </div>
        <div className="flex items-center gap-2">
          <HelpDialogButton
            title="Hướng dẫn Hàng đợi hành động"
            summary="Trang này giúp bạn biến kết quả phân tích thành công việc cụ thể để đội vận hành triển khai ngay."
            steps={[
              "Bước 1 - Chạy phân tích sâu từ trang Trợ lý phân tích.",
              "Bước 2 - Quay lại trang này để theo dõi các run gần nhất.",
              "Bước 3 - Nếu có fallback, kiểm tra lại chất lượng dữ liệu CSV.",
            ]}
            tips={[
              "Run thất bại thường do thiếu cột quan trọng hoặc dữ liệu trống.",
              "Nên lưu ý các run có fallback để chuẩn hóa file cho lần sau.",
            ]}
          />
          <Link href="/insights" className="btn-secondary">Quay lại Trợ lý phân tích</Link>
        </div>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-20" />)}
        </div>
      ) : runs.length === 0 ? (
        <div className="card text-sm text-gray-500">Chưa có phiên chạy nào.</div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <div key={run.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{run.business_name} - {run.report_type}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Ngành: {run.industry || "Chưa khai báo"} {run.fallback_provider ? `- Fallback: ${run.fallback_provider}` : ""}
                  </p>
                  {run.fallback_reason && <p className="text-xs text-amber-700 mt-1">Lý do fallback: {run.fallback_reason}</p>}
                </div>
                <span className="inline-flex rounded border border-gray-200 px-2 py-1 text-xs text-gray-600">
                  {STATUS_LABELS[run.status] || run.status}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2">{new Date(run.created_at).toLocaleString("vi-VN")}</p>
              <div className="mt-3 space-y-2">
                <button
                  className="btn-secondary text-xs"
                  onClick={() => void handleLoadActions(run.id)}
                  disabled={loadingRunIds[run.id]}
                >
                  {loadingRunIds[run.id] ? "Đang tải action..." : "Xem action đề xuất"}
                </button>
                {runErrors[run.id] ? (
                  <p className="text-xs text-red-600">{runErrors[run.id]}</p>
                ) : null}
                {actionsByRun[run.id] && (
                  actionsByRun[run.id].length === 0 ? (
                    <p className="text-xs text-gray-500">Run này chưa có action đề xuất.</p>
                  ) : (
                    <ul className="space-y-2">
                      {actionsByRun[run.id].map((action) => (
                        <li key={action.id} className="border border-green-200 bg-green-50/40 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{action.title}</p>
                              <p className="mt-1 text-xs text-gray-600">
                                Ưu tiên: {action.priority} | Segment: {action.target_segment}
                              </p>
                            </div>
                            <a
                              className="btn-primary text-xs"
                              href={toCampaignFromActionHref(run.id, action)}
                            >
                              Tạo campaign
                            </a>
                          </div>
                          <p className="mt-2 text-sm text-gray-700">{action.goal || action.reason || "Chưa có mô tả chi tiết."}</p>
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
