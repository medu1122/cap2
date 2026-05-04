"use client";
import { ChevronRight } from "lucide-react";
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

const DURATION_OPTIONS = [
  { value: "1_week", label: "1 tuần", desc: "Ngắn hạn, intensity cao" },
  { value: "2_4_weeks", label: "2-4 tuần", desc: "Vừa phải" },
  { value: "1_month", label: "Cả tháng", desc: "Dài hạn, nhẹ nhàng" },
];

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

  const allFilled = userPrefs.target_customer && userPrefs.duration;

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

        <RadioGroup
          label="Bạn muốn chạy trong bao lâu?"
          options={DURATION_OPTIONS}
          value={userPrefs.duration}
          onChange={(v) => update("duration", v)}
        />
      </div>

      <button
        onClick={onNext}
        disabled={!allFilled}
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
