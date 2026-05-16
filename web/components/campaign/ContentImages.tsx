"use client";
import { useRef, useState } from "react";
import { ImagePlus, X, Loader2, Trash2 } from "lucide-react";
import { API_BASE } from "@/lib/api-client";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("aimap_token");
}

interface Props {
  contentId: string;
  images: string[];
}

export default function ContentImages({ contentId, images }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localImages, setLocalImages] = useState<string[]>(images);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const token = getToken();
        const res = await fetch(`${API_BASE}/content/${contentId}/images`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const data = await res.json();
        setLocalImages(data.images || []);
      }
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDeleteAll() {
    if (!confirm("Xóa tất cả ảnh của mục này?")) return;
    setDeleting(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/content/${contentId}/images`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      setLocalImages([]);
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setDeleting(false);
    }
  }

  if (localImages.length === 0) {
    return (
      <div className="mt-2">
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-[#377D73] hover:text-[#377D73] transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 size={10} className="animate-spin" /> : <ImagePlus size={10} />}
          Thêm ảnh
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />

      {/* Grid ảnh */}
      <div className="grid grid-cols-3 gap-1.5">
        {localImages.map((url, idx) => (
          <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50 cursor-pointer"
            onClick={() => setLightbox(url)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <span className="text-white opacity-0 group-hover:opacity-100 text-[9px] font-medium transition-opacity">Xem</span>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="aspect-square rounded-lg border border-dashed border-gray-300 bg-gray-50 hover:border-[#377D73] hover:bg-[#377D73]/5 transition-colors flex items-center justify-center disabled:opacity-50" title="Thêm ảnh">
          {uploading ? <Loader2 size={14} className="animate-spin text-gray-400" /> : <ImagePlus size={14} className="text-gray-400" />}
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={handleDeleteAll} disabled={deleting}
          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50">
          {deleting ? <Loader2 size={8} className="animate-spin" /> : <Trash2 size={8} />}
          Xóa ảnh
        </button>
        <span className="text-[9px] text-gray-400">{localImages.length} ảnh</span>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors" onClick={() => setLightbox(null)}>
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Xem ảnh" className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
