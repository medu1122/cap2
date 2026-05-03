"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Sparkles, BarChart3, X } from "lucide-react";
import CampaignAssistantModal from "./CampaignAssistantModal";

interface AIToolsMenuProps {
  className?: string;
  buttonClassName?: string;
}

export default function AIToolsMenu({ className = "", buttonClassName = "" }: AIToolsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const tools = [
    {
      id: "suggestion",
      icon: Sparkles,
      label: "Gợi ý chiến dịch",
      sublabel: "AI tạo ý tưởng mới",
      color: "from-blue-500 to-purple-500",
      onClick: () => {
        setIsOpen(false);
        setShowAssistant(true);
      },
    },
    {
      id: "analytics",
      icon: BarChart3,
      label: "Phân tích chiến dịch",
      sublabel: "Xem kết quả & ROI",
      color: "from-teal-500 to-emerald-500",
      href: "/campaigns/analytics",
      onClick: undefined,
    },
  ];

  return (
    <>
      <div ref={menuRef} className={`relative inline-block ${className}`}>
        {/* Main Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors ${buttonClassName}`}
        >
          <div className="flex -space-x-1">
            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Sparkles size={10} className="text-white" />
            </span>
            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center">
              <BarChart3 size={10} className="text-white" />
            </span>
          </div>
          <span className="text-sm font-medium text-gray-700">AI Tools</span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu - Windows Desktop Style */}
        {isOpen && (
          <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="px-2 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
              Công cụ AI
            </div>

            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  onClick={() => {
                    setIsOpen(false);
                    if (tool.onClick) tool.onClick();
                  }}
                  className="w-full group"
                >
                  <Link href={tool.href || "#"} className="block">
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div
                        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow`}
                      >
                        <Icon size={18} className="text-white" />
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 group-hover:text-gray-900">
                          {tool.label}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{tool.sublabel}</p>
                      </div>
                    </div>
                  </Link>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Campaign Assistant Modal */}
      {showAssistant && (
        <CampaignAssistantModal onClose={() => setShowAssistant(false)} />
      )}
    </>
  );
}
