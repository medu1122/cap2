"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Mail, Send, RefreshCw, Loader2, CheckCircle2, XCircle,
  ChevronLeft, AlertCircle, Users, Inbox,
} from "lucide-react";
import { api } from "@/lib/api-client";

/* ── Types ───────────────────────────────────────────────────────────────── */

interface CustomerRow {
  ID: string;
  HoVaTen: string;
  SDT: string;
  Email: string;
  [key: string]: unknown;
}

interface CustomerListResponse {
  table: { id: string; name: string; status: string };
  rows: CustomerRow[];
}

interface EmailItem {
  id: string;
  name: string;
  email: string;
  subject: string;
  body: string;
  status: "pending" | "composing" | "done" | "sending" | "sent" | "failed";
  errorMsg?: string;
}

interface CampaignDetail {
  id: string;
  campaign_name: string;
  channels: string[];
  customer_list_id: string | null;
}

interface DeliveryState {
  status: "idle" | "sending" | "done" | "failed";
  total?: number;
  sent?: number;
  failed?: number;
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function buildVariablesFromRow(row: CustomerRow): Record<string, string> {
  return {
    HoVaTen: String(row.HoVaTen || "").trim() || "khách",
    name: String(row.HoVaTen || "").trim() || "bạn",
    phone: String(row.SDT || "").trim(),
    Email: String(row.Email || "").trim(),
  };
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{${key}}`);
}

/* ── Email Card ─────────────────────────────────────────────────────────── */

function EmailCard({
  item,
  onSubjectChange,
  onBodyChange,
  onRegenerate,
  onSend,
}: {
  item: EmailItem;
  onSubjectChange: (id: string, val: string) => void;
  onBodyChange: (id: string, val: string) => void;
  onRegenerate: (id: string) => void;
  onSend: (id: string) => void;
}) {
  const isLoading = item.status === "composing";
  const isSent = item.status === "sent";
  const isSending = item.status === "sending";
  const isFailed = item.status === "failed";
  const canEdit = !isLoading && !isSending && !isSent;

  function statusBadge() {
    switch (item.status) {
      case "composing":
        return (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            Đang soạn…
          </span>
        );
      case "done":
        return (
          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Sẵn sàng
          </span>
        );
      case "sending":
        return (
          <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            Đang gửi…
          </span>
        );
      case "sent":
        return (
          <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-800">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Đã gửi
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-800">
            <XCircle className="h-2.5 w-2.5" />
            Lỗi
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            Chờ xử lý
          </span>
        );
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-amber-200 bg-white shadow-sm">
      {/* Card header */}
      <div className="flex items-center justify-between border-b border-amber-100 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate text-[13px] font-semibold text-slate-900">{item.name}</span>
          {item.email && (
            <span className="truncate text-[11px] text-slate-400">{item.email}</span>
          )}
        </div>
        {statusBadge()}
      </div>

      {/* Card body */}
      <div className="flex-1 space-y-2.5 px-4 py-3">
        {/* Subject */}
        <div>
          <label className="text-[10px] font-medium text-slate-500">Tiêu đề</label>
          <input
            type="text"
            className="mt-0.5 w-full border border-amber-200 rounded-lg bg-amber-50/30 px-3 py-1.5 text-[12px] text-slate-800 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-300 disabled:opacity-60"
            value={item.subject}
            onChange={(e) => onSubjectChange(item.id, e.target.value)}
            disabled={!canEdit}
            placeholder="Tiêu đề email…"
          />
        </div>

        {/* Body */}
        <div>
          <label className="text-[10px] font-medium text-slate-500">Nội dung</label>
          {isLoading ? (
            <div className="mt-0.5 space-y-1.5 rounded-lg border border-amber-100 bg-amber-50/40 p-3">
              <div className="h-3 w-3/4 animate-pulse rounded bg-amber-200" />
              <div className="h-3 w-full animate-pulse rounded bg-amber-200" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-amber-200" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-amber-200" />
            </div>
          ) : (
            <textarea
              className="mt-0.5 w-full min-h-[120px] resize-y rounded-lg border border-amber-200 bg-amber-50/30 px-3 py-2 text-[12px] leading-relaxed text-slate-800 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-300 disabled:opacity-60"
              value={item.body}
              onChange={(e) => onBodyChange(item.id, e.target.value)}
              disabled={!canEdit}
              placeholder="Nội dung email…"
            />
          )}
        </div>

        {/* Error */}
        {isFailed && item.errorMsg && (
          <p className="text-[10px] text-red-600">{item.errorMsg}</p>
        )}
      </div>

      {/* Card footer */}
      {!isSent && (
        <div className="flex items-center justify-end gap-2 border-t border-amber-100 px-4 py-2.5">
          <button
            type="button"
            className="flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-1.5 text-[11px] font-medium text-amber-800 transition hover:bg-amber-50 disabled:opacity-40"
            onClick={() => onRegenerate(item.id)}
            disabled={isLoading || isSending}
          >
            <RefreshCw className="h-3 w-3" />
            Soạn lại
          </button>
          <button
            type="button"
            className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-amber-600 disabled:opacity-40"
            onClick={() => onSend(item.id)}
            disabled={isLoading || isSending || !item.body}
          >
            <Send className="h-3 w-3" />
            Gửi
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────────────────── */

export default function CampaignSendingPage() {
  const { id } = useParams();
  const router = useRouter();

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [customerListName, setCustomerListName] = useState("");
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [composing, setComposing] = useState<string | null>(null);
  const [deliveryState, setDeliveryState] = useState<DeliveryState>({ status: "idle" });

  // Load campaign + customer list
  const loadData = useCallback(async () => {
    try {
      const camp = await api.get<CampaignDetail>(`/campaigns/${id}`);
      setCampaign(camp);

      // Get customer list — dùng campaign.customer_list_id nếu có, không thì lấy list đầu tiên
      let listId = camp.customer_list_id;
      if (!listId) {
        const lists = await api.get<{ id: string; list_name: string }[]>("/workflow/customer-lists");
        if (lists.length === 0) {
          setError("Chưa có danh sách khách hàng. Vui lòng tạo danh sách trước.");
          setLoading(false);
          return;
        }
        listId = lists[0].id;
        setCustomerListName(lists[0].list_name);
      } else {
        // Get list name
        const lists = await api.get<{ id: string; list_name: string }[]>("/workflow/customer-lists");
        const found = lists.find((l) => l.id === listId);
        setCustomerListName(found?.list_name || "Danh sách khách");
      }

      const listData = await api.get<CustomerListResponse>(
        `/workflow/customer-lists/${listId}/rows`
      );

      const items: EmailItem[] = listData.rows
        .filter((row) => row.Email)
        .map((row, idx) => ({
          id: `email-${row.ID || idx}`,
          name: String(row.HoVaTen || "").trim() || "Khách",
          email: String(row.Email || "").trim(),
          subject: "",
          body: "",
          status: "pending" as const,
        }));

      setEmails(items);

      // Check delivery status
      try {
        const delivery = await api.get<{ status: string; total?: number; sent?: number; failed?: number }>(
          `/campaigns/${id}/delivery-summary`
        );
        if (delivery.status === "sending") {
          setDeliveryState({ status: "sending", total: delivery.total, sent: delivery.sent, failed: delivery.failed });
        } else if (delivery.status === "completed") {
          setDeliveryState({ status: "done", total: delivery.total, sent: delivery.sent, failed: delivery.failed });
        } else {
          setDeliveryState({ status: "idle" });
        }
      } catch {
        setDeliveryState({ status: "idle" });
      }
    } catch (err) {
      console.error("Failed to load:", err);
      setError("Không tải được dữ liệu chiến dịch.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling: tự động reload mỗi 5s khi đang gửi
  useEffect(() => {
    if (deliveryState.status !== "sending") return;
    const t = setInterval(async () => {
      try {
        const delivery = await api.get<{ status: string; total?: number; sent?: number; failed?: number }>(
          `/campaigns/${id}/delivery-summary`
        );
        setDeliveryState({
          status: delivery.status === "sending" ? "sending" : "done",
          total: delivery.total,
          sent: delivery.sent,
          failed: delivery.failed,
        });
        if (delivery.status !== "sending") {
          // Reload emails to reflect sent status
          loadData();
        }
      } catch {
        // ignore polling errors
      }
    }, 5000);
    return () => clearInterval(t);
  }, [deliveryState.status, id, loadData]);

  // Compose single email
  const composeEmail = useCallback(
    async (itemId: string, vars: Record<string, string>) => {
      setComposing(itemId);
      setEmails((prev) =>
        prev.map((e) => (e.id === itemId ? { ...e, status: "composing" } : e))
      );

      try {
        const camp = await api.get<{
          content_items: Array<{ channel: string; content_json: { subject: string; body: string } }>
        }>(`/campaigns/${id}`);

        const emailContent = camp.content_items.find((c) => c.channel === "email");

        if (emailContent) {
          const subject = fillTemplate(
            emailContent.content_json.subject || "Chào {{HoVaTen}}",
            vars
          );
          const body = fillTemplate(
            emailContent.content_json.body || "Xin chào {{HoVaTen}},\n\n...",
            vars
          );
          setEmails((prev) =>
            prev.map((e) =>
              e.id === itemId ? { ...e, subject, body, status: "done" } : e
            )
          );
        } else {
          setEmails((prev) =>
            prev.map((e) =>
              e.id === itemId
                ? { ...e, subject: `Chào ${vars.HoVaTen}!`, body: `Xin chào ${vars.HoVaTen},\n\nCảm ơn bạn đã quan tâm!\n\nTrân trọng.`, status: "done" }
                : e
            )
          );
        }
      } catch {
        setEmails((prev) =>
          prev.map((e) =>
            e.id === itemId
              ? { ...e, status: "failed" as const, errorMsg: "Không thể soạn email" }
              : e
          )
        );
      } finally {
        setComposing(null);
      }
    },
    [id]
  );

  // Compose all pending
  const handleComposeAll = async () => {
    const pending = emails.filter((e) => e.status === "pending");
    for (const item of pending) {
      const vars = buildVariablesFromRow({ ID: item.id, HoVaTen: item.name, Email: item.email, SDT: "" });
      await composeEmail(item.id, vars);
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  // Regenerate single
  const handleRegenerate = async (itemId: string) => {
    const item = emails.find((e) => e.id === itemId);
    if (!item) return;
    const vars = buildVariablesFromRow({ ID: itemId, HoVaTen: item.name, Email: item.email, SDT: "" });
    await composeEmail(itemId, vars);
  };

  // Send single
  const handleSend = async (itemId: string) => {
    setEmails((prev) =>
      prev.map((e) => (e.id === itemId ? { ...e, status: "sending" } : e))
    );
    try {
      await api.post(`/campaigns/${id}/send-email`, {
        to: emails.find((e) => e.id === itemId)?.email,
        subject: emails.find((e) => e.id === itemId)?.subject,
        body: emails.find((e) => e.id === itemId)?.body,
      });
      setEmails((prev) =>
        prev.map((e) => (e.id === itemId ? { ...e, status: "sent" } : e))
      );
    } catch {
      setEmails((prev) =>
        prev.map((e) =>
          e.id === itemId
            ? { ...e, status: "failed" as const, errorMsg: "Gửi thất bại. Vui lòng thử lại." }
            : e
        )
      );
    }
  };

  const handleSubjectChange = (id: string, val: string) =>
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, subject: val } : e)));

  const handleBodyChange = (id: string, val: string) =>
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, body: val } : e)));

  // Stats
  const total = emails.length;
  const sent = emails.filter((e) => e.status === "sent").length;
  const done = emails.filter((e) => e.status === "done").length;
  const failed = emails.filter((e) => e.status === "failed").length;
  const pending = emails.filter((e) => e.status === "pending").length;
  const composingCount = emails.filter((e) => e.status === "composing").length;
  const sendingCount = emails.filter((e) => e.status === "sending").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-slate-600 font-medium mb-1">{error}</p>
          <button onClick={loadData} className="mt-3 text-sm text-amber-600 hover:underline">
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      {/* Header */}
      <header className="bg-white border-b border-amber-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/campaigns/${id}`)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-amber-600" />
              <div>
                <h1 className="font-semibold text-slate-900 text-sm">{campaign?.campaign_name || "Gửi Email"}</h1>
                {customerListName && (
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Users size={9} />{customerListName}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs">
            <div className="text-center">
              <p className="text-lg font-bold text-slate-700">{total}</p>
              <p className="text-slate-400">Tổng</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-emerald-600">{done + sent}</p>
              <p className="text-slate-400">Sẵn sàng</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-green-600">{sent}</p>
              <p className="text-slate-400">Đã gửi</p>
            </div>
            {failed > 0 && (
              <div className="text-center">
                <p className="text-lg font-bold text-red-500">{failed}</p>
                <p className="text-slate-400">Lỗi</p>
              </div>
            )}
            <div className="text-center">
              <p className="text-lg font-bold text-slate-400">{pending + composingCount + sendingCount}</p>
              <p className="text-slate-400">Chờ</p>
            </div>
          </div>

          {/* Polling indicator */}
          {deliveryState.status === "sending" && (
            <div className="flex items-center gap-1.5 text-[10px] text-blue-600">
              <Loader2 size={10} className="animate-spin" />
              <span>Đang gửi… {deliveryState.sent}/{deliveryState.total}</span>
            </div>
          )}
        </div>
      </header>

      {/* Empty state */}
      {emails.length === 0 ? (
        <div className="max-w-md mx-auto text-center py-24">
          <Inbox className="h-14 w-14 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Chưa có khách hàng nào</p>
          <p className="text-slate-400 text-xs mt-1">
            Vui lòng thêm danh sách khách hàng có email trước khi gửi.
          </p>
          <button
            onClick={() => router.push("/customer-lists")}
            className="mt-4 text-sm text-amber-600 hover:underline font-medium"
          >
            Tạo danh sách khách hàng →
          </button>
        </div>
      ) : (
        <>
          {/* Actions */}
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Mỗi email được soạn riêng cho từng khách hàng bằng AI.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadData}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-300 px-3 py-1.5 text-[11px] font-medium text-amber-700 transition hover:bg-amber-50"
                >
                  <RefreshCw className="h-3 w-3" />
                  Làm mới
                </button>
                <button
                  onClick={handleComposeAll}
                  disabled={composing !== null || pending === 0}
                  className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-50"
                >
                  {composing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang soạn...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Soạn tất cả ({pending})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Email Grid */}
          <main className="max-w-6xl mx-auto px-4 pb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {emails.map((item) => (
                <EmailCard
                  key={item.id}
                  item={item}
                  onSubjectChange={handleSubjectChange}
                  onBodyChange={handleBodyChange}
                  onRegenerate={handleRegenerate}
                  onSend={handleSend}
                />
              ))}
            </div>
          </main>
        </>
      )}
    </div>
  );
}
