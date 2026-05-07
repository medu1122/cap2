"use client";
import { useState, useEffect, useRef } from "react";
import { Lightbulb, RefreshCw, ChevronRight, Clock, Users, Plus } from "lucide-react";
import { api } from "@/lib/api-client";
import type { SuggestionItem } from "../CampaignAssistantModal";

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  retention: { label: "Giữ chân", color: "bg-green-100 text-green-700" },
  acquisition: { label: "Kéo khách mới", color: "bg-blue-100 text-blue-700" },
  awareness: { label: "Nhận diện", color: "bg-purple-100 text-purple-700" },
  upsell: { label: "Upsell", color: "bg-amber-100 text-amber-700" },
  seasonal: { label: "Theo mùa", color: "bg-orange-100 text-orange-700" },
};

const URGENCY_ICONS: Record<string, string> = {
  high: "🔴",
  medium: "🟡",
  low: "🟢",
};

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
  const [customIdea, setCustomIdea] = useState("");
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Timer for loading state
  useEffect(() => {
    if (loading || loadingMore) {
      setLoadingSeconds(0);
      intervalRef.current = setInterval(() => {
        setLoadingSeconds(s => s + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setLoadingSeconds(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loading, loadingMore]);

  async function loadSuggestions() {
    setLoading(true);
    setError("");
    try {
      const res = await api.post<{ suggestions: SuggestionItem[] }>("/campaign-ideas/suggest", {
        brand_id: brandId,
      });
      onSuggestionsChange(res.suggestions);
    } catch {
      setError("Không thể gợi ý. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMoreSuggestions() {
    setLoadingMore(true);
    setError("");
    try {
      const existingTitles = suggestions.map(s => s.title);
      const res = await api.post<{ suggestions: SuggestionItem[] }>("/campaign-ideas/suggest-more", {
        brand_id: brandId,
        existing_titles: existingTitles,
      });
      // Merge new suggestions with existing ones, avoiding duplicates
      const existingIds = new Set(suggestions.map(s => s.id));
      const newSuggestions = res.suggestions.filter(s => !existingIds.has(s.id));
      onSuggestionsChange([...suggestions, ...newSuggestions]);
    } catch {
      setError("Không thể tải thêm. Vui lòng thử lại.");
    } finally {
      setLoadingMore(false);
    }
  }

  function selectSuggestion(s: SuggestionItem) {
    onSelectSuggestion(s);
    setCustomIdea("");
  }

  function handleCustomIdea() {
    if (!customIdea.trim()) return;
    const custom: SuggestionItem = {
      id: "custom",
      title: customIdea.trim(),
      description: "Ý tưởng tự nhập của bạn",
      category: "awareness",
      channels: ["facebook_post", "email"],
      hook: null,
      timing: null,
      customer_segment: null,
      urgency_level: null,
    };
    onSelectSuggestion(custom);
    setCustomIdea("");
  }

  if (suggestions.length === 0 && !loading) {
    return (
      <div className="space-y-4 text-center py-8">
        <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mx-auto">
          <Lightbulb size={24} className="text-yellow-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Tìm ý tưởng cho bạn</h3>
        <p className="text-sm text-gray-600">
          AI sẽ phân tích thương hiệu và đề xuất ý tưởng chiến dịch
          <br />
          dựa trên xu hướng + dịp lễ sắp tới.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={loadSuggestions} className="btn-primary px-6 py-3">
          <Lightbulb size={16} className="inline mr-2" />
          Gợi ý chiến dịch
        </button>
      </div>
    );
  }

  if (loading || loadingMore) {
    return (
      <div className="space-y-4 text-center py-8">
        <div className="text-5xl font-bold text-blue-500 tabular-nums">
          {loadingSeconds}s
        </div>
        <p className="text-gray-600">{loadingMore ? "Đang tải thêm ý tưởng..." : "AI đang phân tích và gợi ý..."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          Gợi ý cho bạn ({suggestions.length} ý tưởng)
        </h3>
        <button
          onClick={loadSuggestions}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
        >
          <RefreshCw size={12} />
          Gợi ý lại
        </button>
      </div>

      <div className="space-y-3">
        {suggestions.map((s) => {
          const cat = CATEGORY_LABELS[s.category] || { label: s.category, color: "bg-gray-100 text-gray-600" };
          const isSelected = selectedSuggestion?.id === s.id;
          return (
            <button
              key={s.id}
              onClick={() => selectSuggestion(s)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                isSelected
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/50"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Radio */}
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                  isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300"
                }`}>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Title + category */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {s.urgency_level && (
                      <span title="Mức độ khẩn cấp">
                        {URGENCY_ICONS[s.urgency_level] || "⚪"}
                      </span>
                    )}
                    <span className="font-medium text-gray-900">{s.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${cat.color}`}>
                      {cat.label}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{s.description}</p>

                  {/* Hook */}
                  {s.hook && (
                    <p className="text-sm text-blue-600 mt-1 font-medium">
                      → {s.hook}
                    </p>
                  )}

                  {/* Meta: timing + segment */}
                  {(s.timing || s.customer_segment) && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {s.timing && (
                        <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full border border-orange-200">
                          <Clock size={10} />
                          {s.timing}
                        </span>
                      )}
                      {s.customer_segment && (
                        <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                          <Users size={10} />
                          {s.customer_segment}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom idea */}
      <div className="border-t border-gray-100 pt-4 space-y-2">
        <p className="text-xs text-gray-500">Hoặc tự nhập ý tưởng:</p>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="VD: Chiến dịch khuyến mãi Tết..."
            value={customIdea}
            onChange={(e) => setCustomIdea(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCustomIdea()}
          />
          <button onClick={handleCustomIdea} className="btn-secondary">
            Dùng
          </button>
        </div>
      </div>

      {/* Xem thêm button */}
      <button
        onClick={loadMoreSuggestions}
        className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 flex items-center justify-center gap-2 transition-colors"
      >
        <Plus size={14} />
        Xem thêm ý tưởng
      </button>

      <button
        onClick={onNext}
        disabled={!selectedSuggestion}
        className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        Chọn ý tưởng này
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
