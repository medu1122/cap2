"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { STATUS_COLORS, STATUS_LABELS, CHANNEL_LABELS, formatDate, cn } from "@/lib/utils";

interface ContentItem {
  id: string;
  campaign_id: string;
  channel: string;
  status: string;
  content_json: Record<string, unknown>;
  scheduled_date: string | null;
  created_at: string;
}

export default function ApprovePage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  function load() {
    api.get<ContentItem[]>("/content?status=pending_approval")
      .then(setItems)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function approve(id: string) {
    setProcessing(id);
    await api.patch(`/content/${id}/approve`).catch(() => {});
    load();
    setProcessing(null);
  }

  async function reject(id: string) {
    const note = rejectNote[id] || "";
    if (!note) return;
    setProcessing(id);
    await api.patch(`/content/${id}/reject`, { rejection_note: note }).catch(() => {});
    load();
    setProcessing(null);
  }

  function previewText(item: ContentItem): string {
    const c = item.content_json;
    return (c.copy || c.subject || c.hook || "") as string;
  }

  return (
    <div className="p-6 max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1>Approval Queue</h1>
          <p className="text-sm text-gray-500 mt-1">{items.length} nội dung chờ duyệt</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16" />)}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-400">
          Không có nội dung nào chờ duyệt.{" "}
          <Link href="/campaigns" className="text-blue-600 hover:underline">Xem chiến dịch →</Link>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-md overflow-hidden">
          {items.map((item, i) => (
            <div key={item.id} className={cn("p-4 space-y-3", i !== 0 && "border-t border-gray-100")}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge bg-gray-100 text-gray-600">{CHANNEL_LABELS[item.channel]}</span>
                    <span className={cn("badge", STATUS_COLORS[item.status])}>{STATUS_LABELS[item.status]}</span>
                    {item.scheduled_date && <span className="text-xs text-gray-400">{formatDate(item.scheduled_date)}</span>}
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-2">{previewText(item)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link href={`/campaigns/${item.campaign_id}`} className="btn-secondary text-xs py-1 px-3">Xem →</Link>
                  <button
                    onClick={() => approve(item.id)}
                    disabled={processing === item.id}
                    className="btn-primary text-xs py-1 px-3"
                  >
                    Duyệt
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  className="input text-sm py-1"
                  placeholder="Lý do từ chối..."
                  value={rejectNote[item.id] || ""}
                  onChange={(e) => setRejectNote((r) => ({ ...r, [item.id]: e.target.value }))}
                />
                <button
                  onClick={() => reject(item.id)}
                  disabled={!rejectNote[item.id] || processing === item.id}
                  className="btn-danger text-xs py-1 px-3 shrink-0"
                >
                  Từ chối
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
