"use client";
import { useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import StepIntro from "./steps/StepIntro";
import StepSuggestions from "./steps/StepSuggestions";
import StepUserPrefs from "./steps/StepUserPrefs";
import StepPreview from "./steps/StepPreview";

export type SuggestionItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  channels: string[];
  hook: string | null;
  timing: string | null;
  customer_segment: string | null;
  urgency_level: string | null;
};

export type UserPrefs = {
  target_customer: "all" | "existing" | "new" | "";
  start_date: string; // YYYY-MM-DD
  end_date: string;    // YYYY-MM-DD
};

export type BriefForm = {
  title: string;
  objective: string;
  channels: string[];
  hook: string;
  timing: string;
  customer_segment: string;
};

const STEPS = ["intro", "suggestions", "userprefs", "preview"] as const;
type Step = (typeof STEPS)[number];

const STEP_LABELS: Record<Step, string> = {
  intro: "Chọn thương hiệu",
  suggestions: "Gợi ý từ AI",
  userprefs: "Thu thập ý kiến",
  preview: "Xem trước",
};

interface Props {
  onClose: () => void;
}

export default function CampaignAssistantModal({ onClose }: Props) {
  const [step, setStep] = useState<Step>("intro");
  const [brandId, setBrandId] = useState<string>("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestionItem | null>(null);
  const [userPrefs, setUserPrefs] = useState<UserPrefs>({
    target_customer: "",
    start_date: "",
    end_date: "",
  });
  const [brief, setBrief] = useState<BriefForm>({
    title: "",
    objective: "",
    channels: [],
    hook: "",
    timing: "",
    customer_segment: "",
  });

  const stepIndex = STEPS.indexOf(step);

  function goNext() {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  }

  function goBack() {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 text-sm font-bold">AI</span>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Tạo chiến dịch với AI</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Step label */}
        <div className="px-6 py-2 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
          <span>Bước {stepIndex + 1} / {STEPS.length}</span>
          <span>{STEP_LABELS[step]}</span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === "intro" && (
            <StepIntro
              brandId={brandId}
              onBrandChange={setBrandId}
              onNext={goNext}
            />
          )}
          {step === "suggestions" && (
            <StepSuggestions
              brandId={brandId}
              suggestions={suggestions}
              onSuggestionsChange={setSuggestions}
              selectedSuggestion={selectedSuggestion}
              onSelectSuggestion={setSelectedSuggestion}
              onNext={goNext}
            />
          )}
          {step === "userprefs" && (
            <StepUserPrefs
              userPrefs={userPrefs}
              onPrefsChange={setUserPrefs}
              suggestion={selectedSuggestion}
              onNext={goNext}
            />
          )}
          {step === "preview" && (
            <StepPreview
              suggestion={selectedSuggestion}
              userPrefs={userPrefs}
              brief={brief}
              onBriefChange={setBrief}
              brandId={brandId}
              onClose={onClose}
            />
          )}
        </div>

        {/* Footer nav */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={goBack}
            disabled={stepIndex === 0}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
            Quay lại
          </button>

          <span />
        </div>
      </div>
    </div>
  );
}
