"use client";
import { useState, useEffect } from "react";
import { X, Link2, Plus, Trash2, Copy, Check, CheckCircle2, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";

interface CreatedLinkInfo {
  short_code: string;
  name: string;
  link_type: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (urls: string[]) => void;
  onSkip: () => void;
}

export default function TrackingLinksModal({
  isOpen,
  onClose,
  onConfirm,
  onSkip,
}: Props) {
  const [urls, setUrls] = useState<string[]>([]);
  const [currentUrl, setCurrentUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUrls([]);
      setCurrentUrl("");
      setUrlError("");
    }
  }, [isOpen]);

  function addUrl() {
    const trimmed = currentUrl.trim();
    if (!trimmed) {
      setUrlError("Nhập URL");
      return;
    }
    if (!trimmed.startsWith("http")) {
      setUrlError("URL phải bắt đầu bằng http:// hoặc https://");
      return;
    }
    if (urls.includes(trimmed)) {
      setUrlError("URL này đã thêm");
      return;
    }
    setUrls([...urls, trimmed]);
    setCurrentUrl("");
    setUrlError("");
  }

  function removeUrl(index: number) {
    setUrls(urls.filter((_, i) => i !== index));
  }

  function copyLink(shortCode: string) {
    const url = `${window.location.origin}/r/${shortCode}`;
    navigator.clipboard.writeText(url);
    setCopied(shortCode);
    setTimeout(() => setCopied(null), 1500);
  }

  function handleConfirm() {
    onConfirm(urls);
    onClose();
  }

  function handleSkip() {
    onSkip();
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleSkip} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Link2 size={14} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Tạo link theo dõi</h2>
              <p className="text-[10px] text-gray-500">Tự động tạo link cho email và Facebook</p>
            </div>
          </div>
          <button onClick={handleSkip} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">

          {/* Mô tả */}
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-xs text-gray-700">
              Nhập <strong>link đích</strong> của bạn (trang web, landing page...). Hệ thống sẽ tự tạo <strong>link trung gian</strong> cho cả <strong>email</strong> và <strong>Facebook</strong> để đo lường hiệu quả.
            </p>
          </div>

          {/* Danh sách URL đã thêm */}
          {urls.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">Link đích đã thêm</p>
              {urls.map((url, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                  <span className="text-[10px] text-gray-400 font-mono shrink-0">#{i + 1}</span>
                  <p className="text-[11px] text-gray-700 truncate flex-1">{url}</p>
                  <button
                    onClick={() => removeUrl(i)}
                    className="p-1 text-gray-300 hover:text-red-500 shrink-0 transition-colors"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Form thêm URL */}
          <div className="space-y-2">
            <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">Thêm link đích</p>
            <div className="flex gap-2">
              <input
                type="url"
                value={currentUrl}
                onChange={(e) => { setCurrentUrl(e.target.value); setUrlError(""); }}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUrl())}
                placeholder="https://yoursite.com/landing"
                className="input text-[12px] flex-1"
              />
              <button
                type="button"
                onClick={addUrl}
                className="px-3 py-1.5 text-xs font-medium text-white bg-[#377D73] rounded-lg hover:bg-[#2d635c] shrink-0 flex items-center gap-1 transition-colors"
              >
                <Plus size={10} /> Thêm
              </button>
            </div>
            {urlError && (
              <p className="text-[10px] text-red-500">{urlError}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end shrink-0">
          <button
            type="button"
            onClick={handleSkip}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Bỏ qua
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-[#377D73] rounded-lg hover:bg-[#2d635c] transition-colors flex items-center gap-2"
          >
            {urls.length > 0 ? (
              <><CheckCircle2 size={14} /> Tạo {urls.length} link</>
            ) : "Tiếp tục"}
          </button>
        </div>
      </div>
    </div>
  );
}
