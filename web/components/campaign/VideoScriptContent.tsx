"use client";
import { MousePointerClick, Eye } from "lucide-react";

interface Props {
  content: Record<string, unknown>;
}

export default function VideoScriptContent({ content: d }: Props) {
  const scenes = d.scenes as Record<string, unknown>[] | undefined;

  if (Array.isArray(scenes) && scenes.length > 0) {
    return (
      <div className="space-y-2">
        {scenes.map((scene, idx) => (
          <div key={idx} className="bg-amber-50/50 border border-amber-100 rounded-lg p-2.5 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-mono text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded font-semibold">
                Cảnh {(scene.sequence as number) || idx + 1}
              </span>
              <span className="text-[9px] text-amber-600 font-medium">
                ⏱ {(scene.duration as string) || "?"}
              </span>
              <span className="text-[9px] text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">
                📷 {(scene.camera_angle as string) || "góc tự do"}
              </span>
            </div>
            {(scene.setting as string) && (
              <div>
                <p className="text-[9px] text-amber-500 font-medium">🎬 {(scene.setting as string)}</p>
              </div>
            )}
            {(scene.subject_action as string) && (
              <p className="text-[10px] text-gray-600">🧑 {(scene.subject_action as string)}</p>
            )}
            {(scene.dialog_or_narration as string) && (
              <div className="bg-blue-50 border border-blue-100 rounded px-2 py-1">
                <p className="text-[9px] text-blue-500 font-medium">🎤 {(scene.dialog_or_narration as string)}</p>
              </div>
            )}
            {(scene.visual_note as string) && (
              <p className="text-[9px] text-gray-500 italic">🖼 {(scene.visual_note as string)}</p>
            )}
          </div>
        ))}

        {(d.voice_over as string) && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-2">
            <p className="text-[9px] text-blue-600 font-semibold uppercase tracking-wide mb-0.5">🎙 Voice-over toàn video</p>
            <p className="text-[11px] text-blue-800 whitespace-pre-line">{d.voice_over as string}</p>
          </div>
        )}
        {(d.background_music_suggestion as string) && (
          <p className="text-[10px] text-gray-500 italic">🎵 {(d.background_music_suggestion as string)}</p>
        )}
        {(d.call_to_action as string) && (
          <p className="text-[10px] text-gray-700 font-medium">📣 {(d.call_to_action as string)}</p>
        )}
        {(d.total_duration_estimate as string) && (
          <p className="text-[10px] text-gray-400">⏱ Tổng: {(d.total_duration_estimate as string)}</p>
        )}
      </div>
    );
  }

  // Fallback: format cũ
  return (
    <div className="space-y-1">
      {(["hook", "body", "cta"] as const).map((k) => (
        <div key={k}>
          <p className="text-[9px] text-gray-400 uppercase tracking-wide font-medium">
            {k === "hook" ? "Mở đầu" : k === "body" ? "Nội dung" : "CTA"}
          </p>
          <p className="text-xs text-gray-600 whitespace-pre-line">{d[k] as string}</p>
        </div>
      ))}
    </div>
  );
}
