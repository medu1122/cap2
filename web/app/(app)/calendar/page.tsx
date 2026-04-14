"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api-client";
import { STATUS_COLORS, STATUS_LABELS, CHANNEL_LABELS, cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday } from "date-fns";
import { vi } from "date-fns/locale";

interface CalendarItem {
  id: string;
  campaign_id: string;
  campaign_name: string;
  channel: string;
  status: string;
  scheduled_date: string;
  content_preview: string;
}

const CHANNEL_DOT: Record<string, string> = {
  facebook_post: "bg-blue-700",
  email: "bg-violet-600",
  video_script: "bg-amber-700",
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [loading, setLoading] = useState(false);

  const monthStr = format(currentDate, "yyyy-MM");

  useEffect(() => {
    setLoading(true);
    api.get<{ month: string; items: CalendarItem[] }>(`/calendar?month=${monthStr}`)
      .then((r) => setItems(r.items))
      .finally(() => setLoading(false));
  }, [monthStr]);

  const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });

  const itemsByDate = items.reduce((acc, item) => {
    const d = item.scheduled_date;
    if (!acc[d]) acc[d] = [];
    acc[d].push(item);
    return acc;
  }, {} as Record<string, CalendarItem[]>);

  function prevMonth() { setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  function nextMonth() { setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)); }

  const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1>Marketing Calendar</h1>
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="btn-secondary p-1.5"><ChevronLeft size={16} /></button>
          <span className="text-sm font-medium w-36 text-center">
            {format(currentDate, "MMMM yyyy", { locale: vi })}
          </span>
          <button onClick={nextMonth} className="btn-secondary p-1.5"><ChevronRight size={16} /></button>
        </div>
      </div>

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
                        onClick={() => setSelected(selected?.id === item.id ? null : item)}
                        className={cn(
                          "w-full text-left px-1.5 py-0.5 rounded text-xs truncate flex items-center gap-1",
                          item.status === "approved" ? "opacity-100" : item.status === "pending_approval" ? "opacity-70" : "opacity-50",
                          selected?.id === item.id ? "ring-1 ring-blue-400" : "hover:bg-gray-100"
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
              <div className="flex gap-2 items-center">
                <span className="badge bg-gray-100 text-gray-600">{CHANNEL_LABELS[selected.channel]}</span>
                <span className={cn("badge", STATUS_COLORS[selected.status])}>{STATUS_LABELS[selected.status]}</span>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Nội dung</p>
                <p className="text-sm text-gray-700">{selected.content_preview}</p>
              </div>
              <a
                href={`/campaigns/${selected.campaign_id}`}
                className="btn-secondary text-xs py-1 w-full justify-center"
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
      </div>
    </div>
  );
}
