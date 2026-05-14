"use client";
import { useState, useEffect } from "react";
import { X, Link2, Plus, Trash2, Copy, Check, CheckCircle2, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";

interface TrackingLinkInput {
  name: string;
  destination_url: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (links: TrackingLinkInput[]) => void;
  onSkip: () => void;
  existingLinks?: TrackingLinkInput[];
}

export default function TrackingLinksModal({
  isOpen,
  onClose,
  onConfirm,
  onSkip,
  existingLinks = [],
}: Props) {
  const [links, setLinks] = useState<TrackingLinkInput[]>(existingLinks);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", destination_url: "" });
  const [formError, setFormError] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [createdLinks, setCreatedLinks] = useState<{ short_code: string; name: string }[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setLinks(existingLinks);
      setShowForm(existingLinks.length > 0);
      setCreatedLinks([]);
      setFormError("");
    }
  }, [isOpen, existingLinks]);

  function addLink() {
    if (!form.name.trim() || !form.destination_url.trim()) {
      setFormError("Nhập đầy đủ tên và URL đích");
      return;
    }
    if (!form.destination_url.startsWith("http")) {
      setFormError("URL phải bắt đầu bằng http:// hoặc https://");
      return;
    }
    setFormError("");
    setLinks([...links, { name: form.name.trim(), destination_url: form.destination_url.trim() }]);
    setForm({ name: "", destination_url: "" });
  }

  function removeLink(index: number) {
    setLinks(links.filter((_, i) => i !== index));
  }

  function handleSkip() {
    setLinks([]);
    onSkip();
    onClose();
  }

  function handleConfirm() {
    onConfirm(links);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleSkip} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Link2 size={14} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Theo dõi hiệu quả chiến dịch</h2>
            </div>
          </div>
          <button onClick={handleSkip} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="text-center space-y-1">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
              <CheckCircle2 size={20} className="text-blue-500" />
            </div>
            <p className="text-sm text-gray-700">
              Bạn có muốn bổ sung <strong>link trung gian</strong> để theo dõi hiệu quả chiến dịch?
            </p>
            <p className="text-xs text-gray-500">
              Hệ thống sẽ tự tạo link riêng cho email và bài đăng Facebook để đo lường clicks.
            </p>
          </div>

          {links.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500">Link đã thêm:</p>
              {links.map((link, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                  <Link2 size={12} className="text-[#377D73] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{link.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{link.destination_url}</p>
                  </div>
                  <button onClick={() => removeLink(i)} className="p-1 text-gray-300 hover:text-red-500 shrink-0">
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showForm && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Thêm link mới:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Tên link (VD: Trang đặt hàng)"
                  className="input text-xs flex-1"
                />
                <input
                  type="url"
                  value={form.destination_url}
                  onChange={(e) => setForm({ ...form, destination_url: e.target.value })}
                  placeholder="https://yoursite.com"
                  className="input text-xs flex-[2]"
                />
                <button
                  type="button"
                  onClick={addLink}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shrink-0 flex items-center gap-1"
                >
                  <Plus size={10} /> Thêm
                </button>
              </div>
              {formError && <p className="text-[10px] text-red-500">{formError}</p>}
            </div>
          )}

          {createdLinks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500">Tracking links đã tạo:</p>
              {createdLinks.map((link) => (
                <div key={link.short_code} className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                  <Link2 size={12} className="text-green-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800">{link.name}</p>
                    <p className="text-[10px] text-gray-400 font-mono truncate">
                      {typeof window !== "undefined" ? window.location.origin : ""}/r/{link.short_code}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/r/${link.short_code}`;
                      navigator.clipboard.writeText(url);
                      setCopiedCode(link.short_code);
                      setTimeout(() => setCopiedCode(null), 1500);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-white bg-green-600 rounded-md hover:bg-green-700 shrink-0"
                  >
                    {copiedCode === link.short_code ? <Check size={8} /> : <Copy size={8} />}
                    {copiedCode === link.short_code ? "Đã copy" : "Copy"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {!showForm && links.length === 0 && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-blue-200 bg-blue-50 text-blue-600 text-xs font-medium rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Plus size={12} />
              Thêm link để theo dõi
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
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
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            {links.length > 0 ? (
              <>
                <CheckCircle2 size={14} />
                Xác nhận ({links.length} link)
              </>
            ) : (
              "Tiếp tục"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
