"use client";
import { useState } from "react";
import { Lightbulb, ChevronRight, Check } from "lucide-react";
import { api } from "@/lib/api-client";
import type { SuggestionItem } from "../CampaignAssistantModal";

interface Props {
  brandId: string;
  suggestions: SuggestionItem[];
  onSuggestionsChange: (s: SuggestionItem[]) => void;
  selectedSuggestion: SuggestionItem | null;
  onSelectSuggestion: (s: SuggestionItem | null) => void;
  onNext: () => void;
}

export default function StepSuggestions({
  brandId,
  suggestions,
  onSuggestionsChange,
  selectedSuggestion,
  onSelectSuggestion,
  onNext,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  async function loadSuggestions() {
    setLoading(true);
    setError("");
    try {
      const res = await api.post<{ suggestions: SuggestionItem[] }>("/campaign-ideas/suggest", {
        brand_id: brandId,
      });
      onSuggestionsChange(res.suggestions);
    } catch {
      setError("Không tải được. Thử lại.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMoreSuggestions() {
    setLoadingMore(true);
    setError("");
    try {
      const existingTitles = suggestions.map((s) => s.title);
      const res = await api.post<{ suggestions: SuggestionItem[] }>("/campaign-ideas/suggest-more", {
        brand_id: brandId,
        existing_titles: existingTitles,
      });
      const existingIds = new Set(suggestions.map((s) => s.id));
      const newSuggestions = res.suggestions.filter((s) => !existingIds.has(s.id));
      onSuggestionsChange([...suggestions, ...newSuggestions]);
    } catch {
      setError("Không tải được thêm.");
    } finally {
      setLoadingMore(false);
    }
  }

  // Chưa load lần nào
  if (suggestions.length === 0 && !loading) {
    return (
      <div className="space-y-4 text-center py-10">
        <div className="w-12 h-12 rounded-full bg-[#377D73]/10 flex items-center justify-center mx-auto">
          <Lightbulb size={22} className="text-[#377D73]" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">Gợi ý chiến dịch</h3>
        <p className="text-sm text-gray-500">
          AI phân tích thương hiệu và đề xuất ý tưởng phù hợp
        </p>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button onClick={loadSuggestions} className="btn-primary px-8 py-2.5">
          Bắt đầu gợi ý
        </button>
      </div>
    );
  }

  // Loading lần đầu (chưa có gì)
  if (loading) {
    return (
      <div className="space-y-3 text-center py-12">
        <div className="w-10 h-10 rounded-full bg-[#377D73]/10 flex items-center justify-center mx-auto animate-pulse">
          <Lightbulb size={20} className="text-[#377D73]" />
        </div>
        <p className="text-sm font-medium text-gray-600">AI đang phân tích...</p>
        <p className="text-xs text-gray-400">Chờ vài giây</p>
      </div>
    );
  }

  // Đã load rồi → luôn render danh sách, spinner inline dưới cùng
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          {suggestions.length} ý tưởng
        </h3>
        {!loadingMore && (
          <button
            onClick={loadMoreSuggestions}
            className="text-xs text-[#377D73] hover:text-[#2d6860] font-medium transition-colors"
          >
            Xem thêm
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Danh sách ý tưởng */}
      <div className="space-y-2">
        {suggestions.map((s) => {
          const isSelected = selectedSuggestion?.id === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSelectSuggestion(s)}
              className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                isSelected
                  ? "border-[#377D73] bg-[#377D73]/5 shadow-sm"
                  : "border-gray-200 hover:border-[#377D73]/40 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Radio indicator */}
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 transition-colors ${
                    isSelected
                      ? "border-[#377D73] bg-[#377D73]"
                      : "border-gray-300"
                  }`}
                >
                  {isSelected && <Check size={10} className="text-white" />}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <p className="text-sm font-medium text-gray-900 leading-snug">{s.title}</p>

                  {/* Description */}
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">
                    {s.description}
                  </p>

                  {/* Reasoning */}
                  {s.reasoning && (
                    <p className="text-xs text-[#377D73] mt-1 italic leading-relaxed">
                      → {s.reasoning}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {/* Spinner inline khi đang load thêm */}
        {loadingMore && (
          <div className="flex items-center gap-2 py-3 px-3.5 text-xs text-gray-400">
            <div className="w-4 h-4 rounded-full border-2 border-[#377D73] border-t-transparent animate-spin shrink-0" />
            <span>Đang thêm ý tưởng...</span>
          </div>
        )}
      </div>

      {/* Chọn */}
      <button
        onClick={onNext}
        disabled={!selectedSuggestion}
        className="w-full btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
      >
        Chọn ý tưởng này
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
