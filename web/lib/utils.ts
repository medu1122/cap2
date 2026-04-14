import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_LABELS: Record<string, string> = {
  pending_agent: "Đang chờ",
  running: "Đang chạy",
  pending_approval: "Chờ duyệt",
  approved: "Đã duyệt",
  partially_approved: "Duyệt một phần",
  failed: "Thất bại",
  draft: "Nháp",
  rejected: "Từ chối",
};

export const STATUS_COLORS: Record<string, string> = {
  pending_agent: "bg-gray-100 text-gray-600",
  running: "bg-blue-100 text-blue-700",
  pending_approval: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  partially_approved: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
  draft: "bg-gray-100 text-gray-500",
  rejected: "bg-red-100 text-red-600",
};

export const CHANNEL_LABELS: Record<string, string> = {
  facebook_post: "Facebook Post",
  email: "Email",
  video_script: "Video Script",
};

export const CHANNEL_COLORS: Record<string, string> = {
  facebook_post: "bg-blue-700",
  email: "bg-violet-600",
  video_script: "bg-amber-700",
};

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}
