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
  campaignImages?: string[];
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
  campaignImages = [],
}: Props) {
  const [fbLinks, setFbLinks] = useState<TrackingLink[]>([]);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

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
                className="text-[11px] text-[#377D73] hover:underline flex items-center gap-1 break-all"
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
                className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 break-all"
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
                className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 break-all"
              >
                {(c.cta_url as string)}
                <ExternalLink size={9} />
              </a>
            </div>
          ) : null}

          {/* Ảnh đính kèm - style Facebook thật */}
          {campaignImages.length > 0 && !editing && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              {campaignImages.length === 1 && (
                <div
                  className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50 cursor-pointer group"
                  onClick={() => setLightboxImg(campaignImages[0])}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={campaignImages[0]} alt="Hình ảnh chiến dịch"
                    className="w-full object-cover bg-gray-100"
                    style={{ maxHeight: 320 }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </div>
              )}
              {campaignImages.length === 2 && (
                <div className="grid grid-cols-2 gap-0.5 rounded-lg overflow-hidden border border-gray-200">
                  {campaignImages.map((url, idx) => (
                    <div key={idx} className="relative cursor-pointer group" onClick={() => setLightboxImg(url)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Ảnh ${idx + 1}`} className="w-full object-cover bg-gray-100"
                        style={{ height: 200 }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </div>
                  ))}
                </div>
              )}
              {campaignImages.length >= 3 && (
                <div className="grid grid-cols-3 gap-0.5 rounded-lg overflow-hidden border border-gray-200">
                  {campaignImages.slice(0, 3).map((url, idx) => (
                    <div key={idx} className="relative cursor-pointer group"
                      style={{ height: idx === 0 ? 200 : 100, gridRow: idx === 0 ? "span 2" : "span 1" }}
                      onClick={() => setLightboxImg(url)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover bg-gray-100"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      {idx === 2 && campaignImages.length > 3 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-white font-bold text-lg">+{campaignImages.length - 3}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {lightboxImg && (
                <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4"
                  onClick={() => setLightboxImg(null)}>
                  <button className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full"
                    onClick={() => setLightboxImg(null)}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={lightboxImg} alt="Xem ảnh"
                    className="max-w-full max-h-full object-contain rounded-lg"
                    onClick={(e) => e.stopPropagation()} />
                </div>
              )}
            </div>
          )}

          {/* Ảnh từ content (legacy) */}
          {campaignImages.length === 0 && Array.isArray(c.images) && (c.images as string[]).length > 0 && !editing && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="grid grid-cols-3 gap-1.5">
                {(c.images as string[]).map((url, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setLightboxImg(url)} />
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
