"use client";
import { Video } from "lucide-react";

interface Props {
  content: Record<string, unknown>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
      {children}
    </p>
  );
}

export default function VideoScriptContent({ content: d }: Props) {
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

  if (!effectiveScenes && !effectiveOldScenes && !hooks && !caption) {
    return (
      <div className="text-center py-4">
        <Video size={20} className="text-gray-300 mx-auto mb-1" />
        <p className="text-xs text-gray-400">Chưa có kịch bản video</p>
      </div>
    );
  }

  // ─── RENDER: Format mới từ writer agent ─────────────────────────────────
  if (effectiveScenes || hooks) {
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

        {/* Hooks */}
        {hooks && (
          <div>
            <SectionLabel>Lựa chọn Hook (0-5s)</SectionLabel>
            <div className="space-y-1.5">
              {(["A", "B", "C"] as const).map((key) => {
                const hookType = hooks[`${key}_type`] as string | undefined;
                const hookText = hooks[`${key}_text`] as string | undefined;
                const hookOverlay = hooks[`${key}_text_overlay`] as string | undefined;
                const hookWhy = hooks[`${key}_why_viral`] as string | undefined;
                if (!hookText) return null;
                return (
                  <div key={key} className="border border-amber-200 bg-amber-50/40 rounded-lg p-2.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        key === "A" ? "bg-amber-200 text-amber-800" :
                        key === "B" ? "bg-rose-100 text-rose-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>
                        {key}
                      </span>
                      {hookType && (
                        <span className="text-[9px] text-gray-500 italic">{hookType}</span>
                      )}
                      {hookWhy && (
                        <span className="text-[9px] text-green-600 ml-auto">✓ {hookWhy}</span>
                      )}
                    </div>
                    {hookText && (
                      <p className="text-xs text-gray-700 leading-relaxed">{hookText}</p>
                    )}
                    {hookOverlay && (
                      <p className="text-[10px] text-gray-500 mt-1 italic">
                        Overlay: <span className="text-gray-600 not-italic">{hookOverlay}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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

        {/* CTA */}
        {ctaSection && (
          <div>
            <SectionLabel>Call-to-action</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {ctaSection.soft && (
                <div className="border border-gray-200 bg-gray-50 rounded-lg p-2.5">
                  <p className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold mb-1">Soft CTA</p>
                  <p className="text-[11px] text-gray-700 leading-relaxed">{ctaSection.soft}</p>
                  {ctaSection.soft_text_overlay && (
                    <p className="text-[10px] text-gray-400 mt-1">Overlay: {ctaSection.soft_text_overlay}</p>
                  )}
                </div>
              )}
              {ctaSection.hard && (
                <div className="border border-[#377D73]/30 bg-[#377D73]/5 rounded-lg p-2.5">
                  <p className="text-[9px] text-[#377D73] uppercase tracking-wide font-semibold mb-1">Hard CTA</p>
                  <p className="text-[11px] text-gray-800 font-medium leading-relaxed">{ctaSection.hard}</p>
                  {ctaSection.hard_text_overlay && (
                    <p className="text-[10px] text-gray-400 mt-1">Overlay: {ctaSection.hard_text_overlay}</p>
                  )}
                </div>
              )}
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
