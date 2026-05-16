"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { ExternalLink } from "lucide-react";

interface TrackingLink {
  id: string;
  short_code: string;
  name: string;
  link_type: string;
}

interface Props {
  contentId: string;
  campaignId: string;
  content: Record<string, unknown>;
  editing: boolean;
  draft: Record<string, unknown>;
  setDraft: (d: Record<string, unknown>) => void;
  isPending: boolean;
  startEdit: () => void;
}

export default function FacebookPostContent({
  contentId,
  campaignId,
  content: c,
  editing,
  draft,
  setDraft,
  isPending,
  startEdit,
}: Props) {
  const [fbLinks, setFbLinks] = useState<TrackingLink[]>([]);

  useEffect(() => {
    if (!campaignId) return;
    api.get<TrackingLink[]>(`/campaigns/${campaignId}/tracking-links`)
      .then((links) => setFbLinks(links.filter((l) => l.link_type === "facebook_post")))
      .catch(() => setFbLinks([]));
  }, [campaignId]);

  const d = editing ? draft : c;
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div>
      {/* Copy bài đăng */}
      {editing ? (
        <textarea
          className="w-full text-xs text-gray-600 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#377D73]/40 bg-gray-50 resize-none leading-relaxed"
          rows={5}
          value={(d.copy as string) || ""}
          onChange={(e) => setDraft({ ...draft, copy: e.target.value })}
          placeholder="Nhập nội dung bài đăng..."
        />
      ) : (
        <p
          className="text-xs text-gray-600 whitespace-pre-line leading-relaxed cursor-text hover:bg-gray-50 rounded px-1 -mx-1 py-0.5 transition-colors"
          onClick={isPending ? undefined : startEdit}
          title={!isPending ? "Nhấn để chỉnh sửa" : undefined}
        >{c.copy as string}</p>
      )}

      {/* Hashtags + link đích */}
      {editing ? (
        <div className="mt-3 space-y-2">
          <div>
            <p className="text-[9px] text-gray-400 uppercase tracking-wide font-medium mb-1">Hashtags</p>
            <textarea
              className="w-full text-xs text-gray-600 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#377D73]/40 bg-gray-50 resize-none leading-relaxed"
              rows={2}
              value={((d.hashtags as string[]) || []).join(", ")}
              onChange={(e) => setDraft({ ...draft, hashtags: e.target.value.split(",").map((h) => h.trim()).filter(Boolean) })}
              placeholder="#hashtag1, #hashtag2, ..."
            />
          </div>
          <div>
            <p className="text-[9px] text-gray-400 uppercase tracking-wide font-medium mb-1">Link đích (CTA)</p>
            <input
              type="url"
              className="w-full text-xs text-gray-600 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#377D73]/40 bg-gray-50"
              value={(d.cta_url as string) || ""}
              onChange={(e) => setDraft({ ...draft, cta_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div>
            <p className="text-[9px] text-gray-400 uppercase tracking-wide font-medium mb-1">Link bài đăng Facebook</p>
            <input
              type="url"
              className="w-full text-xs text-gray-600 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#377D73]/40 bg-gray-50"
              value={(d.fb_post_url as string) || ""}
              onChange={(e) => setDraft({ ...draft, fb_post_url: e.target.value })}
              placeholder="https://www.facebook.com/.../posts/..."
            />
          </div>
        </div>
      ) : (
        <>
          {/* Hashtags */}
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-2">
            {(c.hashtags as string[] || []).map((h: string) => (
              <span key={h} className="text-[10px] text-[#377D73]">#{h.replace("#", "")}</span>
            ))}
          </div>

          {/* Tracking link FB — hiển thị trong nội dung */}
          {fbLinks.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2 bg-[#377D73]/5 rounded px-2 py-1.5">
              <span className="text-[9px] text-[#377D73] uppercase tracking-wide font-semibold shrink-0">Link đích</span>
              <a
                href={`${baseUrl}/r/${fbLinks[0].short_code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#377D73] hover:underline truncate flex items-center gap-1"
              >
                {baseUrl}/r/{fbLinks[0].short_code}
                <ExternalLink size={9} />
              </a>
              <span className="ml-auto text-[9px] text-gray-400 shrink-0">{fbLinks[0].name}</span>
            </div>
          )}

          {/* fb_post_url — link bài đăng thực tế */}
          {(c.fb_post_url as string) ? (
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2 bg-gray-50 rounded px-2 py-1.5">
              <span className="text-[9px] text-gray-500 uppercase tracking-wide font-semibold shrink-0">Bài đăng FB</span>
              <a
                href={(c.fb_post_url as string)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-blue-600 hover:underline truncate flex items-center gap-1"
              >
                {(c.fb_post_url as string)}
                <ExternalLink size={9} />
              </a>
            </div>
          ) : null}

          {/* CTA URL */}
          {(c.cta_url as string) && !fbLinks.length ? (
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
              <span className="text-[9px] text-gray-400 uppercase tracking-wide font-medium shrink-0">Link</span>
              <a
                href={(c.cta_url as string)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-blue-600 hover:underline truncate flex items-center gap-1"
              >
                {(c.cta_url as string)}
                <ExternalLink size={9} />
              </a>
            </div>
          ) : null}

          {/* Ảnh đính kèm */}
          {Array.isArray(c.images) && (c.images as string[]).length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-[9px] text-gray-400 uppercase tracking-wide font-medium mb-1.5">Ảnh đính kèm</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(c.images as string[]).map((url, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Ảnh ${idx + 1}`}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => window.open(url, "_blank")}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <span className="text-white opacity-0 group-hover:opacity-100 text-[9px] font-medium transition-opacity">Xem</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
