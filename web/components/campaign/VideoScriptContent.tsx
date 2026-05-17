"use client";
import { Loader2, Video } from "lucide-react";

// VideoScriptContent receives parent props for its own loading state
interface Props {
  content: Record<string, unknown>;
  isPending?: boolean;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
      {children}
    </p>
  );
}

export default function VideoScriptContent({ content: d, isPending }: Props) {
  // Cấu trúc mới từ writer agent
  const scenes = d.scenes as Record<string, unknown>[] | undefined;
  const hooks = d.hooks as Record<string, string> | undefined;
  const ctaSection = d.cta as Record<string, string> | undefined;
  const hashtagsObj = d.hashtags as Record<string, string[]> | undefined;
  const caption = d.caption as string | undefined;
  const musicMood = d.music_mood as string | undefined;
  const musicSuggestion = d.music_suggestion as string | undefined;
  const productionTips = d.production_tips as string | undefined;
  const duration = d.duration as string | undefined;
  const recommendedFormat = d.recommended_format as string | undefined;

  // Fallback: cấu trúc cũ (dùng bởi regenerate endpoint trong content.py)
  const oldScenes = d.scenes as Record<string, unknown>[] | undefined;
  const isOldFormat = oldScenes && oldScenes.length > 0 && !("scene_number" in oldScenes[0]);

  // Nếu scenes trống → có thể format cũ có dữ liệu
  const effectiveScenes = (Array.isArray(scenes) && scenes.length > 0) ? scenes : null;
  const effectiveOldScenes = (Array.isArray(oldScenes) && oldScenes.length > 0 && isOldFormat) ? oldScenes : null;

  const hasContent = !!(effectiveScenes || effectiveOldScenes || caption);

  if (isPending && !hasContent) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2 animate-pulse">
          <div className="h-5 w-16 bg-gray-200 rounded-full" />
          <div className="h-5 w-12 bg-gray-200 rounded-full" />
        </div>
        <div className="border border-amber-200 bg-amber-50/40 rounded-lg p-2.5 space-y-2">
          <div className="flex gap-2">
            <div className="h-4 w-4 bg-amber-200 rounded" />
            <div className="h-3 w-20 bg-amber-200 rounded" />
          </div>
          <div className="h-8 bg-amber-100 rounded" />
        </div>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="border border-gray-200 bg-gray-50/60 rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <div className="h-4 w-12 bg-[#377D73]/20 rounded" />
                <div className="h-4 w-16 bg-gray-200 rounded" />
              </div>
              <div className="h-3 bg-gray-100 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-gray-400">
            <Loader2 size={12} className="animate-spin" />
            AI đang soạn kịch bản...
          </div>
        </div>
      </div>
    );
  }

  if (!hasContent) {
    return (
      <div className="text-center py-4">
        <Video size={20} className="text-gray-300 mx-auto mb-1" />
        <p className="text-xs text-gray-400">Chưa có kịch bản video</p>
      </div>
    );
  }

  // ─── RENDER: Format mới từ writer agent ─────────────────────────────────
  if (effectiveScenes) {
    return (
      <div className="space-y-4">

        {/* Meta info */}
        <div className="flex flex-wrap gap-2">
          {duration && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#377D73]/10 text-[#377D73] text-[10px] font-medium rounded-full">
              <span className="w-1.5 h-1.5 bg-[#377D73] rounded-full" />
              {duration}
            </span>
          )}
          {recommendedFormat && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-600 text-[10px] font-medium rounded-full border border-violet-100">
              {recommendedFormat}
            </span>
          )}
        </div>

        {/* Scenes */}
        {effectiveScenes && (
          <div>
            <SectionLabel>Các cảnh</SectionLabel>
            <div className="space-y-2">
              {effectiveScenes.map((scene, idx) => {
                const sceneNum = (scene.scene_number as number | undefined) ?? (scene.sequence as number | undefined) ?? (idx + 1);
                const timeRange = (scene.time_range as string | undefined) ?? (scene.duration as string | undefined) ?? "?";
                const visual = (scene.visual as string | undefined) ?? (scene.setting as string | undefined) ?? "";
                const dialogue = (scene.dialogue as string | undefined) ?? (scene.dialog_or_narration as string | undefined) ?? "";
                const textOverlay = (scene.text_overlay as string | undefined) ?? "";
                const broll = (scene.broll_suggestion as string | undefined) ?? (scene.visual_note as string | undefined) ?? "";
                const sound = (scene.sound as string | undefined) ?? (scene.background_music_suggestion as string | undefined) ?? "";
                const purpose = (scene.purpose as string | undefined) ?? "";
                const transition = (scene.transition as string | undefined) ?? "";
                const cameraAngle = (scene.camera_angle as string | undefined) ?? "";
                const subjectAction = (scene.subject_action as string | undefined) ?? "";

                return (
                  <div key={idx} className="border border-gray-200 bg-gray-50/60 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-white bg-[#377D73] px-1.5 py-0.5 rounded">
                        Cảnh {sceneNum}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        ⏱ {timeRange}
                      </span>
                      {purpose && (
                        <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                          {purpose}
                        </span>
                      )}
                      {cameraAngle && (
                        <span className="text-[9px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                          📷 {cameraAngle}
                        </span>
                      )}
                    </div>

                    {visual && (
                      <p className="text-[10px] text-gray-600 leading-relaxed">
                        <span className="font-medium text-gray-500">Hình ảnh:</span> {visual}
                      </p>
                    )}
                    {subjectAction && (
                      <p className="text-[10px] text-gray-600 leading-relaxed">
                        <span className="font-medium text-gray-500">Hành động:</span> {subjectAction}
                      </p>
                    )}
                    {dialogue && (
                      <div className="bg-blue-50 border border-blue-100 rounded px-2 py-1.5">
                        <p className="text-[10px] text-blue-700 font-medium">🎤 {dialogue}</p>
                      </div>
                    )}
                    {textOverlay && (
                      <p className="text-[10px] text-gray-500 italic">
                        <span className="font-medium not-italic text-gray-400">Text:</span> {textOverlay}
                      </p>
                    )}
                    {broll && (
                      <p className="text-[10px] text-gray-500 italic">
                        <span className="font-medium not-italic text-gray-400">B-roll:</span> {broll}
                      </p>
                    )}
                    {sound && (
                      <p className="text-[10px] text-gray-500 italic">
                        <span className="font-medium not-italic text-gray-400">Âm thanh:</span> {sound}
                      </p>
                    )}
                    {transition && (
                      <p className="text-[10px] text-gray-400 italic">
                        → Chuyển cảnh: {transition}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Caption + Hashtags */}
        {(caption || hashtagsObj) && (
          <div>
            <SectionLabel>Đăng kèm video</SectionLabel>
            {caption && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{caption}</p>
              </div>
            )}
            {hashtagsObj && Object.values(hashtagsObj).some(Boolean) && (
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.entries(hashtagsObj).map(([tier, tags]) => {
                  if (!Array.isArray(tags) || tags.length === 0) return null;
                  return tags.map((tag) => (
                    <span key={tag} className="text-[10px] text-[#377D73]">#{tag.replace("#", "")} </span>
                  ));
                })}
              </div>
            )}
          </div>
        )}

        {/* Music */}
        {(musicMood || musicSuggestion) && (
          <div>
            <SectionLabel>Âm nhạc</SectionLabel>
            <div className="flex flex-wrap gap-3">
              {musicMood && (
                <span className="text-[11px] text-gray-700">
                  <span className="font-medium text-gray-500">Mood:</span> {musicMood}
                </span>
              )}
              {musicSuggestion && (
                <span className="text-[11px] text-gray-700">
                  <span className="font-medium text-gray-500">Gợi ý:</span> {musicSuggestion}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Production tips */}
        {productionTips && (
          <div>
            <SectionLabel>Mẹo sản xuất</SectionLabel>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
              <p className="text-[11px] text-gray-700 whitespace-pre-line leading-relaxed">{productionTips}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── RENDER: Format cũ (từ regenerate endpoint) ─────────────────────────────
  if (effectiveOldScenes) {
    return (
      <div className="space-y-3">
        {effectiveOldScenes.map((scene, idx) => (
          <div key={idx} className="border border-gray-200 bg-gray-50/60 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-white bg-[#377D73] px-1.5 py-0.5 rounded">
                Cảnh {(scene.sequence as number) || idx + 1}
              </span>
              {(scene.duration as string) && (
                <span className="text-[10px] text-gray-500">⏱ {(scene.duration as string)}</span>
              )}
              {(scene.camera_angle as string) && (
                <span className="text-[9px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                  📷 {(scene.camera_angle as string)}
                </span>
              )}
            </div>
            {(scene.setting as string) && (
              <p className="text-[10px] text-gray-600 leading-relaxed">
                <span className="font-medium text-gray-500">Bối cảnh:</span> {(scene.setting as string)}
              </p>
            )}
            {(scene.subject_action as string) && (
              <p className="text-[10px] text-gray-600 leading-relaxed">
                <span className="font-medium text-gray-500">Hành động:</span> {(scene.subject_action as string)}
              </p>
            )}
            {(scene.dialog_or_narration as string) && (
              <div className="bg-blue-50 border border-blue-100 rounded px-2 py-1.5">
                <p className="text-[10px] text-blue-700 font-medium">🎤 {(scene.dialog_or_narration as string)}</p>
              </div>
            )}
            {(scene.visual_note as string) && (
              <p className="text-[10px] text-gray-500 italic">
                <span className="font-medium not-italic text-gray-400">Hình ảnh:</span> {(scene.visual_note as string)}
              </p>
            )}
          </div>
        ))}

        {(d.voice_over as string) && (
          <div>
            <SectionLabel>Voice-over</SectionLabel>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5">
              <p className="text-xs text-blue-800 whitespace-pre-line leading-relaxed">{(d.voice_over as string)}</p>
            </div>
          </div>
        )}
        {(d.background_music_suggestion as string) && (
          <p className="text-[10px] text-gray-500 italic">🎵 {(d.background_music_suggestion as string)}</p>
        )}
        {(d.call_to_action as string) && (
          <div>
            <SectionLabel>CTA</SectionLabel>
            <p className="text-xs text-gray-700 bg-[#377D73]/5 border border-[#377D73]/20 rounded-lg px-3 py-2">
              {(d.call_to_action as string)}
            </p>
          </div>
        )}
        {(d.total_duration_estimate as string) && (
          <p className="text-[10px] text-gray-400">⏱ Tổng thời lượng: {(d.total_duration_estimate as string)}</p>
        )}
      </div>
    );
  }

  return null;
}
