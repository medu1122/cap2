"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Sparkles,
  Bell,
  BellOff,
  CalendarDays,
  X,
  Link2,
  Mail,
  FileVideo,
  Video,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { STATUS_COLORS, STATUS_LABELS, CHANNEL_LABELS, cn, formatDate } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday, isSameDay, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import HelpDialogButton from "@/components/common/HelpDialogButton";

/* ── Types ──────────────────────────────────────────────────────────────── */

interface CalendarItem {
  id: string;
  campaign_id: string;
  campaign_name: string;
  campaign_deadline?: string;
  campaign_start_date?: string | null;
  channel: string;
  status: string;
  scheduled_date: string;
  content_preview: string;
  copy_text: string;
  content_json: Record<string, string>;
}

interface SuggestDatesResponse {
  suggestions: { date: string; score: number; reasons: string[] }[];
  rules_summary: string;
  horizon_days: number;
  campaign_deadline: string;
  avoid_dates: string[];
  content_item_id: string;
  channel: string;
}

/* ── Campaign colors — pastel / light versions ─────────────────────────── */

const CAMPAIGN_COLORS = [
  { bar: "#5EADA6", bg: "#5EADA6/15", dot: "#5EADA6" },
  { bar: "#818CF8", bg: "#818CF8/15", dot: "#818CF8" },
  { bar: "#FCD34D", bg: "#FCD34D/20", dot: "#F59E0B" },
  { bar: "#FCA5A5", bg: "#FCA5A5/20", dot: "#EF4444" },
  { bar: "#6EE7B7", bg: "#6EE7B7/20", dot: "#10B981" },
  { bar: "#C4B5FD", bg: "#C4B5FD/20", dot: "#8B5CF6" },
  { bar: "#F9A8D4", bg: "#F9A8D4/20", dot: "#EC4899" },
  { bar: "#7DD3FC", bg: "#7DD3FC/20", dot: "#0EA5E9" },
  { bar: "#FDBA74", bg: "#FDBA74/20", dot: "#F97316" },
  { bar: "#5EEAD4", bg: "#5EEAD4/20", dot: "#14B8A6" },
];

function getCampaignColor(index: number) {
  return CAMPAIGN_COLORS[index % CAMPAIGN_COLORS.length];
}

/* ── Channel icons ──────────────────────────────────────────────────────── */

function ChannelIcon({ channel, size = 11 }: { channel: string; size?: number }) {
  if (channel === "facebook_post") return <FileVideo size={size} className="text-[#377D73]" />;
  if (channel === "email") return <Mail size={size} className="text-[#6366F1]" />;
  if (channel === "video_script") return <Video size={size} className="text-amber-500" />;
  return <Link2 size={size} className="text-gray-400" />;
}

/* ── Modal ──────────────────────────────────────────────────────────────── */

function CampaignModal({
  item,
  colorIdx,
  onClose,
  rescheduleDate,
  setRescheduleDate,
  rescheduleMsg,
  rescheduling,
  suggestData,
  suggestLoading,
  suggestErr,
  onReschedule,
  copied,
  onCopy,
}: {
  item: CalendarItem;
  colorIdx: number;
  onClose: () => void;
  rescheduleDate: string;
  setRescheduleDate: (v: string) => void;
  rescheduleMsg: string;
  rescheduling: boolean;
  suggestData: SuggestDatesResponse | null;
  suggestLoading: boolean;
  suggestErr: string;
  onReschedule: () => void;
  copied: boolean;
  onCopy: () => void;
}) {
  const color = getCampaignColor(colorIdx);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto overflow-hidden"
          style={{ borderTop: `4px solid ${color.bar}` }}
        >
          {/* Header */}
          <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
              style={{ backgroundColor: color.bg }}
            >
              <CalendarDays size={18} style={{ color: color.bar }} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-gray-900 truncate">{item.campaign_name}</h2>
              <div className="flex gap-2 mt-1.5 flex-wrap">
                <span className="badge bg-gray-100 text-gray-600 text-[10px]">{CHANNEL_LABELS[item.channel]}</span>
                <span className={cn("badge text-[10px]", STATUS_COLORS[item.status])}>
                  {STATUS_LABELS[item.status]}
                </span>
                {item.campaign_deadline && (
                  <span className="badge bg-amber-50 text-amber-700 border border-amber-100 text-[10px]">
                    Deadline: {formatDate(item.campaign_deadline)}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0 mt-1">
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Copyable content */}
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5">Nội dung</p>
              <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-gray-100">
                {item.copy_text || item.content_preview || "—"}
              </div>
              <button
                onClick={onCopy}
                className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#377D73] transition-colors"
              >
                {copied ? (
                  <><Check size={12} className="text-green-500" /> Đã copy!</>
                ) : (
                  <><Copy size={12} /> Copy nội dung</>
                )}
              </button>
            </div>

            {/* Suggestion dates */}
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={13} className="text-amber-500" />
                <p className="text-xs font-bold text-gray-700">Gợi ý ngày đăng</p>
              </div>

              {suggestLoading && <p className="text-xs text-gray-400 py-2">Đang phân tích…</p>}
              {suggestErr && <p className="text-xs text-red-600 py-2">{suggestErr}</p>}

              {suggestData && !suggestLoading && (
                <div className="space-y-3">
                  {suggestData.horizon_days <= 1 && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                      Deadline rất gần — cân nhắc dời deadline hoặc đăng ngay hôm nay.
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {suggestData.suggestions.map((s) => (
                      <button
                        key={s.date}
                        onClick={() => setRescheduleDate(s.date)}
                        className={cn(
                          "rounded-lg border px-2.5 py-1.5 text-[11px] transition-all",
                          rescheduleDate === s.date
                            ? "border-[#377D73] bg-[#377D73]/10 text-[#377D73] font-semibold shadow-sm"
                            : "border-gray-200 bg-white text-gray-600 hover:border-[#377D73]/40"
                        )}
                        title={s.reasons.slice(0, 2).join(" · ")}
                      >
                        {format(parseISO(s.date), "EEE d/M", { locale: vi })}
                      </button>
                    ))}
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-[11px] leading-relaxed text-gray-500">{suggestData.rules_summary}</p>
                    {suggestData.suggestions[0]?.reasons[0] && (
                      <p className="text-[10px] text-gray-400 mt-1.5">
                        Lý do: {suggestData.suggestions[0].reasons[0]}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Reschedule */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Đổi ngày đăng</p>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="input text-sm flex-1"
                />
                <button
                  onClick={onReschedule}
                  disabled={rescheduling || rescheduleDate === item.scheduled_date}
                  className="btn-primary text-sm disabled:opacity-40 whitespace-nowrap"
                >
                  {rescheduling ? "Đang lưu…" : "Lưu"}
                </button>
              </div>
              {rescheduleMsg && (
                <p className={cn("text-xs mt-1.5", rescheduleMsg.includes("thất bại") ? "text-red-600" : "text-green-600")}>
                  {rescheduleMsg}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
            <button
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Main Page ─────────────────────────────────────────────────────────── */

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("approved");
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Modal state
  const [modalItem, setModalItem] = useState<CalendarItem | null>(null);
  const [modalColorIdx, setModalColorIdx] = useState(0);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleMsg, setRescheduleMsg] = useState("");
  const [suggestData, setSuggestData] = useState<SuggestDatesResponse | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestErr, setSuggestErr] = useState("");

  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [updatingReminder, setUpdatingReminder] = useState(false);

  const monthStr = format(currentDate, "yyyy-MM");

  // Load reminder preference
  useEffect(() => {
    api.get<{ email_reminder_enabled: boolean }>("/auth/me")
      .then((u) => setReminderEnabled(u.email_reminder_enabled !== false))
      .catch(() => {});
  }, []);

  async function toggleReminder() {
    setUpdatingReminder(true);
    const next = !reminderEnabled;
    try {
      await api.patch("/auth/me", { email_reminder_enabled: next });
      setReminderEnabled(next);
    } catch {
      // revert on error
    } finally {
      setUpdatingReminder(false);
    }
  }

  function loadCalendar() {
    setLoading(true);
    const params = new URLSearchParams({ month: monthStr });
    if (channelFilter !== "all") params.set("channel", channelFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    api.get<{ month: string; items: CalendarItem[] }>(`/calendar?${params.toString()}`)
      .then((r) => setItems(r.items))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadCalendar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStr, channelFilter, statusFilter]);

  function openModal(item: CalendarItem, colorIdx: number) {
    setModalItem(item);
    setModalColorIdx(colorIdx);
    setRescheduleDate(item.scheduled_date);
    setRescheduleMsg("");
    setCopied(false);
    setSuggestData(null);
    setSuggestErr("");
    setSuggestLoading(true);
    api
      .get<SuggestDatesResponse>(`/calendar/items/${item.id}/suggest-dates`)
      .then(setSuggestData)
      .catch(() => setSuggestErr("Không tải được gợi ý."))
      .finally(() => setSuggestLoading(false));
  }

  function closeModal() {
    setModalItem(null);
    setSuggestData(null);
    setSuggestErr("");
    setSuggestLoading(false);
  }

  async function handleReschedule() {
    if (!modalItem || !rescheduleDate) return;
    setRescheduling(true);
    setRescheduleMsg("");
    try {
      await api.patch(`/calendar/${modalItem.id}`, { scheduled_date: rescheduleDate });
      setRescheduleMsg("Đã lưu ngày mới.");
      loadCalendar();
    } catch {
      setRescheduleMsg("Dời lịch thất bại.");
    } finally {
      setRescheduling(false);
    }
  }

  function handleCopy() {
    if (!modalItem) return;
    const text = modalItem.copy_text || modalItem.content_preview;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Campaign color map (stable per campaign_id) ──────────────────────
  const campaignColorMap = useMemo(() => {
    const ids = Array.from(new Set(items.map((i) => i.campaign_id)));
    const map: Record<string, number> = {};
    ids.forEach((id, idx) => { map[id] = idx; });
    return map;
  }, [items]);

  // ── Campaign metadata map (start_date, deadline) ───────────────────────
  const campaignMeta = useMemo(() => {
    const meta: Record<string, { start: Date | null; deadline: Date | null }> = {};
    for (const item of items) {
      if (!meta[item.campaign_id]) {
        meta[item.campaign_id] = {
          start: item.campaign_start_date ? parseISO(item.campaign_start_date) : null,
          deadline: item.campaign_deadline ? parseISO(item.campaign_deadline) : null,
        };
      }
    }
    return meta;
  }, [items]);

  // ── Unique campaigns in view (for timeline legend) ──────────────────────
  const visibleCampaigns = useMemo(() => {
    const seen = new Map<string, { name: string; start: Date | null; deadline: Date | null; colorIdx: number }>();
    for (const item of items) {
      if (!seen.has(item.campaign_id)) {
        seen.set(item.campaign_id, {
          name: item.campaign_name,
          start: item.campaign_start_date ? parseISO(item.campaign_start_date) : null,
          deadline: item.campaign_deadline ? parseISO(item.campaign_deadline) : null,
          colorIdx: campaignColorMap[item.campaign_id] ?? 0,
        });
      }
    }
    return Array.from(seen.values());
  }, [items, campaignColorMap]);

  // ── Pre-compute timeline bars keyed by date ─────────────────────────────
  // { [dateKey]: Array<{ campaignId, color, isStart, isEnd, colorIdx }> }
  const timelineBarsByDate = useMemo(() => {
    const map: Record<string, Array<{ campaignId: string; colorIdx: number; isStart: boolean; isEnd: boolean }>> = {};
    for (const day of days) {
      const dateKey = format(day, "yyyy-MM-dd");
      const dayDate = day;
      const bars: Array<{ campaignId: string; colorIdx: number; isStart: boolean; isEnd: boolean }> = [];
      for (const c of visibleCampaigns) {
        if (!c.start && !c.deadline) continue;
        const cs = c.start ?? c.deadline;
        const ce = c.deadline ?? c.start;
        if (dayDate >= cs && dayDate <= ce) {
          bars.push({
            campaignId: c.name,
            colorIdx: c.colorIdx,
            isStart: !!c.start && isSameDay(dayDate, c.start),
            isEnd: !!c.deadline && isSameDay(dayDate, c.deadline),
          });
        }
      }
      if (bars.length > 0) map[dateKey] = bars;
    }
    return map;
  }, [days, visibleCampaigns]);

  // ── Calendar grid ─────────────────────────────────────────────────────
  const start = viewMode === "month"
    ? startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
    : startOfWeek(currentDate, { weekStartsOn: 1 });
  const end = viewMode === "month"
    ? endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
    : endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });

  const itemsByDate = useMemo(() => {
    const m: Record<string, CalendarItem[]> = {};
    for (const it of items) {
      const d = it.scheduled_date;
      if (!m[d]) m[d] = [];
      m[d].push(it);
    }
    return m;
  }, [items]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  function prevMonth() {
    if (viewMode === "month") {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
      return;
    }
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7));
  }
  function nextMonth() {
    if (viewMode === "month") {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
      return;
    }
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));
  }

  const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

  const CHANNEL_OPTIONS = [
    { value: "all", label: "Tất cả" },
  { value: "facebook_post", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "email", label: "Email" },
  { value: "video_script", label: "Kịch bản cho video" },
  ];

  return (
    <div className="min-h-screen bg-transparent">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
                <ChevronLeft size={20} />
              </Link>
              <CalendarDays size={22} className="text-[#377D73]" />
              <h1 className="text-xl font-semibold text-gray-900">Lịch đăng nội dung</h1>
            </div>
            <div className="flex items-center gap-3">
              <HelpDialogButton
                title="Hướng dẫn Lịch marketing"
                summary="Timeline hiển thị chiến dịch từ ngày bắt đầu đến deadline. Mỗi thanh màu là một chiến dịch."
                steps={[
                  "Timeline màu chạy từ ngày đầu tiên đến deadline của chiến dịch.",
                  "Chấm tròn trên timeline = ngày đăng thực tế.",
                  "Click vào chiến dịch hoặc chấm để mở chi tiết.",
                  "Dùng bộ lọc để xem theo kênh hoặc trạng thái.",
                  "Bật nhắc email để nhận thông báo ngày đăng.",
                ]}
                buttonClassName="btn-secondary text-xs"
              />
              <button
                onClick={toggleReminder}
                disabled={updatingReminder}
                className={cn(
                  "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors",
                  reminderEnabled
                    ? "border-[#377D73]/30 bg-[#377D73]/5 text-[#377D73]"
                    : "border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100"
                )}
              >
                {updatingReminder ? (
                  <span className="animate-spin text-xs">↻</span>
                ) : reminderEnabled ? (
                  <Bell size={13} />
                ) : (
                  <BellOff size={13} />
                )}
                <span>{reminderEnabled ? "Nhắc email" : "Tắt nhắc"}</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="btn-secondary p-1.5"><ChevronLeft size={16} /></button>
              <span className="text-sm font-semibold w-40 text-center text-gray-800">
                {format(currentDate, "MMMM yyyy", { locale: vi })}
              </span>
              <button onClick={nextMonth} className="btn-secondary p-1.5"><ChevronRight size={16} /></button>
            </div>
            <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5 bg-gray-50">
              <button
                onClick={() => setViewMode("month")}
                className={cn("px-3 py-1 text-xs rounded-md transition-colors", viewMode === "month" ? "bg-white shadow-sm font-semibold text-gray-800" : "text-gray-500 hover:text-gray-700")}
              >
                Tháng
              </button>
              <button
                onClick={() => setViewMode("week")}
                className={cn("px-3 py-1 text-xs rounded-md transition-colors", viewMode === "week" ? "bg-white shadow-sm font-semibold text-gray-800" : "text-gray-500 hover:text-gray-700")}
              >
                Tuần
              </button>
            </div>
            {/* Compact channel + status filter */}
            <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5 bg-gray-50 flex-wrap">
              {CHANNEL_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setChannelFilter(o.value)}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap",
                    channelFilter === o.value
                      ? "bg-white shadow-sm font-semibold text-gray-800"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {o.label}
                </button>
              ))}
              <div className="w-px h-4 bg-gray-300 mx-1 shrink-0" />
              <button
                onClick={() => setStatusFilter("approved")}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap",
                  statusFilter === "approved"
                    ? "bg-white shadow-sm font-semibold text-[#377D73]"
                    : "text-gray-400 hover:text-gray-700"
                )}
              >
                Đã duyệt
              </button>
              <button
                onClick={() => setStatusFilter("all")}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap",
                  statusFilter === "all"
                    ? "bg-white shadow-sm font-semibold text-gray-800"
                    : "text-gray-400 hover:text-gray-700"
                )}
              >
                Tất cả
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-5">
        {/* Empty state */}
        {!loading && items.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <CalendarDays size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="text-gray-500 mb-2">Chưa có nội dung nào được lên lịch.</p>
            <p className="text-sm text-gray-400">Tạo và duyệt chiến dịch để nội dung xuất hiện ở đây.</p>
          </div>
        )}

        {/* Timeline view */}
        {items.length > 0 && (
          <div className="space-y-3">
            {/* Calendar grid */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Day headers */}
              <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
                {WEEKDAYS.map((d) => (
                  <div key={d} className="text-center py-2 text-xs font-semibold text-gray-400 bg-gray-50 border-r border-gray-200 last:border-r-0">
                    {d}
                  </div>
                ))}
              </div>

              {/* Days */}
              <div className="relative" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                {days.map((day) => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  const dayItems = itemsByDate[dateKey] || [];
                  const sameMonth = isSameMonth(day, currentDate);
                  const today = isToday(day);
                  const hasItems = dayItems.length > 0;
                  const primaryColor = hasItems ? getCampaignColor(campaignColorMap[dayItems[0].campaign_id] ?? 0) : null;
                  const bars = timelineBarsByDate[dateKey] || [];

                  return (
                    <div
                      key={dateKey}
                      className={cn(
                        "relative border-r border-b border-gray-200 min-h-24 p-1.5",
                        !sameMonth && "bg-gray-50/60",
                        today && "bg-[#377D73]/4",
                        hasItems && sameMonth && primaryColor && "bg-[#377D73]/5"
                      )}
                      style={hasItems && sameMonth && primaryColor ? {
                        backgroundColor: `${primaryColor.bar}14`,
                      } : undefined}
                    >
                      {/* Campaign timeline bars */}
                      {bars.length > 0 && sameMonth && (
                        <div className="absolute left-0 right-0 top-1 z-10 pointer-events-none flex flex-col gap-0.5 px-1">
                          {bars.map((bar) => {
                            const color = getCampaignColor(bar.colorIdx);
                            return (
                              <div key={bar.campaignId} className="relative h-1.5">
                                <div
                                  className="absolute inset-y-0"
                                  style={{
                                    left: bar.isStart ? "4px" : "0",
                                    right: bar.isEnd ? "4px" : "0",
                                    backgroundColor: color.bar,
                                    opacity: 0.7,
                                    borderRadius: bar.isStart && bar.isEnd
                                      ? "9999px"
                                      : bar.isStart
                                        ? "9999px 2px 2px 9999px"
                                        : bar.isEnd
                                          ? "2px 9999px 9999px 2px"
                                          : "2px",
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Day number */}
                      <p className={cn(
                        "text-xs mb-1 font-semibold",
                        sameMonth ? (today ? "text-[#377D73]" : "text-gray-700") : "text-gray-300",
                        today && "w-6 h-6 rounded-full bg-[#377D73] text-white flex items-center justify-center"
                      )}>
                        {format(day, "d")}
                      </p>

                      {/* Content dots */}
                      <div className="flex flex-wrap gap-1 mt-3">
                        {dayItems.map((item) => {
                          const color = getCampaignColor(campaignColorMap[item.campaign_id] ?? 0);
                          return (
                            <button
                              key={item.id}
                              onClick={() => openModal(item, campaignColorMap[item.campaign_id] ?? 0)}
                              title={item.campaign_name}
                              className="w-4 h-4 rounded-full cursor-pointer hover:scale-125 transition-transform shrink-0"
                              style={{ backgroundColor: color.dot }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Campaign timeline legend */}
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">
                Chiến dịch đang hoạt động
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {visibleCampaigns.map((c) => {
                  const color = getCampaignColor(c.colorIdx);
                  const startStr = c.start ? format(c.start, "d/M") : "?";
                  const endStr = c.deadline ? format(c.deadline, "d/M") : "?";
                  return (
                    <div key={c.name} className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span
                          className="inline-block w-4 h-1.5 rounded-full"
                          style={{ backgroundColor: color.bar }}
                        />
                        <span className="text-xs text-gray-600 font-medium truncate max-w-[140px]" title={c.name}>
                          {c.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {startStr} → {endStr}
                      </span>
                    </div>
                  );
                })}
                {visibleCampaigns.length === 0 && (
                  <p className="text-xs text-gray-400 italic">Không có chiến dịch nào trong tháng này.</p>
                )}
              </div>
            </div>

            {/* Color legend */}
            <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#377D73]" />
                Hôm nay
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-1.5 rounded-full bg-[#818CF8]" />
                Chiến dịch đang hoạt động
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#818CF8]" />
                Nội dung đã lên lịch
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalItem && (
        <CampaignModal
          item={modalItem}
          colorIdx={modalColorIdx}
          onClose={closeModal}
          rescheduleDate={rescheduleDate}
          setRescheduleDate={setRescheduleDate}
          rescheduleMsg={rescheduleMsg}
          rescheduling={rescheduling}
          suggestData={suggestData}
          suggestLoading={suggestLoading}
          suggestErr={suggestErr}
          onReschedule={handleReschedule}
          copied={copied}
          onCopy={handleCopy}
        />
      )}
    </div>
  );
}
