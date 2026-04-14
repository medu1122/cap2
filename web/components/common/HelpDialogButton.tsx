"use client";
import { useState } from "react";

interface HelpDialogButtonProps {
  title: string;
  summary: string;
  steps: string[];
  tips?: string[];
  buttonLabel?: string;
  buttonClassName?: string;
}

export default function HelpDialogButton({
  title,
  summary,
  steps,
  tips = [],
  buttonLabel = "Hướng dẫn",
  buttonClassName = "btn-secondary text-sm",
}: HelpDialogButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={buttonClassName} onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h2>{title}</h2>
              <button type="button" className="btn-secondary text-xs py-1" onClick={() => setOpen(false)}>
                Đóng
              </button>
            </div>
            <p className="text-sm text-gray-700">{summary}</p>
            <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-1">
              {steps.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
            {tips.length > 0 && (
              <div className="rounded-md bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Mẹo nhanh</p>
                <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                  {tips.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
