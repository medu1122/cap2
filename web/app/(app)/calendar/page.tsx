"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, CalendarDays, Check } from "lucide-react";
import { api } from "@/lib/api-client";
import { STATUS_COLORS, STATUS_LABELS, CHANNEL_LABELS, cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday } from "date-fns";
import { vi } from "date-fns/locale";
import HelpDialogButton from "@/components/common/HelpDialogButton";

interface CalendarItem {
  id: string;
  campaign_id: string;
  campaign_name: string;
  channel: string;
  status: string;
  scheduled_date: string;
  content_preview: string;
  copy_text: string;
  content_json: Record<string, string>;
}

const CHANNEL_DOT: Record<string, string> = {
  facebook_post: "bg-blue-700",
  email: "bg-violet-600",
  video_script: "bg-amber-700",
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("approved");
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleMsg, setRescheduleMsg] = useState("");

  const monthStr = format(currentDate, "yyyy-MM");

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

  // Keep selected item in sync after reschedule
  useEffect(() => {
    if (selected) {
      const updated = items.find((i) => i.id === selected.id);
      if (updated) setSelected(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function selectItem(item: CalendarItem) {
    if (selected?.id === item.id) {
      setSelected(null);
    } else {
      setSelected(item);
      setRescheduleDate(item.scheduled_date);
      setRescheduleMsg("");
      setCopied(false);
    }
  }

  function handleCopy() {
    if (!selected) return;
    const text = selected.copy_text || selected.content_preview;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleReschedule() {
    if (!selected || !rescheduleDate) return;
    setRescheduling(true);
    setRescheduleMsg("");
    try {
      await api.patch(`/calendar/${selected.id}`, { scheduled_date: rescheduleDate });
      setRescheduleMsg("Đã dời lịch thành công.");
      loadCalendar();
    } catch {
      setRescheduleMsg("Dời lịch thất bại. Vui lòng thử lại.");
    } finally {
      setRescheduling(false);
    }
  }

  const start = viewMode === "month"
    ? startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
    : startOfWeek(currentDate, { weekStartsOn: 1 });
  const end = viewMode === "month"
    ? endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
    : endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });

  const itemsByDate = items.reduce((acc, item) => {
    const d = item.scheduled_date;
    if (!acc[d]) acc[d] = [];
    acc[d].push(item);
    return acc;
  }, {} as Record<string, CalendarItem[]>);

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

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="flex items-center gap-2">
            <CalendarDays size={20} className="text-gray-500" />
            Lịch đăng nội dung
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Lịch này lấy từ nội dung đã duyệt của chiến dịch; hệ thống phân tích lịch ngay từ lúc tạo chiến dịch.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <HelpDialogButton
            title="Hướng dẫn Lịch marketing"
            summary="Lịch này hiển thị nội dung đã duyệt và ngày đăng dự kiến để bạn điều phối dễ hơn."
            steps={[
              "Dùng bộ lọc để xem theo kênh hoặc trạng thái.",
              "Đổi chế độ Tháng/Tuần để quan sát theo nhu cầu.",
              "Bấm vào một nội dung để xem chi tiết và dời lịch.",
              "Sau khi dời lịch thành công, dữ liệu được lưu và không mất khi F5.",
            ]}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("month")}
              className={cn("btn-secondary text-xs py-1.5", viewMode === "month" && "bg-gray-200")}
            >
              Tháng
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={cn("btn-secondary text-xs py-1.5", viewMode === "week" && "bg-gray-200")}
            >
              Tuần
            </button>
          </div>
          <select className="input text-sm" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
            <option value="all">Tất cả kênh</option>
            <option value="facebook_post">Facebook</option>
            <option value="email">Email</option>
            <option value="video_script">Video</option>
          </select>
          <select className="input text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="approved">Đã duyệt</option>
            <option value="pending_approval">Chờ duyệt</option>
            <option value="rejected">Bị từ chối</option>
          </select>
          <button onClick={prevMonth} className="btn-secondary p-1.5"><ChevronLeft size={16} /></button>
          <span className="text-sm font-medium w-36 text-center">
            {format(currentDate, "MMMM yyyy", { locale: vi })}
          </span>
          <button onClick={nextMonth} className="btn-secondary p-1.5"><ChevronRight size={16} /></button>
        </div>
      </div>

      {!loading && items.length === 0 && (
        <div className="mb-4 text-sm text-gray-400 px-1">
          Chưa có nội dung nào được lên lịch cho tháng này. Tạo và duyệt chiến dịch để nội dung xuất hiện ở đây.
        </div>
      )}

      <div className="flex gap-6">
        <div className={cn("flex-1", selected && "pr-2")}>
          <div className="grid grid-cols-7 border-t border-l border-gray-200">
            {WEEKDAYS.map((d) => (
              <div key={d} className="border-b border-r border-gray-200 px-2 py-2 text-xs font-medium text-gray-500 text-center bg-surface">
                {d}
              </div>
            ))}
            {days.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayItems = itemsByDate[dateKey] || [];
              const sameMonth = isSameMonth(day, currentDate);
              const today = isToday(day);

              return (
                <div
                  key={dateKey}
                  className={cn(
                    "border-b border-r border-gray-200 min-h-24 p-1.5",
                    !sameMonth && "bg-gray-50",
                    today && "border-t-2 border-t-blue-600"
                  )}
                >
                  <p className={cn("text-xs mb-1", sameMonth ? "text-gray-700" : "text-gray-300", today && "font-semibold text-blue-600")}>
                    {format(day, "d")}
                  </p>
                  <div className="space-y-0.5">
                    {dayItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => selectItem(item)}
                        className={cn(
                          "w-full text-left px-1.5 py-0.5 rounded text-xs truncate flex items-center gap-1",
                          item.status === "approved" ? "opacity-100" : "opacity-70",
                          selected?.id === item.id ? "ring-1 ring-blue-400 bg-blue-50" : "hover:bg-gray-100"
                        )}
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", CHANNEL_DOT[item.channel] || "bg-gray-400")} />
                        <span className="truncate text-gray-700">{item.content_preview || item.campaign_name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {selected && (
          <div className="w-72 shrink-0">
            <div className="card sticky top-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2>Chi tiết</h2>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xs">Đóng</button>
              </div>

              <div>
                <p className="text-xs text-gray-500">Chiến dịch</p>
                <p className="text-sm font-medium">{selected.campaign_name}</p>
              </div>

              <div className="flex gap-2 items-center flex-wrap">
                <span className="badge bg-gray-100 text-gray-600">{CHANNEL_LABELS[selected.channel]}</span>
                <span className={cn("badge", STATUS_COLORS[selected.status])}>{STATUS_LABELS[selected.status]}</span>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">Nội dung</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {selected.copy_text || selected.content_preview || "—"}
                </p>
              </div>

              <button
                onClick={handleCopy}
                className="btn-secondary w-full flex items-center justify-center gap-1.5 text-xs py-1.5"
              >
                {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                {copied ? "Đã copy!" : "Copy nội dung"}
              </button>

              <div className="border-t border-gray-100 pt-3 space-y-2">
                <p className="text-xs text-gray-500 font-medium">Dời lịch đăng</p>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="input text-sm py-1 w-full"
                />
                <button
                  onClick={handleReschedule}
                  disabled={rescheduling || rescheduleDate === selected.scheduled_date}
                  className="btn-secondary w-full text-xs py-1.5 disabled:opacity-40"
                >
                  {rescheduling ? "Đang lưu..." : "Lưu ngày mới"}
                </button>
                {rescheduleMsg && (
                  <p className={cn("text-xs", rescheduleMsg.includes("thất bại") ? "text-red-600" : "text-green-600")}>
                    {rescheduleMsg}
                  </p>
                )}
              </div>

              <a
                href={`/campaigns/${selected.campaign_id}`}
                className="btn-secondary text-xs py-1 w-full justify-center block text-center"
              >
                Xem chiến dịch đầy đủ →
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
        {Object.entries(CHANNEL_DOT).map(([ch, color]) => (
          <span key={ch} className="flex items-center gap-1">
            <span className={cn("w-2 h-2 rounded-full", color)} />
            {CHANNEL_LABELS[ch]}
          </span>
        ))}
        <span className="ml-auto italic">Click vào mục để xem nội dung và dời lịch</span>
      </div>
    </div>
  );
}
