"use client";
import { useState } from "react";
import { ChevronRight, CalendarDays } from "lucide-react";
import type { SuggestionItem, UserPrefs } from "../CampaignAssistantModal";

interface Props {
  userPrefs: UserPrefs;
  onPrefsChange: (p: UserPrefs) => void;
  suggestion: SuggestionItem | null;
  onNext: () => void;
}

const TARGET_OPTIONS = [
  { value: "existing", label: "Khách cũ", desc: "Người đã từng mua hàng" },
  { value: "new", label: "Khách mới", desc: "Người chưa từng mua" },
  { value: "all", label: "Tất cả", desc: "Cả cũ và mới" },
];

const DATE_PRESETS = [
  { days: 7, label: "1 tuần" },
  { days: 14, label: "2 tuần" },
  { days: 30, label: "1 tháng" },
  { days: 60, label: "2 tháng" },
  { days: 90, label: "3 tháng" },
];

// Helper: get today's date in YYYY-MM-DD format (local timezone)
function todayStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper: add N days to a date string
function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function RadioGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string; desc: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`text-left p-3 rounded-xl border-2 transition-all ${
              value === opt.value
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-blue-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                value === opt.value ? "border-blue-500 bg-blue-500" : "border-gray-300"
              }`}>
                {value === opt.value && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                <p className="text-xs text-gray-500">{opt.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function StepUserPrefs({
  userPrefs,
  onPrefsChange,
  suggestion,
  onNext,
}: Props) {
  function update(key: keyof UserPrefs, value: string) {
    onPrefsChange({ ...userPrefs, [key]: value });
  }

  function applyPreset(days: number) {
    const start = todayStr();
    const end = addDaysStr(start, days);
    onPrefsChange({ ...userPrefs, start_date: start, end_date: end });
  }

  const allFilled = userPrefs.target_customer && userPrefs.start_date && userPrefs.end_date;
  const isDateValid = !userPrefs.start_date || !userPrefs.end_date ||
    new Date(userPrefs.start_date) <= new Date(userPrefs.end_date);

  const campaignDays = userPrefs.start_date && userPrefs.end_date && isDateValid
    ? Math.round((new Date(userPrefs.end_date).getTime() - new Date(userPrefs.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : null;

  return (
    <div className="space-y-6">
      {suggestion && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-600 font-medium mb-1">Chiến dịch đã chọn</p>
          <p className="font-semibold text-gray-900">{suggestion.title}</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            {suggestion.timing && (
              <span className="badge bg-blue-100 text-blue-700 text-xs">
                ⏰ {suggestion.timing}
              </span>
            )}
            {suggestion.customer_segment && (
              <span className="badge bg-purple-100 text-purple-700 text-xs">
                👥 {suggestion.customer_segment}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="space-y-5">
        <RadioGroup
          label="Bạn muốn nhắm đến đối tượng nào?"
          options={TARGET_OPTIONS}
          value={userPrefs.target_customer}
          onChange={(v) => update("target_customer", v)}
        />

        {/* Date range picker */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            Thời gian chạy chiến dịch
            {campaignDays ? (
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({campaignDays} ngày)
              </span>
            ) : null}
          </p>

          {/* Quick presets - 1 row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <CalendarDays size={13} className="text-gray-400 shrink-0" />
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.days}
                type="button"
                onClick={() => applyPreset(preset.days)}
                className="text-xs px-2.5 py-1.5 rounded-md bg-gray-100 hover:bg-blue-100 hover:text-blue-700 border border-gray-200 hover:border-blue-300 text-gray-700 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Date inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Ngày bắt đầu</label>
              <input
                type="date"
                className="input text-sm"
                value={userPrefs.start_date}
                min={todayStr()}
                onChange={(e) => update("start_date", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Ngày kết thúc</label>
              <input
                type="date"
                className="input text-sm"
                value={userPrefs.end_date}
                min={userPrefs.start_date || todayStr()}
                onChange={(e) => update("end_date", e.target.value)}
              />
            </div>
          </div>

          {/* Validation */}
          {!isDateValid && (
            <p className="text-xs text-red-500">Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu</p>
          )}
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!allFilled || !isDateValid}
        className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Xác nhận và tiếp tục
        <ChevronRight size={16} />
      </button>

      {!allFilled && (
        <p className="text-xs text-center text-gray-400">
          Vui lòng chọn đủ các mục để tiếp tục
        </p>
      )}
    </div>
  );
}
