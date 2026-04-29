"use client";
import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import CampaignAssistantModal from "./CampaignAssistantModal";

export default function CampaignAssistantButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-full shadow-lg shadow-blue-600/30 transition-all hover:scale-105 active:scale-100"
        title="Gợi ý chiến dịch AI"
      >
        <Sparkles size={18} className="text-yellow-300" />
        <span className="font-medium text-sm">Gợi ý chiến dịch AI</span>
      </button>

      {isOpen && <CampaignAssistantModal onClose={() => setIsOpen(false)} />}
    </>
  );
}
