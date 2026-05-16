"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { Link2 } from "lucide-react";

interface TrackingLink {
  id: string;
  destination_url: string;
  link_type: string;
}

interface Props {
  campaignId: string;
}

export default function TrackingLinksManager({ campaignId }: Props) {
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<TrackingLink[]>(`/campaigns/${campaignId}/tracking-links`)
      .then(setLinks)
      .catch(() => setLinks([]))
      .finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) {
    return <div className="text-[11px] text-gray-400 py-2">Đang tải...</div>;
  }

  if (links.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      {links.map((link) => (
        <div key={link.id} className="flex items-center gap-2 text-[11px] bg-white border border-gray-100 rounded-lg px-3 py-2">
          <Link2 size={10} className="text-[#377D73] shrink-0" />
          <p className="text-gray-600 truncate flex-1">{link.destination_url}</p>
        </div>
      ))}
    </div>
  );
}
