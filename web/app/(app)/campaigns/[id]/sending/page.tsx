"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Mail, Send, RefreshCw, Loader2, CheckCircle2, XCircle,
  ChevronLeft, AlertCircle, Users, Inbox, Eye, MousePointerClick,
  CheckCircle, X, ChevronDown, Search,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/* ── Types ───────────────────────────────────────────────────────────────── */

interface WorkflowCustomerList {
  id: string;
  list_name: string;
  status: string;
  total_records: number;
  valid_records: number;
}

interface CampaignDetail {
  id: string;
  campaign_name: string;
  channels: string[];
  customer_list_id: string | null;
}

interface ExecutionLog {
  id: string;
  recipient_name: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  channel: string;
  status: string;
  opened_at: string | null;
  clicked_at: string | null;
  sent_at: string | null;
  error_message: string | null;
}

interface DeliverySummary {
  status: string;
  total?: number;
  sent?: number;
  failed?: number;
  logs: ExecutionLog[];
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "sent":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
          <CheckCircle2 size={9} />
          Đã gửi
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800">
          <XCircle size={9} />
          Lỗi
        </span>
      );
    case "pending":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
          <Loader2 size={9} className="animate-spin" />
          Đang gửi
        </span>
      );
    case "skipped_no_email":
    case "skipped_no_phone":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
          Bỏ qua
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          {status}
        </span>
      );
  }
}

/* ── Customer List Selector ──────────────────────────────────────────────── */

function CustomerListSelector({
  lists,
  selectedIds,
  onChange,
}: {
  lists: WorkflowCustomerList[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  const filtered = lists.filter((l) =>
    l.list_name.toLowerCase().includes(filter.toLowerCase())
  );

  const selected = lists.filter((l) => selectedIds.includes(l.id));
  const totalRecords = selected.reduce((a, l) => a + l.valid_records, 0);

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Users size={13} className="text-gray-400" />
        <p className="text-[11px] font-semibold text-gray-600">Danh sách khách hàng</p>
        {selected.length > 0 && (
          <span className="ml-auto text-[10px] text-[#377D73] font-medium">
            {selected.length} danh sách · {totalRecords.toLocaleString()} khách
          </span>
        )}
      </div>

      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-left transition-all text-[12px]",
            open
              ? "border-[#377D73] ring-1 ring-[#377D73]/30"
              : "border-gray-200 hover:border-gray-300",
            selected.length > 0 ? "text-gray-800" : "text-gray-400"
          )}
        >
          <span className="flex-1 min-w-0">
            {selected.length === 0
              ? "Chọn danh sách khách hàng…"
              : selected.length === 1
              ? selected[0].list_name
              : `${selected.length} danh sách đã chọn`}
          </span>
          <ChevronDown
            size={13}
            className={cn("text-gray-400 shrink-0 transition-transform", open && "rotate-180")}
          />
        </button>

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {selected.map((l) => (
              <span
                key={l.id}
                className="inline-flex items-center gap-1 bg-[#377D73]/10 text-[#377D73] rounded-full pl-2.5 pr-1.5 py-0.5 text-[10px] font-medium"
              >
                {l.list_name}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggle(l.id); }}
                  className="hover:text-red-500 transition-colors"
                >
                  <X size={9} />
                </button>
              </span>
            ))}
          </div>
        )}

        {open && (
          <div className="absolute left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
              <Search size={12} className="text-gray-400 shrink-0" />
              <input
                autoFocus
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Tìm kiếm danh sách…"
                className="flex-1 text-[12px] text-gray-700 placeholder-gray-300 outline-none bg-transparent"
              />
              {filter && (
                <button onClick={() => setFilter("")} className="text-gray-400 hover:text-gray-600">
                  <X size={11} />
                </button>
              )}
            </div>

            <div className="max-h-[240px] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-[11px] text-gray-400 text-center py-4">Không tìm thấy danh sách.</p>
              ) : (
                filtered.map((list) => {
                  const checked = selectedIds.includes(list.id);
                  return (
                    <button
                      key={list.id}
                      type="button"
                      onClick={() => toggle(list.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors text-[12px]",
                        checked ? "bg-[#377D73]/5" : "hover:bg-gray-50"
                      )}
                    >
                      <div
                        className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                          checked ? "bg-[#377D73] border-[#377D73]" : "border-gray-300 bg-white"
                        )}
                      >
                        {checked && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("font-medium truncate", checked ? "text-gray-800" : "text-gray-600")}>
                          {list.list_name}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {list.valid_records.toLocaleString()} / {list.total_records.toLocaleString()} khách
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-3 py-2 border-t border-gray-100">
              <p className="text-[10px] text-gray-400">
                {lists.length} danh sách · Ctrl+click để chọn nhiều
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────────────────── */

export default function CampaignSendingPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [customerLists, setCustomerLists] = useState<WorkflowCustomerList[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<DeliverySummary | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendingProgress, setSendingProgress] = useState({ sent: 0, total: 0 });

  const loadCampaign = useCallback(async () => {
    try {
      const camp = await api.get<CampaignDetail>(`/campaigns/${id}`);
      setCampaign(camp);
      const lists = await api.get<WorkflowCustomerList[]>("/workflow/customer-lists");
      setCustomerLists(lists);
      const listIdParam = searchParams.get("lists");
      if (listIdParam) {
        const ids = listIdParam.split(",").filter(Boolean);
        setSelectedListIds(ids.filter((lid) => lists.some((l) => l.id === lid)));
      }
    } catch {
      setError("Không tải được thông tin chiến dịch.");
    }
  }, [id, searchParams]);

  const loadSummary = useCallback(async () => {
    try {
      const data = await api.get<DeliverySummary>(`/campaigns/${id}/delivery-summary`);
      setSummary(data);
      const sending = data.logs.filter((l) => l.status === "pending").length;
      const total = data.logs.length;
      const sent = data.logs.filter((l) => l.status === "sent").length;
      if (total > 0 && sending > 0) {
        setIsSending(true);
        setSendingProgress({ sent, total });
      } else if (sent > 0 || total > 0) {
        setIsSending(false);
        setSendingProgress({ sent, total });
      }
    } catch {
      // ignore
    }
  }, [id]);

  useEffect(() => {
    loadCampaign().finally(() => setLoading(false));
  }, [loadCampaign]);

  useEffect(() => {
    loadSummary();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isSending) return;
    const t = setInterval(loadSummary, 3000);
    return () => clearInterval(t);
  }, [isSending, loadSummary]);

  const total = summary?.logs.length || 0;
  const sent = summary?.logs.filter((l) => l.status === "sent").length || 0;
  const failed = summary?.logs.filter((l) => l.status === "failed").length || 0;
  const pending = summary?.logs.filter((l) => l.status === "pending").length || 0;
  const opened = summary?.logs.filter((l) => l.opened_at).length || 0;
  const clicked = summary?.logs.filter((l) => l.clicked_at).length || 0;

  async function handleRunCampaign() {
    if (!campaign || selectedListIds.length === 0) {
      setError("Vui lòng chọn ít nhất 1 danh sách khách hàng.");
      return;
    }
    setIsSending(true);
    setError("");
    try {
      await api.post(`/campaigns/${id}/execute`, {
        mode: "email",
        customer_list_ids: selectedListIds,
        ab_test: false,
      });
      loadSummary();
    } catch (e: unknown) {
      setIsSending(false);
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Không thể khởi động chiến dịch.";
      setError(msg);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      {/* Header */}
      <header className="bg-white border-b border-amber-200 px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push(`/campaigns/${id}`)}
              className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
            >
              <ChevronLeft size={20} />
            </button>
            <Mail className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="min-w-0">
              <h1 className="font-semibold text-slate-900 text-sm truncate">
                {campaign?.campaign_name || "Gửi Email"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {isSending && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-3 py-1.5">
                <Loader2 size={12} className="animate-spin text-blue-600" />
                <span className="text-[11px] text-blue-700 font-medium">
                  {sendingProgress.sent}/{sendingProgress.total}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle size={14} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-700">{error}</p>
            <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600 shrink-0">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 text-center border border-gray-100 shadow-sm">
            <p className="text-3xl font-bold text-slate-700">{total}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mt-1">Tổng khách</p>
          </div>
          <div className="bg-gradient-to-br from-[#377D73] to-[#2d6a61] rounded-xl p-4 text-center shadow-lg shadow-[#377D73]/20">
            <p className="text-3xl font-bold text-white">{sent}</p>
            <p className="text-[10px] text-white/80 uppercase tracking-wide font-semibold mt-1">Đã gửi</p>
          </div>
          <div className="bg-white rounded-xl p-4 text-center border border-gray-100 shadow-sm">
            <p className="text-3xl font-bold text-red-500">{failed}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mt-1">Lỗi</p>
          </div>
        </div>

        {/* Open & Click rates */}
        {total > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-xl p-4 text-center border border-gray-100 shadow-sm">
              <p className="text-2xl font-bold text-blue-600">{opened}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Eye size={10} className="text-blue-400" />
                <p className="text-[10px] text-slate-400">Đã mở</p>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1 mt-2">
                <div className="bg-blue-400 h-1 rounded-full transition-all" style={{ width: `${total > 0 ? (opened / total) * 100 : 0}%` }} />
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 text-center border border-gray-100 shadow-sm">
              <p className="text-2xl font-bold text-indigo-600">{clicked}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <MousePointerClick size={10} className="text-indigo-400" />
                <p className="text-[10px] text-slate-400">Đã click</p>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1 mt-2">
                <div className="bg-indigo-400 h-1 rounded-full transition-all" style={{ width: `${total > 0 ? (clicked / total) * 100 : 0}%` }} />
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 text-center border border-gray-100 shadow-sm">
              <p className="text-2xl font-bold text-amber-500">{pending}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Loader2 size={10} className="text-amber-400 animate-spin" />
                <p className="text-[10px] text-slate-400">Đang chờ</p>
              </div>
            </div>
          </div>
        )}

        {/* Customer list selector */}
        {customerLists.length > 0 && (
          <CustomerListSelector
            lists={customerLists}
            selectedIds={selectedListIds}
            onChange={setSelectedListIds}
          />
        )}

        {/* Run Campaign */}
        <div className="flex items-center justify-between mb-6 bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {total === 0 ? "Chưa có dữ liệu gửi" : `${total} khách hàng sẵn sàng`}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {total === 0
                ? "Chọn danh sách và bấm chạy chiến dịch."
                : `Đã gửi: ${sent}/${total}${failed > 0 ? ` · Lỗi: ${failed}` : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadSummary}
              className="flex items-center gap-1.5 rounded-lg border border-amber-300 px-3 py-2 text-[11px] font-medium text-amber-700 hover:bg-amber-50 transition-colors"
            >
              <RefreshCw size={11} />
              Làm mới
            </button>
            <button
              onClick={handleRunCampaign}
              disabled={isSending || selectedListIds.length === 0 || !campaign}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#377D73] to-[#2d6a61] px-5 py-2.5 text-[12px] font-bold text-white shadow-lg shadow-[#377D73]/30 hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Send size={13} />
              )}
              {isSending ? "Đang gửi…" : sent > 0 ? "Gửi lại" : "Chạy chiến dịch"}
            </button>
          </div>
        </div>

        {/* Empty state */}
        {total === 0 && !isSending && (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
            <Inbox className="h-14 w-14 text-slate-200 mx-auto mb-4" />
            {customerLists.length === 0 ? (
              <>
                <p className="text-slate-500 font-medium">Chưa có danh sách khách hàng</p>
                <p className="text-slate-400 text-xs mt-1 mb-4">
                  Vui lòng tạo danh sách khách hàng có email trước khi gửi.
                </p>
                <button
                  onClick={() => router.push("/customer-lists")}
                  className="text-sm text-[#377D73] hover:underline font-medium"
                >
                  Tạo danh sách khách hàng →
                </button>
              </>
            ) : selectedListIds.length === 0 ? (
              <>
                <p className="text-slate-500 font-medium">Chưa chọn danh sách khách hàng</p>
                <p className="text-slate-400 text-xs mt-1 mb-4">
                  Chọn danh sách ở phía trên để bắt đầu gửi.
                </p>
              </>
            ) : (
              <>
                <p className="text-slate-500 font-medium">Danh sách trống</p>
                <p className="text-slate-400 text-xs mt-1 mb-4">
                  Danh sách đã chọn chưa có khách hàng nào có email.
                </p>
              </>
            )}
          </div>
        )}

        {/* Customer delivery list */}
        {total > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                Danh sách khách hàng
              </p>
              {isSending && (
                <div className="flex items-center gap-1.5 text-[10px] text-blue-600">
                  <Loader2 size={10} className="animate-spin" />
                  <span>Đang cập nhật…</span>
                </div>
              )}
            </div>
            <div className="divide-y divide-gray-50">
              {summary?.logs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#377D73]/20 to-[#377D73]/10 flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-bold text-[#377D73]">
                      {(log.recipient_name || "K")[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-slate-800 truncate">
                      {log.recipient_name || "Khách hàng"}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {log.recipient_email || log.recipient_phone || "—"}
                    </p>
                  </div>
                  {log.status === "failed" && log.error_message && (
                    <p className="text-[9px] text-red-500 italic truncate max-w-[120px]" title={log.error_message}>
                      {log.error_message}
                    </p>
                  )}
                  <StatusBadge status={log.status} />
                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className={cn("flex items-center gap-1 text-[10px]", log.opened_at ? "text-[#377D73]" : "text-gray-300")}
                      title={log.opened_at ? `Mở lúc: ${new Date(log.opened_at).toLocaleString("vi")}` : "Chưa mở"}
                    >
                      <Eye size={11} />
                      {log.opened_at ? <CheckCircle size={9} /> : <span className="text-[9px]">—</span>}
                    </div>
                    <div
                      className={cn("flex items-center gap-1 text-[10px]", log.clicked_at ? "text-[#377D73]" : "text-gray-300")}
                      title={log.clicked_at ? `Click lúc: ${new Date(log.clicked_at).toLocaleString("vi")}` : "Chưa click"}
                    >
                      <MousePointerClick size={11} />
                      {log.clicked_at ? <CheckCircle size={9} /> : <span className="text-[9px]">—</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
