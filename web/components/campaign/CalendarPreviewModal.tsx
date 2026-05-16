"use client";
import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  CalendarDays,
  Mail,
  Facebook,
  Video,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
  parseISO,
} from "date-fns";
import { vi } from "date-fns/locale";
import { CHANNEL_LABELS } from "@/lib/utils";

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

interface PreviewCalendarItem {
  date: string;
  channel: string;
  contentPreview: string;
}

interface CalendarPreviewModalProps {
  contentItems: ContentItem[];
  isOpen: boolean;
  onClose: () => void;
  campaignName?: string;
  deadline?: string;
}

function ChannelDot({ channel }: { channel: string }) {
  const colors: Record<string, string> = {
    facebook_post: "bg-blue-700",
    email: "bg-violet-600",
    video_script: "bg-amber-700",
    tiktok: "bg-pink-600",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${colors[channel] || "bg-gray-400"}`}
      title={CHANNEL_LABELS[channel] || channel}
    />
  );
}

export default function CalendarPreviewModal({
  contentItems,
  isOpen,
  onClose,
}: CalendarPreviewModalProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Chuyển content_items thành calendar preview items..
  const calendarItems = useMemo(() => {
    return contentItems
      .filter((item) => item.scheduled_date)
      .map((item): PreviewCalendarItem => {
        const c = item.content_json || {};
        let preview = "";
        if (item.channel === "email") preview = (c.subject as string) || "";
        else if (item.channel === "facebook_post")
          preview = (c.copy as string) || (c.body as string) || "";
        else if (item.channel === "video_script")
          preview = (c.hook as string) || "";

        return {
          date: item.scheduled_date!,
          channel: item.channel,
          contentPreview:
            preview.slice(0, 50) + (preview.length > 50 ? "..." : ""),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [contentItems]);

  const itemsByDate = useMemo(() => {
    const map: Record<string, PreviewCalendarItem[]> = {};
    for (const item of calendarItems) {
      if (!map[item.date]) map[item.date] = [];
      map[item.date].push(item);
    }
    return map;
  }, [calendarItems]);

  const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });

  function prevMonth() {
    setCurrentDate((d) => subMonths(d, 1));
  }

  function nextMonth() {
    setCurrentDate((d) => addMonths(d, 1));
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-[#377D73]/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#377D73] rounded-xl flex items-center justify-center shadow-lg shadow-[#377D73]/20">
              <CalendarDays size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Xem trước lịch đăng bài
              </h2>
              <p className="text-xs text-gray-500">
                Lịch trình nội dung của chiến dịch
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Calendar Navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
          <button
            onClick={prevMonth}
            className="w-8 h-8 rounded-lg hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <h3 className="text-sm font-semibold text-gray-800">
            {format(currentDate, "MMMM yyyy", { locale: vi }).replace(
              /^\w/,
              (c) => c.toUpperCase(),
            )}
          </h3>
          <button
            onClick={nextMonth}
            className="w-8 h-8 rounded-lg hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <ChevronRight size={18} className="text-gray-600" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto p-4">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
              <div
                key={day}
                className="text-center text-[10px] font-semibold text-gray-500 py-1 uppercase tracking-wider"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isCurrentDay = isToday(day);
              const dayItems = itemsByDate[dateStr] || [];

              return (
                <div
                  key={dateStr}
                  className={`
                    min-h-[72px] rounded-lg p-1.5 border transition-all text-xs
                    ${!isCurrentMonth ? "bg-gray-50 border-gray-100 opacity-50" : "bg-white border-gray-200 hover:border-[#377D73]/30"}
                    ${isCurrentDay ? "ring-2 ring-[#377D73] ring-offset-1" : ""}
                  `}
                >
                  <div
                    className={`text-center font-medium mb-1 ${isCurrentDay ? "w-6 h-6 bg-[#377D73] text-white rounded-full flex items-center justify-center mx-auto" : "text-gray-700"}`}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5">
                    {dayItems.slice(0, 2).map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1 text-[9px] bg-gray-50 rounded px-1 py-0.5 truncate"
                      >
                        <ChannelDot channel={item.channel} />
                        <span className="truncate text-gray-600">
                          {item.contentPreview}
                        </span>
                      </div>
                    ))}
                    {dayItems.length > 2 && (
                      <div className="text-[9px] text-gray-400 text-center">
                        +{dayItems.length - 2} khác
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-700" />
              <span className="text-[10px] text-gray-500">Facebook</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-600" />
              <span className="text-[10px] text-gray-500">Email</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-700" />
              <span className="text-[10px] text-gray-500">Video</span>
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <div className="p-3 border-t border-gray-100 bg-gray-50/50 text-center">
          <p className="text-[10px] text-gray-400">
            Đây là lịch xem trước. Chỉ hiển thị nội dung đã được lên lịch.
          </p>
        </div>
      </div>
    </div>
  );
}
