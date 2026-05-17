"use client";
import Image from "next/image";

/** Custom icon map – PNG files from /public/images/icons/ */
export const CUSTOM_ICON_PATHS: Record<string, string> = {
  "campaign-announcement": "/images/icons/announcement-campaign.png",
  "campaign-clock":        "/images/icons/clock-campaign.png",
  "campaign-document":     "/images/icons/document-campaign.png",
  "campaign-email":       "/images/icons/email-campaign.png",
  "campaign-facebook":    "/images/icons/facebook-campaign.png",
  "campaign-gift":        "/images/icons/gift-campaign.png",
  "campaign-image":       "/images/icons/image-campaign.png",
  "campaign-target":      "/images/icons/target-campaign.png",
};

interface CustomIconProps {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}

/**
 * Renders a custom PNG icon, tinted via CSS filter.
 * Falls back gracefully (renders nothing) if the icon is not in the map.
 */
export default function CustomIcon({ name, size = 15, className = "", style, alt }: CustomIconProps) {
  const src = CUSTOM_ICON_PATHS[name];
  if (!src) return null;

  return (
    <Image
      src={src}
      alt={alt ?? name}
      width={size}
      height={size}
      className={className}
      style={{ filter: "brightness(0) saturate(100%)", objectFit: "contain", ...style }}
      unoptimized
    />
  );
}
