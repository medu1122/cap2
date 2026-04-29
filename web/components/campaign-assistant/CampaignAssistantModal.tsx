"use client";
import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import StepIntro from "./steps/StepIntro";
import StepSuggestions from "./steps/StepSuggestions";
import StepPreview from "./steps/StepPreview";
import StepBuilding from "./steps/StepBuilding";
import StepResult from "./steps/StepResult";

export type SuggestionItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  channels: string[];
  hook: string | null;
};

export type BriefForm = {
  title: string;
  objective: string;
  channels: string[];
  hook: string;
};

export type BlockStatus = "idle" | "loading" | "done" | "error";

export type ContentBlocks = {
  email: Record<string, unknown> | null;
  post: Record<string, unknown> | null;
  video: Record<string, unknown> | null;
  imagePrompt: string | null;
};

export type BuildingStatus = {
  email: BlockStatus;
  post: BlockStatus;
  video: BlockStatus;
  image: BlockStatus;
};

const STEPS = ["intro", "suggestions", "preview", "building", "result"] as const;
type Step = (typeof STEPS)[number];

interface Props {
  onClose: () => void;
}

export default function CampaignAssistantModal({ onClose }: Props) {
  const [step, setStep] = useState<Step>("intro");
  const [brandId, setBrandId] = useState<string>("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestionItem | null>(null);
  const [brief, setBrief] = useState<BriefForm>({
    title: "",
    objective: "",
    channels: [],
    hook: "",
  });
  const [ideaId, setIdeaId] = useState<string>("");
  const [blocks, setBlocks] = useState<ContentBlocks>({
    email: null,
    post: null,
    video: null,
    imagePrompt: null,
  });
  const [buildingStatus, setBuildingStatus] = useState<BuildingStatus>({
    email: "idle",
    post: "idle",
    video: "idle",
    image: "idle",
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

  function canGoNext() {
    return stepIndex < STEPS.length - 1;
  }

  function canGoBack() {
    return stepIndex > 0;
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
              <h2 className="font-semibold text-gray-900">AI Campaign Assistant</h2>
              <p className="text-xs text-gray-500">Wizard tạo chiến dịch</p>
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
          <span className="capitalize">
            {step === "intro" && "Chọn thương hiệu"}
            {step === "suggestions" && "AI gợi ý"}
            {step === "preview" && "Xem trước"}
            {step === "building" && "AI đang tạo nội dung"}
            {step === "result" && "Hoàn tất"}
          </span>
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
          {step === "preview" && (
            <StepPreview
              suggestion={selectedSuggestion}
              brief={brief}
              onBriefChange={setBrief}
              onIdeaIdChange={setIdeaId}
              onNext={goNext}
            />
          )}
          {step === "building" && (
            <StepBuilding
              ideaId={ideaId}
              blocks={blocks}
              onBlocksChange={setBlocks}
              buildingStatus={buildingStatus}
              onBuildingStatusChange={setBuildingStatus}
              onComplete={goNext}
            />
          )}
          {step === "result" && (
            <StepResult
              ideaId={ideaId}
              brief={brief}
              blocks={blocks}
              buildingStatus={buildingStatus}
              onClose={onClose}
            />
          )}
        </div>

        {/* Footer nav */}
        {step !== "building" && step !== "result" && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={goBack}
              disabled={!canGoBack()}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
              Quay lại
            </button>

            <span className="text-xs text-gray-400">
              {stepIndex + 1} / {STEPS.length}
            </span>

            <button
              onClick={goNext}
              disabled={!canGoNext()}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Tiếp tục
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
